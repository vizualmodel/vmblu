export const rxtxHandling = {

// return how messages can arrow between two widgets
// There are actually ony two cases to consider: pin pin | pin pad | pin bus | pad bus
// right = A->B, left = A<-B
arrow(A, B) {

    // pin pin
    if (B.is.pin) return {right: B.is.input, left: !B.is.input}

    // pin pad
    if (B.is.pad) return {right: !B.proxy.is.input, left: B.proxy.is.input}

    // pin/pad to shared trunk (bus or cable)
    if (B.is.cable) return A.is.pin   ? {right: !A.is.input, left: A.is.input} 
                                                : {right: A.proxy.is.input, left: !A.proxy.is.input}
},

// A and B are two pin widgets (actual or proxy)
rxtxPinPin() {

    // messages are flowing from the src list to the dst list
    const srcList = []
    const dstList = []

    // get the arrow
    const arrow = this.arrow(this.from, this.to)

    // get source and destination
    const src = arrow.right ? this.from : this.to
    const dst = arrow.right ? this.to : this.from

    // proxies require possibly many connections
    if (dst.is.proxy || src.is.proxy) {

        // find all the pins that can generate input via src - incoming to src
        src.is.proxy ? src.pad?.makeConxList( srcList ) : srcList.push( src )

        // Find all the pins that can receive input via dst - outgoing from dst
        dst.is.proxy ? dst.pad?.makeConxList( dstList ) : dstList.push( dst )

        // do a full connection...
        this.fullConnect(srcList, dstList)
    }
    // if the two are pins, we have to add one destination in one table
    else this.singleConnect(src, dst)

},

rxtxPinPad() {

    // messages are flowing from the inlist to the outlist (list = list of source node widgets)
    const srcList = []
    const dstList = []

    // get the pin and the pad
    const [pin, pad] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from]

    // if the pin that we connect has a channel, the proxy also allows channels
    if (pin.is.channel) pad.proxy.is.channel = true

    // determine the arrow over the route: left or right
    const arrow = this.arrow(pin, pad)

    // from pin to pad
    if (arrow.right) {

        // get all the incoming connections to the pin (that can be a proxy)
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin)

        // get all the outgoing connections on the proxy of the pad
        pad.proxy.makeConxList(dstList)    
        
        // fully connect
        this.fullConnect(srcList, dstList)
    }

    // from pad to pin
    if (arrow.left) {

        // get all the incoming connections on the proxy of the pad
        pad.proxy.makeConxList(srcList)   

        // get all the outgoing connections of the pin
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)
        
        // and fully connect
        this.fullConnect(srcList, dstList)
    }
},

// connect to the bus
rxtxPinBus() {

    // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the tack
    const [pin, tack] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from]

    // get the arrow
    const arrow = this.arrow(pin, tack.cable)

    // arrow is from pin to bus
    if (arrow.right) {

        // now make the source list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin) 

        // make the list of destinations connected to this bus for this pin
        tack.makeConxList(dstList)
        
        // and do a full connect
        this.fullConnect(srcList, dstList)
    }

    // left 
    if (arrow.left) {

        // now make the inlist
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)

        // make the list of outputs of connected to this bus
        tack.makeConxList(srcList)

        // and do a full connect between source and destination list
        this.fullConnect(srcList, dstList)
    }
},

// connect to the bus
rxtxPadBus() {

    // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from]

    const arrow = this.arrow(pad, tack.cable)

    // from pad to bus
    if (arrow.right) {

        pad.proxy.makeConxList(srcList)

        // find the connections from the tack
        tack.makeConxList(dstList)

        // and do a full connect
        this.fullConnect(srcList, dstList)
    }
    // from bus to pad
    if (arrow.left) {

        pad.proxy.makeConxList(dstList)

        // find the incoming connections on the bus that lead to the pad 
        tack.makeConxList(srcList)

        // and do a full connect
        this.fullConnect(srcList, dstList)
    }
},

// disconnect a pin
rxtxPinPinDisconnect() {

    const srcList = []
    const dstList = []

    const arrow = this.arrow(this.from, this.to)

    const src = arrow.right ? this.from : this.to
    const dst = arrow.right ? this.to : this.from

    // if one of the two is a proxy, we have to remove many destinations
    if (src.is.proxy || dst.is.proxy) {

        // make the list of actual in and out widgets
        src.is.proxy ? src.pad?.makeConxList( srcList)  : srcList.push( src )
        dst.is.proxy ? dst.pad?.makeConxList( dstList ) : dstList.push( dst )
 
        // and now do a full disconnection of the pins
        this.fullDisconnect(srcList, dstList)
     }
    // if the two are actual pins we have to remove one destination from one table
    else {
        // remove the destination from the specified output-pin of the node
        src.node.rxtxRemoveFromTxTable(src, dst)
    }
},

// disconnect a pin from a pad
rxtxPinPadDisconnect() {

    // messages are flowing from the inlist to the outlist (list = list of source node widgets)
    const srcList = []
    const dstList = []

    // get the pin and the pad
    const [pin, pad] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from]

    // check if we still need to keep the channel
    if (pad.proxy.is.channel) {

        // find the first other route that also has a channel
        const route = pad.routes.find( route => {
                                if (route != this) {
                                    const other = route.from == pad ? route.to : route.from
                                    if (other.is.pin && other.is.channel) return true
                                    if (other.is.pad && other.proxy.is.channel) return true
                                }
                            })
        
        pad.proxy.is.channel = route ? true : false
    }

    // determine the arrow over the route
    const arrow = this.arrow(pin, pad)

    // from pin to pad
    if (arrow.right) {
        // get all the incoming connections to the pin (that can be a proxy)
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin)

        // get all the outgoing connections on the proxy of the pad
        pad.proxy.makeConxList(dstList)    
        
        // fully disconnect
        this.fullDisconnect(srcList, dstList)
    }

    // from pad to pin
    if (arrow.left) {
        // get all the incoming connections on the proxy of the pad
        pad.proxy.makeConxList(srcList) 

        // get all the outgoing connections of the pin
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)
        
        // and fully disconnect
        this.fullDisconnect(srcList, dstList)
    }
},

// disconnect from the bus
rxtxPinBusDisconnect() {

     // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the bus
    const [pin, tack] = this.from.is.pin ? [this.from, this.to] : [this.to, this.from]

    // get the arrow
    const arrow = this.arrow(pin, tack.cable)

    // right
    if (arrow.right) {
        // now make the output list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin)   

        // make the list of inputs connected to this bus of the same name
        tack.makeConxList(dstList)

        // and do a full disconnect 
        this.fullDisconnect(srcList, dstList)
    }

    // left 
    if (arrow.left) {

        // make the list of outputs of the same name connected to this bus
        tack.makeConxList(srcList)

        // now make the inlist
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)

        // and do a full disconnect 
        this.fullDisconnect(srcList, dstList)
    }
},

rxtxPadBusDisconnect() {

    // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from]

    // get the arrow
    const arrow = this.arrow(pad, tack.cable)

    if (arrow.right) {

        pad.proxy.makeConxList(srcList)
        tack.makeConxList(dstList)
        this.fullDisconnect(srcList, dstList)
    }
    if (arrow.left) {

        tack.makeConxList(srcList)
        pad.proxy.makeConxList(dstList)
        this.fullDisconnect(srcList, dstList)
    }
},

rxtxBusBus() {
    const [A, B] = [this.from, this.to]
    const listA = this.endpointTacksAcrossBridge(A, this)
    const listB = this.endpointTacksAcrossBridge(B, this)
    const {srcList, dstList} = this.connectedEndpointsFromTacks(listA, listB)

    this.fullConnect(srcList, dstList)
},

rxtxBusBusDisconnect() {
    const [A, B] = [this.from, this.to]
    const listA = this.endpointTacksAcrossBridge(A, this)
    const listB = this.endpointTacksAcrossBridge(B, this)
    const {srcList, dstList} = this.connectedEndpointsFromTacks(listA, listB)

    this.fullDisconnect(srcList, dstList)
},

endpointTacksAcrossBridge(start, blockedRoute, visited = new Set()) {
    const list = []

    if (!start?.is?.tack || visited.has(start)) return list
    visited.add(start)

    for (const tack of start.cable.tacks) {
        if (tack === start) continue
        if (!tack.route?.from || !tack.route?.to) continue
        if (tack.route === blockedRoute) continue

        const other = tack.getOther()

        if (other.is.tack) {
            list.push(...this.endpointTacksAcrossBridge(other, blockedRoute, visited))
        }
        else {
            list.push(tack)
        }
    }

    return list
},

actualEndpoint(widget) {
    if (widget?.is?.pin) return widget
    if (widget?.is?.pad) return widget.proxy
    return null
},

endpointIsInput(widget) {
    if (widget?.is?.pin) return widget.is.input
    if (widget?.is?.pad) return !widget.proxy.is.input
    return null
},

connectedEndpointsFromTacks(listA, listB) {
    const srcList = []
    const dstList = []

    for (const tackA of listA) for (const tackB of listB) {
        if (!tackA.areConnected(tackB)) continue

        const actualA = this.actualEndpoint(tackA.getOther())
        const actualB = this.actualEndpoint(tackB.getOther())
        const inputA = this.endpointIsInput(tackA.getOther())

        inputA ? (srcList.push(actualB), dstList.push(actualA)) : (srcList.push(actualA), dstList.push(actualB))
    }

    return {srcList, dstList}
},

// just need to make a single connection
singleConnect(src, dst){

    // find the entry in the txTable 
    let tx = src.node.txTable.find( tx => tx.pin.name == src.name)

    // check
    if (!tx) return;

    // and add it to the array of destinations
    tx.targets.push(dst)        
},

// for each resolved rx and tx pair, add an entry to the table
fullConnect(srcList, dstList) {

    // we have a list of out and ins that we have to connect 
    for(const src of srcList) {

        // find the entry in the conx table that corresponds to the pin 
        const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name )

        /** debug should not happen */
        if (!txRecord) {
            console.warn('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullConnect', src.name, src.node.name)
            continue
        }

        // for each entry in the dstlist, add a destination
        for(const dst of dstList) txRecord.targets.push(dst)
    }
},

// for each resolved rx and tx pair, remove the entry in the table
fullDisconnect(srcList, dstList) {

    for(const src of srcList) {

        // find the entry in the conx table that corresponds to the pin 
        const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name )

        /** debug should not happen */
        if (!txRecord) {
            console.warn('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullDisconnect', src.name, src.node.name)
            continue
        }

        // remove all the targets that are in the list of destinations
        for(const dst of dstList) txRecord.dropTarget(dst)
    }
},

}
