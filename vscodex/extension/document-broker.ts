import * as vscode from 'vscode';
import {cout} from './util.js';
import {vmbluViewType} from './extension.js';
import {VmbluDocument, documentFlags} from './document-model.js';
//import * as documentation from 'documentation';
import { execFile } from 'child_process';
import type { ExecFileException } from 'child_process';
import * as fs from 'fs/promises'; // or 'fs' with .promises
import { SourceDocWatcher } from './source-doc-watcher';
import {getExtensionContext} from './extension.js';


import path from 'path';

// Messages coming from the webview
VmbluDocument.prototype.onMessage = async function (message: any) {

	if (this.flags & documentFlags.LOGVSCODE) {
		if (message.verb != 'console log')
			message.arl ? 	cout(`    vscodex <~~~ [broker]    [${message.verb} ${message.arl.userPath}]`) : 
							cout(`    vscodex <~~~ [broker]    [${message.verb}]`);
	}

	// notation
	const broker = this.panel.webview;

	switch (message.verb) {

		// when the webview is ready, send the document to open to the webview
		case 'ready' : {

			// If we have a backup, read that. Otherwise read the resource from the workspace
			if (typeof this.backupId === 'string') {

				// send the uri to the webview
				broker.postMessage({verb:'open main', uri: this.backupId});
				return;
			}

			// Check if the file already exists
			vscode.workspace.fs.stat(this.uri)
			.then(
				// existing file
				() => {

					// send the uri to the webview
					broker.postMessage({verb:'open main', uri: this.uri.toString()});
				}, 
				// new file
				() => {

					// send the uri to the webview
					broker.postMessage({verb:'new main', uri: this.uri.toString()});
				}
			);

			// done
			return;
		}

		// signals an edit that has been made in the webview
		case 'report edit' : {

			// save and report the edit to vscode
			this.reportEdit(message.edit);

			// done
			return;
		}

		// this signals that the webview has saved the file
		case 'file saved' : {

			// call the resolve function for the promise...
			this.wait.resolve();

			// done
			return;
		}

		// this document instance holds the clipboard
		case 'clipboard switch' : {

			// trigger the event to notify that the clipboard owner has changed..
			this.fireClipboardEvent({what:'switch', owner: this});
			return;
		}

		// this document delivers its clipboard
		case 'clipboard local' : {
	
			// trigger the event to send the clipboard to who has requested it...
			this.fireClipboardEvent({what:'deliver', json:message.json});
			return;
		}

		// this document requests the active external clipboard
		case 'clipboard remote' : {
			
			// trigger an event to get the external clipboard
			this.fireClipboardEvent({what:'request', who: this});
			return;
		}

		// request from the webview to open a new vmblu document
		case 'open document': {

			// make a uri
			const uri = this.makeUri(message.arl);

			// check
			if (! uri) {
				console.log('Could not make uri..', message.arl.url);
				return;
			}

			// open the file with the vmblu editor
			vscode.commands.executeCommand("vscode.openWith", uri, vmbluViewType);

			// done
			return;
		}

		// request from the webview to open a text document - typically a source file
		case 'xxopen source' : {

			// make a uri
			const uri = this.makeUri(message.arl);

			if (! uri) {
				console.log('Could not make uri..', message.arl.url);
				return;
			}

			// open and show the document
			vscode.workspace.openTextDocument(uri)
			.then( newDocument => {
				vscode.window.showTextDocument(newDocument);
			});

			// done
			return;
		}

		// open a source file and optionally jump to a specific line nr
		case 'open source': {

			const uri = this.makeUri(message.arl);

			if (! uri) {
				console.log('Could not make uri..', message.arl.url);
				return;
			}

			const doc = await vscode.workspace.openTextDocument(uri);
			const textEditor = await vscode.window.showTextDocument(doc, { preview: false });

			// check if we have to show a particular line
			if (!message.line) return;

			// Go to the line
			const position = new vscode.Position(message.line - 1, 0); // line is 1-based
			const selection = new vscode.Selection(position, position);
			textEditor.selection = selection;
			textEditor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
			return;
		}

		case 'watch source doc': {

			// make an output file uri
			const outFile = vscode.Uri.parse((message.outFile as { url: string }).url);

			// set up a source file watcher - specify the intermediate outputfile to use and the customer action
			const watcher = new SourceDocWatcher(
								outFile,
								(rawSourceDoc) => {broker.postMessage({verb: 'source doc',rawSourceDoc});}
							);			

			// make sure it gets cleaned up
			getExtensionContext()?.subscriptions.push(watcher);

			// and start the watcher
			watcher.start();

			// set the factories - this will do an update
			//watcher.setFactoryFiles( message.factories );
			watcher.setModelFile(message.model);

			return;
		}

		// The following messages are for reading/writing files - they mimic fetch...(see also arl-adapter)
		// parameters: arl format rqKey - rqKey is used by the webview to find the promise for this action
		case 'HTTP-GET': {

			// make a URI from the arl
			const uri = this.makeUri(message.arl);

			// check
			if (!uri) {
				console.error('INVALID ARL', message.arl);
				broker.postMessage({verb:'404',rqKey:message.rqKey, arl:message.arl});
				return;					
			}

			// read the file according the required format
			const content = (message.format == 'json') 	? await VmbluDocument.readFileAsJSON(uri) 
														: await VmbluDocument.readFileAsString(uri);

			// content can be empty, but not null - return a '200' or '404' message
			content != null ? broker.postMessage({verb:'200',rqKey:message.rqKey, content}) 
							: broker.postMessage({verb:'404',rqKey:message.rqKey, arl: message.arl});

			// done
			return;
		}

		// request from the webview (arl) to save data to a file
		case 'HTTP-POST': {

			// notation
			const arl = message.arl;

			// make a URI from the arl
			const uri = this.makeUri(message.arl);

			// check
			if (!uri) {
				console.error('INVALID ARL', arl);
				broker.postMessage({verb:'404',rqKey:message.rqKey, arl: message.arl});
				return;					
			}

			// save the file - the content is an array of bytes Uint8Array
			await VmbluDocument.writeFile(uri, message.bytes);

			// return success message
			broker.postMessage({verb:'200', rqKey: message.rqKey, content: null});

			// done
			return;
		}

		// console messages
		case 'console log': {

			cout(message.string);
			return;
		}

		case 'info popup': {

			const logMessage = message.args.join(' '); // Assumes data is an array of arguments

			// vscode shows the message as a popup
			vscode.window.showInformationMessage(logMessage);

			return;
		}

		default: cout('DOCUMENT RECEIVED UNKNOWN MESSAGE: '+ message.verb);
			break;
	}
};