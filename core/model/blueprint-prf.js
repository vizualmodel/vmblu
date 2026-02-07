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

    // get the model arl
    const arl = this.getArl()

    // get the full path
    const fullPath = arl?.getFullPath()
    
    // check
    if (!fullPath) return null

    // make an arl 
    const sourceMapArl = arl.resolve(Path.removeExt(fullPath) + '.src.prf')

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

getContract(pin) {

    // check
    if (!pin?.contract) return null

    // normalize types
    const types = typeof this.vmbluTypes === 'string' 
        ? JSON.parse(this.vmbluTypes) 
        : (this.vmbluTypes ?? null)

    const role = pin.contract.owner ? 'owner' : 'follower'
    const payload = pin.contract.payload ?? 'any'

    // render a vmbluType into structured lines
    const renderType = (typeName, indentLevel = 0, stack = new Set()) => {
        const indent = '  '.repeat(indentLevel)
        const lines = []
        const tokens = []
        const pushLine = (parts) => {
            const text = indent + parts.map(p => p.text).join('')
            lines.push(text)
            tokens.push({ indent: indentLevel, parts })
        }

        // no type means any
        if (!typeName) {
            pushLine([{ kind: 'type', text: 'any' }])
            return { lines, tokens, kind: 'primitive' }
        }

        // unknown or primitive
        if (!types || !types[typeName]) {
            pushLine([{ kind: 'type', text: typeName }])
            return { lines, tokens, kind: 'primitive' }
        }

        const def = types[typeName]
        const kind = def.kind ?? (def.fields ? 'object' : def.items ? 'array' : def.external ? 'external' : 'primitive')
        const summary = def.summary ? ` - ${def.summary}` : ''
        pushLine([
            { kind: 'type', text: typeName },
            { kind: 'kind', text: ` (${kind})` },
            ...(summary ? [{ kind: 'summary', text: summary }] : [])
        ])

        if (kind === 'object') {
            const required = new Set(def.required ?? [])
            const fields = def.fields ?? {}
            for (const [name, field] of Object.entries(fields)) {
                const fieldType = field.vmbluType ?? 'any'
                const fieldSummary = field.summary ? ` - ${field.summary}` : ''
                const mark = required.has(name) ? '*' : ''
                tokens.push({
                    indent: indentLevel + 1,
                    parts: [
                        { kind: 'field', text: `${name}${mark}` },
                        { kind: 'punct', text: ': ' },
                        { kind: 'type', text: fieldType },
                        ...(fieldSummary ? [{ kind: 'summary', text: fieldSummary }] : [])
                    ]
                })
                lines.push(`${indent}  ${name}${mark}: ${fieldType}${fieldSummary}`)

                if (types[fieldType] && !stack.has(fieldType)) {
                    stack.add(fieldType)
                    const child = renderType(fieldType, indentLevel + 2, stack)
                    stack.delete(fieldType)
                    lines.push(...child.lines)
                    tokens.push(...child.tokens)
                }
            }
        }
        else if (kind === 'array') {
            const itemType = def.items?.vmbluType ?? 'any'
            const itemSummary = def.items?.summary ? ` - ${def.items.summary}` : ''
            tokens.push({
                indent: indentLevel + 1,
                parts: [
                    { kind: 'field', text: 'items' },
                    { kind: 'punct', text: ': ' },
                    { kind: 'type', text: itemType },
                    ...(itemSummary ? [{ kind: 'summary', text: itemSummary }] : [])
                ]
            })
            lines.push(`${indent}  items: ${itemType}${itemSummary}`)

            if (types[itemType] && !stack.has(itemType)) {
                stack.add(itemType)
                const child = renderType(itemType, indentLevel + 2, stack)
                stack.delete(itemType)
                lines.push(...child.lines)
                tokens.push(...child.tokens)
            }
        }
        else if (kind === 'external') {
            const symbol = def.external?.symbol
            const library = def.external?.library
            if (symbol) {
                const full = library ? `${library}.${symbol}` : symbol
                tokens.push({
                    indent: indentLevel + 1,
                    parts: [
                        { kind: 'field', text: 'symbol' },
                        { kind: 'punct', text: ': ' },
                        { kind: 'type', text: full }
                    ]
                })
                lines.push(`${indent}  symbol: ${full}`)
            }
        }

        return { lines, tokens, kind, summary: def.summary ?? null }
    }

    // payload can be a single type or a request/reply pair
    if (payload && typeof payload === 'object') {
        const requestType = payload.request ?? 'any'
        const replyType = payload.reply ?? 'any'
        const request = renderType(requestType)
        const reply = renderType(replyType)

        const lines = [
            'request:',
            ...request.lines.map(line => `  ${line}`),
            'reply:',
            ...reply.lines.map(line => `  ${line}`)
        ]
        const shift = (tokens, by) => tokens.map(t => ({ ...t, indent: t.indent + by }))
        const tokens = [
            { indent: 0, parts: [{ kind: 'header', text: 'request' }] },
            ...shift(request.tokens, 1),
            { indent: 0, parts: [{ kind: 'header', text: 'reply' }] },
            ...shift(reply.tokens, 1)
        ]

        return {
            role,
            payload,
            request: { type: requestType, ...request, text: request.lines.join('\n') },
            reply: { type: replyType, ...reply, text: reply.lines.join('\n') },
            lines,
            tokens,
            text: lines.join('\n')
        }
    }

    const rendered = renderType(payload)
    return {
        role,
        payload,
        type: payload,
        ...rendered,
        tokens: rendered.tokens,
        text: rendered.lines.join('\n')
    }
}

}
