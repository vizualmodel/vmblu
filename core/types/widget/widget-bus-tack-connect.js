    export const TackConnectHandling = {
    
    // return the widget at the other end
    getOther() {
        return this.route.from == this ? this.route.to : this.route.from
    },

    // return the pin or the proxy if the other is a pad
    getOtherPin() {
        const other = this.route.from == this ? this.route.to : this.route.from
        return other.is.pin ? other : (other.is.pad ? other.proxy : null)
    },

    getContactPoint() {
        return this.route.from == this ? this.route.wire[0] : this.route.wire.at(-1)
    },

    // getOtherName() {
    //     const other = this.route.from == this ? this.route.to : this.route.from

    //     if (other.is.pin) return other.name
    //     if (other.is.pad) return other.proxy.name
    //     return null
    // },

    incoming() {
        const other = this.route.from == this ? this.route.to : this.route.from

        if (other.is.pin) return !other.is.input
        if (other.is.pad) return other.proxy.is.input
        return false
    },

    // make the list of pins/pads that are connected via this tack
    makeConxList(list) {

        for(const tack of this.bus.tacks) {

            // TEMP - ELIMINATES BAD ROUTES
            if (! tack.route?.from || ! tack.route?.to) continue

            // check if the two are connected
            if (! this.areConnected(tack)) continue

            // get the widget connected to the bus
            const other = tack.route.from == tack ? tack.route.to : tack.route.from

            // search further if required
            if (other.is.pin) {
                
                other.is.proxy ? other.pad.makeConxList(list) : list.push(other)
            }
            else if (other.is.pad) {

                other.proxy.makeConxList(list)
            }
        }
    },

    pinNameCheck(A,B) {

        // there has to be a full name match
        if (A.is.multi || B.is.multi) {
            if (!A.hasFullNameMatch(B)) return false
        }
        else {
            if (A.name != B.name) return false
        }

        return true
    },

     // check if two widgets connected to the bus are logically connected
    // if two pins are connected to a bus, the bus is external and a and b can belong to the same node
    // when there is a pad, the proxy and the pin are always from a differnt node 
    // two pads can be connected by a bus

    areConnected(tack) {

        const A = this.getOther()
        const B = tack.getOther()

        let actualA = A
        let actualB = B

        if (A.is.pin) {
            if (B.is.pin) {

                // input / output have to match
                if (A.is.input == B.is.input) return false

                // you cannot connect to your own node via a bus
                if (A.node == B.node) return false
            }
            else if (B.is.pad) {

                // input / output have to be different
                if (A.is.input != B.proxy.is.input) return false

                actualB = B.proxy
            }
        }
        else if (A.is.pad) {
            if (B.is.pin) {

                // input / output have to match
                if (A.proxy.is.input != B.is.input) return false

                actualA = A.proxy
            }
            else if (B.is.pad) {

                // input / output have to be different
                if (A.proxy.is.input == B.proxy.is.input) return false

                // check the names
                actualA = A.proxy
                actualB = B.proxy
            }
        }

        // check the names if multis
        if (actualA.is.multi || actualB.is.multi) return actualA.hasFullNameMatch(actualB) 
    
        // check the name or the alias
        const nameA = this.alias ? this.alias : actualA.name
        const nameB = tack.alias ? tack.alias : actualB.name

        return nameA === nameB
    },

   // highlight the routes that are connected via the incoming route
    highLightRoutes() {

        // highlight the bus
        this.bus.is.highLighted = true
        this.route.highLight()

        // check for the connections to the bus..
        for(const tack of this.bus.tacks) {

            // skip the other
            if (tack === this) continue

            // check if connecetd
            if (this.areConnected(tack)) tack.route.highLight()
        }
    },

    // unhighlight the routes that the tack of this route is connected to
    unHighLightRoutes() {

        // unhighlight the bus
        this.bus.is.highLighted = false
        this.route.unHighLight()

        // check for the connections to the bus..
        for(const tack of this.bus.tacks) {

            // skip
            if (tack === this) continue

            // check if connecetd
            if (this.areConnected(tack)) tack.route.unHighLight()
        }
    },

    rank() {
        return {up:1, down:1}
    }
}

