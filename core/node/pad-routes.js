import {style, eject} from '../util/index.js'
import {Route} from './index.js'

export const padRouteFunctions = {

    adjustRoutes() {
        for(const route of this.routes) route.adjust()
    },

    routeToPin(pin) {

        // create a route between the pin and this pad
        let route = new Route(pin, this)

        // make a simple route between the two pins
        route.fourPointRoute()

        // save the route
        this.routes.push(route)

        // also in the pin
        pin.routes.push(route)
    },

    shortConnection(actual) {

        // create a route between the actual widget and this pad
        let route = new Route(actual, this)

        // make a simple route between the two pins
        route.twoPointRoute()

        // save the route
        this.routes.push(route)

        // also in the actual
        actual.routes.push(route)
    },    

    canConnect(widget) {

        // inputs connect to inputs and outputs to outputs !
        if (widget.is.pin) {

            // the proxy and the widget mùust both be inputs or outputs
            if (this.proxy.is.input != widget.is.input) return false

            // if the widget is a channel, then the proxy must be a channel also
            if (widget.is.channel && !this.proxy.is.channel) return false

            // if the widget is a multi
            if ((widget.is.multi || this.proxy.is.multi) && (!widget.hasMultiOverlap(this.proxy))) return false
        }

        // no duplicates
        if (this.routes.find( route => (route.from == widget)||(route.to == widget))) return false

        return true
    },

    // disconnect all routes to and from a pad
    disconnect() {

        // make a copy of the routes - the pad.routes array will be modified during this proc
        const routes = this.routes.slice()    

        // go through all the routes
        for (const route of routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from

            // a pad can be connected to a pin or bus
            other.is.pin ? route.rxtxPinPadDisconnect() : route.rxtxPadBusDisconnect()

            // remove the route at both ends
            route.remove()
        }
    },

    reconnect(routes) {

        this.routes = routes

        for(const route of routes) {

            // get the other widget
            const other = route.from == this ? route.to : route.from

            // a pad can be attached to a pin or a bus
            if (other.is.pin) other.routes.push(route)
            else other.bus.push(other)
        }
    },

    // before dragging the pad we want to make sure the pad is the to widget
    checkRoutesDirection() {
        this.routes.forEach( route => { if (route.from == this) route.reverse() })
    },

    drag(next, delta) {

        // if there are routes ...
        if (this.routes.length > 0) {

            // get the last two points of the first route
            const wire = this.routes[0].wire

            // get the first or last points of the route
            const [a, b] = this.routes[0].from == this ?  [wire[0], wire[1]] : [wire.at(-1), wire.at(-2)]

            // calculate the next position
            const realNext = a.y == b.y ? {x: a.x + delta.x, y: next.y} : {x: next.x, y: a.y + delta.y}

            // add a new point to the routes
            for (const route of this.routes) route.drawXY( realNext ) 

            // check if we have to switch the left/right text position
            if (a.y == b.y) this.is.leftText = (a.x < b.x)

            // notation
            const rc = this.rect

            // y position is independent of left/right
            rc.y = a.y - rc.h/2

            //x depends on left right
            rc.x = this.is.leftText ? a.x - rc.w : a.x 
        }
        else {
            // just move the pad
            this.rect.x += delta.x
            this.rect.y += delta.y           
        }
    },

    xdrag(next, delta) {

        // if there are routes ...
        if (this.routes.length > 0) {

            // get the last two points of the first route
            const wire = this.routes[0].wire

            // get the last two points of the wire
            if (wire.length > 0) {
                const last = wire.at(-1)
                const prev = wire.at(-2)

                // use the direction to calculate a new value for the next point
                next = prev.y == last.y ? {x: last.x + delta.x, y: next.y} : {x: next.x, y: last.y + delta.y}
            }

            // add a new point to the routes
            for (const route of this.routes) route.drawXY( next ) 

            // place the pad again
            this.place()
        }
        else {
            // just move the pad
            this.rect.x += delta.x
            this.rect.y += delta.y           
        }
    },

    endDrag() {
        //if (this.routes.length == 1) this.routes[0].endpoint(this)
        this.routes.forEach( route => route.endpoint(this))
    },

    slide(delta) {

        // all the routes are attached horizontally
        this.routes.forEach( route => {

            // notation
            const p = route.wire

            // to slide a route it must have at least three segments
            // make a copy of teh wire ! Points in the point array are overwritten !
            if (p.length == 2) {
                //const p0 = {...p[0]}
                //const p1 = {...p[1]}
                route.addTwoSegments({...p[0]},{...p[1]})
            }

            // notation
            const [a,b] = this == route.from ? [p[0],p[1]] : [p.at(-1),p.at(-2)] 

            // move the segment
            a.y += delta.y
            b.y += delta.y
        })
        // finally move the pad
        this.rect.y += delta.y
    },

    fuseEndSegment() {

        // only one route can fuse
        let fusedRoute = null
        let dy = 0

        // all the routes are attached horizontally
        for (const route of this.routes) {
        // this.routes.forEach( route => {

            // at least three segments required
            if (route.wire.length < 4) continue

            // notation
            const p = route.wire
            const [a,b,c, front] = (this == route.from) ? [p[0],p[1],p[2], true] : [p.at(-1),p.at(-2),p.at(-3), false] 

            // check if we can fuse segments 
            if (Math.abs(c.y - b.y) < style.route.tooClose) {
                dy = c.y - a.y
                a.y = c.y
                front ? route.removeTwoPoints(1,p) : route.removeTwoPoints(p.length-3,p)
                fusedRoute = route
                break
            }
        }

        // if we have fused we will move all the routes and pad 
        if (fusedRoute) {
            for (const route of this.routes) {
            //this.routes.forEach( route => {

                // the fused route is already ok
                if (route == fusedRoute) continue

                // notation
                const p = route.wire
                const [a,b] = this == route.from ? [p[0],p[1]] : [p.at(-1),p.at(-2)] 

                // move the segment
                a.y += dy
                b.y += dy
            }
            // finally move the pad
            this.rect.y += dy
        }
    },

    // when we copy the pad-pin routes, we already have copied all the nodes so we can set both ends of the route correctly
    // we use the uid that was also copied as the search element - the final uid is set after calling this routine
    copyPadPinRoutes(pad, root) {

        // copy the routes
        for(const route of pad.routes) {

            // get the other widget
            const other = route.from == pad ? route.to : route.from

            // only routes to/from pins are considered
            if (!other.is.pin) continue

            // clone the route
            const clone = route.clone()

            // the pad - part of the route can be set
            clone.to == pad ?  clone.to = this : clone.from = this

            // and save the cloned route
            this.routes.push(clone)

            // now find the node for the 'other'
            const node = root.nodes.find( node => node.uid == other.node.uid)

            // find the pin in that node
            const pin = node.look.findPin(other.name, other.is.input)

            // set the other part of the route
            clone.from == this ? clone.to = pin : clone.from = pin

            // also save the new route in the pin
            pin.routes.push(clone)
        }
    },

    // remove a route from the routes array
    removeRoute(route) {

        eject(this.routes, route)
    },

    // copy the routes for the undo operation (see redox)
    copyWires() {

        const wires = []
        for (const route of this.routes) wires.push(route.copyWire())
        return wires
    },

    restoreWires(wires) {

        const L = this.routes.length
        for(let i = 0; i < L; i++) this.routes[i].restoreWire(wires[i])
    },

    highLightRoutes() {

        // highlight the connections of the pqd
        for (const route of this.routes) {

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from

            //check
            if (!other) continue

            // filter multis
            if (other.is.pin) {

                // filter unconnected multis
                if (!this.areConnected(other)) continue
                    
                // ok - highlight the route
                route.highLight()
            }

            // if the other is a bustack also highlight the routes that go via the bus
            if (other.is.tack) {

                route.highLight()

                other.bus.highLightRoutes(this)
            }
        }
    },

    unHighLightRoutes() {

        // highlight the connections of the pin
        for (const route of this.routes) {

            //unhighlight the route
            route.unHighLight()

            // check the other part of the route - note that it might be missing during a disconnect operation !
            const other = route.from == this ? route.to : route.from

            // check
            if (!other) continue

            // check the 
            //if (other.is.proxy) other.pad.unHighLightRoutes()

            // if the other is a bustack also highlight the routes that go via the bus
            if (other?.is.tack) other.bus.unHighLightRoutes(this)
        }
    },

    checkRouteUsage() {

        // reset all the routes to used
        for(const route of this.routes) route.is.notUsed = false

        // get the proxy for this pad
        const proxy = this.proxy

        // check the routes
        for(const route of this.routes) {

            // get the other side of the route
            const other = route.from == this ? route.to : route.from;

            // multi messages can only connect to multimessages
            if (other.is.pin) {
                if ((other.is.multi || proxy.is.multi) && !proxy.hasMultiOverlap(other)) route.is.notUsed = true;
            }
            // else if (other.is.pad){
            //     if ((proxy.is.multi || other.proxy.is.multi) && !proxy.hasMultiOverlap(other.proxy)) route.is.notUsed = true;
            // } 
            else if (other.is.tack) {

                // check all the bus routes
                let found = false
                for(const tack of other.bus.tacks) {

                    // skip 
                    if (tack == other) continue

                    // get the pin or pad at the other end 
                    const busWidget = tack.route.to == tack ? tack.route.from : tack.route.to

                    // it could be that the route was not used
                    if (other.bus.areConnected(this, busWidget)) {
                        tack.route.is.notUsed = false
                        found = true
                    }
                }
                // if we have not found one connection..
                if (!found) route.is.notUsed = true
            }
        }
    },

}
