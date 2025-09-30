import {GroupNode, Look, Route} from '../node/index.js'


export const groupHandling = {

   // if the selection contains just one source node, the conversion to a group is straightforward...
singleSourceToGroup() {
},

// transform a selection to a new group node
selectionToGroup(UID) {

    // create a new look for the new group node
    const look = new Look(this.selection.makeLookRect())

    // create a new group type
    const newGroup = new GroupNode(look,"new group", null)

    // give it a unique UID
    UID.generate(newGroup)

    // and add the new group node 
    this.root.addNode( newGroup )

    // make a new view for the node
    const view = newGroup.savedView = this.newSubView(newGroup, this.selection.makeViewRect())

    // reposition the conten of the view to 'cover' the current position
    view.translate(-view.rect.x, -view.rect.y)

    // for each of the selected nodes..
    for(const node of this.selection.nodes) {
        // ..add the node to the new group type 
        newGroup.addNode(node)

        //..and remove it from the root in this view
        this.root.removeNode(node)
    }
    // now we add the buses and keep track of the buses that were transferred
    const transfers = this.busTransfer(newGroup)

    // create the proxies for this group type and make the interconnections inside + outside of the group
    newGroup.addProxies(this.selection)

    // for the buses that were *partially* transferred, we need to set up pads and routes to connect the two buses
    for(const transfer of transfers) {
        this.busInterconnect(transfer.outside, newGroup, transfer.inside)
    }

    // and return the new group
    return newGroup
},

// some buses might have to be copied or moved completely to the group
busTransfer(newGroup) {

    const transfers=[]

    for(const bus of this.selection.buses) {

        // notation
        const selNodes = this.selection.nodes

        // for connections outside of the selection
        const outside = []

        // find the connections that go out of the selection
        for(const tack of bus.tacks) {

            // find to what the tack is connected
            const other = tack.route.from == tack ? tack.route.to : tack.route.from

            // if the node is not part of the selection
            if (other.is.pin && !selNodes.includes(other.node)) outside.push(tack)
        }

        // if all connections to/from the bus are inside the selection -> just move the bus to the new node
        if (outside.length == 0) {

            // add the bus to the new group
            newGroup.buses.push(bus)

            // remove it from this group
            this.root.removeBus(bus)
        }
        // otherwise duplicate the bus in the new group and remove the unnecessary connections on each bus
        else {
            // make an exact copy
            const newBus = bus.copy()

            // and store the *new* bus
            newGroup.buses.push(newBus)

            // distribute the tacks over both buses
            bus.splitTacks(newBus, newGroup)

            // save in the transfer list
            transfers.push({outside: bus, inside: newBus})
        }
    }

    return transfers
},

// The new bus inside the new group has to be connected to the bus outside
// we filter the connections to avoid duplicates
busInterconnect(outside, newGroup, inside) {

    // a helper function to get a pin
    function getPin(tack) {
        const widget = tack.route.to == tack ? tack.route.from : tack.route.to
        return widget.is.pad ? widget.proxy : widget
    }

    // a helper function to check that two tacks are logically connected via the busses
    function haveConnection(tack1, tack2) {

        // get the actual pins
        const pin1 = getPin(tack1)
        const pin2 = getPin(tack2)

        // compare the names
        if (pin1.name != pin2.name) return false

        // check the i/o combination
        return (pin1.is.proxy == pin2.is.proxy) ? (pin1.is.input != pin2.is.input) : (pin1.is.input == pin2.is.input)
    }

    // Use reduce to create an object where each key is a unique tack name
    // and the value is the first tack object found with that name
    const uniqueTacks = inside.tacks.reduce((accumulator, currentTack) => {

        // check if this connection also exists on this bus
        const externalTack = outside.tacks.find(externalTack => {

            return haveConnection(currentTack, externalTack)
        });

        // if there exists a connection
        if (externalTack) {

            // get the corresponding pin (see above)
            const pin = getPin(externalTack)

            // make a unique name to distinguish between input/output
            const specialName = pin.name + (pin.is.input ? '>' : '<')

            // save if not yet in the list
            if (!accumulator[specialName]) accumulator[specialName] = currentTack
        }

        // Return the accumulator for the next iteration
        return accumulator;
    }, {});

    // add a pad for each element in unique tacks
    for(const tack of Object.values(uniqueTacks)) {

        // get the corresponding pin
        const pin = getPin(tack)

        // copy the pin as a proxy
        const newProxy = newGroup.copyPinAsProxy(pin)

        // and create the pad for the proxy
        newGroup.addPad(newProxy)

        // add a route from the proxy to the outside busbar
        outside.makeRoute(newProxy)

        // add a route from the pad to the busbar
        inside.makeRoute(newProxy.pad)
    }
},

// undo the previous operation
undoSelectionToGroup(selection, newGroup, shift, allRoutes) {

    // disconnect the new group
    newGroup.disconnect()

    // shift to the right spot
    //newGroup.savedView.shiftContent(shift.dx, shift.dy)

    // close the view of the 
    newGroup.savedView.closeView()

    // remove the new group
    this.root.removeNode(newGroup)

    // put the selection back
    this.restoreSelection(selection)

    // for every busbar inside the newGroup we have to transfer the tacks to the corresponding 'outside' bus !
    for(const inside of newGroup.buses) inside.transferTacks(selection.buses)

    // disconnect all the nodes
    for (const node of selection.nodes)  node.disconnect()

    // reconnect all the routes again > note that tacks op de verkeerde bus terechtkomen ???
    for (const routes of allRoutes) 
        for (const route of routes) route.reconnect()

},

// converts a group node to a collection of nodes/busses in a selection
// Note thta this different from undoing a group operation (see above)
// group to selection only works when there are no connections to the groupnode
transferToSelection(group, shift) {

    // we will put the nodes in a selection in the view
    this.selection.reset()

    // calculate a rectangle for the selection
    const selRect = this.calcRect(group)

    // the nodes will have to move to a new position
    const dx = shift.dx
    const dy = shift.dy

    // now we can adjust the settings for the selection rectangle
    this.selection.activate(selRect.x + dx, selRect.y + dy, selRect.w, selRect.h)

    // remove all the routes that lead to pads - pads will not be copied
    for (const pad of group.pads) pad.disconnect()

    // add all the nodes to the parent node
    for(const node of group.nodes) {

        // move the look
        node.look.moveDelta( dx, dy)

        // move the routes
        node.look.moveRoutes(dx, dy)

        // move the nodes to the parent node
        this.root.nodes.push(node)

        // also add to the selection
        this.selection.nodes.push(node)
    }

    // move the buses to the parent node as well
    for(const bus of group.buses) {

        // move the bus
        bus.move(dx, dy)

        // move the routes
        bus.moveRoutes(dx, dy)

        // save the buses at the parent node
        this.root.buses.push(bus)

        // also add to the selection
        this.selection.buses.push(bus)
    }

    // and remove the node from this root
    this.root.removeNode(group)
},

undoTransferToSelection(group, shift, padRoutes) {

    // the nodes will have to move back
    const dx = -shift.dx
    const dy = -shift.dy

    for (const node of group.nodes) {

        // move the look
        node.look.moveDelta( dx, dy)

        // move the routes
        node.look.moveRoutes(dx, dy)

        // take them out of the nodes array
        view.root.removeNode(node)
    }

    // move the buses to the parent node as well
    for(const bus of group.buses) {

        // move the bus
        bus.move(dx, dy)

        // move the routes
        bus.moveRoutes(dx, dy)

        // remove the bcakplane
        group.removeBus(bus)
    }

    // reconnect all the pad routes
    for(const route of padRoutes) route.reconnect()

    // put the node back in the view
    view.root.restoreNode(group)
}


}
