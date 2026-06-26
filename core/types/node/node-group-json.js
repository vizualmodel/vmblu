import {Route} from './route.js'
import {Cable} from './cable.js'
import {Pad} from './pad.js'
import {convert} from '../util/index.js'

export const jsonHandling = {

    makeRaw(refArl) {
       
        // separate function for links
        if (this.link) return this.makeRawDock(refArl)

        // get the look to save
        const {label, rect, interfaces} = this.look  ? this.look.makeRaw() : {label: null, rect:null, interfaces:[]} 

        const raw = { kind: "group", name: this.name, rect} 

        if (label) raw.label = label
        if (this.team) raw.team = this.team
        if (this.promptRepo) raw.promptRepo = this.promptRepo.makeRaw(refArl)
        else if (this.prompt) raw.prompt = this.prompt
        if (this.savedView) raw.view = this.savedView.raw ? this.savedView : this.savedView.makeRaw();
        if (interfaces.length) raw.interfaces = interfaces
        if (this.sx) raw.sx = this.sx    
        if (this.dx) raw.dx = this.dx

        // The nodes
        if (this.nodes) raw.nodes = this.nodes.map( node => node.makeRaw(refArl))

        // Give route serialization stable trunk references without naming them.
        this.cables.forEach((cable, index) => cable._rawIndex = index)

        // get the routes and connections inside this group node
        const [routes, conx] = this.getRoutesAndConnections()

        // set the connections 
        if (conx.length) raw.connections = conx

        // The pads
        if (this.pads.length) raw.pads = this.pads.map( pad => pad.makeRaw())

        // the cables
        if (this.cables.length) raw.cables = this.cables.map( cable => cable.makeRaw(refArl))

        this.cables.forEach(cable => delete cable._rawIndex)

        // save the routes (they are already in the raw format)
        if (routes.length) raw.routes = routes
    
        // done
        return raw
    },

    makeRawDock(refArl) {

        // get the look to save
        const {label, rect, interfaces} = this.look  ? this.look.makeRaw() : {label: null, rect:null, interfaces:[]} 

        // The basis of raw
        const raw = { kind: "dock", name: this.name, link: this.link.makeRaw(refArl), rect } 

        // add if present
        if (label) raw.label = label
        if (this.team) raw.team = this.team
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
        if (this.nodes) {
            this.placeNodesColumnFirst(raw.connections)
            this.checkPadOverlap()
        }

        // cook the connections inside this group node - retuns an array of {from, to, status} - from/to are pins or pads
        const conx = raw.connections ? this.cookConx(raw.connections) : [];
     
        const legacyBuses = []
        this._legacyBuses = legacyBuses

        // Legacy buses are now floating cables.
        if (raw.buses) for(const rawBus of raw.buses) {

            const bus = new Cable({x:0, y:0}, null, true)
            bus.node = this
            bus._rawIndex = legacyBuses.length
            bus._rawName = rawBus.name

            // cook it 
            bus.cook(rawBus, modcom)

            // save it
            this.cables.push(bus)
            legacyBuses.push(bus)
        }

        // get the cables
        this._rawCableStart = this.cables.length
        if (raw.cables) for(const rawCable of raw.cables) {

            const cable = new Cable({x:0, y:0})
            cable.node = this

            cable.cook(rawCable, modcom)

            this.cables.push(cable)
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
            this.createNewRoutes(conx)
        }

        legacyBuses.forEach(bus => {
            delete bus._rawIndex
            delete bus._rawName
        })
        delete this._legacyBuses
        delete this._rawCableStart
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
        newPad.is.placed = !!rawPad.placed

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

        const defaultSelectivity = (trunk, widget) => trunk.defaultTackSelectivity?.(widget) ?? false

        // if the endpoint is a bus or cable, make a tack
        if (from.is.cable) {
            from = from.newTack(source.alias, source.selective ?? defaultSelectivity(from, to));
            from.is.endpoint = !!source.endpoint
            from.is.bridge = !!source.bridge
        }
        if (to.is.cable) {
            to = to.newTack(target.alias, target.selective ?? defaultSelectivity(to, from));
            to.is.endpoint = !!target.endpoint
            to.is.bridge = !!target.bridge
        }

        if (from.is.tack && to.is.tack) {
            from.is.bridge = true
            to.is.bridge = true
        }

        // create the route
        const route = new Route(from, to)

        // Tacks are placed from the restored wire, so their center is not meaningful yet.
        // Build the wire from the concrete endpoint when one side is a bus/cable tack.
        route.wire = convert.stringToWire(
            from.is.tack ? null : from.center(),
            to.is.tack ? null : to.center(),
            rawRoute.wire
        )

        // check if we have a route - otherwise make a route
        if (route.wire.length < 2) route.autoRoute(this.nodes)

        // save the routes for pins and pads
        from.is.tack ? from.setRoute(route) : from.routes.push(route)
        to.is.tack ? to.setRoute(route) : to.routes.push(route)

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
                if (!pin) pin = node.look.widgets.find( widget => widget.is.pin && (widget.is.input == input) && (widget.wid === endPoint.wid) )

                // done
                return pin
            }             
        }

        const findPad = (endPoint, input) => {

            // find by name or wid
            let pad = this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.name === endPoint.pad) )
            if (!pad) pad = this.pads.find( pad => (pad.proxy.is.input == input)&&(pad.proxy.wid === endPoint.wid) )

            // done
            return pad
        }

        const findBus = (raw) => {
            const legacyBuses = this._legacyBuses ?? []
            if (Number.isInteger(raw.index)) return legacyBuses[raw.index] ?? this.cables[raw.index]
            return legacyBuses.find(bus => bus._rawName === raw.cable)
        };
        const findCable = (raw) => this.cables[(this._rawCableStart ?? 0) + (raw.index ?? 0)];
        const hasBus = (raw) => Object.hasOwn(raw, 'bus')
        const hasCable = (raw) => Object.hasOwn(raw, 'cable')
        // ---------

        let from = null, to = null;

        if (source.pin) {

            from = findPin(source, false)
            to = target.pin ? findPin(target, true) : target.pad ? findPad(target,false) : hasBus(target) ? findBus(target) : hasCable(target) ? findCable(target) : null;
        }
        else if (source.pad) {

            from = target.pin ? findPad(source,true) : (hasBus(target) || hasCable(target)) ? findPad(source,false) : null;
            to =   target.pin ? findPin(target, true)  : hasBus(target) ? findBus(target) : hasCable(target) ? findCable(target) : null;
        }
        else if (hasBus(source)) {

            from = findBus(source)
            to = target.pin ? findPin(target,true) : target.pad ? findPad(target, true) : null;
        }
        else if (hasCable(source)) {

            from = findCable(source)
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

        // take the cables
        this.cables = otherNode.cables

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
