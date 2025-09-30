export const connectHandling = {

// if no parameter is given, take to
conxString(from, to) {
    // set the type of connection that needs to be made

    let conxStr =     from.is.pin  ? 'PIN'
                    : from.is.tack || from.is.bus ? 'BUS'
                    : from.is.pad ? 'PAD'
                    : ''

    //if (!conxTo) conxTo = this.to
    if (!to) return conxStr

    conxStr +=        to.is.pin  ? '-PIN'
                    : to.is.tack || to.is.bus ? '-BUS'
                    : to.is.pad ? '-PAD'
                    : ''

    return conxStr
},

// checks if a connection is possible - used for hover-feedback
checkConxType(from, to) {

    // set the type of connection that needs to be made
    const conxStr = this.conxString(from, to)

    switch (conxStr) {

        case 'PIN-PIN':

            // from and to are the same - but avoid bad 'hover' feedback at the start of the route
            if (from === to) return (this.wire.length < 3) ? true : false
            
            // else check
            return from.canConnect(to)  

        case 'PIN-BUS':
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'BUS-PIN':
            // multiple connections are refused !
            return from.bus.findTack(to) ? false : true

        case 'PIN-PAD':
            // only accept new connections of the right type
            return to.canConnect(from)

        case 'PAD-PIN':
            // only accept new connections
            return from.canConnect(to)

        case 'BUS-PAD': 
            return false

        case 'PAD-BUS': 
            // multiple connections are refused !
            return to.findTack(from) ? false : true

        case 'BUS-BUS': return false
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

        case 'PIN-BUS':
            conxTo.addTack(this)
            this.rxtxPinBus() 
            return true

        case 'BUS-PIN':
            this.to = conxTo
            conxTo.routes.push(this)            
            this.rxtxPinBus() 
            return true

        case 'BUS-PAD': 
            this.to = conxTo
            conxTo.routes.push(this)
            this.rxtxPadBus()
            return true    

        case 'PAD-BUS': 
            conxTo.addTack(this)
            this.rxtxPadBus() 
            return true        

        case 'PAD-PAD': 
            return false

        case 'BUS-BUS': 
            return false

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

        case 'PIN-BUS':
        case 'BUS-PIN':
            this.rxtxPinBusDisconnect()
            break        

        case 'PAD-BUS':
        case 'BUS-PAD':
            this.rxtxPadBusDisconnect()
            break

        default: 
            console.error('Impossible combination in route.disconnect:',conx)
            break     
    }

    // remove the route
    this.remove()
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
        if (this.from.bus.tacks.includes(this.from)) return

        // add it to the bus tacks again
        this.from.bus.tacks.push(this.from)
    }

    // for buses we need to use the bus to connect to
    const conxTo = this.to.is.tack ? this.to.bus : this.to

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
    this.from.routes.push(this)

    // and reconnect
    const other = clone.to.is.tack ? clone.to.bus : clone.to
    this.connect(other)   
},

}