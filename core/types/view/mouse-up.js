import {doing} from './view-base.js'
import {blockDistance, style} from '../util/index.js'

export const mouseUpHandling = {

    onMouseUp(xyLocal,e, tx) {

        // see what we have hit...
        this.mouseHit(xyLocal)

        // if we need to adjust the undo parameters...
        const state = this.state
        let bus = null

        // check the state state
        switch (state.action) {

            case doing.routeDraw: 
                // notation
                const route = state.route

                // deselect the route
                route.unSelect()

                // keep the pin highlighted, but un highlight the other routes
                route.from.unHighLightRoutes()

                // no more hovering
                this.stopHover()

                // what did we hit..
                const conx = this.hit.lookWidget ?? this.hit.bus ?? this.hit.pad ?? null;

                // complete the route or cancel it...
                route.connect(conx) ? this.doEdit(tx,'routeDraw',{route}) : route.popFromRoute()

                break

            case doing.routeDrag:
                // check if we should combine two segments
                state.route.endDrag(state.routeSegment)
                state.route.unSelect()
                this.doEdit(tx,'routeDrag', {route: this.hit.route, oldWire:state.modo.wire, newWire:state.route.copyWire()})
                break

            case doing.selection:
                if (this.selection.rect) this.getSelected(this.selection.rect)
                break

            case doing.selectionDrag:
                this.doEdit(tx,'selectionDrag',{view: this, oldPos: state.modo.pos, newPos:{x: this.selection.rect.x, y: this.selection.rect.y}})
                break

            case doing.pinAreaSelect:
                break

            case doing.nodeDrag: 
                // get the node being dragged
                const node = state.node

                const oldPos = state.modo.pos
                const newPos = {x: node.look.rect.x, y: node.look.rect.y}

                // remove 'kinks' in the routes
                node.look.snapRoutes()

                if (blockDistance(oldPos, newPos) < style.look.smallMove) 
                    // move the node back, but keep the y value to keep the 'snap' intact (?)
                    node.move({x: oldPos.x - newPos.x, y:0})
                else 
                    this.doEdit(tx,'nodeDrag',{view:this, node, oldPos, newPos})

                break

            case doing.busDraw:
            case doing.busRedraw:

                bus = state.bus;
                bus.is.selected = false
                bus.unHighLight()
                this.doEdit(tx,'busDraw',{bus, oldWire: state.modo.wire, newWire:bus.copyWire()})
                break

            case doing.busSegmentDrag:

                bus = state.bus;
                bus.fuseSegment(state.busSegment)
                bus.is.selected = false
                bus.unHighLight()
                this.doEdit(tx,'busSegmentDrag', {bus, oldWire: state.modo.wire, oldWires: state.modo.wires, newWire: bus.copyWire(), newTackWires: bus.copyTackWires()})
                break

            case doing.busDrag:

                bus = state.bus;
                bus.is.selected = false

                // remove highlight
                state.bus.unHighLight()
                this.doEdit(tx,'busDrag', {bus, oldWire: state.modo.wire, oldWires: state.modo.wires, newWire: bus.copyWire(), newTackWires: bus.copyTackWires()})

                break

            case doing.padDrag: 
                // notation
                const pad = state.pad

                // stop dragging
                pad.endDrag()
                pad.unHighLightRoutes()

                this.doEdit(tx,'padDrag', {pad: hit.pad, oldPos: state.modo.pos, oldWires: state.modo.wires, newPos:{x:pad.rect.x, y:pad.rect.y}, newWires: pad.copyWires()})
                break

            case doing.tackDrag:
                // notation
                const tack = state.tack
                tack.fuseEndSegment()
                tack.route.unSelect()

                this.doEdit(tx,'tackDrag', {tack: hit.tack, oldWire: state.modo.wire, newWire: tack.route.copyWire()})
                break

            case doing.pinDrag:

                // notation
                const pin = state.lookWidget

                // un highlight the routes
                state.lookWidget.unHighLightRoutes()

                // confirm the change
                this.doEdit(tx,'pinDrag',{pin, oldY: state.modo.y, oldLeft: state.modo.left})
                break

            // OBSOLETE
            case doing.pinAreaDrag:
                break

            case doing.interfaceNameDrag: {
                this.doEdit(tx,'interfaceNameDrag',{ifName: state.lookWidget, oldY: state.modo.y, newY: state.lookWidget.rect.y})
            }
            break

            case doing.interfaceDrag: {

                // notation
                const ifName = this.selection.widgets[0]

                // remove the highlights when moving away from the ifName
                ifName?.node.look.unhighLightInterface(this.selection.widgets)

                this.doEdit(tx,'interfaceDrag',{group:this.selection.widgets.slice(), oldY:state.modo.y, newY:ifName.rect.y});

                // done - set the widget and node as selected
                this.selection.interfaceSelect(ifName.node,ifName)
            }
            break;

            case doing.interfaceNameClicked: {

                // notation
                const ifName = this.selection.widgets[0]

                // remove the highlights when moving away from the ifName
                ifName?.node.look.unhighLightInterface(this.selection.widgets)
            }
            break;

            case doing.pinClicked:

                // un highlight the pin
                state.lookWidget.unHighLight()

                // unhighlight the routes
                state.lookWidget.unHighLightRoutes()
                break

            case doing.padArrowClicked:
                state.pad.unHighLight()
                for (const route of state.pad.routes) route.unHighLight()
                break


            case doing.panning: 
                break

            default:
                break
        }
        // reset the state
        this.stateSwitch(doing.nothing)
    },

}