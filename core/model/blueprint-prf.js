import {Path} from '../arl/index.js'
import {convert} from '../util/index.js'
export const ProfileHandling = {

// reads the source doc file and parses it into documentation
async handleSourceMap() {

    // read the source doc file
    const rawSourceMap = await this.readSourceMap()

    // check
    if (! rawSourceMap) return;

    // parse to extract the juicy bits
    this.sourceMap = this.parseSourceMap(rawSourceMap)        

    // ok
    // console.log('** SourceMap **', this.sourceMap)
},

// Reads the sourceMap of the model
async readSourceMap() {

    // get the full path
    const fullPath = this.arl?.getFullPath()
    
    // check
    if (!fullPath) return null

    // make an arl 
    const sourceMapArl = this.arl.resolve(Path.removeExt(fullPath) + '.prf.json')

    // get the file
    return await sourceMapArl.get('json')
},

/**
 * Parses the documentation entries produced by extractHandlersFromFile.
 * Organizes them per node with pin-to-handler mappings.
 *
 * @param {Array<{node: string, handlers: Array}>} docEntries
 * @returns {Map<string, Map<string, object>>} Map of nodeName -> Map of pinName -> handler metadata
 */
parseSourceMap(raw) {

    // check
    if (!raw.entries) return null;

    const nodeMap = new Map();

    // for all nodes in the file
    for (const nodeEntry of raw.entries) {

        // get the handlers and the transmissions in that node
        const { node, handles, transmits } = nodeEntry;

        // Check if there is already an entry in the map for that node
        if (!nodeMap.has(node)) {
            nodeMap.set(node, {handles: new Map(), transmits: new Map()});
        }

        // get the list of pins
        const pinMap = nodeMap.get(node);

        // set the handlers for the pin - note that we will index the pin data using the *handler* name !
        for (const handlerData of handles) {

            const { handler, ...meta } = handlerData;
            pinMap.handles.set(handler, {handler,...meta});
        }

        // set the transmissions on the pin - here we use the *pin name* to index !!!
        for (const transmission of transmits) {

            // deconstruct
            const { pin, ...meta } = transmission;

            // get the entry (if any)
            const entry = pinMap.transmits.get(pin)

            // check if we have an entry already
            if (entry) 
                Array.isArray(entry) ? entry.push({pin,...meta}) : pinMap.transmits.set(pin, [entry, {pin,...meta}])
            else 
                pinMap.transmits.set(pin, {pin, ...meta})
        }
    }

    return nodeMap;
},

/**
 * Optional helper to flatten the nested map into a plain array (useful for UI).
 */
flattenSourceMap(nodeMap) {
    const flatList = [];
    for (const [node, pins] of nodeMap.entries()) {
        for (const [pin, meta] of pins.entries()) {
        flatList.push({ node, pin, ...meta });
        }
    }
    return flatList;
},

// get the information for a given pin
getInputPinProfile(pin) {

    // Get the info about the handlers of the node
    const handles = this.sourceMap?.get(pin.node.name)?.handles

    // check
    if (!handles) return null

    // us the handler name to index the map
    const handlerName = convert.pinToHandler(pin.name)

    // if the pin is not a multi just return the single record
    if (!pin.is.multi) return handles.get(handlerName) ?? null

    // multi case: expand the multi in an array of all names
    const multi = pin.expandMultis()

    // collect the info in an array
    const multiProfile = []
    for (const name of multi) {

        // search on handlername
        const handlerName = convert.pinToHandler(name)

        // get the info for the name
        const info = handles.get(handlerName) ?? null;

        // check
        if (info) multiProfile.push(info)
    }

    // done
    return multiProfile
},

// get the information for a given pin
getOutputPinProfile(pin) {

    // Get the info about the node
    const transmits = this.sourceMap?.get(pin.node.name)?.transmits

    //check
    if (!transmits) return null

    // if the pin is not a multi just return the single record
    if (!pin.is.multi) return transmits.get(pin.name) ?? null

    // multi case: expand the multi in an array of all names
    const multi = pin.expandMultis()

    // collect the info in an array
    const multiProfile = []
    for (const name of multi) {

        // get the info for the name
        const info = transmits.get(name) ?? null;

        // check
        Array.isArray(info) ? multiProfile.push(...info) : multiProfile.push(info)
    }

    // done
    return multiProfile
},

}