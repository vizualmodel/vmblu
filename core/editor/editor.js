import {style, RingStack} from '../util/index.js'
import {mouseHandling} from './editor-mouse.js'
import {keyboardHandling} from "./editor-keyboard.js"
import {messageHandling} from "./editor-message.js"
import {undoRedoHandling} from "./editor-undo-redo.js"

export let editor
export function EditorFactory(tx, sx) {

    // create a new editor
    editor = new Editor()

    // save tx and sx
    editor.tx = tx
    editor.sx = sx

    // set up the editor
    editor.setup()

    // send the canvas to the page layout
    tx.send("canvas", editor.canvas)

    // return the editor
    return editor
}

// state for the editor
export const editorDoing = {
    nothing: 0,
    viewResize: 1,
    viewDrag: 2,
    hoverBorder: 3
}

// The Editor function
export function Editor() {

    // The canvas and context
    this.canvas = null
    this.ctx = null

    // the active document
    this.doc = null

    // The state of the editor (see possible actions above)     *** Not to be confused with the state of the view ! ***
    this.state = {
        view:null,
        widget: null,
        action: editorDoing.nothing,
    }

    // the transmit function and sender
    this.tx = null

    // the settings
    this.sx = null

    // true if we have already launched requestAnimationFrame
    this.waitingForFrame = false
}
Editor.prototype = {

    setup() {
        // create the canvas
        this.canvas = document.createElement("canvas")

        // make the canvas focusable
        this.canvas.setAttribute('tabindex', '0');

        // but avoid the focus outline around it
        this.canvas.style.outline = 'none'

        // create a context
        this.ctx = this.canvas.getContext('2d')

        // set some values that will rarely change
        this.setStyle()
        
        // add the event handlers
        this.addEventHandlers()

        // set the background
        this.clear()
    },

    getCanvasContext() {
        return this.ctx
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

    switchView(view) {

        if (!view) return
 
        // notation
        const doc = this.doc

        // only switch if view is different
        if (view == doc.focus) return;

        // change the apperance
        doc.focus.unHighLight()

        // set the view in focus
        doc.focus = view

        // change the apperance
        doc.focus.highLight()

        // and bring the view to the front in the parent view
        doc.focus.parent?.viewToFront(doc.focus)
    },

    // set some style values that will rarely change
    setStyle() {

        // if we have doc we set the style specified in the doc
        if (this.doc) style.switch(this.doc.model.header?.style)

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

            // clear and redraw
            this.clear()

            // render the document
            this.doc?.view.render(this.ctx) 
            
            // ready for new redraw requests
            this.waitingForFrame = false
        })
    },

    changeCursor(cursor) {
        editor.canvas.style.cursor = cursor
    },

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    xxdeltaForPaste(pos, cb) {

        const slct = cb.selection

        // get the reference to calculate the delta
        const ref = slct.rect ? slct.rect : 
                    slct.nodes?.length > 0 ? slct.nodes[0].look.rect : 
                    slct.pads?.length > 0  ? slct.pads[0].rect : 
                    {x:0, y:0}

        // increment the copy count
        cb.copyCount++
        
        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        if ((ref.x == pos.x) && (ref.y == pos.y)) 

            return {    x: cb.copyCount * style.look.dxCopy, 
                        y: cb.copyCount * style.look.dyCopy}
        else 
            return {    x: pos.x - ref.x + (cb.copyCount-1) * style.look.dxCopy, 
                        y: pos.y - ref.y + (cb.copyCount-1) * style.look.dyCopy }
    },

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    xxxdeltaForPaste(pos, cb) {

        // get the reference to calculate the delta
        const ref = cb.rect ? cb.rect : 
                    cb.root.nodes.length > 0 ? cb.root.nodes[0].look.rect : 
                    cb.root.pads.length > 0  ? cb.root.pads[0].rect : 
                    {x:0, y:0}

        // increment the copy count
        cb.copyCount++
        
        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        if ((ref.x == pos.x) && (ref.y == pos.y)) 

            return {    x: cb.copyCount * style.look.dxCopy, 
                        y: cb.copyCount * style.look.dyCopy}
        else 
            return {    x: pos.x - ref.x + (cb.copyCount-1) * style.look.dxCopy, 
                        y: pos.y - ref.y + (cb.copyCount-1) * style.look.dyCopy }
    },

    // this is to copy to the external windows clipboard
    textToExternalClipboard(text) {

        const blob = new Blob([text], { type: "text/plain" });
        const data = [new ClipboardItem({ ["text/plain"]: blob })];
        navigator.clipboard.write(data)
    },
}
Object.assign(Editor.prototype, mouseHandling, keyboardHandling, messageHandling, undoRedoHandling)


