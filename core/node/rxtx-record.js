// pin is the receiving pin
export function RxPin(pin) {

    this.pin = pin
}

// targets is the list of pins this pin is connected to
export function TxPin(pin) {

    this.pin = pin
    this.targets = []
}
TxPin.prototype = {

    dropTarget(dst) {

        // notation
        const targets = this.targets

        // go through the targets until the destination is found
        for (let i=0; i<targets.length; i++) {

            // if the destination is found
            if ((dst.node == targets[i].node )&&(dst.name == targets[i].name)) {
            
                // shift the routes below one position up
                for (let j = i; j < targets.length-1; j++) targets[j] = targets[j+1]
    
                // the array is one position shorter
                targets.pop()

                // no need to look further in the list - take the next dst
                return
            }
        }
    }
}

// For an incoming tack we save all the tacks with the same selector...
export function RxTack(tack) {
    //this.selector = tack.getOtherPin().name
    this.tack = tack
}


// for an outgoing tack, we save the outgoing connections 
export function TxTack(tack) {
    //this.selector = tack.getOtherPin().name
    this.tack = tack
    this.fanout = []
}
TxTack.prototype = {

    // checks if an incoming message name is passed via this tx
    connectsTo(messageName) {

        const pin = this.tack.getOtherPin()

        // it must either be a literal match or the pin variant must include the message
        return pin.is.multi ? (pin.getMatch(messageName) == messageName) : (pin.name == messageName)
    },

    dropTarget(dst) {

        // notation
        const fanout = this.fanout

        // go through the targets until the destination is found
        for (let i=0; i<fanout.length; i++) {

            // if the destination is found
            if ((dst.node == fanout[i].node )&&(dst.name == fanout[i].name)) {
            
                // shift the routes below one position up
                for (let j = i; j < fanout.length-1; j++) fanout[j] = fanout[j+1]

                // the array is one position shorter
                fanout.pop()

                // no need to look further in the list - take the next dst
                return
            }
        }
    }

}