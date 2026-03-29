import {style} from '../../types/util/index.js'
import {mouseHandling} from './mouse.js'
import {keyboardHandling} from "./keyboard.js"
import {messageHandling} from "./message.js"

// state for the editor
export const Doing = {
    nothing: 0,
    viewResize: 1,
    viewDrag: 2,
    hoverBorder: 3
}

/**
 * @node view manager
 */
export function ViewManager(tx, sx) {

    // The canvas and context
    this.canvas = null
    this.ctx = null

    // The top level view
    this.top = null

    // The model in the top level view
    this.model = null

    // The view that has the focus
    this.focus = null

    // The state
    this.state = {
        view: null,
        widget: null,
        action: Doing.nothing,
    }

    // the transmit function and sender
    this.tx = tx

    // the settings
    this.sx = sx

    // true if we have already launched requestAnimationFrame
    this.waitingForFrame = false

    // set up this node
    this.setup()

    // send the canvas so that it can be placed on screen
    this.tx.send("canvas", this.canvas)
}
ViewManager.prototype = {

    setup() {
        // create the canvas
        this.canvas = document.createElement("canvas")

        // make the canvas focusable
        this.canvas.setAttribute('tabindex', '0');

        // but avoid the focus outline around it
        this.canvas.style.outline = 'none'

        // create a context
        this.ctx = this.canvas.getContext('2d')

        // initialize the canvas context styling
        this.setContextStyle()
        
        // add the event handlers
        this.addEventHandlers()

        // set the background
        this.clear()
    },

    getCanvasContext() {
        return this.ctx
    },

    getModel() {
        return this.model
    },

    addEventHandlers() {

        // add the keyboard handlers to the document
        document.addEventListener('keydown', (e)=> this.onKeydown(e) )
        document.addEventListener('keyup', (e) => this.onKeyup(e) )

        // add mouse related event listeners to the canvas
        this.canvas.addEventListener('mousedown',(e)=>this.onMouseDown(e))
        this.canvas.addEventListener('mouseup',(e)=>this.onMouseUp(e))
        this.canvas.addEventListener('mousemove',(e)=>this.onMouseMove(e))
        this.canvas.addEventListener('mousewheel',(e)=>this.onWheel(e))
        this.canvas.addEventListener('contextmenu',(e)=>this.onContextMenu(e))
        this.canvas.addEventListener('click',(e)=>this.onClick(e))
        this.canvas.addEventListener('dblclick',(e)=>this.onDblClick(e))
        this.canvas.addEventListener('dragover',(e)=>this.onDragOver(e))
        this.canvas.addEventListener('drop',(e)=>this.onDrop(e))

        // not reliable
        //this.canvas.addEventListener('keydown', (e)=> this.onKeydown(e) )
        //this.canvas.addEventListener('keyup', (e) => this.onKeyup(e) )

        // just for testing
        // this.canvas.addEventListener('focus', () => console.log('Canvas is focused'));
        // this.canvas.addEventListener('blur', () => console.log('Canvas lost focus'));
    },

    // clear the screen
    clear() { 
        this.ctx.fillStyle = style.std.cBackground
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height)
    },

    switchFocus(view) {

        if (!view) return

        // only switch if view is different
        if (view == this.focus) return;

        // change the apperance
        this.focus.unHighLight()

        // set the view in focus
        this.focus = view

        // change the apperance
        this.focus.highLight()

        // and bring the view to the front in the parent view
        this.focus.parent?.viewToFront(this.focus)
    },

    // copy the active style values into the 2D context
    setContextStyle() {

        // switch to the style of the model or keep the default style
        if (this.model?.header?.style) style.switch(this.model.header.style)

        // also set the standard ctx values 
        const ctx = this.ctx
        const std = style.std

        ctx.font = std.font
        ctx.strokeStyle = std.cLine
        ctx.fillStyle = std.cFill
        ctx.lineCap = std.lineCap
        ctx.lineJoin = std.lineJoin
        ctx.lineWidth = std.lineWidth
    },

    redraw() {

        // if we are already waiting for a frame, nothing to do
        if (this.waitingForFrame) return;

        // change to waiting status
        this.waitingForFrame = true

        // launch request
        window.requestAnimationFrame( ()=> {

            // Establish the top-level style for this frame before any paint.
            this.setContextStyle()

            // clear and redraw
            this.clear()

            // render the topview and all the views in it
            this.top?.render(this.ctx) 
            
            // ready for new redraw requests
            this.waitingForFrame = false
        })
    },

    changeCursor(cursor) {
        this.canvas.style.cursor = cursor
    },

    // Centralized UI egress for context-menu rendering.
    showContextMenu(payload) {
        this.tx.send('show context menu', payload)
    },

    // this is to copy to the external windows clipboard
    textToExternalClipboard(text) {

        const blob = new Blob([text], { type: "text/plain" });
        const data = [new ClipboardItem({ ["text/plain"]: blob })];
        navigator.clipboard.write(data)
    },
}
Object.assign(ViewManager.prototype, mouseHandling, keyboardHandling, messageHandling)


