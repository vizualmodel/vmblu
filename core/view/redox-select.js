import {editor} from '../editor/index.js'
import {doing} from './view-base.js'
import {selex} from './selection.js'

export const redoxSelect = {

alignVertical: {

    doit({view, left}) {

        // notation
        const nodes = view.selection.nodes
        const pads = view.selection.pads
        let deltaNodes = []
        let deltaPads = []

        // more then one node selected ?
        if (nodes.length > 1) {

            // calculate the horizontal (x) displacements
            deltaNodes = view.nodesAlignHD(nodes, left)

            // now move the nodes and the routes
            view.moveNodesAndRoutes(nodes, deltaNodes)
        }

        // more then one pad selected ?
        if (pads.length > 1) {

            // calculate the delta for every pad
            deltaPads = view.padsAlignHD(pads, left)

            // move the pad
            view.movePadsAndRoutes(pads, deltaPads)
        }

        // save the edit
        editor.saveEdit('alignVertical', {view, nodes, deltaNodes, pads, deltaPads})        
    },
    undo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = true
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true)
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, true)
    },
    redo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = false
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false)
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, false)
    }  
},

spaceVertical: {

    doit({view}) {

        // notation
        const nodes = view.selection.nodes
        const pads = view.selection.pads
        let deltaNodes = []
        let deltaPads = []

        // more then one node selected ?
        if (nodes.length > 1) {

            // calculate the horizontal (x) displacements
            deltaNodes = view.nodesSpaceVD(nodes)

            // now move the nodes and the routes
            view.moveNodesAndRoutes(nodes, deltaNodes)
        }

        // more then one pad selected ?
        if (pads.length > 1) {

            // calculate the delta for every pad
            deltaPads = view.padsSpaceVD(pads)

            // move the pad
            view.movePadsAndRoutes(pads, deltaPads)
        }

        // save the edit
        editor.saveEdit('spaceVertical', {view, nodes, deltaNodes, pads, deltaPads})        
    },
    undo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = true
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true)
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, true)
    },
    redo({view, nodes, deltaNodes, pads, deltaPads}) {

        // back = false
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false)
        if (deltaPads.length > 0) view.movePadsAndRoutes(pads, deltaPads, false)
    }  
},

alignHorizontal: {

    doit({view,top}) {
        // notation
        const nodes = view.selection.nodes

        // check
        if (nodes.length < 2) return
    
        // calculate the dy displacements
        const deltaNodes = view.nodesAlignVD(nodes)
    
        // and move nodes and routes
        view.moveNodesAndRoutes(nodes, deltaNodes)
    
        // save the edit
        editor.saveEdit('alignHorizontal', {view, nodes, deltaNodes})
    },
    undo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true)
    },
    redo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false)
    }  
},

spaceHorizontal: {

    doit({view}) {
        const nodes = view.selection.nodes

        // for the undo operation we keep track of the deltas
        const undo = {view, nodes, deltaNodes:[]}

        if (nodes.length < 2) return
    
        // calculate the horizontal (x) displacements
        const deltaNodes = view.nodesSpaceHD(nodes, left)
    
        // now move the nodes and the routes
        view.moveNodesAndRoutes(nodes, deltaNodes)
    
        // save the edit
        editor.saveEdit('spaceHorizontal', {view, nodes, deltaNodes})
    },
    undo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true)
    },
    redo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false)
    }  
},

selectionDrag: {

    doit({view}){
        // make a shallow copy
        const selection = view.selection.shallowCopy()
        const oldPos = {x:selection.rect.x, y: selection.rect.y}

        // save the selection
        editor.saveEdit('selectionDrag', {  view, selection, oldPos: oldPos,newPos: null })
    },
    undo({view, selection, oldPos, newPos}) {

        // drag the selection (remember: it is a copy !)
        selection.drag({x: oldPos.x-newPos.x, y: oldPos.y - newPos.y})

        // also set the *original* rectangle to the initial position
        view.selection.setRect(oldPos.x, oldPos.y, selection.rect.w, selection.rect.h)
    },
    redo({view, selection, oldPos, newPos}) {

        // drag the selection again (remember it is a copy)
        selection.drag({x: newPos.x-oldPos.x, y: newPos.y - oldPos.y})

        // set the *original* rectangle to the new position
        view.selection.setRect(newPos.x, newPos.y, selection.rect.w, selection.rect.h)
    }

},

disconnectSelection: {

    doit({selection}) {
        // an array of arrays to save the routes of each node
        const allRoutes = []
        
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // save the routes first !
            allRoutes.push(node.getRoutes())

            // disconnect
            node.disconnect()
        }

        // save the edit
        editor.saveEdit('disconnectSelection', {selection: selection.shallowCopy(), allRoutes })
    },
    // nota that allRoutes is an array of arrays - one for each node !
    undo({selection, allRoutes}) {

        for (const routes of allRoutes) {
            for (const route of routes) {
                route.reconnect()
            }
        }
    },
    redo({selection, allRoutes}) {
        for (const node of selection.nodes) node.disconnect()
    }
},

deleteSelection: {

    doit({view}) {

        // an array of arrays to save the routes of each node
        const allRoutes = []

        // notation
        const selection = view.selection
            
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // save the routes
            allRoutes.push(node.getRoutes())

            // disconnect
            node.disconnect()

            // disconnect and remove
            view.root.removeNode(node)
        }

        // remove the pads
        for (const pad of selection.pads) {

            // disconnect pad
            pad.disconnect()

            // remove pad
            view.root.removePad(pad)

            // disconnect pin
            pad.proxy.disconnect()

            // remove pin
            view.root.look.removePin(pad.proxy)
        }

        // remove the buses in the selection, but only the ones that have no connections anymore
        for (const bus of selection.buses) {

            // check
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.removeBus(bus)
        }

        // save the edit
        editor.saveEdit('deleteSelection', {view, selection: selection.shallowCopy(),allRoutes })

        // clean up the selection
        selection.reset()

        // change the state
        view.stateSwitch(doing.nothing)
    },

    // nota that allRoutes is an array of arrays - one for each node !
    undo({view, selection, allRoutes}) {

        // add all the nodes again
        for (const node of selection.nodes) view.root.addNode(node)

        // add all the pads again
        for (const pad of selection.pads) {

            const node = pad.proxy.node
            node.restorePad(pad)
            node.look.restorePin(pad.proxy)
        }

        // add the buses again
        for (const bus of selection.buses) {

            // only the buses without connections were removed
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.restoreBus(bus)
        }

        // add all the routes again
        for (const routes of allRoutes) {
            for (const route of routes) {
                route.reconnect()
            }
        }
    },

    redo({view, selection, allRoutes}) {
        
        // disconnect all nodes in the selection
        for (const node of selection.nodes) {

            // disconnect
            node.disconnect()

            // disconnect and remove
            view.root.removeNode(node)
        }

        // remove the pads
        for (const pad of selection.pads) {

            // disconnect
            pad.disconnect()

            // remove
            view.root.removePad(pad)

            // disconnect pin
            pad.proxy.disconnect()

            // remove pin
            view.root.look.removePin(pad.proxy)
        }

        // remove the buses in the selection, but only the ones that have no connections anymore
        for (const bus of selection.buses) {

            // check
            if (bus.tacks.length != 0) continue

            // remove the bus
            view.root.removeBus(bus)
        }
    }
},

selectionToClipboard: {

    doit({view}){

        // copy the selection to the clipboard of the editor
        view.selectionToClipboard()
    },
    undo(){},
    redo(){}
},

pasteFromClipboard: {

    doit({view, pos, clipboard}){

        // copy the clipboard to the view and to the selection at the position
        view.clipboardToSelection(pos, clipboard)

        // Change the factory and link paths if the selection is copied from a different directory
        if ( ! editor.doc.model.getArl().sameDir(clipboard.origin.arl) ) clipboard.selection.adjustPaths( editor.doc.model.getArl() )

        // change the names of the copied nodes if duplicates
        view.checkPastedNames(clipboard.copyCount)

        // save the edit
        editor.saveEdit('pasteFromClipboard', {view, selection: view.selection.shallowCopy()})
    },
    undo({view, selection}){
        view.removeSelection(selection)
    },
    redo({view, selection}){
        view.restoreSelection(selection)
    },
},

linkFromClipboard: {

    doit({view, pos, clipboard}){

        // also set the relative path for the model
        clipboard.origin.arl.makeRelative(editor.doc.model.getArl())

        // copy the clipboard to the view and to the selection
        view.clipboardToSelection(pos, clipboard)

        // the nodes are links
        view.linkToClipboardNodes(clipboard.origin, clipboard.selection.viewPath)

        // change the names of the copied nodes if duplicates
        view.checkPastedNames(clipboard.copyCount)

        // save the edit
        editor.saveEdit('linkFromClipboard', {view, selection: view.selection.shallowCopy()})
    },
    undo({view, selection}){
        view.removeSelection(selection)
    },
    redo({view, selection}){
        view.restoreSelection(selection)
    },
},

selectionToGroup: {

    doit({view}){

        // notation
        const selection = view.selection

        // if there are no nodes there is nothing to group
        if (selection.nodes.length == 0) return

        // an array of arrays to save the routes of each node
        const allRoutes = []

        // save all the routes of the nodes that will be transferred
        for (const node of selection.nodes)  allRoutes.push(node.getRoutes())
        
        // make a new group with the selection
        const newGroup = view.selectionToGroup(editor.doc.UID)

        // save the shift that was done
        const shift = {dx: newGroup.savedView.rect.x, dy: newGroup.savedView.rect.y}

        // save the edit
        editor.saveEdit('selectionToGroup', {view, selection: selection.shallowCopy(), newGroup, shift, allRoutes})

        // remove the selection (also changes the state)
        selection.reset()

        // change the state
        view.stateSwitch(doing.nothing)

        // rebuild the tx table ?
    },
    undo({view, selection, newGroup, shift, allRoutes}){

        view.undoSelectionToGroup(selection, newGroup, shift, allRoutes)
    },
    redo({view, selection, newGroup, allRoutes}){

        // // make a new group with the selection
        // const newGroup = view.selectionToGroup()

        // // remove the selection (also changes the state)
        // view.selection.reset()

        // // change the state
        // view.stateSwitch(doing.nothing)
    }
},

// ungroup only works if the node that has to be ungrouped has no external connections
unGroup: {

    doit({view, node}){

        // check
        if (!node.is.group || node.isConnected()) return

        // routes to pads will be removed, so we save those
        const padRoutes = []
        for(const pad of node.pads) for(const route of pad.routes) padRoutes.push(route)

        // the nodes and busses have to be moved to the equivalent position in this view
        const shift = {dx: view.rect.x, dy:view.rect.y}

        // save the undo parameters
        editor.saveEdit('unGroup',{view, node, shift, padRoutes})

        // move the nodes and busses to the view
        view.transferToSelection(node, shift)
    },
    undo({view, node, shift, padRoutes}){

        view.undoTransferToSelection(node, shift, padRoutes)
    },
    redo({view, node, shift, padRoutes}){

    }
},

}