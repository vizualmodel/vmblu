import {cloneRuntimeSettings, isDefaultRuntimeSettings} from '../../../runtime/src/runtime-settings.js'

export const redoxNode = {

newGroupNode: {

    doit({view, pos}) {

        // create a new node at pos. False = group node
        const node = view.newEmptyNode(pos, false)

        // undo/redo
        this.saveEdit('newGroupNode',{view, node})
    },
    undo({view, node})    {

        view.root.removeNode(node)

        // ** Note that (currently) we do not remove the node from the uidmap ! **

    },
    redo({view, node})    {

        view.root.addNode(node)
    }
},

newSourceNode: {

    doit({view, pos}) {

        // create a new node at pos. False = group node
        const node = view.newEmptyNode(pos, true)

        // undo/redo
        this.saveEdit('newSourceNode',{view, node})
    },
    undo({view, node})    {

        view.root.removeNode(node)

        // ** Note that (currently) we do not remove the node from the uidmap ! **
    },
    redo({view, node})    {

        // add the node again
        view.root.addNode(node)
    },
},

wider: {
    doit({node}) {
        node.look.wider()
        this.saveEdit('wider', {node})
    },
    undo({node})    {
        node.look.smaller()
    },
    redo({node})    {
        node.look.wider()
    }
},

smaller: {
    doit({node}) {
        node.look.smaller()
        this.saveEdit('smaller', {node})
    },
    undo({node})    {
        node.look.wider()
    },
    redo({node})    {
        node.look.smaller()
    }
},

nodeHighLight: {
    doit({node}) {
        node.is.highLighted ? node.unHighLight() : node.highLight()
        //this.saveEdit('nodeHighLight', {node})
    },
    undo({node})    {
        //node.is.highLighted ? node.unHighLight() : node.highLight()
    },
    redo({node})    {
        //node.is.highLighted ? node.unHighLight() : node.highLight()
    }
},

convertNode: {

    doit({view, node}) {

        // a linked node cannot be changed
        if (!view || node.link) return

        // change the type of node
        const convertedNode = node.switchNodeType( )

        // swap the two nodes in the node tree
        view.root.swap(node, convertedNode)

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable()

        // signal the edit
        this.saveEdit('convertNode',{view, node, convertedNode})
    },
    undo({view, node, convertedNode}) {

        // set the original node back
        if (view.root.swap(convertedNode, node)) convertedNode.look.transferRoutes(node.look)

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable()
    },
    redo({view, node, convertedNode}) {

        // set the converted node back
        if (view.root.swap(node, convertedNode)) node.look.transferRoutes(convertedNode.look)

        // reconstruct the tx tables
        view.root?.rxtxBuildTxTable()
    }
},

nodeToClipboard: {

    doit({view, node}) {

        // select the new node
        view.selection.singleNode(node)  

        // send the clipboard to the clipboard manager
        this.manager.tx.send('clipboard.set',{model: this.manager.model, selection: view.selection})
    },
    undo(){
    },
    redo(){
    }
},

sourceToClipboard: {

    doit({node, viewManager}) {
        // check
        if (! node.is.source) return

        // make the body of the source
        const body = node.makeSourceBody()

        // copy the body to the clipboard
        if (viewManager?.textToExternalClipboard) viewManager.textToExternalClipboard(body)
        else this.manager.tx.send('text to external clipboard', body)
    },
    undo(){
    },
    redo(){
    }
},

swapPins: {
    
    doit({node, left, right}) {
        // save the pins that will be swapped
        const swapped = []

        // find the pins that need to be swapped
        for (let widget of node.look.widgets) {
            if ( widget.is.pin && left  && ! widget.is.left) swapped.push(widget)
            if ( widget.is.pin && right &&   widget.is.left) swapped.push(widget)
        }

        // do the actual swapping
        for(const pin of swapped) pin.leftRightSwap()

        // signal the edit
        this.saveEdit('swapPins', {swapped})
    },
    undo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap()
    },
    redo({swapped}) {
        for(const pin of swapped) pin.leftRightSwap()
    }
},

disconnectNode: {
    doit({node}) {
        // save an array ofpins and routes
        const allRoutes = node.getRoutes()

        // disconnect the node
        node.disconnect()

        // save the edit
        this.saveEdit('disconnectNode',{node, allRoutes})
    },
    undo({node, allRoutes}) {

        // reconnect the routes to the pins - make a copy of the routes array, redo empties the array again !
        for (const route of allRoutes) route.reconnect()
    },
    redo({node, allRoutes}) {

        // redo the disconnect
        node.disconnect()
    }
},

deleteNode: {
    doit({view, node}) {
        // save an array ofpins and routes
        const allRoutes = node.getRoutes()

        // disconnect
        node.disconnect()

        // remove the node
        if (!view) return
        view.root.removeNode(node)

        // if the node has a view, remove it from the list
        if (node.saveView) node.savedView.closeView()

        // save the edit
        this.saveEdit('deleteNode',{view, node, allRoutes})
    },
    undo({view, node, allRoutes}) {

        // add the node to the view again
        view.root.addNode(node)

        // reconnect the routes to the pins - make a copy of the routes array
        for (const route of allRoutes) route.reconnect()
    },
    redo({view, node, allRoutes}) {

        node.disconnect()

        view.root.removeNode(node)
    }
},

// for a node that was selected in the library we do not have to make a copy - it was created from raw
nodeFromNodeLib: {
    
    doit({view, node}) {
        // and add it to the root
        view.root.addNode(node)

        // the new node is the selected one !
        view.state.node = node

        // select the new node
        view.selection.singleNode(node)   

        // save the edit
        this.saveEdit('nodeFromNodeLib',{view, node})
    },
    undo({view, node}){
        view.root.removeNode(node)
    },
    redo({view, node}){
        view.root.addNode(node)
    },
},

nodeDrag: {
    doit({view, node, oldPos, newPos}) {

        // save the starting position for the undo-operation
        this.saveEdit('nodeDrag',{node,view,oldPos,newPos})
    },
    undo({node, view, oldPos, newPos}) {

        const delta = {x: oldPos.x - newPos.x, y: oldPos.y - newPos.y}
        node.move(delta)
        view.selection.move(delta)
    },
    redo({node, view, oldPos, newPos}) {

        const delta = {x: newPos.x - oldPos.x, y: newPos.y - oldPos.y}
        node.move(delta)
        view.selection.move(delta)
    }
},

changeNodeSettings: {
    doit({node, sx}) {
        if (JSON.stringify(sx) !== JSON.stringify(node.sx)) node.sx = sx
    },
    undo({}) {
    },
    redo({}){
    }
},

changeNodeDynamics: {
    doit({node, dx}) {

        const nextDx = cloneRuntimeSettings(dx)

        // don't save an empty runtime settings object
        const normalizedNodeDx = node.dx ? cloneRuntimeSettings(node.dx) : null
        const saveDx = isDefaultRuntimeSettings(nextDx) ? null : nextDx

        if (JSON.stringify(saveDx) !== JSON.stringify(normalizedNodeDx)) node.dx = saveDx

    },
    undo({}) {
    },
    redo({}){
    }
},

changeNodeComment: {
    doit({node,comment}) {

        if ( !comment || comment.length == 0) {
            node.prompt = null
        }
        else if (comment !== node.prompt) {
            node.prompt = comment
        }
    },
    undo({}) {
    },
    redo({}){
    }
}


}
