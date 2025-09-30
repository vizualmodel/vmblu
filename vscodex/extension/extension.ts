/* eslint-disable no-mixed-spaces-and-tabs */
import * as vscode from 'vscode';
import { VmbluDocument } from './document-model.js';
import { WebviewCollection} from './util.js';
import { makeHtmlPage } from './webview-html-page.js';
import { globeHandler } from "./command-handlers.js";
import {cout} from './util.js';
import { VmbluFileDecorationProvider } from './file-decoration-provider.js';

// the viewtype used 
export const vmbluViewType = 'vmblu.vmblu';

// The context
let extensionContext: vscode.ExtensionContext;

export function setExtensionContext(ctx: vscode.ExtensionContext) {
  	extensionContext = ctx;
}

export function getExtensionContext(): vscode.ExtensionContext {
  	if (!extensionContext) {
   		throw new Error('Extension context has not been set yet.');
  	}
  	return extensionContext;
}


// The activate function is called when the extension is activated
export function activate(context: vscode.ExtensionContext) {

	// save the context
	setExtensionContext(context);

	// Register our custom editor providers
	context.subscriptions.push(VmbluEditorProvider.register(context));

	// Register the command provider
	context.subscriptions.push(vscode.commands.registerCommand("vmblu.globe", globeHandler));

	const decorationProvider = new VmbluFileDecorationProvider();
	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(decorationProvider),
		decorationProvider,
	);

	// is called when you change tabs
	// once for the tab you leave ( *UNLESS* that is a vmblu file - cutsom editor) with editor = null
	// and once for the file you move to 
	// NOT USED ANYMORE 
	// vscode.window.onDidChangeActiveTextEditor((editor) => {

	// 	if (editor) {
	// 		cout(`Active file: ${editor.document.uri.fsPath}`);
	// 	} else {
	// 		// This might be a custom editor or no editor is currently active
	// 		cout(`Switched to a non-text editor (possibly a custom editor)`);
	// 	}
	// });
}

// Nothing special to do when the extension is deactivated
export function deactivate() {

}

type clipboardType = {
	owner: VmbluDocument | null,
	requestor: VmbluDocument | null,
}

// The vmblu output channel
// const outputChannel = vscode.window.createOutputChannel("vmblu");
// export const cout = (line:string) => outputChannel.appendLine(line);

// Provider for the VmbluEditor
export class VmbluEditorProvider implements vscode.CustomEditorProvider<VmbluDocument> {

	// the unique view type (see package.json)
	private static readonly viewType = vmbluViewType;

	// The options for our provider
	private static options = {

		// Options for the webview
		webviewOptions: {

			// but check memory overhead...
			retainContextWhenHidden: true, 
		},

		// multiple tabs are not possible on same document yet ? Not necessary I think
		supportsMultipleEditorsPerDocument: false, 	
	};

	// fire this event when a document has changed
	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<VmbluDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	// all the webviews for this extension
	private readonly webviews = new WebviewCollection();

	// clipboard data
	private clipboard : clipboardType =  {
		owner : null,			// the owner of the clipboard
		requestor: null			// the document that requested the clipboard
	};

	// the fileserver maintains the list of files that have been opened

	// The constructor
	constructor(private readonly _context: vscode.ExtensionContext) {}

	// registers the extension - called once, the first time a vmblu document is opened
	public static register(context: vscode.ExtensionContext): vscode.Disposable {

		// register and return a provider for this extension
		return vscode.window.registerCustomEditorProvider( 	VmbluEditorProvider.viewType, 
															new VmbluEditorProvider(context),
															VmbluEditorProvider.options);
	}

	// This function is called each time a new document handled by our extension is opened
	// 'openContext' contains backupId and untitledDocumentData
	async openCustomDocument(	uri: vscode.Uri,
								openContext: { backupId?: string },
								_token: vscode.CancellationToken)	: 	Promise<VmbluDocument> {

		// create a new document
		const document = new VmbluDocument(uri, openContext.backupId);

		// when the document fires didEdit, also inform vscode of the change
		document.disposables.push(document.didEdit(e => {

			// Tell VS Code that the document has been edited by the user
			this._onDidChangeCustomDocument.fire({document,...e,});
		}));

		// when the document fires clipboard, inform all other webpanels
		document.disposables.push( document.onClipboard( this.clipboardHandler.bind(this) ));

		// done
		return document;
	}

	public async resolveCustomEditor(	document: VmbluDocument,
										webviewPanel: vscode.WebviewPanel,
										_token: vscode.CancellationToken): Promise<void> 
	{
		// Add the webview to our internal set of active webviews
		this.webviews.add(document, webviewPanel);
	
		// Set the options for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
	
		// Save the webview panel for this document
		document.panel = webviewPanel;
	
		// Set the message handler for messages received from the webview
		webviewPanel.webview.onDidReceiveMessage(e => document.onMessage(e));
	
		// Get the initial HTML for the webview
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
	
		// Handle view state changes to focus the webview when visible
		const viewStateSubscription = webviewPanel.onDidChangeViewState(e => {

			// get the document for this webview
			const document = this.webviews.getDocument(e.webviewPanel);

			// check - if no document yet it means the tab was just opened => we do not have to sync
			if (!document) return;

			// maybe a sync operation is required
			if (e.webviewPanel.visible) {

				// send a visible message - will sync the document
				e.webviewPanel.webview.postMessage({verb:'visible'});
			} else {

				// save the document that is going away
				document.straightSave();
			}
		});

		document.disposables.push(viewStateSubscription);
	
		// Handle the disposal of the document, ensuring all listeners and other disposables are cleaned up
		const disposeSubscription = document.panel.onDidDispose(document.dispose);
		document.disposables.push(disposeSubscription);

		// send the flags for this document to the webview
		document.panel.webview.postMessage({verb:'documentFlags', flags: document.flags});
	}

	// functions to save and revert documents
	public saveCustomDocument(	document: VmbluDocument, 
								cancellation: vscode.CancellationToken): Thenable<void> {

		return document.save(cancellation);
	}
	public saveCustomDocumentAs(document: VmbluDocument, 
								destination: vscode.Uri, 
								cancellation: vscode.CancellationToken): Thenable<void> {

		return document.saveAs(destination, cancellation);
	}
	public revertCustomDocument(document: VmbluDocument, 
								cancellation: vscode.CancellationToken): Thenable<void> {

		return document.revert(cancellation);
	}
	public backupCustomDocument(document: VmbluDocument, 
								context: vscode.CustomDocumentBackupContext, 
								cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
									
		return document.backup(context.destination, cancellation);
	}

	// makes a webview uri
	private getWebviewUri(webview: vscode.Webview, dir: string, file:string ): vscode.Uri {

		return webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, dir,file));
	}
	
	// returns the html page for the webview
	private getHtmlForWebview(webview: vscode.Webview): string {

		// Get the special URI to use with the webview
		const appWebviewUri = this.getWebviewUri(webview, 'webview', 'webview-bundle.js');

		// The uri for the styling to be used in vscode
		const cssWebviewUri = this.getWebviewUri(webview, 'webview', 'webview-bundle.css');

		// !! IMPORTANT - Dont'forget to adapt the ./ to ../ for the woff files in the css file when using it in vscode !!!
		const iconWebviewUri = this.getWebviewUri(webview, 'webview/material-icons/iconfont', 'outlined.css');
		
		// make the html page using the csp setting, the app and the css Uri
		return makeHtmlPage(webview.cspSource, appWebviewUri, cssWebviewUri, iconWebviewUri);
	}

	// gets called when the extension has to shuffle clipboard content between several editors...
	private clipboardHandler(e: any) {

		switch(e.what) {

			case 'switch':

				// inform everybody of the switch
				for (const doc of this.webviews.allDocuments()) {

					// do not send to the originator of the switch message 
					if (e.owner !== doc) doc.panel.webview.postMessage({verb:'clipboard switched'});
				}

				// and save the new owner
				this.clipboard.owner = e.owner;
				break;

			case 'request':
				
				// check
				if (!this.clipboard.owner) return;

				// save the document that has requested the clipboard
				this.clipboard.requestor = e.who;
				
				// get the clipboard from the current owner
				this.clipboard.owner.panel.webview.postMessage({verb:'clipboard local'});
				break;


			case 'deliver':

				// check
				if (!this.clipboard.requestor) return;

				// deliver to the requestor
				this.clipboard.requestor.panel.webview.postMessage({verb:'clipboard remote', json:e.json});
				break;

		}
	}

}
