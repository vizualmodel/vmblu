import {ModelMap} from './model-map.js'
import {style} from '../util/index.js'
import cliPackage from '../../cli/package.json' assert { type: 'json' };

export function ModelHeader() {

    const today = new Date()

    // Set the schema version in the header
    this.schema = cliPackage.schemaVersion
    this.created = today.toLocaleString()
    this.saved = today.toLocaleString()
    this.utc = today.toJSON()
    this.style = style
    this.runtime = '@vizualmodel/vmblu-runtime'
}
ModelHeader.prototype = {

    // get the header data from the raw file
    cook(arl, raw) {

        const today = new Date()

        // date and version
        this.created = raw.created?.slice() ?? today.toLocaleString(),
        this.saved = raw.saved?.slice() ?? today.toLocaleString(),
        this.utc = raw.utc?.slice() ?? today.toJSON()
        this.schema = raw.schema?.slice() ?? 'no version'

        // Create a style for the model
        this.style = style.create(raw.style)

        // get the runtime
        this.runtime = raw.runtime?.slice() ?? '@vizualmodel/vmblu-runtime'
    },
}