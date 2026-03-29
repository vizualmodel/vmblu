import {style} from '../../types/util/index.js'

export const messageHandling = {
    /**
     * @node view manager
     */

    onTopLevelView(doc) {

        const view = doc?.view ?? null;

        if (!view) {
            this.top = null;
            this.focus = null;
            this.model = null;
            this.redraw();
            return;
        }

        // Ensure the top view has at least the canvas bounds.
        if (view.noRect?.()) {
            view.setRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // set the viewmanager for the top-level view
        view.manager = this

        // save in the manager
        this.top = view;
        this.focus = view;
        this.model = doc.model;
        this.redraw();
    },

    onRoot(root) {
        if (!this.top || !root) return;
        this.top.syncRoot(root);
        this.redraw();
    },

    onRedoxDone() {
        this.redraw()
    },

    onRecalibrate() {

        // reset the transform data
        this.top?.toggleTransform();

        // and redraw
        this.redraw();
    },

    onGridOnOff() {
        // check
        const state = this.top?.state;

        // toggle
        if (state) state.grid = !state.grid;

        // redraw
        this.redraw();
    },

 
    onSizeChange(rect) {
        // check if the size is given
        if (!rect) return;
        
        // adjust - note that dpr will normally not change but it is possible (move to different monitor for example)
        const dpr = rect.dpr ?? window.devicePixelRatio ?? 1;

        // set the witdh and height
        this.canvas.width = Math.round(rect.w * dpr);
        this.canvas.height = Math.round(rect.h * dpr);

        // keep CSS size in sync with the logical size
        this.canvas.style.width = rect.w + 'px';
        this.canvas.style.height = rect.h + 'px';

        // Initialize the 2D context
        this.ctx = this.canvas.getContext('2d');
        const sx = this.canvas.width / rect.w;
        const sy = this.canvas.height / rect.h;
        this.ctx.setTransform(sx, 0, 0, sy, 0, 0);

        // if there is a document,
        if (this.top) {
            
            // change the size of the main view
            this.top.setRect(0, 0, rect.w, rect.h);

            // and recalculate the screen filling windows
            this.top.redoBigRecursive();
        }

        // and redraw
        this.redraw();
    },

};
