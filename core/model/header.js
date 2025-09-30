import {ModelStore} from './model-store.js'
import {style} from '../util/index.js'


export function ModelHeader() {

    const today = new Date()

    this.version = '0.0.1'
    this.created = today.toLocaleString()
    this.saved = today.toLocaleString()
    this.utc = today.toJSON()
    this.style = style
    this.runtime = '@vizualmodel/vmblu'
}
ModelHeader.prototype = {

    toJSON() {

        const today = new Date()

        const header = {
            version: this.version,
            created: this.created,
            saved: today.toLocaleString(),
            utc: today.toJSON(),
            style: this.style.rgb,
            runtime: this.runtime,
        }

        return header
    },

    // get the header data from the raw file
    cook(arl, raw) {

        const today = new Date()

        // date and version
        this.created = raw.created?.slice() ?? today.toLocaleString(),
        this.saved = raw.saved?.slice() ?? today.toLocaleString(),
        this.utc = raw.utc?.slice() ?? today.toJSON()
        this.version = raw.version?.slice() ?? 'no version'

        // Create a style for the model
        this.style = style.create(raw.style)

        // get the runtime
        this.runtime = raw.runtime?.slice() ?? '@vizualmodel/vmblu'
    },
}