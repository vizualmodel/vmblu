import {Route, Bus, Pad} from './index.js'
import {style, eject} from '../util/index.js'
import {Widget} from '../widget/index.js'
import {editor} from '../editor/index.js'

export const proxyHandling = {

    // build the proxy widget array based on the current (outside) connections and proxy indicators
    // Note that the selection nodes have already been added to the group node 
    addProxies(selection) {

        const outside = []

        // for each node in the list ...
        selection.nodes?.forEach( node => {

            // ..for each widget
            node.look.widgets?.forEach( widget => {

                // if there are no connections stop
                if ( ! widget.routes?.length > 0) return

                // connections to the outside of the widget
                const destinations = []

                // make a copy of the routes - because we are deleting in the original array below !
                const routesCopy = widget.routes.slice()

                // .. check all the routes
                routesCopy.forEach( route => {

                    // is the widget external could be external to the group
                    const other = route.from == widget ? route.to : route.from

                    // check if it the route goes to an external node - if not return
                    if ( other.is.pin && ( selection.nodes.includes(other.node))) return 

                    // check if the external goes to an external bus
                    if ((other.is.tack) && ( selection.tacks.includes(other))) return

                    // add the new proxy
                    destinations.push(other)

                    // also remove the route at both endpoints - The route to the proxy widget is added below
                    route.from.removeRoute(route)
                    route.to.removeRoute(route)
                })

                //check
                if (destinations.length > 0) outside.push({widget, destinations})
            })
        })

        // sort the array in y -order to position the proxies in the same order as the originals
        outside.sort( (a,b) => {
            return    a.widget.rect.y > b.widget.rect.y ? 1 
                    : a.widget.rect.y < b.widget.rect.y ? -1
                    : 0
        })

        // and now add a proxy widget for each proxy/pin with and external connection
        outside.forEach( outsider => {

            // notation
            const orig = outsider.widget

            // copy the 'outsider' as a proxy
            const newProxy = this.copyPinAsProxy(orig)

            // create the pad
            this.addPad(newProxy)

            // make a straight line - move to the the y-coordinate of the pin
            newProxy.pad.moveTo(newProxy.pad.rect.x, orig.rect.y)

            // make a route to the pin
            newProxy.pad.routeToPin(orig)

            // also add a route to the destinations in the view that contains the group
            let route = null
            outsider.destinations.forEach( destination => {

                // create a new route
                route = new Route(newProxy, destination)

                // make a smart connection between the two destinations
                route.builder()

                // and save the route in the new proxy...
                newProxy.routes.push(route)

                // and in the destination widget
                if (destination.is.pin)  
                        destination.routes.push(route)

                // reset the route in the tack and re-attach to the bus
                else if (destination.is.tack) 
                    destination.restore(route)
            })
        })
    },    


    // used when making a group from a selected nr of nodes
    // copy a pin as a proxy for a new node - also make a ifName if required
    // is = {channel, input, request, proxy}
    copyPinAsProxy(pin) {

        const look = this.look
        let pos = null

        // for a node with a prefix
        if (pin.pxlen != 0) {

            // get the prefix
            const prefix = pin.getPrefix()

            // find the ifName
            let ifName = look.findInterfaceName(prefix)

            // add the ifName if not present
            if(!ifName) ifName = this.look.addIfName(prefix, look.nextPinPosition(false))

            // get the rectangle of the last pin in the ifName group
            const last = look.getInterface(ifName).at(-1).rect

            // when we add we want to add below last item - set x according to left / right
            pos = { x: pin.is.left ? last.x : last.x + last.w, 
                    y: last.y + last.h}
        }
        else {
            pos = look.nextPinPosition(pin.is.left)
        }

        // get the rectangle for the pin
        const rc = look.pinRectangle(pin.displayName(), pos.y, pin.is.left)

        // create the pin
        const widget = new Widget.Proxy(rc, this, pin.name.slice(), pin.is)

        // copy the pxlen
        widget.pxlen = pin.pxlen

        // add the widget
        look.addWidget( widget )

        // done
        return widget
    },

    addPad(proxy) {

        // the y position of the pad
        const yOffset = style.placement.marginTop + this.pads.length * (style.pad.hPad + style.pad.hSpace)
 
        // get the width of the view or use a default value..
        const width = this.savedView ? this.savedView.rect.w : style.view.wDefault

        // take the position of the view into account
        const dx = this.savedView ? this.savedView.rect.x : 0

        // get the pad rectangle
        const rect = proxy.is.left  ? proxy.makePadRect({x: style.pad.wViewLeft + dx, y: yOffset})
                                    : proxy.makePadRect({x: width - style.pad.wViewRight + dx, y: yOffset})
 
        // create the pad
        const pad = new Pad(rect, proxy)

        // add a new UID to the pad (when loading a file the doc has not been set yet !)
        editor.doc?.UID.generate(pad)
 
        // save
        this.pads.push(pad)     
 
        // save also in the proxy
        proxy.pad = pad
    },

    // removes a pad from the pad array
    removePad(pad) {
        eject(this.pads, pad)    
    },

    restorePad(pad) {
        //this.look.restorePin(pad.proxy)
        this.pads.push(pad)
    },

    // add pads for a list of widgets
    addPads(widgets) {
        for(const widget of widgets) if (widget.is.proxy) this.addPad(widget)
    },

    addBus(name, pos, uid=null) {

        //we create a bus
        const bus = new Bus(name ?? '',pos, uid)

        // save it
        this.buses.push(bus)

        // done
        return bus
    },

    deleteBus(bus) {

        // first disconnect every connection to the bus
        bus.disconnect()

        // remove the bus
        this.removeBus(bus)
    },

    // removes a bus from the bus array
    removeBus(bus) {

        eject(this.buses, bus)		        
    },

    // restores a bus
    restoreBus(bus) {

        // a bus can be in the list already
        if (this.buses.find( bp => bp.uid == bus.uid)) return

        // put in the list again
        this.buses.push(bus)
    }
}
