/* eslint-disable no-undef */
/* eslint-disable semi */

// Message handlers for messages coming from the other nodes...
import {vscode} from './arl-adapter.js'

export const messageBrokerWebview = {

	/** @node message broker */

	// request vscode to open a new nodemesh document
	"-> open document"(arl) {

		// send a message to the vscode side
		vscode.postMessage({verb:'open document', arl})
	},

    // the canvas div that has to be added 
    "-> canvas"(canvas) {

		// set the theme
		document.documentElement.className = "dark" + " common"

        // note that the context of a canvas gets reset when the size changes !
		canvas.width = window.visualViewport.width;
		canvas.height = window.visualViewport.height;

        // add the canvas to the main window
        document.body.append(canvas)

		// and focus the canvas
		canvas.focus()

		// Listen for the 'resize' event and send a resize request when that happens
		let resizeTimeout;
		window.visualViewport.addEventListener('resize', () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				this.tx.send("canvas resize", {x:0, y:0, w:window.visualViewport.width, h:window.visualViewport.height})
			}, 100);
			//this.tx.send("canvas resize", {x:0, y:0, w:window.visualViewport.width, h:window.visualViewport.height})
		});
    },

	"-> modal div"(modalDiv) {

		// add the div to the document body
		document.body.append(modalDiv)
	},

	"-> floating menu"(menuDiv) {

		// add the floating menu to the document body
		document.body.append(menuDiv)
	},

	// the editor signals that it is now the owner of the active clipboard
	"-> clipboard switch"() {
	
		// intercept the clipboard message
		vscode.postMessage({verb: 'clipboard switch'})
	},

	// the editor has sends the content of its clipboard
	"-> clipboard local"({json}) {
		// request the vscod extension to forward the internal clipboard
		vscode.postMessage({verb: 'clipboard local', json})
	},

	// The editor requests the content of the external clipboard
	"-> clipboard remote"() {

		// request the external clipboard
		vscode.postMessage({verb: 'clipboard remote'})
	},

	"-> new edit"(edit) {

		// signal vscode about the edit
		vscode.postMessage({verb: 'report edit', edit: edit?.verb ?? 'unspecified'})
	},

	"-> open js file"({arl, line}) {

		console.log('OPEN SOURCE ', arl)

		vscode.postMessage({verb:'open source', arl, line})
	},
};