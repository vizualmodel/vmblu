import {eject} from '../util/index.js'
import {RxPin, TxPin} from './rxtx-record.js'

export const rxtxHandling = {

rxtxPrepareTables() {

    if (this.is.group) return

    // add an entry in the tx or rx table for each output input pin
    for (const widget of this.look.widgets) {

        // we only look at pins
        if ( !widget.is.pin) continue

        // inputs in the rx table, outputs in the txTable
        this.rxtxAddPin(widget)
    }
},

rxtxResetTables() {

    if (this.is.group) return

    this.txTable = []
    this.rxTable = []
},

rxtxAddPin(pin) {

    if (this.is.group) return

    if (pin.is.input) 
        this.rxTable.push( new RxPin(pin) ) 
    else 
        this.txTable.push( new TxPin(pin) )
},

rxtxPopPin(pin) {

    if (this.is.group) return

    if (pin.is.input)
        this.rxTable.pop() 
    else 
        this.txTable.pop()
},

// remove a pin from a table
rxtxRemovePin(pin) {

    if (this.is.group) return

    if (pin.is.input) {
        const rx = this.rxTable.find( rx => rx.pin == pin)
        eject(this.rxTable, rx)
    } else {
        const tx = this.txTable.find( tx => tx.pin == pin)
        eject(this.txTable, tx)
    }
},

// add a group of pins to the rx/tx tables
rxtxAddPinArea(widgets) {

    if (this.is.group) return

    for(const widget of widgets) if (widget.is.pin) this.rxtxAddPin(widget);
},

// follow the routes to build the tx tables - recursive function
rxtxBuildTxTable() {

    // for group nodes just continue to look for source nodes
    // and buses with routers
    if (this.is.group) {

        // do the buses that have a filter first
        for(const bus of this.buses) if (bus.hasFilter()) bus.rxtxBuildRxTxTable();

        // then the nodes
        for (const node of this.nodes) node.rxtxBuildTxTable()

        // done  
        return
    }

    // build the connection table for all source nodes
    // search all possible destinations for a pin that can send a message
    for (const widget of this.look.widgets) {

        // we only look at pins that have routes and can have outgoing message
        if ( !widget.is.pin || widget.is.input || (widget.routes.length == 0)) continue

        // find the transmit record for this pin
        const txRecord = this.txTable.find( tx => tx.pin.name == widget.name)

        // check - but is actually not possible
        if (!txRecord) {
            console.error(`${this.name} NO TX TABLE RECORD FOR ${widget.name}`)
            continue
        }

        // reset the targets
        txRecord.targets = []

        // gather all destinations for this pin in a list
        const dstList = []

        // look at every route for that pin
        for (const route of widget.routes) {

            // discard pathological routes
            if (!route.from || !route.to) continue

            // set the dstination
            const dst = route.from == widget ? route.to : route.from

            if (dst.is.pin) {
                dst.is.proxy ? dst.pad?.makeConxList(dstList) : dstList.push(dst)
            }
            // if a bus has a filter propagation stops 
            else if (dst.is.tack) {
                dst.bus.hasFilter() ?  dstList.push(dst) : dst.makeConxList(dstList)
                //dst.bus.hasFilter() ?  dstList.push(dst) : dst.bus.makeConxList(widget, dstList)
            }
            else if (dst.is.pad) {
                dst.proxy.makeConxList(dstList)
            }
        }

        // now we put the results in the tx list
        for (const dst of dstList) txRecord.targets.push(dst)
    }
},

// removes a connection from the conx table tx and rx are widgets
rxtxRemoveFromTxTable(txWidget, rxWidget) {

    // find the destination targets that corresponds with the transmitter
    const targets = this.txTable.find( tx => tx.pin.name == txWidget.name)?.targets

    // check
    const L = targets?.length ?? 0

    // go through all destinations for this output pin
    for (let i=0; i<L; i++) {

        // find the destination
        if ((rxWidget.node == targets[i].node)&&(rxWidget.name == targets[i].name)) {

            // shift the routes below one position up
            for (let j=i; j<L-1; j++) targets[j] = targets[j+1]

            // the array is one position shorter
            targets.pop()

            // no need to look any further
            return
        }
    }
},


}
