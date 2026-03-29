import {doing} from '../../types/view/view-base.js'
import {selex} from '../../types/view/selection.js'

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
        this.saveEdit('alignVertical', {view, nodes, deltaNodes, pads, deltaPads})        
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
        this.saveEdit('spaceVertical', {view, nodes, deltaNodes, pads, deltaPads})        
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
        this.saveEdit('alignHorizontal', {view, nodes, deltaNodes})
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
        this.saveEdit('spaceHorizontal', {view, nodes, deltaNodes})
    },
    undo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, true)
    },
    redo({view, nodes, deltaNodes}) {
        if (deltaNodes.length > 0) view.moveNodesAndRoutes(nodes, deltaNodes, false)
    }  
},

selectionDrag: {

    doit({view, oldPos, newPos}){
        // make a shallow copy
        const selection = view.selection.shallowCopy()

        // save the selection
        this.saveEdit('selectionDrag', {  view, selection, oldPos, newPos})
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
        this.saveEdit('disconnectSelection', {selection: selection.shallowCopy(), allRoutes })
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
        this.saveEdit('deleteSelection', {view, selection: selection.shallowCopy(),allRoutes })

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

pasteFromClipboard: {

    // raw is raw and a copy
    async doit({view, pos, raw, asLink}){

        // check
        if (! raw?.root ) return

        // we will rebuild the clipboard model
        const content = {raw, root: null, imports: [] }

        // if a clipboard comes from a remote file, we have to check references and collect the imports
        asLink ? this.manager.model.rawAsLinks(content.imports, raw) : this.manager.model.handleRawPaths(content.imports, raw)

        // add the new models to the manager compiler
        if (content.imports?.length > 0) await this.manager.modcom.addImports(this.manager.model, content.imports)

        // compile the raw clipboard as if 'raw' was already part of this model...
        content.root = this.manager.modcom.compileRawNode(this.manager.model, raw.root)

        // copy the clipboard to the view and to the selection at the position
        view.clipboardToSelection(pos, null, content)

        // change the names of the copied nodes if duplicates
        view.checkPastedNames(view.selection.paste.count)

        // save the edit
        this.saveEdit('pasteFromClipboard', {view, selection: view.selection.shallowCopy()})
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
        const newGroup = view.selectionToGroup(this.manager.UID)

        // save the shift that was done
        const shift = {dx: newGroup.savedView.rect.x, dy: newGroup.savedView.rect.y}

        // save the edit
        this.saveEdit('selectionToGroup', {view, selection: selection.shallowCopy(), newGroup, shift, allRoutes})

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
        this.saveEdit('unGroup',{view, node, shift, padRoutes})

        // move the nodes and busses to the view
        view.transferToSelection(node, shift)
    },
    undo({view, node, shift, padRoutes}){

        view.undoTransferToSelection(node, shift, padRoutes)
    },
    redo({view, node, shift, padRoutes}){

    }
},

// MAKE UNDO POSSIBLE !
autoRouteSelection: {

    doit({view}){

        if (! view?.root) return

        const nodes = view.selection.nodes
        if (nodes.length < 2) return

        const routes = view.root.getInternalRoutes(nodes)

        for (const route of routes) route.autoRoute( view.root.nodes )
    },
    undo(){},
    redo(){}

}

}
