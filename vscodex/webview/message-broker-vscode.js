/* eslint-disable no-undef */
/* eslint-disable semi */

// the event handler for messages coming from vs code
import {Document} from '../../core/document/document.js';
import {Path} from '../../core/arl'
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

				// check if the document has to be created
				this.activeDoc.load()
				.then( () => {

					// set as the active document
					this.tx.send('set document', this.activeDoc)

					// write to the output file (= same name as model file but with .prf added before extension)
					const outFilename = Path.getSplit(arl.userPath).name + '.prf.json'

					// Make the output file name
					const outFile = arl.resolve(outFilename)

					// also request to run run documentation.js on the factory files...
					vscode.postMessage({verb:'watch source doc', model: arl, outFile})
				})
				.catch( error => {

					// show a popup message
					console.error(`*** Could not open main document ${message.uri} ${error}`)            
				})

				// done
				return;
			}

			case 'new main' : {

				// make a url from the uri that we got
				const arl = this.makeArl(message.uri)

				// create the new document
				this.activeDoc = new Document(arl)

				// init the root for this new document
				this.activeDoc.view.initRoot(Path.nameOnly(arl.userPath))		
				
				// save the new document
				this.activeDoc.save()
				.then( () => {

					// set as the active document
					this.tx.send('set document', this.activeDoc)
				})
				.catch( error => {
					// show a popup message
					console.error(`*** Could not create main document ${message.uri} ${error}`)            
				})

				return;
			}

			// a file needs to be saved - if no uri is given, the current file is used
			case 'save request' : {

				// The uri that is passed is a complete uri
				if (message.uri) {
					// save the document under a different name
					await this.activeDoc.saveAs(message.uri)
				}
				else {
					// save the active document
					await this.activeDoc.save()
				}

				// vscode could be waiting for the save !
				vscode.postMessage({verb:'file saved'})

				// done
				return
			}

			// the document became visible - do a sync
			case 'visible' : {

				this.tx.send('sync model')
				return
			}

			case 'source doc' : {
				this.activeDoc.model.sourceMap = this.activeDoc.model.parseSourceMap(message.rawSourceDoc) 
				return
			}

			// vscode informs all editors about a clipboard switch
			case 'clipboard switched' : {

				// send a message to the editor to inform the editor
				this.tx.send('clipboard switched')
				return
			}

			// vscode requests the clipboard from the editor connected to this message broker
			case 'clipboard local' : {

				// request the internal clipboard
				this.tx.request('clipboard local', this.activeDoc)
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