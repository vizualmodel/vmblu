export const connectHandling = {

trunkOfTack(tack) {
    if (!tack?.is?.tack) return null
    return tack.cable
},

bridgeParts(from, to) {
    if (!from?.is?.tack || !to?.is?.cable) return null
    if (!from.cable?.is?.cable) return null
    if (from.cable.is.floating === to.is.floating) return null
    return from.cable.is.floating
        ? {cable: to, bus: from.cable}
        : {cable: from.cable, bus: to}
},

bridgeNeighbors(trunk) {
    const neighbors = []

    for (const tack of trunk?.tacks ?? []) {
        const other = tack.route?.from == tack ? tack.route.to : tack.route?.from
        if (!other?.is?.tack) continue

        const neighbor = this.trunkOfTack(other)
        if (neighbor) neighbors.push(neighbor)
    }

    return neighbors
},

bridgePathExists(from, to) {
    const seen = new Set()
    const pending = [from]

    while (pending.length) {
        const trunk = pending.pop()
        if (!trunk || seen.has(trunk)) continue
        if (trunk === to) return true

        seen.add(trunk)
        pending.push(...this.bridgeNeighbors(trunk))
    }

    return false
},

canBridge(from, to) {
    const bridge = this.bridgeParts(from, to)
    if (!bridge) return false

    return !this.bridgePathExists(bridge.cable, bridge.bus)
},

canConnectPromotedRoute(from, route) {
    if (!route?.is?.route || route === this) return false
    if (!route.from || !route.to || route.wire.length < 2) return false
    if (route.from.is.tack || route.to.is.tack) return false
    if (route.from === from || route.to === from) return false

    if (from.is.pin || from.is.pad) return true
    if (!from.is.tack) return false

    return !!from.cable?.is?.floating
},

conxString(from, to) {
    // set the type of connection that needs to be made

    if (!from || !to) return null

    let conxStr =     from.is.pin  ? 'PIN'
                    : from.is.tack || from.is.cable ? 'CBL'
                    : from.is.route ? 'ROUTE'
                    : from.is.pad ? 'PAD'
                    : ''

    conxStr +=        to.is.pin  ? '-PIN'
                    : to.is.tack || to.is.cable ? '-CBL'
                    : to.is.route ? '-ROUTE'
                    : to.is.pad ? '-PAD'
                    : ''

    return conxStr
},

// checks if a connection is possible - used for hover-feedback
checkConxType(from, to) {

    // set the type of connection that needs to be made
    const conxStr = this.conxString(from, to)

    if (!conxStr) return false

    switch (conxStr) {

        case 'PIN-PIN':

            // from and to are the same - but avoid bad 'hover' feedback at the start of the route
            if (from === to) return (this.wire.length < 3) ? true : false
            
            // else check
            return from.canConnect(to)  

        case 'PIN-CBL':
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'CBL-PIN':
            // multiple connections are refused !
            return from.cable.findTack(to) ? false : true

        case 'PIN-PAD':
            // only accept new connections of the right type
            return to.canConnect(from)

        case 'PAD-PIN':
            // only accept new connections
            return from.canConnect(to)

        case 'CBL-PAD': 
            // multiple connections are refused !
            return from.cable.findTack(to) ? false : true

        case 'PAD-CBL': 
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'CBL-CBL': return this.canBridge(from, to)
        case 'PIN-ROUTE':
        case 'PAD-ROUTE':
        case 'CBL-ROUTE': return this.canConnectPromotedRoute(from, to)
        case 'PAD-PAD': return false

        default : return false
    }
},

// make the actual connection
connect(conxTo) {

    // we do the check here
    if (! this.checkConxType(this.from, conxTo)) return false

    // set the type of connection that needs to be made
    const conxStr = this.conxString(this.from, conxTo)
    
    switch (conxStr) {

        case 'PIN-PIN':
            this.to = conxTo
            conxTo.routes.push(this)
            this.rxtxPinPin()
            return true

        case 'PIN-PAD':
            this.to = conxTo
            conxTo.routes.push(this)
            this.rxtxPinPad()
            return true

        case 'PAD-PIN':
            this.to = conxTo
            conxTo.routes.push(this)   
            this.rxtxPinPad()           
            return true

        case 'PIN-CBL':
            conxTo.addTack(this)
            this.rxtxPinBus() 
            return true

        case 'CBL-PIN':
            this.to = conxTo
            conxTo.routes.push(this)            
            this.from.setSelective(this.from.cable.defaultTackSelectivity(conxTo))
            this.from.setRoute(this)
            this.rxtxPinBus() 
            return true

        case 'CBL-PAD': 
            this.to = conxTo
            conxTo.routes.push(this)
            this.from.setSelective(this.from.cable.defaultTackSelectivity(conxTo))
            this.from.setRoute(this)
            this.rxtxPadBus()
            return true    

        case 'PAD-CBL': 
            conxTo.addTack(this)
            this.rxtxPadBus() 
            return true        

        case 'PAD-PAD': 
            return false

        case 'CBL-CBL': 
            if (!conxTo.addTack(this)) return false
            this.autoRoute()
            this.rxtxBusBus()
            return true

        default : return false
    }
},

// disconnects a route at both ends 
disconnect() {

    // set the type of connection that needs to be made
    let conx = this.conxString(this.from, this.to)

    switch (conx) {

        case 'PIN-PIN':
            this.rxtxPinPinDisconnect()
            break

        case 'PIN-PAD':
        case 'PAD-PIN':
            this.rxtxPinPadDisconnect()
            break        

        case 'PIN-CBL':
        case 'CBL-PIN':
            this.rxtxPinBusDisconnect()
            break        

        case 'PAD-CBL':
        case 'CBL-PAD':
            this.rxtxPadBusDisconnect()
            break

        case 'CBL-CBL':
            this.rxtxBusBusDisconnect()
            break

        default: 
            console.error('Impossible combination in route.disconnect:',conx)
            return false
    }

    // remove the route
    this.remove()
    return true
},

// used in undo operations - the route has been removed in the to and from widgets 
// and has to be reconnected there. It is possible that a route appears twice in the list
// so we always check if we have already handled the route or not
// Reconnecting is a two stage process: first connect the route in the from widget (we do this here)
// and then connect in the to-widget by calling the connect function
reconnect() {

    // check if we have already handled the route. Could be a pin..
    if (this.from.is.pin) {

        // check if already handled
        if (this.from.routes.includes(this)) return

        // save the route in from
        this.from.routes.push(this)
    }

    // ..or a pad
    else if (this.from.is.pad) {

        // check if already handled
        if (this.from.routes.includes(this)) return

        // no, save the route
        this.from.routes.push(this)
    }

    // ..or could be a bus tack
    else if (this.from.is.tack) { 

        // check if already handled
        if (this.from.cable.tacks.includes(this.from)) return

        // add it to the bus tacks again
        this.from.cable.tacks.push(this.from)
    }

    // for buses we need to use the bus to connect to
    const conxTo = this.to.is.tack ? this.to.cable : this.to

    // set to in the route to null
    this.to = null
    
    // and connect again
    this.connect(conxTo)
},

// also used in undo/redo - copies the content of a temp copy into this route
connectFromClone(clone) {
    
    // save the old route details in the route
    this.wire = clone.wire
    this.from = clone.from

    if (this.from.is.pin || this.from.is.pad) {
        this.from.routes.push(this)
    }
    else if (this.from.is.tack) {
        this.from.route = this
        if (!this.from.cable.tacks.includes(this.from)) this.from.cable.tacks.push(this.from)
    }

    // and reconnect
    const other = clone.to.is.tack ? clone.to.cable : clone.to
    this.connect(other)   
},

}
