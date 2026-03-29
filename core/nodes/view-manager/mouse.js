import {Doing} from './view-manager.js'

export const mouseHandling = {

    prepare(e) {

        // 
        this.canvas.focus()

        // no default action
        e.preventDefault()

        //check
        if (!this.top) return [null, null, null]

        // transform the mouse coord to local coord
        const xyLocal = this.top.localCoord({x:e.offsetX, y:e.offsetY})

        // find if we are in a view
        return this.top.whichView(xyLocal)
    },

    // show the rightclick menu
    onContextMenu(e) {
        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // check if we have hit a view widget
        if (widget) return // this.viewContextMenu(view,widget, e)

        // execute the actions for the view
        view.onContextMenu(xyView, e, this.tx)

        //and redraw
        this.redraw()
    },

    onMouseDown(e) {

        // for mouse down we only accept the left button
        if (e.button != 0) return

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // if the view is not the activeview - switch
        if (view != this.focus) this.switchFocus(view)

        // if we have hit a view widget we have to handle that, otherwise pass to the view
        widget ? this.viewMouseDown(view, widget) : view.onMouseDown(xyView, e, this.tx)

        //and redraw
        this.redraw()
    },

    onMouseMove(e) {    

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // check if something needs to be done about the view first
        if (this.viewMouseMove(view, widget,{x:e.movementX, y:e.movementY})) return

        // execute - only redraw if action returns true
        if (view.onMouseMove(xyView,e, this.tx)) this.redraw()
    },
 
    onMouseUp(e) {

        // if we are doing something with a view, just cancel that
        if (this.state.action) return this.viewMouseUp()

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // execute
        view.onMouseUp(xyView,e, this.tx)

        // redraw
        this.redraw()
    },

    onWheel(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // execute
        //view.onWheel({x:e.offsetX, y:e.offsetY},e)
        view.onWheel(xyView,e)

        // redraw
        this.redraw()
    },

    onDblClick(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // execute
        view.onDblClick(xyView,e, this.tx)
    },

    // a single click in the edit window
    onClick(e) {
        return
    },

    onDragOver(e) {
        e.preventDefault()
    },

    onDrop(e) {

        // prepare
        const [view, widget, xyView] = this.prepare(e)

        // check
        if (!view) return

        // drop the data - do the redraw in onDrop - async function
        view.onDrop(xyView, e)
    },

    // viewContextMenu(view, widget, e) {
    //     if (widget.is.viewTitle) {
    //         viewHeaderCxMenu.prepare(view, tx)
    //         this.tx.send("show context menu", {menu:viewHeaderCxMenu.choices, event:e})
    //     }
    // },

    viewMouseDown(view, widget) {

        if (widget.is.icon) {

            view.iconClick(widget, this)
        }
        else if (widget.is.border) {

            this.state.view = view
            this.state.widget = widget
            this.state.action = Doing.viewResize
        }
        else if (widget.is.viewTitle) {
    
            // if we have hit the title bar - drag the view
            this.state.view = view
            this.state.widget = widget
            this.state.action = Doing.viewDrag
        }
    },

    viewWidgetHover(view, widget) {
        if (widget.is.border) {
            this.state.action = Doing.hoverBorder
            view.highLight()
        }
    },

    viewMouseMove(view, widget, delta) {

        switch( this.state.action ) {

            case Doing.nothing:

                if (! widget?.is.border) return false

                // check the type of cursor to show
                if ((widget.name == "top")||(widget.name == "bottom")) this.canvas.style.cursor = "ns-resize"
                else if ((widget.name == "left")||(widget.name == "right")) this.canvas.style.cursor = "ew-resize"
                else if (widget.name == "corner") this.canvas.style.cursor = "nw-resize"
                else return true

                this.state.action = Doing.hoverBorder
                this.state.view = view
                break

            case Doing.viewDrag:
                this.state.view.move(delta)
                break

            case Doing.viewResize:
                this.state.view.resize(this.state.widget, delta)
                break

            case Doing.hoverBorder:

                // for the current view we keep the cursor as is - otherwise set it to pointer again
                if ( (view != this.state.view) || (! widget?.is.border)) {

                    this.canvas.style.cursor = "default"
                    this.state.action = Doing.nothing
                }
                break

            default: return false
        }

        this.redraw()
        return true
    },

    viewMouseUp() {
        // reset the state
        // if (Doing.hoverBorder) this.state.view.unHighLight()
        this.state.view = this.state.widget = null
        this.state.action = Doing.nothing
    }
}
