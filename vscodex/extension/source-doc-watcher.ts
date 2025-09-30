import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execFile } from 'child_process';
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

      await this.runSrcdoc(doFullScan ? undefined : { changed, deleted, reason });

      this.firstFullRunDone = true;
      this.lastRun = Date.now();
    } finally {
      this.running = false;
    }
  }

  // --- Running the CLI + posting results ------------------------------------

  private async runSrcdoc(delta?: { changed: string[]; deleted: string[]; reason?: string }) {
    const modelPath = this.modelUri!.fsPath;
    const outPath = this.outUri!.fsPath;
    const srcdocPath = path.join(__dirname, '../srcdoc/vmblu-srcdoc.cjs');

    const args = [modelPath, '--out', outPath];

    if (delta) {
      // Pass changed/deleted lists. For large batches, use a temp file to avoid arg length limits.
      const largeBatch = delta.changed.length + delta.deleted.length > 200;
      if (largeBatch) {
        const tmpList = path.join(os.tmpdir(), `srcdoc-delta-${Date.now()}.json`);
        await fs.writeFile(tmpList, JSON.stringify(delta), 'utf8');
        args.push('--delta-file', tmpList);
      } else {
        if (delta.changed.length) args.push('--changed', ...delta.changed);
        if (delta.deleted.length) args.push('--deleted', ...delta.deleted);
      }
      if (delta.reason) args.push('--reason', delta.reason);
    } else {
      args.push('--full');
    }

    await new Promise<void>((resolve) => {
      execFile('node', [srcdocPath, ...args], async (error, stdout, stderr) => {
        if (error) {
          console.error('srcdoc error:', error);
          resolve(); // don’t throw; keep watcher alive
          return;
        }
        if (stderr) console.warn('srcdoc stderr:', stderr);
        try {
          const jsonText = await fs.readFile(outPath, 'utf8');
          const sourceMap = JSON.parse(jsonText);
          this.customerAction(sourceMap);
        } catch (err) {
          console.error('Failed to read srcdoc output:', err);
        }
        resolve();
      });
    });
  }
}
