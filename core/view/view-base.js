import {GroupNode, Look} from '../node/index.js'
import {shape, style, TextEdit} from '../util/index.js'
import {Selection} from './selection.js'

// all the methods for the view
import {mouseHandling} from './mouse.js'
import {mouseMoveHandling} from './mouse-move.js'
import {mouseDownHandling} from './mouse-down.js'
import {mouseUpHandling} from './mouse-up.js'
import {contextHandling} from './mouse-context.js'
import {nodeHandling} from './view-node.js'
import {selectionHandling} from './view-select.js'
import {groupHandling} from './view-group.js'
import {alignHandling} from './view-select-align.js'
import {keyboardHandling} from './view-keyboard.js'
import {viewWidgetHandling} from './view-widget.js'
import {dropHandling} from './view-drop.js'

// the ongoing action of a view
export const doing = {
    nothing:0,
    nodeDrag:1,
    routeDrag:2,
    panning:3,
    routeDraw:4,
    editTextField:5,
    selection:6,
    selectionDrag:7,
    pinAreaSelect:8,
    pinAreaDrag:9,
    padDrag:10,
    padArrowClicked: 11,
    busDraw:12,
    busRedraw:13,
    busSegmentDrag:14,
    busDrag:15,
    tackDrag:16,
    pinClicked:17,
    pinDrag:18,
    interfaceDrag: 19,
    interfaceNameDrag: 20,
    interfaceNameClicked: 21
}

export function View(rect, node=null, parent=null) {

    // the transform parameters - shift the content below the header of the view window !
    //this.tf = {sx:1.0, sy: 1.0, dx:rect.x, dy:rect.y}
    this.tf = {sx:1.0, sy: 1.0, dx:rect.x, dy:rect.y + style.view.hHeader}

    // the rectangle of the view
    this.rect = rect

    // the widgets of the view itself
    this.widgets = []

    // the (group) root node for which this is the view
    this.root = node

    // the parent view
    this.parent = parent

    // a view can contain other views - the children
    this.views = []

    // on idle we check if we have hit something every x msec
    this.hitTimer = 0

    // the editor state inside the view - action is one of the doing values above
    this.state = {
        action: 0,      
        pad: null,
        node: null,      
        route: null,
        routeSegment: 0,
        cursorInterval: null,
        bus: null,
        busSegment: 0,
        busLabel: null,
        tack: null,
        lookWidget: null,
        hoverOver: null,
        highLighted: false,
        grid: false,
    }

    // the text object that is being edited
    this.textField = new TextEdit()

    // the element on the screen that was hit - 'what' is a constant of type zap defined in mouse.js
    this.hit = {
        what: 0,
        selection : null,
        xyLocal: {x:0, y:0},
        xyScreen: {x:0, y:0},
        pad: null,
        padArrow: false,
        node: null,
        lookWidget: null,
        route: null,
        routeSegment: 0,
        bus:null,
        busSegment: 0,
        busLabel:null,
        tack:null
    }

    // when selecting we keep track of the selection here
    this.selection = new Selection(this)

    // The state of the view - used to set and restore views
    this.viewState = {
        visible: true,
        big: false,
        tf:{sx:1.0, sy:1.0, dx:rect.x, dy:rect.y},
        rect:{...rect}
    }
}
View.prototype = {

    makeRaw() {
        return {
            state: this.viewState.visible ? (this.viewState.big ? 'big':'open' ) : 'closed',
            rect: this.viewState.big ? this.viewState.rect : this.rect,
            tf: this.tf
        }
    },

    stateSwitch(newAction) {

        // check if we need to do something...
        if (this.state.action == doing.editTextField) this.endTextEdit()

        // switch to the new state
        this.state.action = newAction
    },

     // resets the view to a known state
    reset() {
        // reset the state
        const state = this.state
        state.action = doing.nothing
        state.node = null
        state.view = null
        state.route = null

        // reset the selection
        this.selection.reset()

        // reset all the views contained in this view
        this.views.forEach( view => view.reset())
    },

    // make a reasonable rectangle that contains the nodes and is positioned at the group node
    makeViewRect(node) {

        // if there are no nodes, use default values
        let rc = {x:0,y:0,w:0,h:0}

        // make the view rectangle a little bit bigger
        const µ = 0.1

        // if there are nodes...
        if ((node.nodes.length > 0) || (node.pads.length > 0) ) {

            // make a rect that contains all nodes and pads
            rc = this.calcRect(node)

            // create some extra width
            rc.w = rc.w + Math.floor(µ*rc.w)

            // create some extra height
            rc.h = rc.h + Math.floor(µ*rc.h)
        }

        // check
        if (rc.w < style.view.wDefault) rc.w = style.view.wDefault
        if (rc.h < style.view.hDefault) rc.h = style.view.hDefault

        // position the view 
        rc.x = node.look.rect.x;
        rc.y = node.look.rect.y + style.view.hHeader + style.header.hHeader;

        // done
        return rc
    },

    noRect() {
        return (this.rect.w == 0) || (this.rect.h == 0)
    },

    setRect(x,y,w,h) {
        this.rect.x = x
        this.rect.y = y
        this.rect.w = w
        this.rect.h = h
    },

    // when putting nodes in a new view, shift the nodes wrt the new origin to 'stay in place'
    shiftContent(dx, dy) {

        // the nodes
        this.root.nodes.forEach( node => {

            // move the look and the widgets
            node.look.moveDelta(dx,dy)

            // move the routes (only the routes that start at this node)
            node.look.moveRoutes(dx,dy)
        })

        // the buses
        this.root.buses.forEach( bus => bus.move(dx, dy))

        // the pads ???
    },

    translate(dx, dy) {
        this.tf.dx += dx
        this.tf.dy += dy
    },

    resetTransform() {
        this.tf.dx = this.rect.x
        this.tf.dy = this.rect.y
        this.tf.sx = 1.0
        this.tf.sy = 1.0
    },

    setTransform(tf) {
        this.tf.dx = tf.dx
        this.tf.dy = tf.dy
        this.tf.sx = tf.sx
        this.tf.sy = tf.sy
    },

    saveTransform(tf) {
        Object.assign(this.viewState.tf, tf)
    },

    // returns the coordinates of where the middle of the view is in local coordinates
    middle() {

        const tf = this.tf
        const rc = this.rect

        // the middle of the view in local coordinates 
        return {
            x: (rc.x + rc.w/2 - tf.dx)/tf.sx,
            y: (rc.y + rc.h/2 - tf.dy)/tf.sy
        }

    },

    initRoot(name) {
        // create the look for the root
        const look = new Look({x:this.rect.x + this.rect.w/2, y:this.rect.y, w:0, h:0})

        // create a groupnode
        this.root = new GroupNode(look,name)

        // return the root
        return this.root
    },

    // render the view    
    render(ctx) {

        // switch to the style of the file where the node comes from
        const savedStyle = style.switch(this.root?.link?.model?.header?.style)

        // save the current context settings
        ctx.save()

        // notation
        const rc = this.rect
        const st = style.view

        // views with a parent have widgets and a clip rectangle
        if (this.parent) {
        
            // draw the widgets
            for (const widget of this.widgets) widget.render(ctx)
        
            // add a clip rect - but exclude the header
            ctx.rect( rc.x + st.wLine/2 , rc.y + st.hHeader, rc.w - st.wLine, rc.h - st.hHeader)
        
            // set it as a clipping region
            ctx.clip()
        }

        // set the *additional* transform for this window
        const tf = this.tf
        ctx.transform(tf.sx, 0.0, 0.0, tf.sy, tf.dx, tf.dy)

        // draw the grid if necessary
        if (this.state.grid) this.drawGrid(ctx)

        // render the content of the view
        if (this.root) this.renderContent(ctx)

        // if there are other views render them now
        for(const view of this.views) view.render(ctx)
    
        // restore the previous settings
        ctx.restore()

        // restore the style
        style.switch(savedStyle)
    },

    renderContent(ctx) {

        // notation
        const root = this.root

        // if there is a selection, we first render that
        this.selection.render(ctx)    

        // first draw all the routes that originate from the widget (avoids drawing routes twice)
        for(const node of root.nodes) {
            for(const widget of node.look.widgets) {
                if (!widget.routes) continue
                for(const route of widget.routes) {
                    if (route.from == widget) route.render(ctx)
                }
            }
        }

        // draw all the pad routes
        for(const pad of root.pads) {
            for(const route of pad.routes) {
                if (route.from == pad) route.render(ctx)
            }
        }

        // draw all the bus routes
        for(const bus of root.buses) {
            for(const tack of bus.tacks) {
                if(tack.route?.from == tack) tack.route.render(ctx)
            }
        }

        // now render the nodes, pads and buses
        for(const node of root.nodes) node.render(ctx)
        for(const pad of root.pads) pad.render(ctx)
        for(const bus of root.buses) bus.render(ctx)
    },



    highLight() {
        this.state.highLighted = true
        for (const widget of this.widgets) {
            if (widget.is.viewTitle || widget.is.viewBox || widget.is.icon) {
                widget.is.highLighted = true
            }
        }
    },

    unHighLight() {
        this.state.highLighted = false
        for (const widget of this.widgets) {
            if (widget.is.viewTitle || widget.is.viewBox || widget.is.icon) {
                widget.is.highLighted = false
            }
        }
    },

    // get the toplevel view in the stack
    topView() {

        let top = this
        while (top.parent) top = parent
        return top
    },

    drawGrid(ctx) {

        const rc = this.rect
        const tf = this.tf
        const grid = style.view.grid
        
        // the top-left and bottom right coordinates of the view
        const area = {  x:(rc.x - tf.dx)/tf.sx, 
                        y:(rc.y - tf.dy)/tf.sy,
                        w: rc.w/tf.sx,
                        h: rc.h/tf.sy
                    }
        // the grid
        shape.grid(ctx, area.x, area.y, area.w, area.h , grid.dx, grid.dy, grid.cLine, grid.cAxis)
    },

    getNamePath() {

        if (!this.parent) return ''

        let view = this
        let namePath = ''

        while (view.parent) {
            namePath += ' @ ' + view.root.name 
            view = view.parent
        }

        return namePath
    }
}

Object.assign(View.prototype, 
    mouseHandling, 
    mouseDownHandling, 
    mouseMoveHandling,
    mouseUpHandling,
    nodeHandling,
    contextHandling,
    selectionHandling, 
    groupHandling,
    alignHandling,
    keyboardHandling,
    viewWidgetHandling,
    dropHandling)

