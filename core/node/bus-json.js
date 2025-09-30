import {convert} from '../util/index.js'
import {Factory} from './index.js'

export const busJsonHandling = {

toJSON() {
    // cable or busbar
    const json = this.is.cable    ? {   kind: 'cable', name: this.name } : { kind: 'busbar', name:  this.name}

    // save the filter if applicable
    if (this.is.filter && this.filter) json.filter = this.filter

    // the wire
    json.start = convert.pointToString(this.wire[0])
    json.wire = convert.wireToString(this.wire)

    // done
    return json
},
    
cook(raw, modcom) {
    
    // set the type of bus
    this.is.cable = (raw.kind == 'cable') ? true : false

    // set the name
    this.name = raw.name

    // check for a filter
    if (raw.filter) {

        // get the main and the current model
        const main = modcom.getMainModel()
        const current = modcom.getCurrentModel()

        // create the filter
        this.filter = new Factory(raw.filter.function)
        this.is.filter = true

        // transform the factory file relative to the main model file
        if (raw.filter.path) {
            this.filter.arl = current.arl.resolve( raw.filter.path )
            if (main != current) this.filter.arl.makeRelative(main.arl)
        }
    }

    // save the path and labels for this bus
    this.wire = convert.stringToWire(convert.stringToPoint(raw.start), null, raw.wire)

    // ** pathological ** should not happen
    if (this.wire.length == 1) this.wire.push(this.wire[0])

    // place the labels..
    this.startLabel.place()
    this.endLabel.place()
},


}