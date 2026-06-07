import {doing} from './view-base.js'
import {zap} from './mouse.js'
import {blockDistance, style} from '../util/index.js'

export const mouseUpHandling = {

    onMouseUp(xyLocal,e, tx) {

        // see what we have hit...
        this.mouseHit(xyLocal, this.state.action === doing.routeDraw ? this.state.route : null)

        // if we need to adjust the undo parameters...
        const state = this.state
        let cable = null

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

                // Use the active hit kind to avoid stale hit fields from an earlier mouse target.
                const conx = this.hit.what == zap.pin ? this.hit.lookWidget
                            : this.hit.what == zap.pad ? this.hit.pad
                            : this.hit.what == zap.busSegment ? this.hit.cable
                            : this.hit.what == zap.route ? this.hit.route
                            : null

                // complete the route or cancel it...
                if (conx?.is?.route && route.checkConxType(route.from, conx)) {
                    this.doEdit(tx,'routeDrawToRoute',{view: this, route, targetRoute: conx, segment: this.hit.routeSegment, xyLocal})
                }
                else {
                    route.connect(conx) ? this.doEdit(tx,'routeDraw',{view: this, route}) : this.doEdit(tx,'routeCancel',{view: this, route})
                }

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

                cable = state.cable;
                cable.is.selected = false
                cable.unHighLight()
                this.stopHover()
                const cableConx = this.hit.lookWidget ?? this.hit.pad ?? null
                this.doEdit(tx,'cableDraw',{view: this, cable, conx: cableConx, oldWire: state.modo.wire, newWire: cable.copyWire(), oldTacks: state.modo.tacks, oldTackWires: state.modo.tackWires ?? state.modo.wires, newTacks: cable.tacks.slice(), newTackWires: cable.copyTackWires()})
                break

            case doing.busSegmentDrag:

                cable = state.cable;
                cable.fuseSegment(state.busSegment)
                cable.is.selected = false
                cable.unHighLight()
                this.doEdit(tx,'cableSegmentDrag', {cable, oldWire: state.modo.wire, oldTackWires: state.modo.wires, newWire: cable.copyWire(), newTackWires: cable.copyTackWires()})
                break

            case doing.busDrag:

                cable = state.cable;
                cable.is.selected = false

                // remove highlight
                state.cable.unHighLight()
                this.doEdit(tx,'cableDrag', {cable, oldWire: state.modo.wire, oldTackWires: state.modo.wires, newWire: cable.copyWire(), newTackWires: cable.copyTackWires()})

                break

            case doing.padDrag: 
                // notation
                const pad = state.pad

                // stop dragging
                pad.endDrag()
                pad.unHighLightRoutes()

                this.doEdit(tx,'padDrag', {pad, oldPos: state.modo.pos, oldWires: state.modo.wires, newPos:{x:pad.rect.x, y:pad.rect.y}, newWires: pad.copyWires()})
                break

            case doing.tackDrag:
                // notation
                const tack = state.tack
                tack.fuseEndSegment()
                tack.route.unSelect()

                this.doEdit(tx,'tackDrag', {tack, oldWire: state.modo.wire, newWire: tack.route.copyWire()})
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
