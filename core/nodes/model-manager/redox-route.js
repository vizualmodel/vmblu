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
    doit({route}) {
        this.saveEdit('routeDraw',{route, newRoute:route.clone()})

        // check if the route has to be displayed as a twisted pair
        route.checkTwistedPair()

        // check if the route can be used or not
    },

    // The old route is actually a copy but with the original from/to and points
    undo({route, newRoute}) {

        // disconnect the route
        route.disconnect()
    },

    redo({route, newRoute}) {

        // check if there is a new route
        if (newRoute) route.connectFromClone(newRoute)
    }
},

deleteRoute: {

    // The edit is called at the start of the redraw - newRoute is added when the route is completed
    doit({route, oldRoute}) {

        this.saveEdit('deleteRoute',{route, oldRoute})

        // disconnect the route
        route.disconnect()

        // remove the route at both endpoints
        route.remove()
    },

    // The old route is actually a clone with the original from/to and points
    undo({route, oldRoute}) {

        // check if there was an old route
        if (oldRoute) route.connectFromClone(oldRoute)
    },

    redo({route, oldRoute}) {

        // disconnect the old route
        route.disconnect()

        // check if there is a new route
        route.remove()
    }
},

}
