import { convert } from '../util/index.js';
import { Path } from '../arl/index.js';
import { ModelCompiler } from '../model/index.js';

export const messageHandling = {
    /**
     * @node editor
     */

    onSetDocument(doc) {
        // the document can be null
        if (!doc) {
            this.doc = null;
            this.redraw();
            return;
        }

        // for a new active doucment, screen size has not yet been set
        if (doc.view.noRect())
            doc.view.setRect(0, 0, this.canvas.width, this.canvas.height);

        // set the document as the active document
        this.doc = doc;

        // switch the node library (it can be empty but not null)
        this.tx.send('change library', {
            ref: doc.model.getArl(),
            libraries: doc.model.libraries,
        });

        // set the style for the document
        this.setStyle();

        // ..and redraw
        this.redraw();
    },

    // reply on the get request
    onGetDocument() {
        // reply the active document
        this.tx.send('reply document', this.doc);
    },

    onShowSettings() {

        // check
        if (!this.doc?.model) return 

        // Get the 
        // const rect = this.canvas.getBoundingClientRect();

        // notation
        const header = this.doc.model.header;
        const redraw = () => this.redraw();

        // save the current version of the rgb
        const oldRgb = header.style.rgb;

        // send the settings to the popup
        this.tx.send('document settings', {
            title: 'Document Settings',
            path: this.doc.model.getArl()?.getFullPath() ?? '- unspecified -',
            settings: header,
            pos: { x: 25, y: 25 },
            onColor(rgb) {
                header.style.adapt(rgb);
                redraw();
            },
            ok(runtime) {
                // save the value of the runtime
                header.runtime = runtime;
            },
            cancel() {
                header.style.adapt(oldRgb);
                redraw();
            },
        });
    },

    onSyncModel() {
        this.doc?.update().then(() => {
            // and redraw
            this.redraw();
        });
    },

    onRecalibrate() {
        // reset the transform data
        this.doc?.view.toggleTransform();

        // and redraw
        this.redraw();
    },

    onGridOnOff() {
        // check
        const state = this.doc?.view?.state;

        // toggle
        if (state) state.grid = !state.grid;

        // redraw
        this.redraw();
    },

    onAcceptChanges() {
        // check
        if (!this.doc) return;

        // loop through the nodes of the document
        this.doc.view.root.acceptChanges();

        // redraw
        this.redraw();
    },

    onSizeChange(rect) {
        // check if the size is given
        if (!rect) return;

        // adjust
        this.canvas.width = rect.w;
        this.canvas.height = rect.h;

        // don't forget to adjust the style
        this.canvas.style.width = rect.w + 'px';
        this.canvas.style.height = rect.h + 'px';

        // Initialize the 2D context
        this.ctx = this.canvas.getContext('2d');

        // we have to reinit the canvas context
        this.setStyle();

        // if there is a document,
        if (this.doc) {
            // change the size of the main view
            this.doc.view?.setRect(0, 0, rect.w, rect.h);

            // and recalculate the screen filling windows
            this.doc.view?.redoBigRecursive();
        }

        // and redraw
        this.redraw();
    },

    onMakeLib(e) {
        // notation
        const doc = this.doc;

        // check
        if (!doc?.view?.root) return;

        // the position of the popup
        const pos = { x: e.screenX, y: e.screenY };

        // propose a path for the lib
        const libPath =
            doc.target.library?.userPath ??
            Path.getSplit(doc.model.getArl().userPath).name + '.lib.js';

        // request the path for the save as operation
        this.tx.send('show lib path', {
            title: 'Make library build file...',
            entry: libPath,
            pos: pos,
            ok: (libPath) => doc.toJavascriptLib(libPath),
            cancel: () => {},
        });
    },

    onMakeApp(e) {
        //notation
        const doc = this.doc;

        // check that we have a model
        if (! doc?.view?.root ) return;

        // CHECK ALSO FOR doc.model.getArl() + message !

        // the position of the popup
        const pos = { x: e.screenX, y: e.screenY };

        // convert to a workspace path
        //const appPath = doc.target.application?.userPath ?? Path.changeExt(doc.model.getArl().userPath, 'js')
        const appPath =
            doc.target.library?.userPath ??
            Path.getSplit(doc.model.getArl().userPath).name + '.app.js';

        // request the path for the save as operation
        this.tx.send('show app path', {
            title: 'Make application...',
            path: appPath,
            pos: pos,
            ok: (appPath) => doc.model.makeAndSaveApp(appPath, doc.view.root),
            //ok: (appPath) => doc.toJavascriptApp(appPath),
            cancel: () => {},
        });
    },

    onRunApp() {
        // make the src and the html to run the page
        const runable = this.doc.toJavascriptApp(null);

        // request to run this
        this.tx.send('run', {
            mode: 'page',
            js: runable.srcArl,
            html: runable.htmlArl,
        });
    },

    onRunAppInIframe() {
        const runable = this.doc.toJavascriptApp(null);

        // send out the run message
        this.tx.send('run', {
            mode: 'iframe',
            js: runable.srcArl,
            html: runable.htmlArl,
        });

        // check that we have an iframe
        if (!this.iframe) {
            this.iframe = document.createElement('iframe');
            this.tx.send('iframe', this.iframe);
        }

        // set the url of the iframe
        this.iframe.src = runable.htmlArl.url;
    },

    onPinProfile({}) {},

    // group and node are just the names of the nodes
    async onSelectedNode({ model, nodePath, xyLocal }) {
        // find the model in the
        const node = await this.doc.nodeFromLibrary(model, nodePath);

        // check
        if (!node) return;

        // move the node to the xyLocal
        node.look.moveTo(xyLocal.x, xyLocal.y);

        // simply add the node to the active view
        this.doEdit('nodeFromNodeLib', { view: this.doc.focus, node });
    },

    onSavePointSet({}) {

        // check
        if (!this.doc?.model) return;

        // make this accessible..
        const doc = this.doc;

        //title,message, pos,ok, cancel}
        this.tx.send('save point confirm', {
            title: 'Confirm to set a new save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: () => {

                // Get the actual node to save (mostly the root...)
                const toSave = doc.getNodeToSave();

                // check
                if (!toSave) return;

                // get a model compiler for collecting factories and models
                const modcom = new ModelCompiler(doc.UID);

                // encode the root node as a string, but convert it back to json !
                doc.model.raw = JSON.parse(modcom.encode(toSave, doc.model));
            },
            cancel: () => {},
        });
    },

    onSavePointBack({}) {

        // check
        if (! this.doc?.model) return;

        // make this accessible..
        const editor = this;
        const doc = this.doc;

        //title,message, pos,ok, cancel}
        this.tx.send('save point confirm', {
            title: 'Confirm to go back to the previous save point',
            message: '',
            pos: { x: 500, y: 100 },
            ok: async () => {
                // just load the model again ...
                // await doc.load()
                doc.reCompile();

                // reset the undo stack
                doc.undoStack.reset();

                // and redraw
                editor.redraw();

                // save it - it is the new reference
                try {
                    // save this version
                    const text = JSON.stringify(doc.model.raw, null, 4);

                    // check and save
                    if (text) doc.model.getArl().save(text);
                } catch (err) {
                    console.log(
                        `JSON stringify error: ${err}\nin 'on save point back'`
                    );
                }
            },
            cancel: () => {},
        });
    },
};
