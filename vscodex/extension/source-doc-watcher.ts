import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile, ExecFileOptions } from 'child_process';
import { debounce } from './util';
import * as os from 'os';

type Arl = { url: string };
type someAction = (data: any) => void;

export class SourceDocWatcher {
  private modelUri: vscode.Uri | null = null;
  private outUri: vscode.Uri;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private customerAction: someAction;

  // NEW: incremental state
  private pendingChanged = new Set<string>();
  private pendingDeleted = new Set<string>();
  private running = false;
  private lastRun = 0;
  private firstFullRunDone = false;
  private vmbluExecutable: string | null = null;
  private vmbluExecutableSource: 'local' | 'path' | 'script' = 'path'; // remembers how we resolved the CLI
  private vmbluPreArgs: string[] = []; // optional prefix args (e.g., ['<script>']) when we fall back to node
  private vmbluMissingNotified = false; // avoids spamming the user with duplicate "install CLI" messages

  // tune to taste
  private static readonly DEBOUNCE_MS = 500;
  private static readonly MIN_INTERVAL_MS = 10_000;

  constructor(outUri: vscode.Uri, customerAction: someAction) {
    this.customerAction = customerAction;
    this.outUri = outUri;
  }

  setModelFile(modelArl: Arl) {
    this.modelUri = vscode.Uri.parse(modelArl.url);
    // Kick a run when the model changes/loads
    this.requestScan('model-set');
  }

  start() {
    this.stop();

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
    const norm = p.replace(/\\/g, '/');
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

      if (result.stderr) console.warn('vmblu profile stderr:', result.stderr);
      try {
        const jsonText = await fs.readFile(outPath, 'utf8');
        const sourceMap = JSON.parse(jsonText);
        this.customerAction(sourceMap);
      } catch (err) {
        console.error('Failed to read vmblu profile output:', err);
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
    // Reuse any previously resolved local shim or script-based fallback.
    if (this.vmbluExecutable && (this.vmbluExecutableSource === 'local' || this.vmbluExecutableSource === 'script')) {
      return this.vmbluExecutable;
    }

    const binNames = process.platform === 'win32' ? ['vmblu.cmd', 'vmblu.exe', 'vmblu'] : ['vmblu'];
    this.vmbluExecutable = null;
    this.vmbluPreArgs = [];
    const searchRoots = this.collectVmbluSearchRoots(); // search close to the workspace first

    for (const root of searchRoots) {
      const binDir = path.join(root, 'node_modules', '.bin');
      for (const name of binNames) {
        const candidate = path.join(binDir, name);
        try {
          await fs.access(candidate);
          this.vmbluExecutable = candidate;
          this.vmbluExecutableSource = 'local';
          this.vmbluMissingNotified = false;
          return candidate;
        } catch {
          // continue search
        }
      }
    }

    const script = await this.findVmbluCliScript(searchRoots);
    if (script) {
      this.vmbluExecutable = process.execPath;
      this.vmbluPreArgs = [script];
      this.vmbluExecutableSource = 'script';
      this.vmbluMissingNotified = false;
      return this.vmbluExecutable;
    }

    this.vmbluExecutable = binNames[0];
    this.vmbluExecutableSource = 'path';
    return this.vmbluExecutable;
  }

  // ensure we reuse the same argument set across retries
  private async runVmbluSafely(baseArgs: string[], options: ExecFileOptions): Promise<{ stderr?: string } | null> {
    try {
      return await this.runVmbluWithCurrentResolution(baseArgs, options);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException & { stderr?: string };
      if (nodeErr?.code === 'EINVAL' && this.vmbluExecutableSource !== 'script') { 
        
        // Windows occasionally reports EINVAL when launching shims; fall back to running the script via node
        const fallbackApplied = await this.applyScriptFallback();
        if (fallbackApplied) {
          try {
            return await this.runVmbluWithCurrentResolution(baseArgs, options);
          } catch (fallbackError) {
            this.logVmbluFailure(fallbackError as NodeJS.ErrnoException & { stderr?: string });
            return null;
          }
        }
      }

      this.logVmbluFailure(nodeErr);
      return null;
    }
  }

  // execute using whatever command/preArgs resolution currently active
  private async runVmbluWithCurrentResolution(baseArgs: string[], options: ExecFileOptions): Promise<{ stderr?: string }> {
    const vmbluBin = await this.resolveVmbluExecutable();
    const spawnArgs = this.vmbluPreArgs.length ? [...this.vmbluPreArgs, ...baseArgs] : [...baseArgs];
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
    if (error?.stderr) console.error('vmblu profile stderr:', error.stderr);
    console.error('vmblu profile error:', error);
  }

  private collectVmbluSearchRoots(): Set<string> { 
    
    // gather candidate roots near the workspace for node_modules lookups
    const searchRoots = new Set<string>();
    const normalize = (p: string) => path.resolve(p);

    const modelFolder = this.modelUri ? vscode.workspace.getWorkspaceFolder(this.modelUri) : undefined;
    if (modelFolder) searchRoots.add(normalize(modelFolder.uri.fsPath));
    if (this.modelUri) searchRoots.add(normalize(path.dirname(this.modelUri.fsPath)));

    const outFolder = vscode.workspace.getWorkspaceFolder(this.outUri);
    if (outFolder) searchRoots.add(normalize(outFolder.uri.fsPath));
    searchRoots.add(normalize(path.dirname(this.outUri.fsPath)));

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      searchRoots.add(normalize(folder.uri.fsPath));
    }

    searchRoots.add(normalize(path.join(__dirname, '..', '..')));
    searchRoots.add(normalize(path.join(__dirname, '..', '..', '..')));

    return searchRoots;
  }

  private async findVmbluCliScript(roots: Iterable<string>): Promise<string | null> { 
    
    // search upward for a checked-in CLI (e.g., in monorepo builds)
    const candidates = new Set<string>();

    for (const root of roots) {
      let current = path.resolve(root);
      for (let depth = 0; depth < 4; depth += 1) {
        candidates.add(current);
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    }

    for (const dir of candidates) {
      const scriptPath = path.join(dir, 'cli', 'bin', 'vmblu.js');
      try {
        await fs.access(scriptPath);
        return scriptPath;
      } catch {
        // continue
      }
    }

    return null;
  }

  private async applyScriptFallback(): Promise<boolean> { 
    
    // last-resort: invoke vmblu.js through Node when shims fail
    const script = await this.findVmbluCliScript(this.collectVmbluSearchRoots());
    if (!script) return false;
    this.vmbluExecutable = process.execPath;
    this.vmbluPreArgs = [script];
    this.vmbluExecutableSource = 'script';
    this.vmbluMissingNotified = false;
    return true;
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

