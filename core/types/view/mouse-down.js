import {zap, NONE, SHIFT, CTRL, ALT} from './mouse.js'
import {doing} from './view-base.js'
import {selex} from './selection.js'
import {Route} from '../node/index.js'

export const mouseDownHandling = {

    saveHitSpot(xyLocal, e) {

        const hit = this.hit

        // save the hit coordinates
        hit.xyLocal.x = xyLocal.x
        hit.xyLocal.y = xyLocal.y
        hit.xyScreen.x = e.x
        hit.xyScreen.y = e.y
    },

    onMouseDown(xyLocal, e, tx) {

        // notation
        const state = this.state
        const hit = this.hit

        // save the hitspot
        this.saveHitSpot(xyLocal, e)

        // get the binary keys mask
        const keys = this.keyMask(e)

        // check what was hit inside the window - with ctrl-alt we just look for the routes !
        keys === (CTRL|ALT) ?  this.mouseHitRoutes(xyLocal) : this.mouseHit(xyLocal)

        // check if we need to cancel the selection
        if (this.selection.canCancel(hit, keys)) this.selection.reset()

        // check what we have to do
        switch(hit.what){

            case zap.pin: {

                switch(keys) {

                    case NONE:
                    case CTRL|SHIFT: {

                        // save the widget & node
                        state.lookWidget = hit.lookWidget
                        state.node = hit.node

                        // and highlight the routes
                        hit.lookWidget.highLightRoutes()

                        // new state
                        this.stateSwitch(doing.pinClicked)

                        // set the node and pin as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget)
                    }
                    break

                    case SHIFT:{

                        // save the node
                        state.node = hit.node

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.pinAreaSelect)

                        // ..and only then start a new selection
                        this.selection.pinAreaStart(hit.node,xyLocal)
                    }
                    break

                    case CTRL:{

                        // notation
                        const pin = hit.lookWidget

                        // save the pin/proxy to drag..
                        state.lookWidget = pin

                        // set the node and pin as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget)

                        // set state to drag the pin/proxy up and down
                        this.stateSwitch(doing.pinDrag) 

                        // save the edit
                        this.state.modo.left = pin.is.left
                        this.state.modo.pos.y = pin.rect.y
                    }
                    break
                }
            }
            break

            case zap.ifName : {

                switch(keys) {

                    case NONE:{

                        // we select the entire interface here
                        this.selection.interfaceSelect(hit.node,hit.lookWidget)

                        // highlight the ifName group
                        this.selection.widgets = hit.node.look.highLightInterface(hit.lookWidget)

                        // state switch
                        this.stateSwitch(doing.interfaceNameClicked) 
                    }
                    break

                    case SHIFT:{
                       // save the node
                       state.node = hit.node

                       // first switch the state - might end the previous selection !
                       this.stateSwitch(doing.pinAreaSelect)

                       // ..and only then start a new selection
                       this.selection.pinAreaStart(hit.node,xyLocal)
                    }
                    break

                    case CTRL:{

                        // we select the entire interface here
                        this.selection.interfaceSelect(hit.node,hit.lookWidget)

                        // highlight the ifName group
                        this.selection.widgets = hit.node.look.highLightInterface(hit.lookWidget)

                        // notation
                        const pins = this.selection.widgets

                        // save the mouse down position
                        this.state.modo.y = pins[0].rect.y

                        // switch to dragging the ifName
                        this.stateSwitch(doing.interfaceDrag) 
                    }
                    break

                    case CTRL|SHIFT:{

                        // save the widget and its current position
                        this.state.lookWidget = hit.lookWidget
                        this.state.modo.y = hit.lookWidget.rect.y

                        // set the node as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget)

                        // switch to dragging the ifName
                        this.stateSwitch(doing.interfaceNameDrag)
                    }
                    break
                }
            }
            break

            case zap.icon: {

                switch(keys) {

                    case NONE:
                    case SHIFT: {
                        // set the node as selected
                        this.selection.singleNode(hit.node)

                        // exceute the iconclick action
                        hit.node.iconClick(tx, this, hit.lookWidget, {x:e.clientX, y:e.clientY})
                    }
                    break

                    case CTRL:{

                        // set the node as selected
                        this.selection.singleNode(hit.node)

                        hit.node.iconCtrlClick(tx,this, hit.lookWidget, {x:e.clientX, y:e.clientY})
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                }
            }
            break

            case zap.header: {

                switch(keys) {

                    case NONE:
                    case SHIFT: {
                        // set the node as selected
                        this.selection.singleNode(hit.node)

                        // start dragging the node
                        this.stateSwitch(doing.nodeDrag)
                        state.node = hit.node

                        state.modo.pos.x = hit.node.look.rect.x
                        state.modo.pos.y = hit.node.look.rect.y
                    }
                    break

                    case CTRL:{

                        // extend the current selection - set the node as selected
                        this.selection.extend(hit.node)

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag)

                        // save the mouse down position
                        this.state.modo.pos.x = this.selection.rect.x;
                        this.state.modo.pos.y = this.selection.rect.y;
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                }
            }
            break

            case zap.node: {

                switch(keys) {

                    case NONE:{

                        // set the node as selected
                        this.selection.singleNode(hit.node)

                        // start dragging the node
                        this.stateSwitch(doing.nodeDrag)
                        state.node = hit.node

                        // save the mouse down position
                        state.modo.pos.x = hit.node.look.rect.x
                        state.modo.pos.y = hit.node.look.rect.y
                    }
                    break

                    case SHIFT: {

                        // save the node
                        state.node = hit.node

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.pinAreaSelect)

                        // ..and only then start a new selection
                        this.selection.pinAreaStart(hit.node,xyLocal)
                    }
                    break

                    case CTRL:{

                        // extend the current selection - set the node as selected
                        this.selection.extend(hit.node)

                        // save the mouse down position
                        this.state.modo.pos.x = this.selection.rect.x;
                        this.state.modo.pos.y = this.selection.rect.y;

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag)
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }
            }
            break

            case zap.route: {

                switch(keys) {

                    case NONE:
                    case CTRL|ALT:{

                        // save the wire
                        this.state.modo.wire = hit.route.copyWire()

                        // select the route
                        hit.route.select()

                        // save & change the state
                        this.stateSwitch(doing.routeDrag)
                        state.route = hit.route
                        state.routeSegment = hit.routeSegment
                    }
                    break

                    case SHIFT:{

                        // Save the original route so undo can restore it after rerouting.
                        this.doEdit(tx,'deleteRoute',{view: this, route: hit.route, oldRoute: hit.route.clone()})
                    
                        // and start rerouting
                        hit.route.resumeDrawing(hit.routeSegment, xyLocal)

                        // and now select the route
                        hit.route.select()

                        // stateswitch
                        this.stateSwitch(doing.routeDraw)
                        state.route = hit.route
                    }
                    break

                    case CTRL:{
                        const conversion = this.root.convertRouteToCable(hit.route, hit.routeSegment, xyLocal, true)
                        const pendingRoute = conversion?.pending?.route

                        if (!pendingRoute) break

                        this.doEdit(tx,'routeToCable',{conversion})

                        pendingRoute.select()
                        this.stateSwitch(doing.routeDraw)
                        state.route = pendingRoute
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }
            }
            break

            case zap.pad: {

                switch(keys) {

                    case NONE:{
                        // save the pad
                        const pad = state.pad = hit.pad

                        // if we drag the pad, make sure it is the to-widget in the routes
                        pad.checkRoutesDirection()

                        // highlight the pad routes
                        pad.highLightRoutes()

                        this.state.modo.pos.x = pad.rect.x
                        this.state.modo.pos.y = pad.rect.y
                        this.state.modo.wires = pad.copyWires()

                        this.state.modo.pos.x = pad.rect.x
                        this.state.modo.pos.y = pad.rect.y
                        this.state.modo.wires = pad.copyWires()

                        // new state
                        this.stateSwitch(doing.padDrag)
                    }
                    break

                    case SHIFT:{
                    }
                    break

                    case CTRL:{
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }
            }
            break

            case zap.padArrow: {

                switch(keys) {

                    case NONE:{

                        // save the pad
                        state.pad = hit.pad

                        // highlight the pad routes
                        for (const route of hit.pad.routes) route.highLight()

                        // change the state
                        this.stateSwitch(doing.padArrowClicked)
                    }
                    break

                    case SHIFT:{
                    }
                    break

                    case CTRL:{
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }
            }
            break

            case zap.selection: {
                
                switch(keys) {

                    case NONE:{
                        if (this.selection.what === selex.freeRect || this.selection.what === selex.multiNode){  
                            
                            // save the mouse down position
                            this.state.modo.pos.x = this.selection.rect.x;
                            this.state.modo.pos.y = this.selection.rect.y;
                            this.stateSwitch(doing.selectionDrag)
                        } 
                        else if (this.selection.what === selex.ifArea) {

                            // check the widget that was hit
                            const widget = this.selection.widgetHit(xyLocal)

                            if (!widget) return

                            if (widget.is.ifName) {
                                // highlight the ifName group
                                this.selection.widgets = widget.node.look.highLightInterface(widget)

                                // state switch
                                this.stateSwitch(doing.interfaceNameClicked) 
                            }
                            else {  
                                // save the widget & node
                                state.lookWidget = widget
                                state.node = widget.node

                                // and highlight the routes
                                widget.highLightRoutes()

                                // new state
                                this.stateSwitch(doing.pinClicked)

                                // set the node and pin as selected
                                this.selection.singleNodeAndWidget(widget.node, widget)
                            }
                        }
                    }
                    break

                    // on shift we restart the selection
                    case SHIFT:{

                        if (hit.node) {
                            // save the node
                            state.node = hit.node
    
                            // ..and only then start a new selection
                            this.selection.pinAreaStart(hit.node, xyLocal)

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.pinAreaSelect)
                        }
                        else if (this.selection.isPinSelection()) {
    
                            // ..and only then start a new selection
                            this.selection.pinAreaStart(this.selection.getPinAreaNode(), xyLocal)

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.pinAreaSelect)
                        }
                        else {
                            // ..and only then start a new selection
                            this.selection.freeStart(xyLocal)

                            // first switch the state - might end the previous selection !
                            this.stateSwitch(doing.selection)
                        }
                    }
                    break

                    case CTRL:{

                        switch(this.selection.what) {

                            case selex.singleNode:
                            case selex.multiNode: 

                                if (hit.node) this.selection.extend(hit.node)

                            break;

                            case selex.ifArea:

                                // save the mouse down position
                                this.state.modo.y = this.selection.widgets[0].rect.y

                                // set state to drag the pin/proxy up and down
                                this.stateSwitch(doing.interfaceDrag) 
                            break;

                            case selex.pinArea:
                            break;
                        }

                    }
                    break

                    case CTRL|SHIFT:{

                        if (this.selection.what == selex.ifArea) {

                            // check the widget that was hit
                            const widget = this.selection.widgetHit(xyLocal)

                            if (!widget) return

                            if (widget.is.ifName) {

                                // save the widget
                                this.state.lookWidget = widget

                                // save the mouse down position
                                this.state.modo.y = widget.rect.y

                                // set the node as selected
                                this.selection.singleNodeAndWidget(widget.node, widget)

                                // switch to dragging the ifName
                                this.stateSwitch(doing.interfaceNameDrag)
                            }
                        }
                    }
                    break
                }
            }
            break

            case zap.busLabel: {
                switch(keys) {

                    case NONE:{
 
                        state.bus = hit.bus
                        state.busLabel = hit.busLabel
                        state.bus.is.selected = true

                        // highlight the bus and its connections
                        state.bus.highLight()

                        // save the current wire
                        state.modo.wire = hit.bus.copyWire()

                        // change state
                        this.stateSwitch(doing.busRedraw)
                    }
                    break

                    case SHIFT:{
                    }
                    break

                    case CTRL:{
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }


            }
            break

            case zap.busSegment: {
                
                switch(keys) {

                    case NONE:{

                        // save state
                        state.bus = hit.bus
                        state.busSegment = hit.busSegment
                        state.bus.is.selected = true

                        // highlight the bus and its connections
                        hit.bus.highLight()

                        // allow free movement for a single segment...
                        if (hit.bus.singleSegment()) {

                            state.modo.wire = hit.bus.copyWire()
                            state.modo.wires = hit.bus.copyTackWires()
                            this.stateSwitch(doing.busDrag) 
                        }
                        else {
                            state.modo.wire = hit.bus.copyWire()
                            state.modo.wires = hit.bus.copyTackWires()
                            this.stateSwitch(doing.busSegmentDrag)
                        }
                    }
                    break

                    case SHIFT:{
                        if (hit.bus.is.cable) {
                            state.bus = hit.bus
                            state.busSegment = hit.busSegment
                            state.bus.is.selected = true
                            state.modo.wire = hit.bus.copyWire()
                            state.modo.tacks = hit.bus.tacks.slice()
                            state.modo.tackWires = hit.bus.copyTackWires()

                            hit.bus.resumeDrawing(hit.busSegment, xyLocal)

                            this.stateSwitch(doing.busDraw)
                        }
                    }
                    break

                    case CTRL:{

                        const trunk = hit.bus
                        const segment = hit.busSegment
                        const a = trunk.wire[segment - 1]
                        const b = trunk.wire[segment]
                        const point = {x: xyLocal.x, y: xyLocal.y}

                        if (a.x === b.x) {
                            point.x = a.x
                            point.y = Math.min(Math.max(point.y, Math.min(a.y, b.y)), Math.max(a.y, b.y))
                        }
                        else {
                            point.x = Math.min(Math.max(point.x, Math.min(a.x, b.x)), Math.max(a.x, b.x))
                            point.y = a.y
                        }

                        const tack = trunk.newTack()
                        tack.placeOnSegment(point, segment)

                        const route = new Route(tack, null)
                        route.wire = [{...tack.center()}, {...tack.center()}]
                        tack.route = route

                        route.select()
                        this.stateSwitch(doing.routeDraw)
                        state.route = route
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }


            }
            break

            case zap.tack: {
                switch(keys) {

                    case NONE:{

                        state.tack = hit.tack
                        state.tack.route.select()
                        state.modo.wire = hit.tack.route.copyWire()
                        this.stateSwitch(doing.tackDrag)
                    }
                    break

                    case SHIFT:{

                        // notation
                        const route = hit.tack.route

                        // stateswitch
                        state.route = route

                        // Save the original route so undo can restore it after rerouting.
                        this.doEdit(tx,'deleteRoute',{view: this, route, oldRoute: route.clone()})

                        // and start rerouting from the last segment
                        route.resumeDrawing(route.wire.length-1, xyLocal)      

                        // select the route
                        route.select()
                        this.stateSwitch(doing.routeDraw)
                    }
                    break

                    case CTRL:{
                    }
                    break

                    case CTRL|SHIFT:{
                    }
                    break
                }


            }
            break

            case zap.nothing: {

                switch(keys) {

                    case NONE:{

                        // switch state
                        this.stateSwitch(doing.panning)

                        // save the current position
                        this.doEdit(tx,'panning', {view:this})
                    }
                    break

                    case SHIFT:{

                        // first switch the state - might end the previous selection !
                        this.stateSwitch(doing.selection)

                        // ..and only then start a new selection
                        this.selection.freeStart(xyLocal)
                    }
                    break

                    case CTRL:{
                    }
                    break

                    case CTRL|SHIFT:{

                        //create a new *cable* bus (will set state.bus)
                        this.doEdit(tx,'busCreate',{view: this, pos: xyLocal})
                    }
                    break
                }
            }
            break
        }
    },    

}
