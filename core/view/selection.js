import {inside,shape, style, eject} from '../util/index.js'
import {zap} from './mouse.js'
import {pinAreaHandling} from './selection-pin-area.js'

// a constant for indicating the selection type
export const selex = {
    nothing: 0,
    freeRect: 1,
    pinArea: 2,
    singleNode: 4,
    multiNode: 5
}

// nodes etc. selectd in the editor
export function Selection(view=null)  {

    // the rectangle
    this.rect= {x:0, y:0, w:0, h:0};

    // when selecting widgets inside a node this is where the selection started
    this.yWidget = 0

    // The color of the selection - can change
    this.color = style.selection.cRect;

    // the selection type
    this.what = selex.nothing

    // the view path
    this.viewPath = view ? view.getNamePath() : '';

    // the selected elements
    this.nodes= [];
    this.pads= [];
    this.buses= [];
    this.tacks= [];
    this.widgets= [];
}
Selection.prototype = {

    render(ctx) {

        // we only use width as a check 
        if (this.what === selex.freeRect || this.what === selex.pinArea) {

            // notation
            const rc = this.rect

            // draw the rectangle
            shape.roundedRect(ctx, rc.x, rc.y, rc.w, rc.h, style.selection.rCorner, 1, this.color.slice(0,7), this.color )
        }
    },

    // keep viewpath and color
    reset() {

        // not active
        this.what = selex.nothing

        // reset yWidget 
        this.yWidget = 0

        // unselect the pins if any
        for (const pin of this.widgets) pin.unSelect()

        // unselect the nodes if any
        for(const node of this.nodes) node.unSelect()

        // clear the selected objects
        this.nodes.length = 0
        this.pads.length = 0
        this.buses.length = 0
        this.widgets.length = 0
        this.tacks.length = 0
    },

    shallowCopy() {

        const selection = new Selection()

        selection.rect = {...this.rect}
        selection.yWidget = this.yWidget
        selection.color= this.color
        selection.what = this.what
        selection.viewPath = this.viewPath
        selection.nodes = this.nodes?.slice()
        selection.pads = this.pads?.slice()
        selection.buses = this.buses?.slice()
        selection.tacks = this.tacks?.slice()
        selection.widgets = this.widgets?.slice()

        return selection
    },

    canCancel(hit) {

        // if we have hit a selection we cannot cancel it
        // if we have not hit it we can cancel the rectangle selections 
        // The single node selection is not cancelled normally

        return (hit.what == zap.selection) ? false : (this.what === selex.freeRect || this.what === selex.pinArea) 
    },

    setRect(x,y,w,h) {

        const rc = this.rect

        rc.x = x
        rc.y = y
        rc.w = w
        rc.h = h
    },

    activate(x,y,w,h, color) {

        this.setRect(x,y,w,h)
        if (color) this.color = color
    },

    // start a free rectangle selection
    freeStart(where) {

        // reset the current selection
        this.reset()

        // free rectangle selection
        this.what = selex.freeRect
 
        // set the x and y value for the selection rectangle
        this.setRect(where.x, where.y, 0, 0)
    },

    singleNode(node) {

        // unselect other - if any
        this.reset()

        // select a single node
        this.nodes = [node]

        // set the selection type
        this.what = selex.singleNode

        // set the rectangle
        node.doSelect()
    },

    singleNodeAndWidget(node, pin) {

        // unselect
        this.reset()

        // reselect
        this.singleNode(node)
        this.widgets = [pin]
        pin.doSelect()
    },

   // extend an existing selection
    extend(node) {

        // if there are no nodes this is the first selection
        if (this.nodes.length <1) {
            this.singleNode(node)
            return
        }

        // if the node is selected - unselect
        if (this.nodes.includes(node)) {

            // remove the node from the array
            eject(this.nodes, node)

            // unselect the node
            node.unSelect()

            // done
            return
        }

        // save the node
        this.nodes.push(node)

        // and set as selected
        node.doSelect()

        // multinode selection
        this.what = selex.multiNode
    },

    // get the single selected node
    getSingleNode() {
        return this.what == selex.singleNode ? this.nodes[0] : null
    },

    getSelectedWidget() {
        return this.what == selex.singleNode ? this.widgets[0] : null
    },

    getPinAreaNode() {
        return ((this.what == selex.pinArea) && this.widgets[0]) ? this.widgets[0].node : null 
    },

    // switch the selected widget
    switchWidget(pin) {

        if (pin) {
            this.widgets[0]?.unSelect()
            pin.doSelect()
            this.widgets[0] = pin
            return
        }
    
        // if no pin is given try below
        const below = this.widgetBelow()
        if (below) return this.switchWidget(below)

        // try above ...
        const above = this.widgetAbove()
        if (above) return this.switchWidget(above)
    },

    widgetBelow() {

        // get node and widget
        const [node, current] = (this.what != selex.singleNode) ? [null, null] : [this.nodes[0], this.widgets[0]]

        // check
        if (!current || !node) return null

        let below = null
        for(const widget of node.look.widgets) {

            if ((widget.is.pin || widget.is.ifName) && 
                (widget.rect.y > current.rect.y) &&
                (!below || (widget.rect.y < below.rect.y))) below = widget
        }

        // done
        return below
    },

    widgetAbove() {

        // get node and widget
        const [node, current] = (this.what != selex.singleNode) ? [null, null] : [this.nodes[0], this.widgets[0]]

        // check
        if (!current || !node) return null

        let above = null
        for(const widget of node.look.widgets) {

            if ((widget.is.pin || widget.is.ifName) && 
                (widget.rect.y < current.rect.y) &&
                (!above || (widget.rect.y > above.rect.y))) above = widget
        }

        // done
        return above
    },

    // check if we have hit the selection
    hitTest(xyLocal) {

        // If there is a rectangle, we have a simple criterion
        if ((this.what == selex.freeRect || this.what == selex.pinArea) && inside(xyLocal, this.rect)) return [zap.selection, this, null]

        // multi-node or single node
        // search the nodes (in reverse - visible node on top of another will be found first)
        for (let i = this.nodes.length-1; i>=0; i--) {
            if (inside(xyLocal, this.nodes[i].look.rect)) return [zap.selection, this, this.nodes[i]]
        }

         // nothing
         return [zap.nothing, null, null]
    },

    setColor(color) {
        this.color = color
    },

    resize(dw, dh) {
        this.rect.w += dw
        this.rect.h += dh
    },

    move(delta) {
        // move the selection rectangle
        this.rect.x += delta.x
        this.rect.y += delta.y
    },

    drag(delta) {

        // *1* move 

        // move the nodes in the selection 
        for( const node of this.nodes) node.look.moveDelta(delta.x, delta.y)

        // also move the pads
        for (const pad of this.pads) pad.move(delta)

        // move the buses if there are nodes in the selection
        if (this.nodes.length > 0)
            for (const bus of this.buses) bus.move(delta.x, delta.y)

        // or otherwise just the bus tacks 
        else 
            for (const tack of this.tacks) tack.slide(delta)

        // move the routes that have start end end points in the selection
        

        // *2* Route adjustments

        // now we adjust the end points of the routes again
        for( const node of this.nodes) node.look.adjustRoutes()

        // adjust the routes for the pads
        for(const pad of this.pads) pad.adjustRoutes()

        // also for the buses
        for (const bus of this.buses) bus.adjustRoutes()      

        // *3* move the selection rectangle

        this.rect.x += delta.x
        this.rect.y += delta.y
    },

    // shallowCopy() {

    //     const slct = new Selection()

    //     // make a shallow copy of the nodes etc
    //     for (const node of this.nodes) slct.nodes.push(node)
    //     for (const bus of this.buses) slct.buses.push(bus)
    //     for (const pad of this.pads) slct.pads.push(pad)
    //     for (const pin of this.widgets) slct.widgets.push(pin)
    //     for (const tack of this.tacks) slct.tacks.push(tack)

    //     // make a real copy of the rect
    //     slct.rect = {...this.rect}

    //     // copy the color
    //     slct.color = this.color

    //     return slct
    // },

    // return the top left node in the selection
    topLeftNode() {

        if (this.nodes.length == 0) return null

        let topleft = this.nodes[0]

        for(const node of this.nodes) {

            if ((node.look.rect.y < topleft.look.rect.y) && (node.look.rect.x < topleft.look.rect.x)) topleft = node
        }

        return topleft
    },

    // make the view wider then the selection because of the added pads
    makeViewRect() {

        const rc = this.rect

        return {x: rc.x - style.view.wExtra, 
                y: rc.y - style.view.hExtra, 
                w: rc.w + 2*style.view.wExtra, 
                h: rc.h + 2*style.view.hExtra}
    },

    // position the new group look as close as possible to the top left node 
    makeLookRect() {

        const topleft = this.topLeftNode()
        const rcSel = this.rect

        const x = topleft ? topleft.look.rect.x : rcSel.x
        const y = topleft ? topleft.look.rect.y : rcSel.y

        // leave w and h at 0
        return {x,y,w:0,h:0}
    },

    adjustPaths(ref) {

        if (!this.nodes) return

        for (const node of this.nodes) node.adjustPaths(ref)
    },


}
Object.assign(Selection.prototype, pinAreaHandling)