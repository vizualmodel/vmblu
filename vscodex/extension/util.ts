import * as vscode from 'vscode';
import {VmbluDocument} from './document-model.js';

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// The vmblu output channel
const outputChannel = vscode.window.createOutputChannel("vmblu");
export const cout = (line:string) => outputChannel.appendLine(line);

// debouncing function for the calling the source doc update ...
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Tracks all webviews.
 */
export class WebviewCollection {

	// The set of all webviews
	private readonly _webviews = new Map<vscode.WebviewPanel,VmbluDocument>();

	//Get all known documents
	public *allDocuments(): Iterable<VmbluDocument> {
		for (const document of this._webviews.values()) {
			
			yield document;
		}
	}

	//Add a new webview to the collection.
	public add(document: VmbluDocument, webviewPanel: vscode.WebviewPanel) {

		// add the entry
		this._webviews.set(webviewPanel, document);

		// make sure the entry is deleted when the panel is closed
		webviewPanel.onDidDispose(() => {
			this._webviews.delete(webviewPanel);
		});
	}

	// get the document associated with a webviewPanel
	public getDocument(webviewPanel: vscode.WebviewPanel) {

		return this._webviews.get(webviewPanel);
	}
}

/**
 * Tracks all webviews.
 */
export class xWebviewCollection {

	// The set of all webviews
	private readonly _webviews = new Set<{
		readonly document: VmbluDocument ;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	// get the document for a given webview

	//Get all known documents
	public *iterate(): Iterable<VmbluDocument> {
		for (const entry of this._webviews) {
				yield entry.document;
			}
	}

	//Add a new webview to the collection.
	public add(document: VmbluDocument, webviewPanel: vscode.WebviewPanel) {
		const entry = { document, webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}

/**
 * Tracks all webviews.
 */
export class xxxWebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}