import {style, convert} from '../util/index.js'
import {selex} from './selection.js'
import {Look, SourceNode} from '../node/index.js'

export const selectionHandling = {

    // finds nodes or routes in the selection rectangle
    getSelected(rect) {

        // notation
        const slct = this.selection

        // check the nodes
        for( const node of this.root.nodes) if (node.overlap(rect)) slct.nodes.push(node)

        // check all pads
        for( const pad of this.root.pads) if (pad.overlap(rect)) slct.pads.push(pad)

        // check the buses and the individual tacks
        for( const bus of this.root.buses) if (bus.overlap(rect)) {

            // ..if so select the bus
            slct.buses.push(bus)

            // ...and select the tacks in the selection
            for( const tack of bus.tacks) if (tack.overlap(rect)) slct.tacks.push(tack)
        }

        // check the cables and the individual tacks
        for( const cable of this.root.cables) if (cable.overlap(rect)) {

            slct.cables.push(cable)

            for( const tack of cable.tacks) if (tack.overlap(rect)) slct.tacks.push(tack)
        }
    },

    // an external widget has a connection with a node outside the selection
    externalWidgets(nodeList) {

        let widgetList = []

        // go through all the widgets of the selected nodes
        nodeList.forEach( node => {
            node.look.widgets.forEach( widget => {
                widget.routes?.forEach( route => {  
                    if ( !nodeList.includes(route.to.node) || !nodeList.includes(route.from.node)) widgetList.push(widget)
                })
            })
        })
        return widgetList
    },


    // if we are copying the same uid, we 
    deltaForPaste(pos, raw) {

        // the position where to paste
        const here = this.selection.pastePos(raw.uid, pos)

        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        return {x: here.x - raw.rect.x, y: here.y - raw.rect.y}
    },

    // save the selection to the clipboard (no copies are made !)
    selectionToClipboard(tx) {

        // get the model from which we take the selection
        const model = this.getManager()?.getModel()

        // check
        if (!model) return

        // send the selection to the clipboard
        tx.send('clipboard.set',{model, selection:this.selection})
    },

    // The raw clipboard was compiled into a model 'root'
    clipboardToSelection(pos, where, content) {

        // calculate where the selection has to be pasted
        const delta = pos ? this.deltaForPaste(pos, content.raw) : {x:0, y:0}

        // initialise the selection
        this.selection.reset()

        // and set the type of selection
        this.selection.what = content.raw.what;

        const pasteNode = (node, delta) => {
            node.look.moveDelta(delta.x, delta.y)
            node.look.moveRoutes(delta.x, delta.y)
            this.root.addNode(node)
            this.selection.nodes.push(node)
        }
        const pasteBus = (bus, delta) => {
            bus.move(delta.x, delta.y)
            this.selection.buses.push(bus)           
        }
        const pasteCable = (cable, delta) => {
            cable.move(delta.x, delta.y)
            this.selection.cables.push(cable)           
        }

        // copy as required
        switch(content.raw.what) {

            case selex.freeRect:

               // paste
                for (const node of content.root.nodes) pasteNode(node, delta)
                for (const bus of content.root.buses) pasteBus(bus, delta)
                for (const cable of content.root.cables ?? []) pasteCable(cable, delta)
                for (const pad of content.root.pads) {}

                // notation
                const rc = content.raw.rect

                // set the rectangle
                this.selection.activate(rc.x + delta.x, rc.y + delta.y, rc.w, rc.h, style.selection.cRect)
            break

            case selex.multiNode:

                // copy the nodes in the clipboard
                for (const node of content.root.nodes) {
                    pasteNode(node, delta)
                    node.doSelect()
                }

                // select the pasted nodes
                break

            case selex.singleNode: {

                // paste the node
                pasteNode(content.root.nodes[0], delta)
                content.root.nodes[0].doSelect()
            }
            break

            case selex.ifArea:
            case selex.pinArea: {

                // check
                if (!where) return

                // add the widgets
                const widgets = where.node.look.rawWidgetsToPinArea(content.raw.widgets, where.pos)

                // add the pads or adjust the rx/tx tables
                where.node.is.source ? where.node.rxtxAddPinArea(widgets) : where.node.addPads(widgets)

                // the selection becomes the widgets that were copied
                this.selection.pinAreaSelect(widgets)
            }
            break

        }
    },

    // The selection which has been pasted might have duplicate names...
    checkPastedNames(n) {

        // check all the nodes in the selection
        for (const pasted of this.selection.nodes) {

            // start at the number given
            let counter = n

            // check if there is a duplicate (999 is just there to avoid endless loops)
            while( this.root.hasDuplicate(pasted) && counter < 999) {

                // put a number after the name
                const newName = convert.addNumber(pasted.name, counter++)

                // change the name
                pasted.updateName(newName)
            }
        }
    },

    // note that the selection is a stored previous selection, not the current one !
    removeSelection(selection) {

        // reset the current selection
        this.selection.reset()

        // remove all the nodes etc.
        for (const node of selection.nodes) this.root.removeNode(node)
        for (const bus of selection.buses) this.root.removeBus(bus)
        for (const cable of selection.cables) this.root.removeCable(cable)
        for (const pad of selection.pads) this.root.removePad(pad)
    },

    // note that the selection is a stored previous selection, not the current one !
    restoreSelection(selection) {

        // restore all the nodes etc.
        for (const node of selection.nodes) this.root.restoreNode(node)
        for (const bus of selection.buses) this.root.restoreBus(bus)
        for (const cable of selection.cables) this.root.restoreCable(cable)
        for (const pad of selection.pads) this.root.restorePad(pad)

        // reset the current selection
        const sel = this.selection
        sel.reset()

        // and put the restored nodes in the selection again
        for (const node of selection.nodes) sel.nodes.push(node)
        for (const bus of selection.buses) sel.buses.push(bus)
        for (const cable of selection.cables) sel.cables.push(cable)
        for (const pad of selection.pads) sel.pads.push(pad)        

        const rc = selection.rect
        sel.activate(rc.x, rc.y, rc.w, rc.h, selection.color)
    },

}
