// ------------------------------------------------------------------
// Source node: DocumentManager
// Creation date 9/24/2023, 10:28:10 AM
// ------------------------------------------------------------------

import {Path, ARL} from '../../types/arl/index.js'
import {Document, TextDocument} from './document.js'

//Constructor for document manager
export function DocumentManager(tx, sx) {

    // save the transmitter
    this.tx = tx

	// the document that is being handled by the editor
	this.active = null

    // ARL currently being opened. Loading is owned here so every document
    // source (workspace, source navigation, URL parameters) behaves alike.
    this.loading = null
    this.loadingSequence = 0

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
            doc.getArl()?.equals(arl)
        )
    },

    makeDocument(arl, line=null) {
        return arl?.getPath?.()?.toLowerCase().endsWith('.blu')
            ? new Document(arl)
            : new TextDocument(arl, line)
    },

    activateDocument(doc) {
        this.active = doc ?? null

        if (doc?.kind === 'text') {
            this.tx.send('doc.set active', null)
            this.tx.send('text.set active', doc)
        }
        else {
            this.tx.send('text.set active', null)
            this.tx.send('doc.set active', doc ?? null)
        }
    },

    openDocument(arl, line=null) {

        const doc = this.makeDocument(arl, line)

        // save in the list
        this.documents.push(doc)

        // set a new tab
        this.tx.send('tab.new', doc.getTab())

        // set as the active document
        this.activateDocument(doc)
    },

	// bring an existing document to the foreground
    toForeground(doc) {

        // check
        if (!doc) return 

        // select the tab for the doc
        this.tx.send("tab.select", doc.getTabId())

        // set the doc as the active document
        this.activateDocument(doc)
    },

    /**
     * @prompt User selected a document 
     * This will bring the document to the foreground.
     * @pin doc selected @ document manager
     * @param {ARL} arl - The ARL of the selected document.
     */
    async onDocSelected(arl) {

        const request = arl?.arl ? arl : {arl}
        const sequence = this.beginLoading(request.arl)
        try {
            const docArl = await this.resolveDocumentArl(request.arl)
            if (sequence !== this.loadingSequence) return
            this.loading = docArl
            const doc = this.haveDocument(docArl)
            if (doc && Number.isInteger(request.line)) doc.line = request.line
            doc ? this.toForeground(doc) : this.openDocument(docArl, request.line)
        }
        catch (error) {
            if (sequence === this.loadingSequence) this.failLoading(request.arl, error)
        }
	},

    /**
     * @prompt Open a document using its ARL.
     * @param {ARL} arl - The ARL of the document to open.
     */
    async onDocOpen(arl) {

        const request = arl?.arl ? arl : {arl}
        const sequence = this.beginLoading(request.arl)
        try {
            const docArl = await this.resolveDocumentArl(request.arl)
            if (sequence !== this.loadingSequence) return
            this.loading = docArl
            const doc = this.haveDocument(docArl)
            if (doc && Number.isInteger(request.line)) doc.line = request.line
            doc ? this.toForeground(doc) : this.openDocument(docArl, request.line)
        }
        catch (error) {
            if (sequence === this.loadingSequence) this.failLoading(request.arl, error)
        }
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
        this.tx.send('tab.new', doc.getTab())

		// set the document
		this.activateDocument(doc)
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

        // Text files save directly through their ARL. Save As remains a model
        // operation until the workspace exposes a generic destination picker.
        if (doc.kind !== 'model') return

        // save the old doc name
        const oldName = doc.getTabId()

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
            if (doc.kind === 'model' && doc.getArl()) models.push(doc.getArl())
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
        const index = this.documents.findIndex((doc) => doc.getTabId() === name)
        if (index < 0) return

        const [closed] = this.documents.splice(index, 1)
        this.tx.send('tab.remove', name)

        if (closed !== this.active) return

        const next = this.documents[index] ?? this.documents[index - 1] ?? null
        if (next) this.tx.send('tab.select', next.getTabId())
        this.activateDocument(next)
    },

    /**
     * @prompt Select a tab/document by name.
     * @pin tab request to select
     * @param {string} name - Name of the tab to select.
     */
	onTabRequestToSelect(name) {

        // check if the file is in the list of open files
        const doc = this.documents.find( doc => doc.getTabId() == name)

        // if there is already a view, bring the view to the foreground
        if (!doc) return

        // set the doc as the active document
        this.activateDocument(doc)

        // send out a message
        this.tx.send("tab.select", name)

	},

    onFileSaveActive() {
        if (this.active?.kind === 'text') this.tx.send('text.save', this.active)
    },

    beginLoading(arl) {
        const sequence = ++this.loadingSequence
        if (!arl) return sequence
        this.loading = arl
        this.tx.send('file.loading', arl)
        return sequence
    },

    finishLoading(arl) {
        if (!this.loading) return
        const sameArl = !arl || this.loading?.equals?.(arl) || arl?.equals?.(this.loading)
        const loadingPath = this.loading?.getFullPath?.()
        const completedPath = arl?.getFullPath?.()
        const samePath = Boolean(loadingPath && completedPath && loadingPath === completedPath)
        if (!sameArl && !samePath) return
        this.loading = null
        this.tx.send('file.loaded', arl)
    },

    failLoading(arl, error) {
        if (!this.loading) return
        const sameArl = !arl || this.loading?.equals?.(arl) || arl?.equals?.(this.loading)
        const loadingPath = this.loading?.getFullPath?.()
        const failedPath = arl?.getFullPath?.()
        const samePath = Boolean(loadingPath && failedPath && loadingPath === failedPath)
        if (!sameArl && !samePath) return
        if (error) console.error(`Could not load ${arl?.getPath?.() ?? 'document'}:`, error)
        this.loading = null
        this.tx.send('file.failed', arl)
    },

    onModelLoaded(arl) {
        this.finishLoading(arl)
    },

    onTextLoaded(arl) {
        this.finishLoading(arl)
    },

    onModelFailed(arl) {
        this.failLoading(arl)
    },

    onTextFailed(arl) {
        this.failLoading(arl)
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
