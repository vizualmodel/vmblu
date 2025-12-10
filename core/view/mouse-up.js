import {doing} from './view-base.js'
import {blockDistance, style} from '../util/index.js'
import {editor} from '../editor/index.js'

export const mouseUpHandling = {

    onMouseUp(xyLocal,e) {

        // see what we have hit...
        this.mouseHit(xyLocal)

        // if we need to adjust the undo parameters...
        let undo = null

        // check the state state
        switch (this.state.action) {

            case doing.routeDraw: 
                // notation
                const route = this.state.route

                // deselect the route
                route.unSelect()

                // keep the pin highlighted, but un highlight the other routes
                route.from.unHighLightRoutes()

                // no more hovering
                this.stopHover()

                // what did we hit..
                const conx = this.hit.lookWidget ?? this.hit.bus ?? this.hit.pad ?? null;

                // complete the route or cancel it...
                route.connect(conx) ? editor.doEdit('routeDraw',{route}) : route.popFromRoute()

                break

            case doing.routeDrag:
                // check if we should combine two segments
                this.state.route.endDrag(this.state.routeSegment)
                this.state.route.unSelect()

                // save the new situation
                editor.getParam().newWire = this.state.route.copyWire()
                break

            case doing.selection:
                if (this.selection.rect) this.getSelected(this.selection.rect)
                break

            case doing.selectionDrag:
                // adjust the parameters for the undo operation
                editor.getParam().newPos = {x: this.selection.rect.x, y: this.selection.rect.y}
                break

            case doing.pinAreaSelect:
                break

            case doing.nodeDrag: 
                // get the node being dragged
                const node = this.state.node

                // remove 'kinks' in the routes
                node.look.snapRoutes()

                // get the parameters
                const param = editor.getParam()

                // adjust the parameters for the undo operation
                param.newPos = {x: node.look.rect.x, y: node.look.rect.y}

                // do a node drag check - if too small remove from redox stack
                if (blockDistance(param.oldPos, param.newPos) < style.look.smallMove) {

                    // move the node back, but keep the y value to keep the 'snap' intact (?)
                    node.move({x: param.oldPos.x - param.newPos.x, y:0})

                    // don't save the edit
                    editor.dropLastEdit()
                }
                break

            case doing.busDraw:
            case doing.busRedraw:
                this.state.bus.is.selected = false

                // remove highlight
                this.state.bus.unHighLight()

                // adjust the parameters for the undo operation
                editor.getParam().newWire = this.state.bus.copyWire()
                break

            case doing.busSegmentDrag:
                this.state.bus.fuseSegment(this.state.busSegment)
                this.state.bus.is.selected = false

                // remove highlight
                this.state.bus.unHighLight()

                // adjust the parameters for the undo operation
                undo = editor.getParam()
                undo.newWire = this.state.bus.copyWire()
                undo.newTackWires = this.state.bus.copyTackWires()
                break

            case doing.busDrag:
                //this.state.bus.fuseSegment(this.state.busSegment)
                this.state.bus.is.selected = false

                // remove highlight
                this.state.bus.unHighLight()

                // adjust the parameters for the undo operation
                undo = editor.getParam()
                undo.newWire = this.state.bus.copyWire()
                undo.newTackWires = this.state.bus.copyTackWires()
                break

            case doing.padDrag: 
                // notation
                const pad = this.state.pad

                // stop dragging
                pad.endDrag()

                // remove the highlights
                pad.unHighLightRoutes()
                //for (const route of pad.routes)  route.unHighLight()

                // the undo verb could be an extrudePad
                if (editor.getVerb() == 'extrudePad') break

                // no, adjust the parameters
                undo = editor.getParam()
                undo.newPos = {x:pad.rect.x, y:pad.rect.y}
                undo.newWires = pad.copyWires()
                break

            case doing.tackDrag:
                // notation
                const tack = this.state.tack
                tack.fuseEndSegment()
                tack.route.unSelect()

                // adjust the parameters for the undo operation
                editor.getParam().newWire = tack.route.copyWire()
                break

            case doing.pinDrag:

                // notation
                const pin = this.state.lookWidget

                // un highlight the routes
                this.state.lookWidget.unHighLightRoutes()

                // save the new position
                editor.getParam().newPos = {left: pin.is.left, y: pin.rect.y}
                break

            // OBSOLETE
            case doing.pinAreaDrag:
                // editor.getParam().newY = this.selection.widgets[0].rect.y
                break

            case doing.interfaceNameDrag: {

                // notation
                const ifName = this.state.lookWidget

                // save the new position
                editor.getParam().newY = ifName.rect.y
            }
            break

            case doing.interfaceDrag: {

                // notation
                const ifName = this.selection.widgets[0]

                // remove the highlights when moving away from the ifName
                ifName?.node.look.unhighLightInterface(this.selection.widgets)

                // adjust the undo parameter
                editor.getParam().newY = ifName.rect.y

                // done - set the widget and node as selected
                this.selection.singleNodeAndWidget(ifName.node, ifName)
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
                this.state.lookWidget.unHighLight()

                // unhighlight the routes
                this.state.lookWidget.unHighLightRoutes()
                break

            case doing.padArrowClicked:
                this.state.pad.unHighLight()
                for (const route of this.state.pad.routes) route.unHighLight()
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