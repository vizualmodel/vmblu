import * as vscode from 'vscode';
import {cout} from './util.js';
import {parseJsonWithDuplicateKeyWarning} from './json-parse.js';

// to be removed - will be defined in View
interface SomeEdit {
	readonly label: string;
	undo(): void;
	redo(): void;
}

export const documentFlags = {
	LOGVSCODE : 0x1		// log messages to/from vscode
};

// Define the vmblu document model
export class VmbluDocument implements vscode.CustomDocument {

	private static readonly AUTOSAVE_DELAY_MS = 1000;

	public readonly uri: vscode.Uri;
	readonly backupId: string | undefined;

	// save this as we wait for a promise to resolve - we save the resolve function here
	public wait:any = {
		promise: null,
		resolve() {},
		reject() {},
	};

	// flags for the document
	public flags = 0;

	// event emitter for edits
	private readonly _didEdit = new vscode.EventEmitter<SomeEdit>;
	public readonly didEdit = this._didEdit.event;

	// the clipboard event is used to signal to all documents that something was saved to the clipboard of this document
	private readonly _onClipboard = new vscode.EventEmitter<any>();
	public readonly onClipboard = this._onClipboard.event;

	// The webview panel for this document - we do not support multi tab for the same document
	public panel: any = null;
	// Optional model watcher for suppressing local-save change notifications
	public modelWatcher: { setLocalSave?: () => void; setModelFile?: (modelArl: any) => void } | null = null;
	public resolvedModelArl: any = null;

	// The disposable (event listeners) for this document
	public disposables: vscode.Disposable[] = [];
	private autosaveTimer: NodeJS.Timeout | null = null;
	private saveInFlight: Promise<void> | null = null;
	private autosavePending = false;

	// The constructor for our document
	constructor(uri: vscode.Uri,backupId: string | undefined) {

		// save the parameters
		this.backupId = backupId;
		this.uri = uri;

		// we have to release the emitter at the end
		this.disposables.push(this._didEdit);
		this.disposables.push(this._onClipboard);
	}

	// Functions to read and write files...
	static async readFileAsBytes(uri: vscode.Uri): Promise<Uint8Array> {

		if (uri.scheme == 'untitled') return new Uint8Array();
	
		try {
			// read
			const content = await vscode.workspace.fs.readFile(uri);

			// convert to byte array
			return new Uint8Array(content);

		} catch (error) {
			// write an error message
			console.error(`Read file "${uri.path}" gave error: ${error}`);

			// and return an empty array
			return new Uint8Array();
		}
	}
	
	static async readFileAsString(uri: vscode.Uri): Promise<string> {

		if (uri.scheme == 'untitled') return '';
	
		try {
			// read
			const content = await vscode.workspace.fs.readFile(uri);

			// convert to string
			return content.toString();
			
		} catch(error) {
			// log the error
			cout(`Read file "${uri.path}" gave error: ${error}`);

			// return an empty string
			return '';
		}
	}

	static async readFileAsJSON(uri: vscode.Uri) {

		if (uri.scheme == 'untitled') return null;
	
		try {
			// Otherwise, read from the file system
			const rawFile = await vscode.workspace.fs.readFile(uri);

			// make json string out of it
			const content = rawFile.toString();

			// Parse and return JSON if the content is not empty
			return content.length > 0 ? parseJsonWithDuplicateKeyWarning(content, uri.path, cout) : null;

		} catch (error) {
			// report the error
			cout(`Read file "${uri.path}" gave error: ${error}`);

			return '';
		}
	}

	static async writeFile(uri: vscode.Uri, bytes:Uint8Array): Promise<void> {

		return vscode.workspace.fs.writeFile(uri, bytes);
	}

	// place holder - real function is imported below
	onMessage(e:any):void {}

	// Called by VS Code when there are no more references to the document.
	// This happens when all editors for it have been closed.
	dispose(): void {

		// check
		if ( ! this.disposables) return;

		if (this.autosaveTimer) {
			clearTimeout(this.autosaveTimer);
			this.autosaveTimer = null;
		}

		// clear all the disposables
		for( const item of this.disposables) item.dispose?.();
		this.disposables.length = 0;
	}

	// // called when a webview for this document is opened
	// addWebviewPanel(panel: vscode.WebviewPanel):void {

	// 	// save the webview panel for this document
	// 	this.panel = panel;

	// 	// Set the message handler for messages received from the webview
	// 	panel.webview.onDidReceiveMessage(e => this.onMessage(e));
	// }

	// resolves an arl to a uri
	makeUri(arl:any):vscode.Uri | null {

		// check
		return arl.url  ? vscode.Uri.parse(arl.url) : null;
	}

	// fire didedit
	reportEdit(edit: any) {

		// fire an edit event - the parameter is of type SomeEdit
		this._didEdit.fire( {	label: edit,
								undo: ()=>{},
								redo: ()=>{} });

		// persist edits through vmblu using a short debounce window
		this.scheduleAutoSave();
	}

	// Method to call when handling the clipboard
	fireClipboardEvent(e:any) {

		// this 
		this._onClipboard.fire(e);
	}

	// Called by VS Code when the user saves the document.
	async save(cancellation: vscode.CancellationToken): Promise<void> {

		// do a save as but with the current file name
		await this.runSave(null, cancellation);
	}

	// Called by VS Code when the user saves the document to a new location.
	async saveAs(targetResource: vscode.Uri | null , cancellation: vscode.CancellationToken): Promise<void> {

		await this.runSave(targetResource, cancellation);
	}

	private scheduleAutoSave() {
		if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
		this.autosaveTimer = setTimeout(() => {
			this.autosaveTimer = null;
			void this.autoSave();
		}, VmbluDocument.AUTOSAVE_DELAY_MS);
	}

	private async autoSave(): Promise<void> {
		try {
			await this.runSave(null, undefined, true);
		}
		catch (error) {
			cout(`Autosave failed for "${this.uri.path}": ${error}`);
		}
	}

	private async runSave(targetResource: vscode.Uri | null, cancellation?: vscode.CancellationToken, isAutoSave = false): Promise<void> {
		if (this.saveInFlight) {
			if (isAutoSave) {
				this.autosavePending = true;
				return;
			}
			await this.saveInFlight;
		}

		const savePromise = this.performSave(targetResource, cancellation);
		this.saveInFlight = savePromise;

		try {
			await savePromise;
		}
		finally {
			this.saveInFlight = null;
			if (this.autosavePending) {
				this.autosavePending = false;
				this.scheduleAutoSave();
			}
		}
	}

	private async performSave(targetResource: vscode.Uri | null, cancellation?: vscode.CancellationToken): Promise<void> {
		if (cancellation?.isCancellationRequested) return;

		// The webview where we will ask for the file data
		const broker = this.panel.webview;

		// Let the model watcher suppress the change notification for this local save
		this.modelWatcher?.setLocalSave?.();

		// make a promise to wait for...
		this.wait.promise = new Promise( (resolve, reject) => {
			this.wait.resolve = resolve;
			this.wait.reject = reject;
		});

		// request the current document
		broker.postMessage({verb:'save request', uri: targetResource ? targetResource.toString() : null});

		// wait for the result (see the message handler onMessage)
		await this.wait.promise;
	}

	// Called by VS Code when the user calls `revert` on a document.
	async revert(_cancellation: vscode.CancellationToken): Promise<void> {

		// read the content of the document...
		const diskContent = await VmbluDocument.readFileAsBytes(this.uri);
	}

	// my own internal save function
	async straightSave() {
		return this.runSave(null);
	}

	// Called by VS Code to backup the edited document.
	// These backups are used to implement hot exit.
	async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
		
		// save the document to the destination
		await this.saveAs(destination, cancellation);

		// return an id and a delete function ...
		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// noop
				}
			}
		};
	}

}

// add the message handler
import "./document-broker.js";
