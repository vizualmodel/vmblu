import {convert} from '../util/index.js'
import {Factory,normalizeFactoryPath} from './index.js'

export const busJsonHandling = {

makeRaw(refArl) {

    const json = {
        name: this.name
    }

    // save the filter if applicable
    if (this.is.filter && this.filter) json.filter = this.filter.makeRaw(refArl)

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

    if (raw.filter) {
        this.is.filter = true
        this.filter = new Factory(raw.filter.function ?? raw.filter.fName)
        const normalized = normalizeFactoryPath(raw.filter.path ?? './index.js')
        this.filter.pathKind = normalized.pathKind
        this.filter.arl = modcom.getCurrentModel()?.getArl()?.resolve(normalized.path)
    }
    else {
        this.is.filter = false
        this.filter = null
    }

    // ** pathological ** should not happen
    if (this.wire.length == 1) this.wire.push(this.wire[0])

    // place the labels..
    this.startLabel.place()
    this.endLabel.place()
},


}
