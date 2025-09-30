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
        let len = 4

        // try at most 5 times with 4 chars
        while(count < 10) {

            //make a uid of 4 characters
            let uid = rndAlfa(this.uidLength)
            if (! this.uidmap.has(uid)) return uid

            // duplicate in the map
            count++
            console.log('*** THERE WAS A DUPLICATE *** (can happen, nothing to worry about)')

            // after 5 times we increase the length of the uid
            if (count > 4) this.uidLength++
        }
        console.eror('*** FAILED TO MAKE A UNIQUE UID ***')

        // return some value
        return '????'
    },

    // // set the uid of the object + add the uid and the object to the uidmap
    // UID(what) {

    //     // if there is no uid or the uid is already in the map - get a new uid
    //     what.uid = this._freshUID()
        
    //     // add the object and uid to the map
    //     this.uidmap.set(what.uid, what)
    // },
    
    // set the uid of the object + add the uid and the object to the uidmap
    generate(what) {

        // if there is no uid or the uid is already in the map - get a new uid
        what.uid = this._freshUID()
        
        // add the object and uid to the map
        this.uidmap.set(what.uid, what)
    },
}