import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile, ExecFileOptions } from 'child_process';
import { debounce, cout } from './util';
import * as os from 'os';

type Arl = { url: string };
type someAction = (data: any) => void;

function normalizeSeparators(value: string): string {
  return value.replace(/\\/g, '/');
}

export class SourceDocWatcher {
  private modelUri: vscode.Uri | null = null;
  private outUri: vscode.Uri;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private customerAction: someAction;
  private started = false;

  // NEW: incremental state
  private pendingChanged = new Set<string>();
  private pendingDeleted = new Set<string>();
  private running = false;
  private lastRun = 0;
  private firstFullRunDone = false;
  private vmbluExecutable: string | null = null;
  private vmbluExecutableSource: 'local' | 'path' = 'path'; // remembers how we resolved the CLI
  private vmbluPreArgs: string[] = []; // optional prefix args (unused without fallbacks)
  private vmbluMissingNotified = false; // avoids spamming the user with duplicate "install CLI" messages
  private vmbluExecutableRootsKey: string | null = null; // cache signature for search roots used to resolve CLI

  // tune to taste
  private static readonly DEBOUNCE_MS = 500;
  private static readonly MIN_INTERVAL_MS = 10_000;

  constructor(outUri: vscode.Uri, customerAction: someAction) {
    this.customerAction = customerAction;
    this.outUri = outUri;
    //cout(`[SourceDocWatcher] Initialized with outUri=${outUri.toString()}`);
  }

  setModelFile(modelArl: Arl) {
    this.modelUri = vscode.Uri.parse(modelArl.url);
    //cout(`[SourceDocWatcher] Model set to ${this.modelUri.toString()}`);
    // Kick a run when the model changes/loads
    this.requestScan('model-set');
  }

  start() {
    this.stop();
    this.started = true;

    // Watch only JS/TS; adjust if you also emit JSX/TSX
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts}');

    // Debounced trigger hooked to FS events
    const trigger = debounce((reason?: string) => this.maybeRun(reason ?? 'fs-event'), SourceDocWatcher.DEBOUNCE_MS);

    // Collect deltas + trigger
    this.fileWatcher.onDidChange(uri => this.onFsChange(uri, 'change', trigger), this, this.disposables);
    this.fileWatcher.onDidCreate(uri => this.onFsChange(uri, 'create', trigger), this, this.disposables);
    this.fileWatcher.onDidDelete(uri => this.onFsChange(uri, 'delete', trigger), this, this.disposables);

    this.disposables.push(this.fileWatcher);

    // Optional: initial full run at startup
    this.requestScan('start');
  }

  stop() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.fileWatcher = null;
    this.started = false;
  }

  dispose() { this.stop(); }

  // --- FS event handling -----------------------------------------------------

  private onFsChange(uri: vscode.Uri, kind: 'change'|'create'|'delete', trigger: (reason?: string)=>void) {
    const p = uri.fsPath;
    if (this.isIgnored(p)) return;

    if (kind === 'delete') {
      // If deleted, ensure it's not also marked as changed
      this.pendingChanged.delete(p);
      this.pendingDeleted.add(p);
    } else {
      // Created/changed
      this.pendingDeleted.delete(p);
      this.pendingChanged.add(p);
    }
    trigger(kind);
  }


  private isIgnored(p: string): boolean {
    const norm = normalizeSeparators(p);
    return (
      norm.includes('/node_modules/') ||
      norm.includes('/.git/') ||
      norm.includes('/.vscode/') ||
      norm.includes('/dist/') ||
      norm.includes('/build/') ||
      norm.includes('/out/')
    );
  }

  // --- Orchestration ---------------------------------------------------------

  private requestScan(reason: string) {
    const trigger = debounce(() => this.maybeRun(reason), SourceDocWatcher.DEBOUNCE_MS);
    trigger();
  }

  private async maybeRun(reason: string) {
    if (!this.modelUri || !this.outUri) return;
    if (this.running) return;

    const now = Date.now();
    if (now - this.lastRun < SourceDocWatcher.MIN_INTERVAL_MS) return;

    this.running = true;
    try {
      const changed = Array.from(this.pendingChanged);
      const deleted = Array.from(this.pendingDeleted);

      // Reset the accumulators so new FS events get collected for the next run
      this.pendingChanged.clear();
      this.pendingDeleted.clear();

      // Decide: full vs incremental
      const doFullScan = !this.firstFullRunDone || (changed.length === 0 && deleted.length === 0);

      await this.runProfile(doFullScan ? undefined : { changed, deleted, reason });

      this.firstFullRunDone = true;
      this.lastRun = Date.now();
    } finally {
      this.running = false;
    }
  }

  // --- Running vmblu profile + posting results ------------------------------

  private async runProfile(delta?: { changed: string[]; deleted: string[]; reason?: string }) {
    // Build the base CLI invocation; we'll reuse arguments for retries/fallbacks.
    const modelPath = this.modelUri!.fsPath;
    const outPath = this.outUri!.fsPath;
    const args = ['profile', modelPath, '--out', outPath];
    let deltaFile: string | undefined;

    if (delta) {
      // Pass changed/deleted lists. For large batches, use a temp file to avoid arg length limits.
      const largeBatch = delta.changed.length + delta.deleted.length > 200;
      if (largeBatch) {
        deltaFile = path.join(os.tmpdir(), `vmblu-profile-delta-${Date.now()}.json`);
        await fs.writeFile(deltaFile, JSON.stringify(delta), 'utf8');
        args.push('--delta-file', deltaFile);
      } else {
        if (delta.changed.length) args.push('--changed', ...delta.changed);
        if (delta.deleted.length) args.push('--deleted', ...delta.deleted);
      }
      if (delta.reason) args.push('--reason', delta.reason);
    } else {
      args.push('--full');
    }

    // Run from the workspace that owns the model so relative imports stay stable.
    const workspaceFolder = this.modelUri ? vscode.workspace.getWorkspaceFolder(this.modelUri) : undefined;
    const options: ExecFileOptions = workspaceFolder ? { cwd: workspaceFolder.uri.fsPath } : {};

    try {
      const result = await this.runVmbluSafely(args, options);
      if (!result) return;

      //if (result.stderr) console.warn('vmblu profile stderr:', result.stderr);
      if (result.stderr) cout(`vmblu profile stderr: ${result.stderr}`);
      try {
        const jsonText = await fs.readFile(outPath, 'utf8');
        const sourceMap = JSON.parse(jsonText);
        //cout(`[SourceDocWatcher] Loaded profile output (${sourceMap.entries?.length ?? 0} entries) from ${outPath}`);
        this.customerAction(sourceMap);
      } catch (err) {
        cout(`Failed to read vmblu profile output ${err}`);
      }
      this.vmbluMissingNotified = false; // successful run means future misses should notify again
    } finally {
      if (deltaFile) {
        try {
          await fs.unlink(deltaFile);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  private async resolveVmbluExecutable(): Promise<string> {
    //const binNames = process.platform === 'win32' ? ['vmblu.cmd', 'vmblu.exe', 'vmblu'] : ['vmblu'];
    const binNames = process.platform === 'win32' ? ['vmblu.cmd'] : ['vmblu'];
    const searchRoots = this.collectVmbluSearchRoots(); // search close to the workspace first
    const rootsKey = JSON.stringify(Array.from(searchRoots).sort());
    //cout(`[SourceDocWatcher] Resolving vmblu CLI. Search roots: ${searchRoots.join(' | ')}`);

    if (
      this.vmbluExecutable &&
      this.vmbluExecutableSource === 'local' &&
      this.vmbluExecutableRootsKey === rootsKey &&
      (await this.pathExists(this.vmbluExecutable))
    ) {
      return this.vmbluExecutable;
    }

    this.vmbluExecutable = null;
    this.vmbluPreArgs = [];

    for (const root of searchRoots) {
      const binDir = path.join(root, 'node_modules', '.bin');
      for (const name of binNames) {
        const candidate = path.join(binDir, name);
        try {
          await fs.access(candidate);
          this.vmbluExecutable = candidate;
          this.vmbluExecutableSource = 'local';
          this.vmbluMissingNotified = false;
          this.vmbluExecutableRootsKey = rootsKey;
          cout(`[SourceDocWatcher] Using vmblu CLI at ${candidate}`);
          return candidate;
        } catch {
          //cout(`[SourceDocWatcher] No CLI at ${candidate}`);
          // continue search
        }
      }
    }

    this.vmbluExecutable = binNames[0];
    this.vmbluExecutableSource = 'path';
    this.vmbluExecutableRootsKey = rootsKey;
    cout(`[SourceDocWatcher] Using vmblu CLI from PATH: ${this.vmbluExecutable}`);
    return this.vmbluExecutable;
  }

  // ensure we reuse the same argument set across retries
  private async runVmbluSafely(baseArgs: string[], options: ExecFileOptions): Promise<{ stderr?: string } | null> {
    try {
      return await this.runVmbluWithCurrentResolution(baseArgs, options);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException & { stderr?: string };
      this.logVmbluFailure(nodeErr);
      return null;
    }
  }

  // execute using whatever command/preArgs resolution currently active
  private async runVmbluWithCurrentResolution(baseArgs: string[], options: ExecFileOptions): Promise<{ stderr?: string }> {
    const vmbluBin = await this.resolveVmbluExecutable();
    const spawnArgs = [...baseArgs];
    if (process.platform === 'win32' && vmbluBin.toLowerCase().endsWith('.cmd')) {
      const comspec = process.env.COMSPEC || 'cmd.exe';
      return this.execVmblu(comspec, ['/c', vmbluBin, ...spawnArgs], options);
    }
    return this.execVmblu(vmbluBin, spawnArgs, options);
  }

  // thin promise wrapper around execFile so we can reuse error handling
  private execVmblu(command: string, args: string[], options: ExecFileOptions): Promise<{ stderr?: string }> {
    return new Promise((resolve, reject) => {
      try {
        execFile(command, args, options, (error, _stdout, stderr) => {
          if (error) {
            const nodeErr = error as NodeJS.ErrnoException & { stderr?: string };
            nodeErr.stderr = stderr;
            reject(nodeErr);
            return;
          }
          resolve({ stderr: stderr || undefined });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private logVmbluFailure(error: NodeJS.ErrnoException & { stderr?: string }) {
    if (error?.code === 'ENOENT') {
      this.notifyMissingVmblu();
      return;
    }
    if (error?.stderr) cout(`vmblu profile stderr: ${error.stderr}`);
    cout(`vmblu profile error ${error}`);
  }

  private collectVmbluSearchRoots(): string[] {
    const seen = new Set<string>();
    const roots: string[] = [];
    const normalize = (p: string) => path.resolve(p);

    const addRoot = (p: string | null | undefined) => {
      if (!p) return;
      const normalized = normalize(p);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      roots.push(normalized);
    };

    const addChain = (start: string | null | undefined) => {
      if (!start) return;
      let current = normalize(start);
      while (!seen.has(current)) {
        addRoot(current);
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    };

    if (this.modelUri) {
      const modelDir = path.dirname(this.modelUri.fsPath);
      addChain(modelDir);
      const modelFolder = vscode.workspace.getWorkspaceFolder(this.modelUri);
      addChain(modelFolder?.uri.fsPath);
    }

    const outDir = path.dirname(this.outUri.fsPath);
    addChain(outDir);
    const outFolder = vscode.workspace.getWorkspaceFolder(this.outUri);
    addChain(outFolder?.uri.fsPath);

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      addChain(folder.uri.fsPath);
    }

    return roots;
  }

  private async pathExists(file: string): Promise<boolean> {
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }

  private notifyMissingVmblu() {
    if (this.vmbluMissingNotified) return;
    this.vmbluMissingNotified = true;
    this.vmbluExecutable = null; // allow re-discovery after installation
    this.vmbluExecutableSource = 'path';
    this.vmbluPreArgs = [];
    vscode.window.showErrorMessage(
      'vmblu CLI not found. Install it in your workspace with "npm install -D @vizualmodel/vmblu-cli".'
    );
  }
}

