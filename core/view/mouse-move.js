import {Route} from '../node/index.js'
import {inside} from '../util/index.js'
import {doing} from './view-base.js'
import {zap, NONE, SHIFT, CTRL, ALT} from './mouse.js'
import {editor} from '../editor/index.js'


export const mouseMoveHandling = {

    // onMouseMove returns true or false to signal if a redraw is required or not...
    onMouseMove(xyLocal,e) {  

        // also this is needed
        let dxdyLocal = {x: e.movementX/this.tf.sx, y: e.movementY/this.tf.sy} 

        // notation
        const state = this.state

        // do what we need to do
        switch(state.action) {

            case doing.nothing:
                this.idleMove(xyLocal)
                return false

            case doing.panning:
                this.tf.dx += e.movementX
                this.tf.dy += e.movementY
                return true

            case doing.nodeDrag:
                state.node.move(dxdyLocal)
                return true

            case doing.routeDraw:
                this.drawRoute(state.route, xyLocal)
                return true

            case doing.routeDrag:
                // move the route segment - the drag object is the route
                state.route.moveSegment(state.routeSegment,dxdyLocal)
                return true

            case doing.selection:
                // make the rectangle bigger/smaller
                this.selection.resize(dxdyLocal.x, dxdyLocal.y)
                return true

            case doing.selectionDrag:
                this.selection.drag(dxdyLocal)
                return true

            case doing.pinAreaSelect:
                this.selection.pinAreaResize(state.node, xyLocal)
                return true

            case doing.padDrag:
                state.pad.drag(xyLocal, dxdyLocal)
                return true

            case doing.busDraw:
                state.bus.drawXY(xyLocal)
                return true

            case doing.busRedraw:
                state.bus.resumeDrawXY(state.busLabel,xyLocal,dxdyLocal)
                return true

            case doing.busSegmentDrag:
                state.bus.moveSegment(state.busSegment,dxdyLocal)
                return true

            case doing.busDrag:
                state.bus.drag(dxdyLocal)
                return true

            case doing.tackDrag:
                state.tack.slide(dxdyLocal)
                return true

            case doing.pinDrag:
                state.lookWidget.drag(xyLocal)
                return true

            // OBSOLETE
            case doing.pinAreaDrag:
                // move the rectangle
                // this.selection.pinAreaDrag(dxdyLocal)

                // move the pins
                // this.selection.getPinAreaNode().look.dragPinArea(this.selection.widgets, this.selection.rect)
                return true

            case doing.interfaceNameDrag:
                state.lookWidget.drag(xyLocal)
                return true

            case doing.interfaceDrag:

                // move the rectangle
                this.selection.widgetsDrag(dxdyLocal)

                // swap the widgets if necessary
                this.selection.widgets[0].node.look.swapInterface(xyLocal, this.selection.widgets)
                return true

            case doing.pinClicked:

            // for a simple pin selection we check the keys that were pressed again
            switch(this.keyMask(e)) {

                case NONE: {

                    // if still inside the node - nothing to do
                    if (inside(xyLocal, state.lookWidget.node.look.rect)) return false

                    // draw a route - set the action
                    this.stateSwitch(doing.routeDraw)

                    // create a new route - only the from widget is known
                    state.route = new Route(state.lookWidget, null)

                    // this is the route we are drawing
                    state.route.select()

                    // if the pin we are starting from is a multi message pin, set the route as a twisted pair
                    if (state.lookWidget.is.multi) state.route.setTwistedPair()

                    // add the route to the widget
                    state.lookWidget.routes.push(state.route)  
                    
                    // done 
                    return true
                }

                case SHIFT:{

                    // un highlight the routes
                    state.lookWidget.unHighLightRoutes()

                    // first switch the state - might end the previous selection !
                    this.stateSwitch(doing.pinAreaSelect)

                    // ..and only then start a new selection
                    this.selection.pinAreaStart(state.node,xyLocal)

                    // done 
                    return true
                }

                case CTRL:{

                    // notation
                    const pin = state.lookWidget

                    // set the widget as selected
                    pin.is.selected = true

                    // set state to drag the pin/proxy up and down
                    this.stateSwitch(doing.pinDrag) 

                    // save the edit
                    editor.doEdit('pinDrag',{pin})

                    // done
                    return true
                }

                // if ctrl-shift is pushed we extrude a pad
                case CTRL|SHIFT: {

                    // if still inside the node - nothing to do
                    if (inside(xyLocal, state.lookWidget.node.look.rect)) return false

                    // un highlight the routes
                    state.lookWidget.unHighLightRoutes()

                    // do the edit
                    editor.doEdit('extrudePad',{view: this, pos: xyLocal})

                    // only switch state if the extrusion was successfull
                    if (this.state.pad) {

                        // state switch
                        this.stateSwitch(doing.padDrag)

                        // highlight the pad 
                        for (const route of this.state.pad.routes) route.highLight()
                    }
                    // done
                    return true
                }
            }
            return false

            case doing.interfaceNameClicked:

                // if not moving do nothing
                if ( inside(xyLocal, this.selection.widgets[0].rect)) return false;

                // moving: unselect the node
                //this.selection.nodes[0].unSelect()

                // // set a selection rectangle around the selected pins
                // this.selection.pinAreaRectangle()

                // // switch to dragging the ifName
                // this.stateSwitch(doing.interfaceDrag) 

                // // notation
                // const pins = this.selection.widgets

                // // do the edit
                // editor.doEdit('interfaceDrag',{ group: pins.slice(), oldY: pins[0].rect.y, newY: pins[0].rect.y})
                return true;

            case doing.padArrowClicked:
                // if we move away from the current pin, we start drawing the route
                if ( !inside(xyLocal, state.pad.rect)) {

                    // set the action
                    this.stateSwitch(doing.routeDraw)

                    // create a new route - only the from widget is known
                    state.route = new Route(state.pad, null)

                    // if the pad we are starting from is a multi message pin, set the route as a twisted pair
                    if (state.pad.proxy.is.multi) state.route.setTwistedPair()

                    // this is the route we are drawing
                    state.route.select()

                    // add the route to the widget
                    state.pad.routes.push(state.route)          
                }
                return true

            default:
                return false
        }
    },

    idleMove(xyLocal) {

        // if the timer is running return
        if (this.hitTimer) return false

        // launch a timer
        // this.hitTimer = setTimeout(()=> {
        //     this.hitTimer = 0
        //     this.mouseHit(xyLocal)
        // } ,100)

        return false
    },

    drawRoute(route, xyLocal) {

        // check if we have hit something with our route ...
        this.mouseHit(xyLocal)

        // the following objects have a hover-state
        const hit = this.hit
        const conx =  hit.what == zap.pin ? hit.lookWidget 
                    : hit.what == zap.pad ? hit.pad 
                    : hit.what == zap.busSegment ? hit.bus
                    : null

        // give visual feedback if we hover over a connectable object
        this.hover( conx, conx ? route.checkConxType(route.from, conx) : false )

        // draw the route
        if (conx && (conx.is.pin || conx.is.pad))
            route.endpoint(conx)
        else 
            route.drawXY(xyLocal)
    },

    // clear or set the hover object and set the hover state to ok or nok
    hover(hoverOver, ok) {

        const hit = this.hit
        const state = this.state

        // most frequent case
        if (state.hoverOver == hoverOver) return

        // check if we were hovering
        if (hoverOver) {

            hoverOver.is.hoverOk = ok
            hoverOver.is.hoverNok = !ok

            // keep or reset previous
            if (state.hoverOver) {
                this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false
            }

            // set new
            state.hoverOver = hoverOver
        } 
        else {
            // reset previous
            if (state.hoverOver) {
                this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false
                this.state.hoverOver = null
            }
        }
    },

    stopHover() {
        if (this.state.hoverOver) {
            this.state.hoverOver.is.hoverOk = this.state.hoverOver.is.hoverNok = false
            this.state.hoverOver = null
        }
    }

}