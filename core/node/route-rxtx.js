export const rxtxHandling = {

// return how messages can arrow between two widgets
// There are actually ony two cases to consider: pin pin | pin pad | pin bus | pad bus
// right = A->B, left = A<-B
arrow(A, B) {

    // pin pin
    if (B.is.pin) return {right: B.is.input, left: !B.is.input}

    // pin pad
    if (B.is.pad) return {right: !B.proxy.is.input, left: B.proxy.is.input}

    // pin bus | pad bus
    if (B.is.bus) return A.is.pin   ? {right: !A.is.input, left: A.is.input} 
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
    const arrow = this.arrow(pin, tack.bus)

    // arrow is from pin to bus
    if (arrow.right) {

        // now make the source list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin) 

        // if the bus has a router save the pins this tack is connected to, and set the connections to the tack
        if (tack.bus.hasFilter()) {

            // add the incoming to the table for the bus
            tack.bus.rxtxAddRxTack(tack)

            // and do a full connect to the bus
            this.fullConnect(srcList,[tack])
        }

        // and do a full connect between source and destination list
        else {

            // make the list of destinations connected to this bus for this pin
            tack.bus.makeConxList(pin, dstList)
            
            // and do a full connect
            this.fullConnect(srcList, dstList)
        }
    }

    // left 
    if (arrow.left) {

        // now make the inlist
        pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)

        if (tack.bus.hasFilter()) {

            // add the destination for this tack
            tack.bus.rxtxAddTxTack(tack, dstList)
        }
        else {

            // make the list of outputs of connected to this bus
            tack.bus.makeConxList(pin, srcList)

            // and do a full connect between source and destination list
            this.fullConnect(srcList, dstList)
        }
    }
},

// connect to the bus
rxtxPadBus() {

    // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from]

    const arrow = this.arrow(pad, tack.bus)

    // from pad to bus
    if (arrow.right) {

        pad.proxy.makeConxList(srcList)

        if (tack.bus.hasFilter()) {

            // add the tack to the table
            tack.bus.rxtxAddRxTack(tack)

            // and do a full connect to the bus tack only
            this.fullConnect(srcList,[tack])            
        }
        else {

            // find the connections from the tack
            tack.bus.makeConxList(pad, dstList)

            // and do a full connect
            this.fullConnect(srcList, dstList)
        }
    }
    // from bus to pad
    if (arrow.left) {

        pad.proxy.makeConxList(dstList)

        if (tack.bus.hasFilter()) {

            // save the destinations for this tack
            tack.bus.rxtxAddTxTack(tack, dstList)
        }
        else {
            // find the incoming connections on the bus that lead to the pad 
            tack.bus.makeConxList(pad, srcList)

            // and do a full connect
            this.fullConnect(srcList, dstList)
        }
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
    const arrow = this.arrow(pin, tack.bus)

    // right
    if (arrow.right) {
        // now make the output list 
        pin.is.proxy ? pin.pad?.makeConxList(srcList) : srcList.push(pin)   

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveRxTack(tack)

            this.fullDisconnect(srcList, [tack])
        }
        else {

            // make the list of inputs connected to this bus of the same name
            tack.bus.makeConxList(pin, dstList)

            // and do a full disconnect 
            this.fullDisconnect(srcList, dstList)
        }
    }

    // left 
    if (arrow.left) {

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveTxTack(tack)

        } else {

            // make the list of outputs of the same name connected to this bus
            tack.bus.makeConxList(pin, srcList)

            // now make the inlist
            pin.is.proxy ? pin.pad?.makeConxList(dstList) : dstList.push(pin)

            // and do a full disconnect 
            this.fullDisconnect(srcList, dstList)
        }
    }
},

rxtxPadBusDisconnect() {

    // we will build an output/input list with of actual widgets
    const dstList = []
    const srcList = []

    // get the pin and the bus
    const [pad, tack] = this.from.is.pad ? [this.from, this.to] : [this.to, this.from]

    // get the arrow
    const arrow = this.arrow(pad, tack.bus)

    if (arrow.right) {

        pad.proxy.makeConxList(srcList)

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveRxTack(tack)

            this.fullDisconnect(srcList, [tack])
        }
        // and do a full disconnect 
        else {

            bus.makeConxList(pad, dstList)

            this.fullDisconnect(srcList, dstList)
        }
    }
    if (arrow.left) {

        if (tack.bus.hasFilter()) {

            tack.bus.rxtxRemoveTxTack(tack)
        }
        else {

            tack.bus.makeConxList(pad, srcList)
            pad.proxy.makeConxList(dstList)
            this.fullDisconnect(srcList, dstList)
        }
    }
},

// just need to make a single connection
singleConnect(src, dst){

    // find the entry in the txTable 
    let tx = src.node.txTable.find( tx => tx.pin.name == src.name)

    // check
    if (!tx) return;

    // if one of the pins is a multi, there must be a partial overlap
    if ((src.is.multi || dst.is.multi) &&  !dst.hasMultiOverlap(src)) return;

    // and add it to the array of destinations
    tx.targets.push(dst)        
},

// for each resolved rx and tx pair, add an entry to the table
fullConnect(srcList, dstList) {

    // we have a list of out and ins that we have to connect 
    for(const src of srcList) {

        if (src.is.pin) {

            // find the entry in the conx table that corresponds to the pin 
            const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name )

            /** debug should not happen */
            if (!txRecord) {
                console.warn('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullConnect', src.name, src.node.name)
                continue
            }

            // for each entry in the dstlist, add a destination
            for(const dst of dstList) {
                
                // if one of the pins is a multi, there must be a partial overlap
                if ( !(src.is.multi || dst.is.multi) || dst.hasMultiOverlap(src)) txRecord.targets.push(dst)
            }
        }
        // a tack here means that there is filter function on the bus
        else if (src.is.tack) {

            // find the entry in the conx table that corresponds to the tack
            const txTack = src.bus.txTable.find( txTack => txTack.tack == src )    

            /** debug should not happen */
            if (!txTack) {
                console.warn('*** SHOULD NOT HAPPEN *** Could not find txTack in fullConnect', src.bus.name)
                continue
            }            

            // for each entry in the dstlist, add a destination
            for(const dst of dstList) {
                txTack.fanout.push(dst)
            }
        }
    }
},

// for each resolved rx and tx pair, remove the entry in the table
fullDisconnect(srcList, dstList) {

    for(const src of srcList) {

        // The source can be a tack or a pin
        if (src.is.pin) {

            // find the entry in the conx table that corresponds to the pin 
            const txRecord = src.node.txTable.find( txRecord => txRecord.pin.name == src.name )

            /** debug should not happen */
            if (!txRecord) {
                console.warning('*** SHOULD NOT HAPPEN *** Could not find txRecord in fullDisconnect', src.name, src.node.name)
                continue
            }

            // remove all the targets that are in the list of destinations
            for(const dst of dstList) txRecord.dropTarget(dst)
    
        }
        else if (src.is.tack) {

            // find the entry in the conx table that corresponds to the tack
            const txTack = src.bus.txTable.find( txTack => txTack.tack == src )    

            /** debug should not happen */
            if (!txTack) {
                console.warning('*** SHOULD NOT HAPPEN *** Could not find txTack in fullDisconnect', src.bus.name)
                continue
            }            

            // remove all the dst in the fanout that are in the list of destinations
            for(const dst of dstList) txTack.dropTarget(dst)
        }
    }
},

}
