
export const routeHandling = {

// for the undo operation of a disconnect we have to save all the routes to and from this node
getRoutes() {

    const allRoutes = []

    // save the routes to all the pins
    for (const pin of this.look.widgets) {

        // check
        if (!pin.is.pin) continue

        // make a copy of the routes
        for (const route of pin.routes) allRoutes.push(route)
    }

    // done
    return allRoutes
},

// for the undo operation of a disconnect we have to save all the routes to and from this node
getAllRoutes(widgets) {

    const allRoutes = []

    // save the routes to all the pins
    for (const pin of widgets) {

        // check
        if (!pin.is.pin) continue

        // make a copy of the routes
        for (const route of pin.routes) allRoutes.push(route)
    }

    // done
    return allRoutes
},

connect() {},

disconnect() {
    for (const widget of this.look.widgets) if (widget.is.pin) widget.disconnect()
},

disconnectPinArea(widgets) {
    for (const widget of widgets) if (widget.is.pin) widget.disconnect()
},

isConnected() {

    for (const widget of this.look.widgets) if (widget.is.pin && widget.routes.length > 0) return true
    return false
},

// highlight all the routes
highLight() {
    // clear the highlight state first
    this.is.highLighted = true

    // unhighlight the routes if the look at the other side is not highlighted
    for(const widget of this.look.widgets) {

        // only check pins that have routes
        if (!widget.is.pin || widget.routes.length == 0) continue

        for(const route of widget.routes) {

            const other = route.from === widget ? route.to : route.from

            route.highLight()

            if (other.is.tack) other.highLightRoutes()
        }
    }
},

// un-highlight all the routes
unHighLight() {

    // clear the highlight state first
    this.is.highLighted = false

    // unhighlight the routes if the look at the other side is not highlighted
    for(const widget of this.look.widgets) {

        // only check pins that have routes
        if (!widget.is.pin || widget.routes.length == 0) continue

        for(const route of widget.routes) {

            const other = route.from === widget ? route.to : route.from

            route.unHighLight()

            if (other.is.tack) other.unHighLightRoutes()
        }
    }
},

}
