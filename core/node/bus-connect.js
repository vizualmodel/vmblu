// a bus groups a number of connections
import {closestPointOnCurve, interpolateSegment} from '../util/index.js'
import {Route, RxTack, TxTack} from './index.js'
import {Widget} from '../widget/index.js'

export const busConnect = {

    // disconnect all routes to and from a bus
    disconnect() {

        // make a copy - the original array will be modified
        const tacks = this.tacks.slice()

        // remove the tacks
        for (const tack of tacks) {

            // what is the tack connected to..
            const other = tack.route.from == tack ? tack.route.to : tack.route.from

            // disconnect
            other.is.pin ? tack.route.rxtxPinBusDisconnect() : tack.route.rxtxPadBusDisconnect()
            
            // remove the route at the pin also
            tack.route.remove()
        }
    },

    // undo a disconnect action
    reconnect(tacks) {

        for (const tack of tacks) {

            // add the tack to the bus again
            this.tacks.push(tack)

            // place it (probably not necessary)
            tack.orient()

            // the tack is connected to...
            const other = tack.route.to == tack ? tack.route.from : tack.route.to

            // add the route to the pin
            other.routes.push(tack.route)

            // change the rxtx tables...
            other.is.pin ? tack.route.rxtxPinBus() : tack.route.rxtxPadBus()
        }
    },

    // every connection of the old bus that starts from a node in the selection is transferred to the new bus
    splitTacks(newBus, newGroup) {

        this.tacks.forEach( (tack,index) => {

            // if the arrow comes from a node in the new group
            if (tack.route.from.is.pin && newGroup.nodes.includes(tack.route.from.node)) {

                // push the arrow on the new bus
                newBus.tacks.push(tack)

                // take it from this bus
                this.tacks[index] = null

                // adjust the bus
                tack.bus = newBus
            }
        })

        // close the holes..
        this.tacks = this.tacks.filter( w => w != null)
    },

    // transfer the tacks from this buses (inside a group) to the same bus outside - used in undo group
    transferTacks(outsiders) {

        // for all tacks
        for(const tack of this.tacks) {

            // find the corresponding bus
            for(const outside of outsiders) {

                if (this.uid == outside.uid) {
                    tack.bus = outside
                    break
                }
            }
        }
    },

    // make a route from the widget to the bus - the widget is a pin or a pad
    makeRoute(widget) {

        // select a point on the bus wire closest = {point, segment nr, endPoint}
        const closest = closestPointOnCurve(this.wire, widget.center())

        // if the closest point is an endpoint, we interpollate close to that point
        const point = closest.endPoint ? interpolateSegment(closest.point, closest.segment, this.wire) : closest.point

        // create a tack
        const tack = new Widget.BusTack(this)

        // place the tack at a the selected position on the bus
        tack.placeOnSegment(point, closest.segment)

        // a new route between the widget and the tack
        const route = new Route(widget, tack)

        // make a smart connection between the two destinations
        route.builder()

        // and save the route in the new proxy...
        widget.routes.push(route)

        // set the route in the tack, the tack in the bus and orient the tack
        tack.restore(route)
    },

    rxtxPrepareTables() {
    },
    
    rxtxResetTables() {
    
        this.txTable = []
        this.rxTable = []
    },

    // follow the routes to build the tx tables - recursive function
    rxtxBuildRxTxTable() {
    
        // for all the incoming tacks
        for (const tack of this.tacks) {

            if (tack.incoming()) {

                this.rxtxAddRxTack(tack)
            }
            else {

                const outgoing = []

                const other = tack.getOther()

                other.is.proxy ? other.pad.makeConxList(outgoing) : (other.is.pad ? other.proxy.makeConxList(outgoing) : outgoing.push(other))

                this.rxtxAddTxTack(tack, outgoing)
            }
        }
    },
    
    // For an outgoing tack, we save the incoming connections
    rxtxAddTxTack(tack, outgoing) {
    
        // make a record for the tack
        const txTack = new TxTack(tack)
    
        // now add the list to the tx record (make a copy !)
        txTack.fanout = outgoing.slice()
    
        // push the target to the txTable
        this.txTable.push(txTack)
    },
    
    // removes a connection
    rxtxRemoveTxTack(tack) {
        
        // find the destination targets that corresponds with the transmitter and remove the enrty
        const index = this.txTable.findIndex( tx => tx.tack == tack)
        if (index > -1) this.txTable.splice(index, 1)
    },

    // For an incoming tack, we save the outgoing connections
    rxtxAddRxTack(tack) {

        this.rxTable.push(new RxTack(tack))
    },

    // removes a connection
    rxtxRemoveRxTack(tack) {

        // find the destination targets that corresponds with the transmitter and remove the enrty
        const index = this.rxTable.findIndex( tx => tx.tack == tack)
        if (index > -1) this.rxTable.splice(index, 1)
    },


}