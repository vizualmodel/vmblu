// ------------------------------------------------------------------
// Source node: DocumentManager
// Creation date 9/24/2023, 10:28:10 AM
// ------------------------------------------------------------------

import {Path, ARL} from '../../types/arl/index.js'
import {Document} from './document.js'

//Constructor for document manager
export function DocumentManager(tx, sx) {

    // save the transmitter
    this.tx = tx

	// the document that is being handled by the editor
	this.active = null

    // the list of documents being handled
    this.documents = []

    // check for parameters
    this.checkForQueryParameters()
}

DocumentManager.prototype = {

    /**
     * @node document manager
     */

    async resolveDocumentArl(arl) {

        if (!arl) return null

        const path = arl.getPath?.()
        if (!path) return arl

        const split = Path.split(path)

        if (split.ext === '.blu') {
            const raw = await arl.get?.('json').catch(() => null)
            const modelPath = raw?.kind === 'vmblu.entrypoint' ? raw.model : null
            const modelArl = typeof modelPath === 'string' ? arl.resolve?.(modelPath) : null
            if (modelArl) return modelArl
        }

        return arl
    },

    haveDocument(arl) {

        return this.documents.find(doc =>
            doc.model.getArl()?.equals(arl)
        )
    },

    openDocument(arl) {

        // create a new document for a model
        const doc = new Document(arl)

        // save in the list
        this.documents.push(doc)

        // set a new tab
        this.tx.send('tab.new', arl.getName())

        // set as the active document
        this.tx.send('doc.set active', doc)

        // save here also
        this.active = doc
    },

	// bring an existing document to the foreground
    toForeground(doc) {

        // check
        if (!doc) return 

        // select the tab for the doc
        this.tx.send("tab.select", doc.model.getArl().getName())

        // set the doc as the active document
        this.tx.send('doc.set active', doc)

        // set as active
        this.active = doc
    },

    /**
     * @prompt User selected a document 
     * This will bring the document to the foreground.
     * @pin doc selected @ document manager
     * @param {ARL} arl - The ARL of the selected document.
     */
    async onDocSelected(arl) {

        const docArl = await this.resolveDocumentArl(arl)
        const doc = this.haveDocument(docArl)
        doc ? this.toForeground(doc) : this.openDocument(docArl)
	},

    /**
     * @prompt Open a document using its ARL.
     * @param {ARL} arl - The ARL of the document to open.
     */
    async onDocOpen(arl) {

        const docArl = await this.resolveDocumentArl(arl)
        const doc = this.haveDocument(docArl)
        doc ? this.toForeground(doc) : this.openDocument(docArl)
    },

    onDocGet(){},

    /**
     * @prompt Create a new, empty document with the given ARL.
     * @pin doc new @ document manager
     * @param {ARL} arl - ARL for the new document to be created.
     */
	onDocNew(arl) {
        
        // create a new tab
        const doc = new Document(arl) 

        // save in the
        this.documents.push(doc)

        // init the root
        doc.view.initRoot(Path.nameOnly(arl.getPath()))

        // show the tab
        this.tx.send('tab.new', arl.getName())

		// set the document
		this.tx.send('doc set active', doc)

		// set active
		this.active = doc
	},
    /**
     * @prompt Notification that a document has been renamed.
     * @pin doc renamed @ document manager
     * @param {Object} info
     * @param {string} info.oldName - Previous document name.
     * @param {string} info.newName - New document name.
     */
    onDocRenamed({oldName, newName}) {

        //DEV ONLY
        console.log('old-new', oldName, newName)
    },

    onDocDeleted(arl) {
    },
    /**
     * @prompt Save the currently active document.
     * A popup allows the user to select the name for the file
     * @pin save as @ document manager
     * @param {object} e - the event 
     */
	onFileSaveAs(e) {

        // check
        if (!this.active) return;

        // the position of the popup
        const pos = e ? {x:e.screenX, y:e.screenY} : {x:25, y:25}

        // notation
        const doc = this.active

        // save the old doc name
        const oldName = doc.model.getArl().getName()

        // request the path for the save as operation
        this.tx.send("file.save as filename",{  title:  'Save as...' ,
                                                entry:  doc.model.getArl().getPath(), 
                                                pos:    pos,
                                                ok:     (userPath) => {

                                                            // save the active document as 
                                                            this.tx.send('file.save',{path:userPath})
                                                            
                                                            // and change the doc name
                                                            this.tx.send('tab.rename',{oldName, newName: userPath})
                                                        },
                                                cancel: ()=>{}
                                            })		
	},
    /**
     * @prompt Save all currently open documents.
     * @pin save all @ document manager
     */
	onFileSaveAll() {
	},
    /**
     * @prompt Send a message with the list of open models (as ARLs).
     * @pin get open models @ document manager
     */
	onGetOpenModels() {

        const models = []

        // get all the arl
        this.documents.forEach( doc => {
            if (doc.model.getArl()) models.push(doc.model.getArl())
        })

        // return the array of files
        this.tx.send("open models", models)
    },

    /**
     * @prompt Close a tab by name, managing active document state accordingly.
     * @pin tab request to close @ document manager
     * @param {string} name - Name of the tab to close.
     */
    onTabRequestToClose(name) {

        // notation
        const L = this.documents.length

        // go through all documents
        for (let i=0; i<L; i++) {

            // find the tab to remove
            if (name == this.documents[i].model.getArl().getName()) {

                // shift the documents below one position up
                for (let j=i; j<L-1; j++) this.documents[j] = this.documents[j+1]

                // the array is one position shorter
                this.documents.pop()

                // remove the tab
                this.tx.send("tab.remove",name)

                // if we close the active doc, we have to change that
                if (name == this.active.model.getArl().getName()) {

                    // choose the doc below
                    if (i+1<L-1) {
                        
                        // set the active document
						this.active = this.documents[i+1]

                        // select the tab in the ribbon
                        this.tx.send("tab.select", this.active.model.getArl().getName())
					}
                    // .. or the doc above
                    else if (i > 0) {

                        // set the active document
                        this.active = this.documents[i-1]

                        // select the tab in the ribbon
                        this.tx.send("tab.select", this.active.model.getArl().getName())
                    }

                    // or nothing..
                    else this.active = null

                    // the active view is also the selected tab
					this.tx.send('doc.set active', this.active )
                }
                // no need to look to the next view
                return
            }
        }       
    },

    /**
     * @prompt Select a tab/document by name.
     * @pin tab request to select
     * @param {string} name - Name of the tab to select.
     */
	onTabRequestToSelect(name) {

        // check if the file is in the list of open files
        const doc = this.documents.find( doc => doc.model.getArl().getName() == name)

        // if there is already a view, bring the view to the foreground
        if (!doc) return

        // set the doc as the active document
        this.tx.send("doc.set active", doc)

        // send out a message
        this.tx.send("tab.select", name)

        // set the active doc here also
        this.active = doc
	},

    // check for URL query parameters "https://site.com/somewhere/?model=/path/to/model.vmblu"
    checkForQueryParameters() {

        // Get the parameters and the origin 
        const {searchParams, origin} = new URL(window.location.href)

        // check
        if (!searchParams) return

        // extract the model path: note that in Vite (and most SPA setups) everything under `public/` is served from the root,
        const modelPath = searchParams.get('model'); // e.g. "/examples/tutorial/chat-client.vmblu"

        // check
        if (!modelPath) return;

        // construct the arl
        const arl = new ARL(modelPath)
        arl.url = new URL(modelPath, origin)

        // open the document
        this.onDocOpen(arl)
    }

} // document manager.prototype
