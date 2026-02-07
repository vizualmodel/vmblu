import {View} from '../view/index.js'
import {Path} from '../arl/index.js'
import {RingStack} from '../util/index.js'
import {ModelCompiler, ModelBlueprint} from '../model/index.js'
import {importExportHandling} from './import-export.js'
import {UIDGenerator} from './uid-generator.js'

// The document is the main item handled by the editor

export function Document(arl=null) {

    // The outer view for this document (contains all the views)
    this.view = new View({x:0,y:0,h:0,w:0})

    // The active view (is one of the views in the view or the view itself)
    this.focus = this.view

    // The model
    this.model = arl ? new ModelBlueprint(arl) : null

    // this is main model
    this.model.is.main = true

    // The UID generator
    this.UID = new UIDGenerator()

    // we will need a modelcompiler - also pass the UID generator to the compiler
    this.modcom = new ModelCompiler( this.UID )

    // we use a different compiler for saving the model - it gets reset every time...
    this.savecom = new ModelCompiler( this.UID )

    // The arls set by the user for library/application
    this.target = {
        application: null,
        library: null
    }

    // the undo stack of size ..31 is just a nr !
    this.undoStack = new RingStack(31)
}
Document.prototype = {

    resolve(path) {
        return this.model?.getArl()?.resolve(path)
    },

    // reset the doc , eg before a new load
    reset() {

        this.model?.reset()
        
        // reset the model compiler
        this.modcom.reset()

        // reset the uid generator
        this.UID.reset()
    },

    // loads a document from file    
    // FILE -> RAW -> MODEL
    async load() {

        //check
        if (! this.model ) return 

        // get the root node in the file - if 'raw' for the model exists, it is used !
        const newRoot = await this.modcom.getRoot(this.model)
        
        // check
        if (newRoot) {
            // set as root in the main view
            this.view.syncRoot(newRoot)            
        }
        else {
            this.view.initRoot(Path.nameOnly(this.model.blu.arl.userPath))
            console.warn(`Empty root for ${this.model.blu.arl.userPath} -  ok for empty file`)
        }

        // load the library files for the document - but don't wait for it....
        this.model.libraries?.load()
    },

    // reparse the raw model (no loading required) -> used in getSavePoint    
    // RAW -> MODEL
    reCompile() {

        this.UID.reset()

        // it is like getRoot but without re-reading all the files
        const newRoot = this.modcom.compileNode(this.model,null)

        // check
        if (newRoot) {
            // set as root in the main view
            this.view.syncRoot(newRoot)            
        }
        else {
            this.view.initRoot(Path.nameOnly(this.model.getArl().userPath))
            console.warn(`Empty root for ${this.model.getArl().userPath} -  ok for empty file`)
        }
    },

    // reconstruct the main model 'raw' from what is in memory and then reload the linked nodes
    // MODEL -> RAW -> MODEL
    async updateLinks() {

        // check
        if (! this.model || ! this.view?.root) return

        // check if the main model needs to be synced
        if (this.model.is.dirty) {

            // sync the model
            this.model.raw = this.modcom.encode(this.view.root, this.model)
            
            // also set the fresh flag
            this.model.is.fresh = true
        }

        // check for any changes in the models
        await this.modcom.updateFactoriesAndModels()

        // update the nodes in the model for which the model has changed
        this.modcom.updateLinkedNode(this.view.root)

        // reset the fresh flag
        this.modcom.resetFresh()
    },

    // MODEL -> RAW -> FILE
    async save() {

        // check
        if (! this.model) return null

        // reset the save compiler
        this.savecom.reset()

        // Get the actual node to save (mostly the root...)
        const toSave = this.getNodeToSave()

        // check
        if (!toSave) return

        // encode the model as two parts
        const raw = this.savecom.encode(toSave, this.model)

        // check
        if (!raw) return

        // set raw in the model again
        this.model.setRaw(raw)

        // and save
        this.model.saveRaw()
    },

    // change the arl and save
    async saveAs(path) {

        if (!this.model.changeArl(path)) return;
        return this.save()
    },



    // get the node that needs to be saved
    getNodeToSave() {

        // notation
        const root = this.view.root

        // check
        if ( !root || root.is.source) return null

        // if there is only one real node we save that node
        const toSave = ( root.isContainer() && (root.nodes.length == 1)) ? root.nodes[0] : root

        // save the view - but at the toplevel only the tf is used
        if (toSave == root) toSave.savedView = this.view;

        // done
        return toSave
    }
}
Object.assign(Document.prototype, importExportHandling)
