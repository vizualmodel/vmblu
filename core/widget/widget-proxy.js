import {Pin} from './widget-pin.js'
import {convert} from '../util/index.js'

// a proxy is like a pin but is actually a stand-in for one or more pins of objects that are part of the group
export function Proxy(rect,node,name,is) {

    // constructor chaining
    Pin.call(this,rect,node,name,is)

    // change the proxy setting
    this.is.proxy = true

    // every proxy can have a corresponding pad
    this.pad = null
}

// specific functions for a proxy
export const ProxyFunctions = {

    // find all source node pins that can bring their input to this pin
    makeConxList(list) {
        
        for(const route of this.routes) {

            // the destination, i.e. the other widget
            const other = route.from == this ? route.to : route.from

            // check
            if (! this.areConnected(other)) continue

            // pin a proxy, take it to the next level, else save in list
            if (other.is.pin) {
                other.is.proxy ? other.pad?.makeConxList(list) : list.push(other)
            }
            // the destination is a pad
            else if (other.is.pad) {

                // just continue to build the list
                other.proxy.makeConxList(list)
            }
            // bus link
            else if (other.is.tack) {

                // check if the bus is actually a router
                other.bus.hasFilter() ?  list.push(other) : other.makeConxList(list)
            }
        }
    },

    // when after editing the proxy name has changed, we might have to change the look 
    nameChanged(savedName) {

        // each proxy has a pad ...
        const pad = this.node.pads.find( pad => pad.proxy == this)

        // if the pin has no pad, this is pathological
        if (!pad) {
            // log it
            console.log(`** No pad was found for this pin "${this.name}" - pin was removed`)

            // remove the proxy
            this.node.look.removePin(this)
            return
        }

        // if the name has not zero length...
        if (this.name.length > 0) {

            // ...also change the name of the pad
            pad.nameChange(this.name)

            // done
            return
        }

        // The pin and the pad can only be removed if there are no routes
        if (pad.routes?.length > 0) {

            // restore the old name
            this.restoreSavedName(savedName)
        }
        else {
            // remove the proxy
            this.node.look.removePin(this)

            // and remove the pad
            this.node.removePad(pad)
        }
    },
}
// overwrite some specific pin functions
Object.assign(Proxy.prototype, Pin.prototype, ProxyFunctions)