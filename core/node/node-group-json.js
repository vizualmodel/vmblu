import {Route, Bus, Pad, Link} from './index.js'
import {Widget} from '../widget/index.js'
import {convert, style} from '../util/index.js'

export const jsonHandling = {

    toJSON() {

        // separate function for links
        if (this.link) return this.dockToJSON()

        // get the items to save
        const {rect, label, interfaces} = this.look ? this.look.getItemsToSave() : {rect: null, label: null, interfaces: []}

        // The json structure to save
        const json = { kind: "group", name: this.name} 

        // add if present
        if (label) json.label = label
        if (interfaces.length) json.interfaces = interfaces
        if (this.sx) json.sx = this.sx    
        if (this.dx) json.dx = this.dx
        if (this.prompt) json.prompt = this.prompt
        if (this.nodes.length) json.nodes = this.nodes

        // get the routes inside this group node
        const [routes, conx] = this.getRoutesAndConnections()

        // set the connections 
        if (conx.length) json.connections = conx

        // add the editor specific fields: rect, view, buses, routes
        json.editor = {rect: convert.rectToString(rect)}

        // add the view
        if (this.savedView) json.editor.view = convert.viewToJSON(this.savedView)

        // the buses
        if (this.buses.length) json.editor.buses = this.buses

        // save the routes
        if (routes.length) json.editor.routes = routes
    
        // done
        return json
    },

    dockToJSON() {

        // get the elements to save
        const {rect, label, interfaces} = this.look ? this.look.getItemsToSave() : {rect: null, label: null, interfaces: []}

        const json = { kind: "dock", name: this.name, link: this.link } 

        // add if present
        if (label) json.label = label
        if (this.prompt) json.prompt = this.prompt
        if (interfaces.length) json.interfaces = interfaces
        if (this.sx) json.sx = this.sx    
        if (this.dx) json.dx = this.dx

        // add the editor specific fields
        json.editor = { rect: convert.rectToString(rect) }

        // done
        return json
    },

    // cook the content of the node (nodes, buses, pads and routes)
    cook(raw, modcom) {

        // cook the common parts
        this.cookCommon(raw)

        // if there is a view - make a simple view for the node only rect and tf - the view is restored later 
        if (raw.editor.view) this.savedView = convert.stringToView(raw.editor.view)

        // handle the subnodes
        if (raw.nodes) for(const rawNode of raw.nodes) {

            // get the node : it can be a link or a local node
            const node = rawNode.link ? modcom.linkedNode(rawNode) : modcom.localNode(rawNode)

            // save if successful
            if (node) this.nodes.push(node)

            // if the node has not been properly placed, do it now
            if (!node.is.placed) this.placeNode(node)
        }

        // cook the connections inside this group node - retuns an array of {from, to, status} - from/to are pins or pads
        const conx = raw.connections ? this.cookConx(raw.connections) : [];
     
        // get the buses
        if (raw.editor.buses) for(const rawBus of raw.editor.buses) {

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
        if (raw.editor.routes) for(const rawRoute of raw.editor.routes) {

            // cook the route
            const route = this.cookRoute(rawRoute)
            if (route) routes.push(route)
        }

        // The routes that were not found in the connections have been marked - we have to add routes for new connections now
        if (conx) {

            // and check the route against the connections - the status of the conx and route is adapted
            for (const route of routes) this.findRouteInConx(route, conx);

            // create the routes for the connections that were not foudn
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

    // places a node according to a grid
    placeNode(node) {

        const place = style.placement
        const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft
        const spacing = place.spacing   // small gap so nodes do not touch
        const tolerance = place.tolerance  // allow a little drift when matching columns

        const placedNodes = this.nodes.filter(other => (other !== node) && other.look && other.is.placed)
        const idx = this.nodes.indexOf(node) >= 0 ? this.nodes.indexOf(node) : this.nodes.length - 1

        // keep the column grid, but stack vertically based on actual heights
        const col = idx % place.nodesPerRow
        const columnX = marginLeft + col * place.colStep

        // start at the default top margin for this column
        let y = place.marginTop

        // find the bottom of the lowest node already in this column
        for (const other of placedNodes) {
            const ox = other.look.rect.x
            if (Math.abs(ox - columnX) <= tolerance) {
                const bottom = other.look.rect.y + other.look.rect.h
                if (bottom + spacing > y) y = bottom + spacing
            }
        }

        // move down further if we still overlap any node (safety for slightly misaligned columns)
        const expand = rect => ({x: rect.x - spacing, y: rect.y - spacing, w: rect.w + 2 * spacing, h: rect.h + 2 * spacing})
        const overlap = (a, b) => !((a.x + a.w <= b.x) || (a.x >= b.x + b.w) || (a.y + a.h <= b.y) || (a.y >= b.y + b.h))
        let candidate = {x: columnX, y, w: node.look.rect.w, h: node.look.rect.h}
        while (placedNodes.some(other => overlap(expand(candidate), expand(other.look.rect)))) {
            candidate.y += spacing
        }

        node.look.moveTo(candidate.x, candidate.y)
        node.is.placed = true
    },


    // places a node according to a grid
    OLD_placeNode(node) {

        const place = style.placement
        const index = this.nodes.length - 1

        // find row and column 
        const col = index % place.nodesPerRow
        const row = Math.floor(index / place.nodesPerRow);

        // check if we need extra space for the pads
        const marginLeft = this.pads.length ? place.marginLeftPads : place.marginLeft;

        // move the node to its location
        node.look.moveTo( marginLeft + col * place.colStep, place.marginTop  + row * place.rowStep)

        // set the flag
        node.is.placed = true
    },

    // rawPad exists, but might be incomplete
    cookPad(proxy, rawPad) {

        // get the rect
        let rect = rawPad.rect ? convert.stringToRect(rawPad.rect) : {x:10,y:10,w:0,h:0};

        // if no width is given, calculate
        if (rect.w == 0) rect = proxy.makePadRect({x: rect.x, y:rect.y})

        // create a new pad
        const newPad = new Pad(rect, proxy, null)

        // set the direction of the text
        newPad.is.leftText = rawPad.align == "left" ? true : false;

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
            if (!from) console.error(`invalid route *FROM* ${rawRoute.from} to ${rawRoute.to}`)
            if (!to) console.error(`invalid route from ${rawRoute.from} *TO* ${rawRoute.to}`)
            return null;
        }

        // if the endpoint is a bus, make a tack
        if (from.is.bus) from = from.newTack();
        if (to.is.bus) to = to.newTack();

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
