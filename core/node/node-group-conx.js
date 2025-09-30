import {Route} from './index.js'
import {convert} from '../util/index.js'

export const conxHandling = {

    // message flow is src dst
    addConnection(src, dst, conx) {

        // helper function
        const makeAddress = (A) => A.is.pin ? {pin: A.name, node: A.node.name} : A.is.pad ? {pin: A.proxy.name} : {pin: '?', node: '?'};

        // simple case - no a tack (pin or pad)
        if ( ! dst.is.tack) {
            // save 
            conx.push({src: makeAddress(src), dst: makeAddress(dst)})  

            // done
            return
        }

        // If the destination is a bus we have to find the actual connected pins and pads
        const bus = dst.bus
        const fanout = []

        // check the connections to the bus
        for(const tack of bus.tacks) {

            // skip the to tack
            if (tack == dst) continue

            // Take the widget at the other end of the route
            const other = tack.route.from == tack ? tack.route.to : tack.route.from

            // check if the two are connected (i/o, name)
            if (bus.areConnected(src, other)) fanout.push(other)
        }           

        // save all the destinations from the bus that were found
        for(const busDst of fanout) {

            // save 
            conx.push({src: makeAddress(src), dst: makeAddress(busDst)})
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
                    routes.push(convert.routeToString(route))

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
                routes.push(convert.routeToString(route))

                // get the destination (it can be null for half-routes !)
                const other = route.from == pad ? route.to : route.from

                // add the connection
                this.addConnection(pad,other, conx)
            }
        }        

        // What remains are the routes from the bus to incoming pins and from the bus to the outgoing pads
        // Note that routes from a bus are **not** added to the connections array !!
        for(const bus of this.buses) {

            // convert each tack
            for(const tack of bus.tacks) {

                const other = tack.getOther()
                if (other.is.pin && other.is.input) routes.push(convert.routeToString(tack.route))
                if (other.is.pad && !other.proxy.is.input) routes.push(convert.routeToString(tack.route))
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

                const sFrom = `${raw.from?.pin} ${raw.from?.node ? ' @ ' + raw.from?.node : '(pad)'}`
                const sTo = `${raw.to?.pin} ${raw.to?.node ? ' @ ' + raw.to?.node : '(pad)'}`
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

        let src = null, dst = null;
        for (const raw of rawConx) {

            // *** CHANGE THIS TO ONLY SRC DST *** //
            const rawsrc = raw.from ?? raw.src
            const rawdst = raw.to ?? raw.dst

            if (!rawsrc || !rawdst) continue

            // find from and to and give an error message if not found
            src = rawsrc.node ? resolvePin(rawsrc, false) : resolvePad(rawsrc, true)
            if (!src) showError('Connection <src> not found: ', raw)

            dst = rawdst.node ? resolvePin(rawdst, true) : resolvePad(rawdst, false)
            if (!dst) showError('Connection <dst> not found: ', raw)

            // check
            if (!src || !dst) continue;

            // check i/o mismatch
            if (ioMismatch(src, dst)) {
                showError('Input/output mismatch: ', raw)
                continue;
            }

            // check rq/rp mismatch
            if (rqrpMismatch(src, dst)) {
                showError('request/reply mismatch: ', raw)
                continue;
            }

            // add to the array
            conx.push({src, dst, is: {new:true}})
        }
        return conx
    },

    // a route should have a counterpart in the connections - otherwise it is set to be removed
    findRouteInConx(route, conx) {

        // helper functions -----------------------------------
        const findConx = (A, B) => conx.find( cx => ((A == cx.src) && (B == cx.dst)) || ((A == cx.dst) && (B == cx.src)) )
        //const findConx = (A, B) => conx.find( cx => ((A == cx.src) && (B == cx.dst)) )

        const checkBus = (bus, src, via) => {

            // check for the connections to the bus..
            for(const tack of bus.tacks) {

                // skip this tack of the route...
                if (tack == via) continue

                // get the other side of the route
                const dst = tack.getOther()

                // check if logically conneceted via this bus (i/o and name must match...)
                if (bus.areConnected(src, dst)) {

                    // check if we find this connection in conx
                    const cx = findConx(src, dst)

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

            // we always accept routes to buses 
            route.is.noConx = dst.is.tack ? false : true;
            return
        }

             
        // check the routes 
        if (src.is.tack){

            // we accept routes that come from a bus...
            route.is.noConx = false
        }
        // pin or pad
        else {
            // other end goes to a bus
            if (dst.is.tack) {

                // The bus that the tack is connected to
                checkBus(dst.bus, src, dst)
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

    createRoutes(conx) {

        // check
        if (! conx?.length) return

        // add a routes for each new connection
        for(const cx of conx) {

            if (!cx.is.new) continue

            // create a new route
            const route = new Route(cx.src, cx.dst)
            
            // make a smart connection between the two destinations
            route.autoRoute(this.nodes)

            // The route is for a new connection
            route.is.newConx = true
            
            // and save the route in the endpoints
            route.from.routes.push(route)
            route.to.routes.push(route)
        }
    }
}