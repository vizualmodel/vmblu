import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from './util';

type Arl = { url: string };
type modelChangedAction = () => void;

export class ModelFileWatcher {
  private modelUri: vscode.Uri | null = null;
  private modelFileWatcher: vscode.FileSystemWatcher | null = null;
  private disposables: vscode.Disposable[] = [];
  private started = false;
  private readonly modelChangedAction: modelChangedAction;
  private isLocalSave = false;

  private static readonly DEBOUNCE_MS = 500;
  constructor(modelChangedAction: modelChangedAction) {
    this.modelChangedAction = modelChangedAction;
  }

  setModelFile(modelArl: Arl) {
    this.modelUri = vscode.Uri.parse(modelArl.url);
    this.updateModelFileWatcher();
  }

  start() {
    this.stop();
    this.started = true;
    this.updateModelFileWatcher();
  }

  stop() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.modelFileWatcher = null;
    this.started = false;
    this.isLocalSave = false;
  }

  dispose() { this.stop(); }

  private updateModelFileWatcher() {
    if (!this.started || !this.modelUri) return;

    if (this.modelFileWatcher) {
      this.modelFileWatcher.dispose();
      this.modelFileWatcher = null;
    }

    const modelPattern = this.getModelWatchPattern();
    if (!modelPattern) return;

    this.modelFileWatcher = vscode.workspace.createFileSystemWatcher(modelPattern);
    const trigger = debounce(() => this.notifyModelChanged(), ModelFileWatcher.DEBOUNCE_MS);
    this.modelFileWatcher.onDidChange(() => trigger(), this, this.disposables);
    this.modelFileWatcher.onDidCreate(() => trigger(), this, this.disposables);
    this.disposables.push(this.modelFileWatcher);
  }

  private getModelWatchPattern(): vscode.GlobPattern | null {
    if (!this.modelUri) return null;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.modelUri);
    if (workspaceFolder) {
      const rel = path.relative(workspaceFolder.uri.fsPath, this.modelUri.fsPath);
      return new vscode.RelativePattern(workspaceFolder, rel);
    }

    return this.modelUri.fsPath;
  }

  // Call this function for a save that should not trigger a reload, i.e. a normal save
  setLocalSave() {
    // The next save is a local save
    this.isLocalSave = true;
  }

  // called by the ModelFileWatcher when the model has changed
  private notifyModelChanged() {

    // check
    if (!this.modelUri) return;

    // check if it is a local save (by the user or vmblu itself)
    if (!this.isLocalSave) this.modelChangedAction()

    // reset
    this.isLocalSave = false;
  }

}
