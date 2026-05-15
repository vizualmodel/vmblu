function cableForRoute(route) {
    const fromCable = route.from?.cable?.is?.cable ? route.from.cable : null
    const toCable = route.to?.cable?.is?.cable ? route.to.cable : null
    return fromCable ?? toCable
}

function checkForCollapse(route, node) {
    const cable = cableForRoute(route)
    return cable && node ? {node, cable, tacks: cable.tacks.slice(), route: null} : null
}

function collapseIfReady(collapse) {
    if (!collapse) return null

    const collapsed = collapse.cable.collapseIfOnlyEndpointTacks(collapse.node)
    if (!collapsed) return null

    collapse.route = collapsed.route
    return collapse
}

function undoCollapse(collapse) {
    if (!collapse) return false

    collapse.route.disconnect()
    collapse.node.restoreCable(collapse.cable)
    collapse.cable.reconnect(collapse.tacks.slice())
    return true
}

function undoRouteToCable(conversion) {
    const {node, route, oldRoute, cable, routes, pending} = conversion

    if (pending?.route?.to) pending.route.disconnect()
    else if (pending?.tack && cable.tacks.includes(pending.tack)) cable.removeTack(pending.tack)
    for (const leg of routes.slice()) leg.disconnect()
    cable.disconnect()
    cable.tacks.length = 0
    node.removeCable(cable)
    route.connectFromClone(oldRoute)
}

function redoRouteToCable(conversion) {
    const {node, route, cable, tacks} = conversion

    route.disconnect()
    node.restoreCable(cable)
    cable.reconnect(tacks.slice())
}

export const redoxRoute = {

routeDrag: {

    doit({route, oldWire, newWire}) {
        // save the edit
        this.saveEdit('routeDrag', {  route, oldWire, newWire} )
    },
    undo({route, oldWire, newWire}) {
        route.restoreWire(oldWire)
    },
    redo({route, oldWire, newWire}) {
        route.restoreWire(newWire)
    }
},

routeDraw: {

    // the edit is called when the route is completed 
    doit({view, route}) {
        this.saveEdit('routeDraw',{node: view.root, route, newRoute:route.clone()})

        // check if the route can be used or not
    },

    // The old route is actually a copy but with the original from/to and points
    undo(edit) {
        const {node, route} = edit

        // disconnect the route
        const collapse = checkForCollapse(route, node)
        route.disconnect()
        edit.collapse = collapseIfReady(collapse)
    },

    redo({route, newRoute, collapse}) {

        // check if there is a new route
        if (collapse) undoCollapse(collapse)
        else if (newRoute) route.connectFromClone(newRoute)
    }
},

routeCancel: {

    doit({view, route}) {
        const collapse = checkForCollapse(route, view.root)
        route.popFromRoute()

        const collapsed = collapseIfReady(collapse)
        if (collapsed) this.saveEdit('routeCancel', {collapse: collapsed})
    },

    undo({collapse}) {
        undoCollapse(collapse)
    },

    redo({collapse}) {
        collapse.route = collapse.cable.collapseIfOnlyEndpointTacks(collapse.node)?.route
    }
},

deleteRoute: {

    // The edit is called at the start of the redraw - newRoute is added when the route is completed
    doit({view, route, oldRoute}) {

        this.saveEdit('deleteRoute',{node: view.root, route, oldRoute})
    },

    // The old route is actually a clone with the original from/to and points
    undo({route, oldRoute, collapse}) {

        // check if there was an old route
        if (collapse) undoCollapse(collapse)
        else if (oldRoute) route.connectFromClone(oldRoute)
    },

    redo(edit) {

        const collapse = checkForCollapse(edit.route, edit.node)
        edit.route.disconnect()
        edit.collapse = collapseIfReady(collapse)
    }
},

routeToCable: {

    doit({view, route, segment, conversion}) {

        conversion ??= view.root.convertRouteToCable(route, segment)
        if (!conversion) return

        this.saveEdit('routeToCable', conversion)
    },

    undo({node, route, oldRoute, cable, routes, tacks, pending}) {
        undoRouteToCable({node, route, oldRoute, cable, routes, tacks, pending})
    },

    redo({node, route, oldRoute, cable, tacks}) {
        redoRouteToCable({node, route, oldRoute, cable, tacks})
    }
},

routeDrawToRoute: {

    doit({view, route, targetRoute, segment, xyLocal}) {

        const conversion = view.root.convertRouteToCable(targetRoute, segment, xyLocal)

        route.drawXY(xyLocal)

        if (!conversion || !route.connect(conversion.cable)) {
            if (conversion) undoRouteToCable(conversion)
            route.popFromRoute()
            return
        }

        this.saveEdit('routeDrawToRoute', {conversion, route, newRoute: route.clone()})
    },

    undo({conversion, route}) {
        route.disconnect()
        undoRouteToCable(conversion)
    },

    redo({conversion, route, newRoute}) {
        redoRouteToCable(conversion)
        route.connectFromClone(newRoute)
    }
},

}
