/* eslint-disable no-undef */
/* eslint-disable semi */
// ------------------------------------------------------------------
// Source node: MessageBroker
// Creation date 9/23/2023, 10:16:36 AM
// ------------------------------------------------------------------

import {adaptARL, vscode} from './arl-adapter.js'
import {ARL} from '../../core/arl/index.js'
import {adaptConsole} from './console-adapter.js'
import {messageBrokerVscode} from './message-broker-vscode.js'
import {messageBrokerWebview} from './message-broker-webview.js'

// import {Document} from '../../core/document/document.js';
// import {promiseMap} from './arl-adapter.js';

const LOGVSCODE = 0x1		// log messages to/from vscode


//Constructor for message broker
export function MessageBroker(tx, sx) {

    // save the transmitter and the settings
    this.tx = tx
    this.sx = sx

	// There can only be one active doc per editor !
	this.activeDoc = null

	// the document flags set by the vscode document
	this.documentFlags = 0x0

	// adapt the console.log function !
	adaptConsole()

	// change the behaviour of arl/HTTP to get files from the local machine
	adaptARL()

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => this.onMessage(event));

	// make sure to intercept dangerous keys from the webview
	window.addEventListener('keydown', event => this.interceptKeys(event));

	// send a message to the webview that the application is ready
	vscode.postMessage({verb:'ready'})
}
MessageBroker.prototype = {

	// This is to avoid propagating unwanted keys to vscode
	interceptKeys(event) {

		// These are the potentially dangerous keys...
		if (['Delete', 'Enter', 'Escape'].includes(event.key)) {
			event.preventDefault();  // Stop default browser behavior
			event.stopPropagation(); // Stop bubbling this event up to VSCode
		}
	},

	// resolves a uri string to an arl
	makeArl(uri) {
		
		// get the filename from the uri
		let lastSlash = uri.lastIndexOf('/')

		// make a userPath from the uri - take the last name
		const userPath = (lastSlash < 0) ? uri : uri.slice(lastSlash+1)

		// make an arl
		const arl = new ARL(userPath)

		// set the url for the document
		arl.url = uri

		// done
		return arl
	},
}
Object.assign(  MessageBroker.prototype, messageBrokerWebview, messageBrokerVscode);