import {style, convert} from '../util/index.js'
import {editor} from '../editor/index.js'
import {selex} from './selection.js'

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

    // to calculate the delta it does not matter if the copy and paste are in the same or in different views
    // The delta is simply a value to go from one coordinate value to another
    // cb is the clipboard
    deltaForPaste(pos, cb) {

        if (!pos) return null;

        // increment the copy count
        cb.copyCount++

        const slct = cb.selection

        const ref = (slct.what == selex.freeRect) ? slct.rect : (slct.what == selex.multiNode) ? slct.nodes[0].look.rect  : {x:0, y:0}

        // if the position is the same as the reference - move the first, otherwise only move starting from 2
        return ((ref.x == pos.x) && (ref.y == pos.y)) 
                    ? {x: cb.copyCount * style.look.dxCopy,y: cb.copyCount * style.look.dyCopy}
                    : {x: pos.x - ref.x + (cb.copyCount-1) * style.look.dxCopy, y: pos.y - ref.y + (cb.copyCount-1) * style.look.dyCopy }
    },

    // save the selection to the clipboard (no copies are made !)
    selectionToClipboard() {

        // send the selection to the clipboard manager
        editor.tx.send('clipboard set',{model: editor.doc.model, selection: this.selection})
    },
        
    // copy the clipboard to the selection - everything is copied !
    clipboardToSelection(pos, clipboard) {

        // calculate where the selection has to be pasted
        const delta = this.deltaForPaste(pos, clipboard)

        // if we have selected a node and a position inside the node, get it here (before we reset)
        const [node, inside] = this.selection.whereToAdd()

        // initialise the selection
        this.selection.reset()

        // the selection in the clipboard
        const cbslct = clipboard.selection

        // set the type of selection
        this.selection.what = cbslct.what

        // copy as required
        switch(cbslct.what) {

            case selex.freeRect:
            case selex.multiNode:

                // copy the nodes in the clipboard
                for (const node of cbslct.nodes) {

                    // make a copy
                    let newNode = node.copy()

                    // move the new node to the new spot
                    newNode.look.moveDelta(delta.x, delta.y)

                    // add the node to the active view
                    this.root.addNode(newNode)

                    // add the node to the selection
                    this.selection.nodes.push(newNode)
                }

                // we want new UIDs for the copied nodes
                this.root.uidChangeAll(editor.doc.UID)

                // for multiNode, we're done
                if (cbslct.what == selex.multiNode) return

                // copy the buses in the clipboard
                for (const bus of cbslct.buses) {

                    // make a copy
                    let newBus = bus.copy()

                    // change the uid - there are no routes to copy so this is ok 
                    // editor.doc.UID.generate(newBus)

                    // move the new node to the new spot
                    newBus?.move(delta.x, delta.y)

                    // add to the selection
                    this.selection.buses.push(newBus)
                }

                // copy the pads - i don't think so....
                for (const pad of cbslct.pads) {
                }

                // we could copy the routes that go bteween the nodes/busses in the copy ...

                // check if we need to set the rectangle again...
                if (cbslct.rect) {

                    // notation
                    const rc = cbslct.rect

                    // set the rectangle
                    this.selection.activate(rc.x + delta.x, rc.y + delta.y, rc.w, rc.h, style.selection.cRect)
                }

                // done
                break

            case selex.singleNode: {

                // make a copy
                let newNode = cbslct.nodes[0]?.copy()

                // we want new UIDs for the copied node(s)
                newNode.uidChangeAll(editor.doc.UID)
                
                // move the new node to the new spot
                newNode.look.moveTo(delta.x, delta.y)

                // add the node to the active view
                this.root.addNode(newNode)

                // add the node to the selection
                this.selection.nodes.push(newNode)

                // select
                newNode.doSelect()
            }
            break

            case selex.ifArea:
            case selex.pinArea: {

                // check
                if (!node || !inside) return

                // paste the widgets 
                const copies = node.look.copyPinArea(cbslct.widgets, inside)

                // add the pads or adjust the rx/tx tables
                node.is.source ? node.rxtxAddPinArea(copies) : node.addPads(copies)

                // the selection becomes the widgets that were copied
                this.selection.pinAreaSelect(copies)

                this.selection.what = cbslct.what;
            }
            break
        }
    },

    // The clipboard has been copied already, now we set the links
    linkToClipboardNodes(model, viewPath) {
        
        // the nodes in the clipboard and the selection are copies - we set them as links
        for (const linkedNode of this.selection.nodes) linkedNode.setLink(model, linkedNode.name + viewPath)
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

    // The clipboard has been copied already, now we set the links
    xxlinkToClipboardNodes(clipboard, model) {

        // the nodes in the clipboard and the selection are copies - we set them as links
        const L = clipboard.selection.nodes.length

        // check - should match ...
        if (L != this.selection.nodes.length) return

        for(let i=0; i<L; i++) {
            this.selection.nodes[i].setLink(model, clipboard.selection.nodes[i].name )
        }
    },

    // note that the selection is a stored previous selection, not the current one !
    removeSelection(selection) {

        // reset the current selection
        this.selection.reset()

        // remove all the nodes etc.
        for (const node of selection.nodes) this.root.removeNode(node)
        for (const bus of selection.buses) this.root.removeBus(bus)
        for (const pad of selection.pads) this.root.removePad(pad)
    },

    // note that the selection is a stored previous selection, not the current one !
    restoreSelection(selection) {

        // restore all the nodes etc.
        for (const node of selection.nodes) this.root.restoreNode(node)
        for (const bus of selection.buses) this.root.restoreBus(bus)
        for (const pad of selection.pads) this.root.restorePad(pad)

        // reset the current selection
        const sel = this.selection
        sel.reset()

        // and put the restored nodes in the selection again
        for (const node of selection.nodes) sel.nodes.push(node)
        for (const bus of selection.buses) sel.buses.push(bus)
        for (const pad of selection.pads) sel.pads.push(pad)        

        const rc = selection.rect
        sel.activate(rc.x, rc.y, rc.w, rc.h, selection.color)
    },



    // get the node and the position where a pin must be added
    xxxselectedNodeAndPosition() {

        // get the selected node (only one !)
        const node = this.selection.getSingleNode()
        if (! node ) return [null, null]

        // get the selected widget
        const widget = this.selection.getSelectedWidget()

        // determine the position for the widget
        const pos = widget  ? {x: widget.is.left ? widget.rect.x : widget.rect.x + widget.rect.w, y: widget.rect.y + widget.rect.h} 
                            : this.hit.xyLocal

        return [node, pos]
    }

}