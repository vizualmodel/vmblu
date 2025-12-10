import {zap, NONE, SHIFT, CTRL, ALT} from './mouse.js'
import {doing} from './view-base.js'
import {selex} from './selection.js'
import {editor} from '../editor/index.js'

export const mouseDownHandling = {

    saveHitSpot(xyLocal, e) {

        const hit = this.hit

        // save the hit coordinates
        hit.xyLocal.x = xyLocal.x
        hit.xyLocal.y = xyLocal.y
        hit.xyScreen.x = e.x
        hit.xyScreen.y = e.y
    },

    onMouseDown(xyLocal, e) {

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
        if (this.selection.canCancel(hit)) this.selection.reset()

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
                        editor.doEdit('pinDrag',{pin})
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

                        // set the node as selected
                        this.selection.singleNodeAndWidget(hit.node, hit.lookWidget)

                        // highlight the ifName group
                        this.selection.widgets = hit.node.look.highLightInterface(hit.lookWidget)

                        // set a selection rectangle around the selected pins
                        this.selection.pinAreaRectangle()

                        // notation
                        const pins = this.selection.widgets

                        // do the edit
                        editor.doEdit('interfaceDrag',{ group: pins.slice(), oldY: pins[0].rect.y, newY: pins[0].rect.y})

                        // switch to dragging the ifName
                        this.stateSwitch(doing.interfaceDrag) 
                    }
                    break

                    case CTRL|SHIFT:{
                        // Save the edit
                        editor.doEdit('interfaceNameDrag',{ifName: hit.lookWidget})

                        // save the widget
                        this.state.lookWidget = hit.lookWidget

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
                        hit.node.iconClick(this, hit.lookWidget, {x:e.clientX, y:e.clientY})
                    }
                    break

                    case CTRL:{

                        // set the node as selected
                        this.selection.singleNode(hit.node)

                        hit.node.iconCtrlClick(this, hit.lookWidget, {x:e.clientX, y:e.clientY}, editor)
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

                        // do the edit (saves the position)
                        editor.doEdit('nodeDrag',{view:this, node: hit.node})
                    }
                    break

                    case CTRL:{

                        // extend the current selection - set the node as selected
                        this.selection.extend(hit.node)

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag)

                        // drag the node
                        editor.doEdit('selectionDrag',{view: this})
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

                        // do the edit (saves the position)
                        editor.doEdit('nodeDrag',{view:this, node: hit.node})
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

                        // switch to node drag
                        this.stateSwitch(doing.selectionDrag)

                        // drag the node
                        editor.doEdit('selectionDrag',{view: this})
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

                        // the edit will save the current track
                        editor.doEdit('routeDrag', {route: hit.route})

                        // select the route
                        hit.route.select()

                        // save & change the state
                        this.stateSwitch(doing.routeDrag)
                        state.route = hit.route
                        state.routeSegment = hit.routeSegment
                    }
                    break

                    case SHIFT:{

                        //The old route is saved if it would need to be restored
                        editor.doEdit('deleteRoute',{route: hit.route})
                    
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
                        state.pad = hit.pad

                        // if we drag the pad, make sure it is the to-widget in the routes
                        hit.pad.checkRoutesDirection()

                        // highlight the pad routes
                        hit.pad.highLightRoutes()

                        // new state
                        this.stateSwitch(doing.padDrag)

                        // the edit
                        editor.doEdit('padDrag', {pad: hit.pad})
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
                        if (this.selection.what == selex.freeRect){  
                            
                            // drag the whole selection
                            editor.doEdit('selectionDrag', {view: this})
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
                        else if (this.selection.what === selex.pinArea || this.selection.what === selex.ifArea) {
    
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
                                // set state to drag the pin/proxy up and down
                                this.stateSwitch(doing.interfaceDrag) 

                                // notation
                                const pins = this.selection.widgets

                                // drag the area
                                editor.doEdit('interfaceDrag',{ group: pins.slice(), oldY: pins[0].rect.y, newY: pins[0].rect.y})
                            break;

                            case selex.pinArea:
                                // NO MORE PIN AREA DRAG
                                // this.stateSwitch(doing.pinAreaDrag) 
                                // editor.doEdit('pinAreaDrag', this)
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

                                // Save the edit
                                editor.doEdit('interfaceNameDrag',{ifName: widget})

                                // save the widget
                                this.state.lookWidget = hit.lookWidget

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
                        // change state
                        this.stateSwitch(doing.busRedraw)
                        state.bus = hit.bus
                        state.busLabel = hit.busLabel
                        state.bus.is.selected = true

                        // highlight the bus and its connections
                        state.bus.highLight()

                        // start the busdraw
                        editor.doEdit('busDraw',{bus:hit.bus})
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
                            this.stateSwitch(doing.busDrag) 
                            editor.doEdit('busDrag', {bus: hit.bus}) 
                        }
                        else {
                            this.stateSwitch(doing.busSegmentDrag)
                            editor.doEdit('busSegmentDrag', {bus: hit.bus})
                        }
                    }
                    break

                    case SHIFT:{
                    }
                    break

                    case CTRL:{

                        // also save the bus
                        state.bus = hit.bus
                        state.bus.is.selected = true

                        // change state
                        this.stateSwitch(doing.busDrag)

                        // start the drag
                        editor.doEdit('busDrag', {bus: hit.bus})
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

                        // change state
                        this.stateSwitch(doing.tackDrag)
                        state.tack = hit.tack
                        state.tack.route.select()

                        // start the tackdrag
                        editor.doEdit('tackDrag', {tack: hit.tack})
                    }
                    break

                    case SHIFT:{

                        // notation
                        const route = hit.tack.route

                        // stateswitch
                        this.stateSwitch(doing.routeDraw)
                        state.route = route

                        //save the old route
                        editor.doEdit('deleteRoute',{route})

                        // and start rerouting from the last segment
                        route.resumeDrawing(route.wire.length-1, xyLocal)      

                        // select the route
                        route.select()
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
                        editor.doEdit('panning', {view:this})
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

                        // create a new bus (will set state.bus)
                        // editor.doEdit('busCreate',{view: this, pos: xyLocal, cable: false})

                        // // check and switch state
                        // if (this.state.bus) {
                        //     this.state.bus.is.selected = true
                        //     this.stateSwitch(doing.busDraw)
                        // }
                    }
                    break

                    case CTRL|SHIFT:{

                        // create a new *cable* bus (will set state.bus)
                        // editor.doEdit('busCreate',{view: this, pos: xyLocal, cable:true})

                        // // check and switch state
                        // if (this.state.bus) {
                        //     this.state.bus.is.selected = true
                        //     this.stateSwitch(doing.busDraw)
                        // }
                    }
                    break
                }
            }
            break
        }
    },    

}