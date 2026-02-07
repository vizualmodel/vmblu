import {Route, Bus, Pad, Link} from './index.js'
import {Widget} from '../widget/index.js'
import {convert, style} from '../util/index.js'

export const jsonHandling = {

    makeRaw() {
       
        // separate function for links
        if (this.link) return this.makeRawDock()

        // get the look to save
        const {label, rect, interfaces} = this.look  ? this.look.makeRaw() : {label: null, rect:null, interfaces:[]} 

        const raw = { kind: "group", name: this.name, rect} 

        if (label) raw.label = label
        if (this.prompt) raw.prompt = this.prompt
        if (this.savedView) raw.view = this.savedView.raw ? this.savedView : this.savedView.makeRaw();
        if (interfaces.length) raw.interfaces = interfaces
        if (this.sx) raw.sx = this.sx    
        if (this.dx) raw.dx = this.dx

        // The nodes
        if (this.nodes) raw.nodes = this.nodes.map( node => node.makeRaw())

        // get the routes and connections inside this group node
        const [routes, conx] = this.getRoutesAndConnections()

        // set the connections 
        if (conx.length) raw.connections = conx

        // The pads
        if (this.pads.length) raw.pads = this.pads.map( pad => pad.makeRaw())

        // the buses
        if (this.buses.length) raw.buses = this.buses.map( bus => bus.makeRaw())

        // save the routes (they are already in the raw format)
        if (routes.length) raw.routes = routes
    
        // done
        return raw
    },

    makeRawDock() {

        // get the look to save
        const {label, rect, interfaces} = this.look  ? this.look.makeRaw() : {label: null, rect:null, interfaces:[]} 

        // The basis of raw
        const raw = { kind: "dock", name: this.name, link: this.link.makeRaw(), rect } 

        // add if present
        if (label) raw.label = label
        if (this.prompt) raw.prompt = this.prompt
        if (interfaces.length) raw.interfaces = interfaces
        if (this.sx) raw.sx = this.sx    
        if (this.dx) raw.dx = this.dx

        // done
        return raw
    },

    // cook the content of the node (nodes, buses, pads and routes)
    cook(raw, modcom) {

        // cook the common parts
        this.cookCommon(raw, modcom)

        // if there is a view - make a simple view for the node only rect and tf - the view is restored later 
        this.savedView = raw.view

        // handle the subnodes
        if (raw.nodes) for(const rawNode of raw.nodes) {

            // get the node : it can be a link or a local node
            const node = rawNode.link ? modcom.linkedNode(rawNode) : modcom.localNode(rawNode)

            // save if successful
            if (node) this.nodes.push(node)
        }

        // If there are nodes that have to be placed do it here
        if (this.nodes) this.placeUnplacedNodes(raw.connections);

        // cook the connections inside this group node - retuns an array of {from, to, status} - from/to are pins or pads
        const conx = raw.connections ? this.cookConx(raw.connections) : [];
     
        // get the buses
        if (raw.buses) for(const rawBus of raw.buses) {

            // the name is also used for the bus labels !
            const bus = new Bus(rawBus.name, {x:0, y:0})

            // cook it 
            bus.cook(rawBus, modcom)

            // save it
            this.buses.push(bus)
        }

        // temp storage for the routes
        const routes = []

        // now cook the routes...
        if (raw.routes) for(const rawRoute of raw.routes) {

            // cook the route
            const route = this.cookRoute(rawRoute)
            if (route) routes.push(route)
        }

        // The routes that were not found in the connections have been marked - we have to add routes for new connections now
        if (conx) {

            // and check the route against the connections - the status of the conx and route is adapted
            for (const route of routes) this.findRouteInConx(route, conx);

            // create the routes for the connections that were not found
            this.createRoutes(conx)
        }
    },

    // Place the node as the root node in a view
    placeRoot() {
        // The root is not a container - make some extra margins
        const place = style.placement

        // move the node to its location
        this.look.moveTo( place.marginLeft , place.marginTop)

        // set the flag
        this.is.placed = true
    },

    // places all unplaced nodes according to a grid
    placeUnplacedNodes(rawConnections) {

        const unplaced = this.nodes.filter(node => node?.look && !node.is.placed)
        if (!unplaced.length) return

        const place = style.placement
        const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft
        const spacing = place.spacing
        const tolerance = place.tolerance

        const degree = new Map()
        for (const raw of rawConnections ?? []) {
            const src = raw.src ?? raw.from
            const dst = raw.dst ?? raw.to
            if (!src?.node || !dst?.node) continue
            degree.set(src.node, (degree.get(src.node) ?? 0) + 1)
            degree.set(dst.node, (degree.get(dst.node) ?? 0) + 1)
        }

        const placedNodes = this.nodes.filter(node => node?.look && node.is.placed)
        const expand = rect => ({x: rect.x - spacing, y: rect.y - spacing, w: rect.w + 2 * spacing, h: rect.h + 2 * spacing})
        const overlap = (a, b) => !((a.x + a.w <= b.x) || (a.x >= b.x + b.w) || (a.y + a.h <= b.y) || (a.y >= b.y + b.h))

        const order = unplaced.slice().sort((a, b) => {
            const da = degree.get(a.name) ?? 0
            const db = degree.get(b.name) ?? 0
            return db - da
        })

        for (let i = 0; i < order.length; i++) {
            const node = order[i]
            const col = i % place.nodesPerRow
            const columnX = marginLeft + col * place.colStep

            let y = place.marginTop
            for (const other of placedNodes) {
                const ox = other.look.rect.x
                if (Math.abs(ox - columnX) <= tolerance) {
                    const bottom = other.look.rect.y + other.look.rect.h
                    if (bottom + spacing > y) y = bottom + spacing
                }
            }

            let candidate = {x: columnX, y, w: node.look.rect.w, h: node.look.rect.h}
            while (placedNodes.some(other => overlap(expand(candidate), expand(other.look.rect)))) {
                candidate.y += spacing
            }

            node.look.moveTo(candidate.x, candidate.y)
            node.is.placed = true
            placedNodes.push(node)
        }
    },

    // rawPad exists, but might be incomplete
    cookPad(proxy, rawPad) {

        // get the rect
        let rect = rawPad.rect ? rawPad.rect : {x:10,y:10,w:0,h:0};

        // if no width is given, calculate
        if (rect.w == 0) rect = proxy.makePadRect({x: rect.x, y:rect.y})

        // create a new pad
        const newPad = new Pad(rect, proxy, null)

        // set the direction of the text
        newPad.is.leftText = rawPad.left

        // save the pad in the proxy
        proxy.pad = newPad

        // and push the pad on the pads array
        this.pads.push(newPad)
    },

    cookRoute(rawRoute) {

        const source = convert.rawToEndPoint(rawRoute.from)
        const target = convert.rawToEndPoint(rawRoute.to)

        // check
        if (!source || !target) return null;
        
        // find the actual widgets at both ends of the route (pin pad or bus)
        let [from, to] = this.getEndPoints(source, target)

        //check for errors - It can be that from/to are not found if the pin name for a linked node has changed
        if (!from || !to) {
            if (!from) console.error(`invalid route from ${rawRoute.from} to ${rawRoute.to} - 'from' endpoint not found`)
            if (!to) console.error(`invalid route from ${rawRoute.from} to ${rawRoute.to} - 'to' endpoint not found`)
            return null;
        }

        // if the endpoint is a bus, make a tack
        if (from.is.bus) from = from.newTack(source.alias);
        if (to.is.bus) to = to.newTack(target.alias);

        // create the route
        const route = new Route(from, to)

        // get the wire (for bustacks the center will be null, but that is not a problem)
        route.wire = convert.stringToWire(from.center(), to.center(), rawRoute.wire)

        // check if we have a route - otherwise make a route
        if (route.wire.length < 2) route.autoRoute(this.nodes)

        // save the routes for pins and pads
        from.is.tack ? from.setRoute(route) : from.routes.push(route)
        to.is.tack ? to.setRoute(route) : to.routes.push(route)

        // set the route as twisted pair if required (multi wire)
        route.checkTwistedPair()

        // this is required if a linked node has changed (eg more pins or pins have moved...)
        route.adjust()

        // done
        return route
    },

    // get the widget for the endpoint
    getEndPoints(source, target) {

        // -------- helpers
        const findPin = (endPoint, input) => {
            for(const node of this.nodes) {

                // check the node name first
                if (node.name != endPoint.node) continue

                // try to find by name or by wid (name could have changed !)
                let pin = node.look.widgets.find( widget => widget.is.pin && (widget.is.input == input) && (widget.name === endPoint.pin) )
                if (!pin) node.look.widgets.find( widget => widget.is.pin && (widget.is.input == input) && (widget.wid === endPoint.wid) )

                // done
                return pin
            }             
        }

        const findPad = (endPoint, input) => {

            // find by name or wid
            let pad = this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.name === endPoint.pad) )
            if (!pad) this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.wid === endPoint.wid) )

            // done
            return pad
        }

        const findBus = (raw) => this.buses.find( bus => bus.name === raw.bus);
        // ---------

        let from = null, to = null;

        if (source.pin) {

            from = findPin(source, false)
            to = target.pin ? findPin(target, true) : target.pad ? findPad(target,false) : target.bus ? findBus(target) : null;
        }
        else if (source.pad) {

            from = target.pin ? findPad(source,true) : target.bus ? findPad(source,false) : null;
            to =   target.pin ? findPin(target, true)  : target.bus ? findBus(target) : null;
        }
        else if (source.bus) {

            from = findBus(source)
            to = target.pin ? findPin(target,true) : target.pad ? findPad(target, true) : null;
        }

        return [from, to]
    },

    // the node is fused with a another group node - note that the other node is already a copy !
    fuse( otherNode ) {

        // check for added /deleted widgets
        this.widgetCompare( otherNode )

        // fuse the settings
        this.sxUpdate(otherNode)

        // take the nodes from the linked node
        this.nodes = otherNode.nodes

        // take the buses
        this.buses = otherNode.buses

        // take the pads
        this.pads = otherNode.pads

        // the pads must correspond to the proxies of this node
        this.reConnectPads()
    },

    // for an imported groupnode the pads have to be reconnected to the proxies of the look in the importing file
    reConnectPads() {

        // for all the pads
        this.pads.forEach( pad => {

            // find the input or output pin for this node...
            const proxy = this.look.findPin(pad.proxy.name, pad.proxy.is.input)

            // should absolutely not happen
            if (!proxy) return console.log(`*** ERROR *** node ${this.name} has no proxy for pad  ${pad.proxy.name}`)

            // set the proxy
            pad.proxy = proxy

            // and also set the pad in the proxy
            proxy.pad = pad
        })
    },

    // // check that each pin has a pad - no more no less
    // checkPadProxyPairs() {

    //     for (const pin of this.look.widgets) {

    //         // only check proxies
    //         if (!pin.is.proxy) continue

    //         // find the corresponding pad
    //         const pad = this.pads.find( pad => pad.proxy == pin)

    //         // ok - continue
    //         if (pad) continue

    //         // create a new pad
    //         this.addPad(pin)
    //     }
    // }
}
