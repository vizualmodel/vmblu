import {Route} from './index.js'
import {convert} from '../util/index.js'

export const conxHandling = {

    // message flow is src dst
    addConnection(src, dst, conx) {

        // helper function
        const makeAddress = (A) => A.is.pin ? {pin: A.name, node: A.node.name} : A.is.pad ? {pin: A.proxy.name} : {pin: '?', node: '?'};
        const pushConnection = (rawSrc, rawDst) => {

            const cx = conx.find(cx => sameAddress(cx.src, rawSrc))
            if (!cx) {
                conx.push({src: rawSrc, dst: rawDst})
                return
            }

            const dstList = Array.isArray(cx.dst) ? cx.dst : [cx.dst]
            if (dstList.some(dst => sameAddress(dst, rawDst))) return

            cx.dst = [...dstList, rawDst]
        }
        const sameAddress = (A, B) => (A?.pin === B?.pin) && ((A?.node ?? null) === (B?.node ?? null))

        // simple case - no a tack (pin or pad)
        if ( ! dst.is.tack) {
            // save 
            pushConnection(makeAddress(src), makeAddress(dst))  

            // done
            return
        }

        // If the destination is a bus/cable we have to find the actual connected pins and pads
        const fanout = []

        // check the connections to the bus/cable
        for(const tack of dst.cable.tacks) {

            // skip the to tack
            if (tack == dst) continue

            // check if the two are connected (i/o, name)
            if (dst.areConnected(tack)) fanout.push(tack.getOther())
        }           

        // save all the destinations from the bus that were found
        for(const busDst of fanout) {

            // save 
            pushConnection(makeAddress(src), makeAddress(busDst))
        }
    },

    getRoutesAndConnections() {

        const routes = []
        const conx = []

        // get all the routes from the output pins of all the nodes
        for(const node of this.nodes) {

            // sav all the routes of output pins
            for(const pin of node.look.widgets) {

                // only output pins
                if (! pin.is.pin || pin.is.input) continue

                // look at all routes
                for(const route of pin.routes) {

                    // store the route for that pin
                    routes.push(convert.routeToRaw(route))

                    // get the destination (it can be null for half-routes !)
                    const other = route.from == pin ? route.to : route.from

                    // add the connection also
                    this.addConnection(pin, other, conx)
                }
            }
        }

        // get all the routes from the incoming pads to input pins or buses
        for(const pad of this.pads) {

            // outgoing pads have been covered in pins and busses...
            if ( ! pad.proxy.is.input) continue
                
            // convert each route.. 
            for(const route of pad.routes) {

                // push the route string
                routes.push(convert.routeToRaw(route))

                // get the destination (it can be null for half-routes !)
                const other = route.from == pad ? route.to : route.from

                // add the connection
                this.addConnection(pad,other, conx)
            }
        }        

        // What remains are the routes from the cable to incoming pins and from the cable to outgoing pads
        // Note that routes from a cable are **not** added to the connections array.
        for(const cable of this.cables) {

            for(const tack of cable.tacks) {

                const other = tack.getOther()
                if (other.is.pin && other.is.input) routes.push(convert.routeToRaw(tack.route))
                if (other.is.pad && !other.proxy.is.input) routes.push(convert.routeToRaw(tack.route))
            }
        }

        return [routes, conx]
    },

    // when we are getting the connections the pins and the pads have been added to the group node, but not the buses and the routes
    cookConx(rawConx) {

        //-------- helpers -----------
        const resolvePin = (raw, input) => {
            for(const node of this.nodes) {
                if (node.name != raw.node) continue
                return node.look.widgets.find( widget => widget.is.pin && (widget.name === raw.pin) && (widget.is.input === input))
            }            
        }

        const resolvePad = (raw, input) => this.pads.find( pad => (pad.proxy.name === raw.pin)&&(pad.proxy.is.input === input)  );

        const showError = (error, raw) => {

                const sFrom = `${raw.src?.pin} ${raw.src?.node ? ' @ ' + raw.src?.node : '(pad)'}`
                const sTo = `${raw.dst?.pin} ${raw.dst?.node ? ' @ ' + raw.dst?.node : '(pad)'}`
                console.error(error + sFrom + ' -> ' + sTo);
        }

        const ioMismatch = (from, to) => {

            // for pins i/o should be different
            return  (from.is.pin && to.is.pin) ? (from.is.input == to.is.input) : 
                    (from.is.pin && to.is.pad) ? ( from.is.input != to.proxy.is.input) :
                    (from.is.pad && to.is.pin) ? ( from.proxy.is.input != to.is.input) :
                    (from.is.pad && to.is.pad) ? true : true;
        }

        // An input pin with a channel (reply) can only be connected to an output pin with a channel (request)
        const rqrpMismatch = (from, to) => {

            const A = from.is.pin ? from : from.proxy
            const B = to.is.pin ? to : to.proxy

            if (A.is.input && A.is.channel ) {
                return (A.is.channel != B.is.channel)
            }
            if (B.is.input && B.is.channel ) {
                return (A.is.channel != B.is.channel)
            }
        }
        //------------------------------

        const conx = []

        const rawPairs = (raw) => {

            // Backward compatibility with older raw files.
            const rawsrc = raw.src ?? raw.from
            const rawdst = raw.dst ?? raw.to

            if (!rawsrc || !rawdst) return []

            return (Array.isArray(rawdst) ? rawdst : [rawdst])
                .map(dst => ({src: rawsrc, dst}))
        }

        let src = null, dst = null;
        for (const raw of rawConx) {

            for (const rawPair of rawPairs(raw)) {

                // find from and to and give an error message if not found
                src = rawPair.src.node ? resolvePin(rawPair.src, false) : resolvePad(rawPair.src, true)
                if (!src) showError('Connection <src> not found: ', rawPair)

                dst = rawPair.dst.node ? resolvePin(rawPair.dst, true) : resolvePad(rawPair.dst, false)
                if (!dst) showError('Connection <dst> not found: ', rawPair)

                // check
                if (!src || !dst) continue;

                // check i/o mismatch
                if (ioMismatch(src, dst)) {
                    showError('Input/output mismatch: ', rawPair)
                    continue;
                }

                // check rq/rp mismatch
                if (rqrpMismatch(src, dst)) {
                    showError('request/reply mismatch: ', rawPair)
                    continue;
                }

                // add to the array
                conx.push({src, dst, is: {new:true}})
            }
        }
        return conx
    },

    // a route should have a counterpart in the connections - otherwise it is set to be removed
    findRouteInConx(route, conx) {

        // helper functions -----------------------------------
        const findConx = (A, B) => conx.find( cx => ((A == cx.src) && (B == cx.dst)) || ((A == cx.dst) && (B == cx.src)) )

        // dst is a tack
        const checkBus = (src, dst) => {

            // check for the connections to the bus..
            for(const tack of dst.cable.tacks) {

                // skip this tack of the route...
                if (tack == dst) continue

                // check if logically conneceted via this bus (i/o and name must match...)
                if (tack.areConnected(dst)) {

                    // get the other side of the route
                    const other = tack.getOther()

                    // check if we find this connection in conx
                    const cx = findConx(src, other)

                    // if the connection is found set the connection status, if not set the route status
                    if (cx) 
                        cx.is.new = false
                    else 
                        tack.route.is.noConx = true
                }
            }
        }
        // ---------------------------------------------------

        const [src, dst] = route.messageFlow()

        // if there are no connections the route is new
        if ( conx.length == 0) {

            // we always accept routes to buses/cables
            route.is.noConx = dst.is.tack ? false : true;
            return
        }

        // check the routes 
        if (src.is.tack){

            // we do not check routes that come from a bus/cable...
            route.is.noConx = false
        }
        // pin or pad
        else {
            // other end goes to a bus
            if (dst.is.tack) {

                // The bus that the tack is connected to
                checkBus(src, dst)
            }
            // pin or pad
            else {

                // find the connection in the conx array - the order can be different
                const cx = findConx(src, dst)

                // if the connection is found set the connection status, if not set the route status
                cx ? (cx.is.new = false) : (route.is.noConx = true)
            }
        }
    },

    createNewRoutes(conx) {

        // check
        if (! conx?.length) return

        // add a routes for each new connection
        for(const cx of conx) {

            if (!cx.is.new) continue

            this.createNewRoute(cx)
        }
    },

    createNewRoute(cx) {

        // check
        if (!cx?.is?.new || !cx.src || !cx.dst) return null

        // create a new route
        const route = new Route(cx.src, cx.dst)

        // The route is for a new connection
        route.is.newConx = true
        
        // and save the route in the endpoints
        route.from.routes.push(route)
        route.to.routes.push(route)

        // make a smart connection between the two destinations
        route.autoRoute(this.nodes)

        return route
    },

    // create a single route between src and dst
    createRoute(src, dst) {

        // check
        if (!src || !dst) return
        if (!src.canConnect(dst)) return

        // create a new route from the src
        const route = new Route(src, null)

        // The route is for a new connection
        route.is.newConx = true
        
        // and save the route in the from endpoint
        route.from.routes.push(route)

        // make the actual connection
        if (route.connect(dst)) {
            
            // if ok make a smart connection between the two destinations
            route.autoRoute(this.nodes)
        }
        else {
            // could not connect - drop the route in the source as well
            route.from.routes.pop()
        }
    },

    convertRouteToCable(route, segment = 1, xyLocal = null, createPending = false) {

        if (!route?.from || !route?.to) return null
        if (route.from.is.tack || route.to.is.tack) return null
        if (route.wire.length < 2) return null

        const oldRoute = route.clone()
        const wire = route.copyWire()
        const clickSegment = Math.min(Math.max(segment, 1), wire.length - 1)

        const cable = this.addCable(wire[0])
        cable.wire = wire.map(point => ({...point}))

        route.disconnect()

        const attach = (widget, point, tackSegment, endpoint = false) => {
            const tack = cable.newTack()
            tack.is.endpoint = endpoint
            tack.placeOnSegment(point, tackSegment)

            const leg = new Route(widget, tack)
            leg.wire = [widget.center(), {...point}]
            widget.routes.push(leg)
            tack.restore(leg)

            widget.is.pin ? leg.rxtxPinBus() : leg.rxtxPadBus()

            return leg
        }

        const pointOnSegment = (wire, segment, point) => {
            const a = wire[segment - 1]
            const b = wire[segment]

            if (!point) return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}
            if (a.x === b.x) return {x: a.x, y: Math.min(Math.max(point.y, Math.min(a.y, b.y)), Math.max(a.y, b.y))}
            if (a.y === b.y) return {x: Math.min(Math.max(point.x, Math.min(a.x, b.x)), Math.max(a.x, b.x)), y: a.y}
            return {x: point.x, y: point.y}
        }

        const makePendingBranch = () => {
            const point = pointOnSegment(cable.wire, clickSegment, xyLocal)
            const tack = cable.newTack()
            tack.placeOnSegment(point, clickSegment)

            const pendingRoute = new Route(tack, null)
            pendingRoute.wire = [{...point}, {...point}]
            tack.route = pendingRoute

            return {route: pendingRoute, tack}
        }

        const first = cable.wire[0]
        const last = cable.wire.at(-1)
        const routes = [
            attach(oldRoute.from, first, 1, true),
            attach(oldRoute.to, last, cable.wire.length - 1, true)
        ]

        const pending = createPending ? makePendingBranch() : null
        return {node: this, route, oldRoute, cable, routes, tacks: routes.map(leg => leg.from.is.tack ? leg.from : leg.to), pending}
    },

    getInternalRoutes(nodes) {

        const routes = []

        // get all the routes from the output pins of all the nodes
        for(const node of nodes) {

            // sav all the routes of output pins
            for(const pin of node.look.widgets) {

                // only output pins
                if (! pin.is.pin || pin.is.input) continue

                // look at all routes
                for(const route of pin.routes) {

                    // get the destination (it can be null for half-routes !)
                    const other = route.from == pin ? route.to : route.from

                    // check that the node is in the list of nodes
                    if ( ! nodes.includes(other.node)) continue

                    // store the route for that pin
                    routes.push(route)
                }
            }
        }

        return routes
    }


}
