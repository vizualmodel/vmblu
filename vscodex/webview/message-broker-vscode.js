/* eslint-disable no-undef */
/* eslint-disable semi */

// the event handler for messages coming from vs code
import {Document} from '../../core/nodes/document-manager/document.js';
import {Path} from '../../core/types/arl/index.js'
import {promiseMap, vscode} from './arl-adapter.js';

// defined in document-model.js
const LOGVSCODE = 0x1		// log messages to/from vscode

export const messageBrokerVscode = {

	/** @node message broker */
	
    async onMessage(event) {

		// The json data that the extension sent
		const message = event.data; 

		// Log the message sent by vscode
		if (this.documentFlags & LOGVSCODE) console.log(`    vscodex ~~~> [broker]    [${message.verb}]`);

		switch (message.verb) {	

			// a document has been opened by the user: the 'new' document can be an existing document or still have to be created
			case 'open main': {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri)

				// create the new document
				this.activeDoc = new Document(arl)

				// set as the active document
				this.tx.send('set document', this.activeDoc)

				// get the arl for the sourceProfile
				const outFile = this.getSourceProfile(arl)

				// also request to start the source code and model watchers
				vscode.postMessage({verb:'start watchers', model: arl, outFile})

				// done
				return;
			}

			case 'new main' : {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri)

				// create the new document
				this.activeDoc = new Document(arl)

				// seed an empty raw model so the kernel side can compile an editable empty document
				this.activeDoc.model.raw = this.getEmptyRawModel()

				// set as the active document
				this.tx.send('set document', this.activeDoc)

				// get the arl for the sourceProfile
				const outFile = this.getSourceProfile(arl)

				// also request to start the source code and model watchers
				vscode.postMessage({verb:'start watchers', model: arl, outFile})

				return;
			}

			// a file needs to be saved - if no uri is given, the current file is used
			case 'save request' : {

				const path = message.uri ? this.makeArl(message.uri).getPath() : null

				// delegate saving to the kernel model manager
				this.tx.send('model.save', {path, preserveTarget: message.preserveTarget === true})

				// vscode could be waiting for the save !
				vscode.postMessage({verb:'file saved'})

				// done
				return
			}

			// the document became visible - some of the links might have changed - do a sync.
			case 'visible' : {

				this.tx.send('sync links')
				return
			}

			// an llm has changed the model - reread from file
			case 'model changed' : {
				this.tx.send('reload model')
				return
			}

			case 'source doc' : {
				
				this.activeDoc.model.sourceProfile = this.activeDoc.model.parseSourceProfile(message.rawSourceDoc)
				this.activeDoc.model.sourceProfileOrigin = 'host'
				return
			}

			// vscode informs all editors about a clipboard switch
			case 'clipboard switched' : {

				// send a message to the editor to inform the editor
				this.tx.send('clipboard.switched')
				return
			}

			// vscode requests the clipboard from the editor connected to this message broker
			case 'clipboard local' : {

				// request the internal clipboard
				this.tx.request('clipboard.local', this.activeDoc)
				.then(({json}) => {

					// and transfer the json to vscode
					vscode.postMessage({verb:'clipboard local', json})
				})
				.catch( error => console.log('message broker timeout on clipboard.local'))
				return;
			}

			// vscode returns the clipboard content in json to the editor that requested it
			case 'clipboard remote' : {

				this.tx.reply({json: message.json})
				return
			}

			// succesful execution of a fake HTTP request....
			case '200' : {
				// find the resolve in the promiseMap
				const resolve = promiseMap.get(message.rqKey)

				// check
				if (!resolve) return;

				// and call the resolve code
				resolve(message.content);

				// remove the resolve from the map
				promiseMap.delete(message.rqKey)

				// done
				return
			}

			// execution of a fake HTTP request failed....
			case '404' : {

				// TO CORRECT
				// find the reject  in the promiseMap  -- *** we have to make a reject map as well *** !!!
				// const reject = promiseMap.get(message.rqKey)

				// find the resolve in the promiseMap
				const resolve = promiseMap.get(message.rqKey)

				// check
				if (!resolve) return;

				// and call the resolve code
				resolve(message.content);

				// remove the resolve from the map
				promiseMap.delete(message.rqKey)

				// done
				return
			}

			case 'folder.get.result': {

				const resolve = promiseMap.get(message.rqKey)
				if (!resolve) return

				resolve(message.content ?? {folders: [], files: []})
				promiseMap.delete(message.rqKey)
				return
			}

			case 'documentFlags' : {

				// the debug settings frm the document
				this.documentFlags = message.flags
				return
			}

			default: 

				// show an error message
				console.log(`Message broker: "${message.verb}" is an unknown message`)
				break
		}
    }
}
