import {ModelCompiler, ModelMap, UIDGenerator} from '../../types/model/index.js'
import {importExportHandling} from './import-export.js'
import {Redox} from './redox.js'
import {Path} from '../../types/arl/index.js'
import {GroupNode, Look} from '../../types/node/index.js'
//import {undoRedoHandling} from './undo-redo.js'

// The document is the main item handled by the editor

/**
 * @node model manager
 */

export function ModelManager(tx, sx) {

    // save tx, sx
    this.tx = tx
    this.sx = sx

    // The model
    this.model = null

    // The UID generator
    this.UID = new UIDGenerator()

    // Loaded models are shared across document switches
    this.models = new ModelMap()

    // we will need a modelcompiler - also pass the UID generator to the compiler
    this.modcom = new ModelCompiler( this.UID, this.models )

    // we use a different compiler for saving the model - it gets reset every time...
    this.savecom = new ModelCompiler( this.UID, this.models )

    // The arls set by the user for library/application
    this.target = {
        application: null,
        library: null
    }

    // The redox structure for this mode manager
    this.redox = new Redox(this)

}
ModelManager.prototype = {

    async onModelSet(doc) {

        const model = doc?.model ?? null;

        if (!model) return

        this.model = model

        for (const cachedModel of this.models.map.values()) cachedModel.is.main = false
        model.is.main = true

        await this.modcom.refreshRaw(model)

        if (!model.savePoint) model.savePoint = model.raw

        if (!model.root || this.modcom.hasFresh()) {
            this.reCompile(model.raw)
        }
        else {
            model.root = this.ensureContainerRoot(model.root)
            this.tx.send('model.root', model.root)
        }

        this.modcom.resetFresh()
        model.libraries?.load()
    },

    // some edits are async
    async onRedoxDoit({verb, param} = {}) {

        if (!verb || !this.redox[verb]?.doit) return

        // call, but make this.redox the 'this'
        const action = this.redox[verb].doit
        await action.call(this.redox, param)
        this.tx.send('redox.done', {verb})
    },

    onRedoxUndo() {
        const previous = this.redox.getUndo()
        if (!previous) return

        const action = this.redox[previous.verb]?.undo
        if (!action) return

        action.call(this.redox, previous.param)
        this.tx.send('redox.done', {verb: previous.verb})
    },

    onRedoxRedo() {
        const next = this.redox.getUndo()

        if (!next) return

        const action = this.redox[next.verb]?.undo
        if (!action) return

        action.call(this.redox, next.param)
        this.tx.send('redox.done', {verb: next.verb})
    },

    onAcceptChanges() {

        // check
        if (!this.model?.root) return;

        // loop through the nodes of the document
        this.model.root.acceptChanges();

        // redraw
        this.tx.send('redox.done', {verb: 'accept changes'})
    },

   
   onShowSettings() {

        // check
        if (!this.model) return 

        // notation
        const header = this.model.header;
        const tx = this.tx

        // save the current version of the rgb
        const oldRgb = header.style.rgb;

        // send the settings to the popup
        this.tx.send('model.header', {

            title: 'Model Settings',
            path: this.model.getArl()?.getFullPath() ?? '- unspecified -',
            settings: header,
            pos: { x: 25, y: 25 },
            onColor(rgb) {
                header.style.adapt(rgb);
                tx.send('redox.done', {verb: 'accept changes'})
            },
            ok(runtime) {
                header.runtime = runtime;
            },
            cancel() {
                header.style.adapt(oldRgb);
                tx.send('redox.done', {verb: 'accept changes'})
            },
        });
    },

    async onSyncLinks() {

        // if there is no model, nothing to do
        if (!this.model) return

        // notation
        const model = this.model

        // set the main bits
        for (const cachedModel of this.models.map.values()) cachedModel.is.main = false
        model.is.main = true

        // check the models imported by this main model
        await this.modcom.refreshRaw(model)
        
        // check if anything has changed
        if (!this.modcom.hasFresh()) return

        // update the nodes that need to be updated
        if (!model.root || model.blu.is.fresh || model.viz.is.fresh) {
            this.reCompile(model.raw)
        }
        else if (this.modcom.updateLinkedNode(model.root, model.root)) {
            this.tx.send('redox.done', {verb: 'sync links'})
        }

        // reset the fresh bits
        this.modcom.resetFresh()
    },

    onReloadModel() {
    },

    onSyncModel() {
    },

    onMakeLib(e) {
    //     // notation
    //     const doc = this.doc;

    //     // check
    //     if (!doc?.view?.root) return;

    //     // the position of the popup
    //     const pos = { x: e.screenX, y: e.screenY };

    //     // propose a path for the lib
    //     const libPath =
    //         doc.target.library?.userPath ??
    //         Path.getSplit(doc.model.getArl().userPath).name + '.lib.js';

    //     // request the path for the save as operation
    //     this.tx.send('show lib path', {
    //         title: 'Make library build file...',
    //         entry: libPath,
    //         pos: pos,
    //         ok: (libPath) => doc.toJavascriptLib(libPath),
    //         cancel: () => {},
    //     });
    },

    onMakeApp(e) {

        // check that we have a model
        if (! this.model?.root ) return;

        // the position of the popup
        const pos = { x: e.screenX, y: e.screenY };

        // convert to a workspace path
        const appPath =
            this.target.application?.relativeTo(this.model.getArl()) ??
            Path.getSplit(this.model.getArl().getPath()).name + '.app.js';

        // request the path for the save as operation
        this.tx.send('get path', {
            title: 'Make application...',
            path: appPath,
            pos: pos,
            ok: (appPath) => this.model.makeAndSaveApp(appPath, this.model.root),
            cancel: () => {},
        });
    },

    // onRunApp() {
    //     // make the src and the html to run the page
    //     const runable = this.doc.toJavascriptApp(null);

    //     // request to run this
    //     this.tx.send('run', {
    //         mode: 'page',
    //         js: runable.srcArl,
    //         html: runable.htmlArl,
    //     });
    // },

    // onRunAppInIframe() {
    //     const runable = this.doc.toJavascriptApp(null);

    //     // send out the run message
    //     this.tx.send('run', {
    //         mode: 'iframe',
    //         js: runable.srcArl,
    //         html: runable.htmlArl,
    //     });

    //     // check that we have an iframe
    //     if (!this.iframe) {
    //         this.iframe = document.createElement('iframe');
    //         this.tx.send('iframe', this.iframe);
    //     }

    //     // set the url of the iframe
    //     this.iframe.src = runable.htmlArl.url;
    // },

    // group and node are just the names of the nodes
    // async onSelectedNode({ model, nodePath, xyLocal }) {
    //     // find the model in the
    //     const node = await this.doc.nodeFromLibrary(model, nodePath);

    //     // check
    //     if (!node) return;

    //     // move the node to the xyLocal
    //     node.look.moveTo(xyLocal.x, xyLocal.y);

    //     // simply add the node to the active view
    //     this.doEdit('nodeFromNodeLib', { view: this.doc.focus, node });
    // },

    // get the node that needs to be saved
    getNodeToSave() {

        const root = this.model?.root

        // check
        if ( !root || root.is.source) return null

        // if there is only one real node we save that node
        return ( root.isContainer() && (root.nodes.length == 1)) ? root.nodes[0] : root
    },

    ensureContainerRoot(root) {

        if (!root || root.isContainer()) return root

        const container = new GroupNode(new Look({x:0, y:0, w:0, h:0}), '')
        container.nodes.push(root)
        container.is.placed = true

        return container
    },

    reCompile(raw) {

        if (!this.model) return;

        // get the root node in the file - if 'raw' for the model exists, it is used !
        const compiledRoot = raw?.root ? this.modcom.compileRawNode(this.model, raw.root) : null
        const newRoot = this.ensureContainerRoot(compiledRoot)
        
        // check
        if (newRoot) {
            this.model.root = newRoot
            this.tx.send('model.root', newRoot)
        }
        else {
            this.model.root = null
            console.warn(`Empty root for ${this.model.blu.arl.getPath()} - ok for empty file`)
            this.tx.send('model.root', null)
        }

    },

    // Th path parameter is optional
    onModelSave({path=null}) {

        // check
        if (! this.model) return null

        if (path && !this.model.changeArl(path)) return;

        // reset the save compiler
        this.modcom.reset()

        // Get the actual node to save (mostly the root...)
        const toSave = this.getNodeToSave()

        // check
        if (!toSave) return

        // encode the model as two parts
        const raw = this.modcom.encode(toSave, this.model)

        // check
        if (!raw) return

        // set raw in the model again
        this.model.setRaw(raw)

        // and save
        this.model.saveRaw()
    },

    onSavePointSet({}) {
        // check
        if (!this.model?.root) return;

        //title,message, pos,ok, cancel}
        this.tx.send('save point.confirm', {
            title: 'Confirm to set a new save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: () => {

                // Get the actual node to save (mostly the root...)
                const toSave = this.getNodeToSave();

                // check
                if (!toSave) return;

                // get a model compiler for collecting factories and models
                this.modcom.reset()

                // encode the root node as a string, but convert it back to json !
                this.model.savePoint = this.modcom.encode(toSave, this.model);
            },
            cancel: () => {},
        });
    },

    onSavePointBack({}) {

        // check
        if (! this.model || ! this.model.savePoint) return;

        //title,message, pos,ok, cancel}
        this.tx.send('save point.confirm', {
            title: 'Confirm to go back to the previous save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: async () => {

                // just load the model again ...
                this.reCompile(this.model.savePoint);

                // reset the undo stack
                this.redox.undoStack.reset();

                this.tx.send('redox.done')

                // save it - it is the new reference
                try {
                    // save this version
                    const text = JSON.stringify(doc.model.raw, null, 4);

                    // check and save
                    if (text) this.model.getArl().save(text);

                } 
                catch (err) {
                    console.log(`JSON stringify error: ${err}\nin 'on save point back'`);
                }
            },
            cancel: () => {},
        });
    },
}
Object.assign(ModelManager.prototype, importExportHandling)
