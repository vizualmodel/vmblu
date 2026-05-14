import {rndAlfa} from '../util/index.js'

export function UIDGenerator() {

    // the uid map
    this.uidmap = new Map()

    // the initial length for the uid
    this.uidLength = 4
}
UIDGenerator.prototype = {

    reset() {

        this.uidmap.clear()
    },

    // get a fresh uid
    _freshUID() {

        let count = 0

        // try at most 10 times with the current length
        while(count < 10) {

            const uid = rndAlfa(this.uidLength)
            if (!this.uidmap.has(uid)) return uid

            count++
            console.log('*** THERE WAS A DUPLICATE *** (can happen, nothing to worry about)')

            // after 5 times we increase the length of the uid
            if (count > 4) this.uidLength++
        }
        console.error('*** FAILED TO MAKE A UNIQUE UID ***')

        // return some value
        return '????'
    },

    // set the uid of the object + add the uid and the object to the uidmap
    generate(what) {

        what.uid = this._freshUID()
        this.uidmap.set(what.uid, what)
    },
}
