// ------------------------------------------------------------------
// Source node: DocumentManager
// Creation date 9/24/2023, 10:28:10 AM
// ------------------------------------------------------------------

import {Path} from '../arl/index.js'
import {Document} from './document.js'

//Constructor for document manager
export function DocumentManager(tx, sx) {

    // save the transmitter
    this.tx = tx

	// the document that is being handled by the editor
	this.active = null

    // the list of documents being handled - note that a document is a view !
    this.documents = []
}

DocumentManager.prototype = {

	// Output pins of the node
    /**
     * 
     * @node document manager
     */

	// open a document given the arl
    toForeground(arl) {

       // check if the document is in the list of documents
       let doc = this.documents.find( doc => doc.model.arl?.equals(arl))

       // if there is already a view, bring the view to the foreground
       if (doc) {
           // select the tab for the doc
           this.tx.send("tab select", arl.getName())

           // set the doc as the active document
           this.tx.send('doc set active', doc)

           // set as active
           this.active = doc
       }
       else {

           // create a new document
           doc = new Document(arl)

           // save in the list
           this.documents.push(doc)

           // get the document
           doc.load()

           // then read the source documentation for the model
           .then( () => {
                doc.model.handleSourceDoc()
           })

           // send the stuff to the editor
           .then( () => {
               // set a new tab
               this.tx.send('tab new', arl.getName())

               // set as the active document
               this.tx.send('doc set active', doc)

               // save here also
               this.active = doc
           })
           // .catch( error => {
           // 	// show a popup message
           // 	console.error(`Could not open model ${arl.userPath}, error: ${error}`)            
           // })
       }
    },
    /**
     * @prompt User selected a document 
     * This will bring the document to the foreground.
     * @pin doc selected @ document manager
     * @param {ARL} arl - The ARL of the selected document.
     */
    onDocSelected(arl) {

        this.toForeground(arl)
	},

    /**
     * @prompt Open a document using its ARL.
     * @param {ARL} arl - The ARL of the document to open.
     */
    onDocOpen(arl) {
        this.toForeground(arl)
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
        doc.view.initRoot(Path.nameOnly(arl.userPath))

        // show the tab
        this.tx.send('tab new', arl.getName())

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
	onSaveAs(e) {

        // the position of the popup
        const pos = e ? {x:e.screenX, y:e.screenY} : {x:25, y:25}

        // notation
        const doc = this.active

        // save the old doc name
        const oldName = doc.model.arl.getName()

        // request the path for the save as operation
        this.tx.send("save as filename",{   title:  'Save as...' ,
                                            entry:  doc.model.arl.userPath, 
                                            pos:    pos,
                                            ok:     (userPath) => {

                                                        // save the active document as 
                                                        if (!doc.saveAs(userPath)) return
                                                        
                                                        // and change the doc name
                                                        this.tx.send('tab rename',{oldName, newName: doc.model.arl.getName()})
                                                    },
                                            cancel: ()=>{}
                                        })		
	},
    /**
     * @prompt Save the currently active document.
     * @pin save @ document manager
     */
	onSave() {
        this.active.save()
	},
    /**
     * @prompt Save all currently open documents.
     * @pin save all @ document manager
     */
	onSaveAll() {
        this.documents.forEach( doc => doc.model.arl && doc.save())
	},
    /**
     * @prompt Send a message with the list of open models (as ARLs).
     * @pin get open models @ document manager
     */
	onGetOpenModels() {

        const models = []

        // get all the arl
        this.documents.forEach( doc => {
            if (doc.model.arl) models.push(doc.model.arl)
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
            if (name == this.documents[i].model.arl.getName()) {

                // shift the documents below one position up
                for (let j=i; j<L-1; j++) this.documents[j] = this.documents[j+1]

                // the array is one position shorter
                this.documents.pop()

                // remove the tab
                this.tx.send("tab remove",name)

                // if we close the active doc, we have to change that
                if (name == this.active.model.arl.getName()) {

                    // choose the doc below
                    if (i+1<L-1) {
                        
                        // set the active document
						this.active = this.documents[i+1]

                        // select the tab in the ribbon
                        this.tx.send("tab select", this.active.model.arl.getName())
					}
                    // .. or the doc above
                    else if (i > 0) {

                        // set the active document
                        this.active = this.documents[i-1]

                        // select the tab in the ribbon
                        this.tx.send("tab select", this.active.model.arl.getName())
                    }

                    // or nothing..
                    else this.active = null

                    // the active view is also the selected tab
					this.tx.send('doc set active', this.active )
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
        const doc = this.documents.find( doc => doc.model.arl.getName() == name)

        // if there is already a view, bring the view to the foreground
        if (doc) {

            // if the document is dirty, we save the document
            if (this.active.model.is.dirty) this.active.save()

			// set the doc as the active document
			this.tx.send("doc set active", doc)

            // send out a message
            this.tx.send("tab select", name)

			// set the active doc here also
			this.active = doc
        }
	},

} // document manager.prototype
