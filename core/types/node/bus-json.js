import {convert} from '../util/index.js'
import {Factory,normalizeFactoryPath} from './index.js'

export const busJsonHandling = {

makeRaw(refArl) {

    const json = {
        name: this.name
    }

    // the wire
    json.start = convert.pointToString(this.wire[0])
    json.wire = convert.wireToString(this.wire)

    // done
    return json
},

 
cook(raw, modcom) {
    
    // set the name
    this.name = raw.name

    // save the path and labels for this bus
    this.wire = convert.stringToWire(convert.stringToPoint(raw.start), null, raw.wire)

    // ** pathological ** should not happen
    if (this.wire.length == 1) this.wire.push(this.wire[0])

    // place the labels..
    this.startLabel.place()
    this.endLabel.place()
},


}
