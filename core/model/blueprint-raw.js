import {convert, style} from '../util/index.js'
import {Path} from '../arl/index.js'

export const RawHandling = {

// gets the blu and viz file - only fails if blu is missing
async fetch() {

    // if the extension is json it is another node file
    if (this.blu.arl) {

        try {
            const [bRaw, vRaw] = await Promise.all([
                this.blu.arl.get('json'),
                this.viz.arl.get('json').catch(error => {
                    // viz file not found - return null which makes the promise resolve successfully !
                    console.warn(`Viz file failed to load, proceeding with null: ${error.message}`);
                    return null;
                })
            ]);

            // set the fresh bit 
            this.blu.is.fresh = true;
            this.viz.is.fresh = true;

            return {bRaw, vRaw};
        }
        catch( error ) {
            // This ONLY catches the rejection from pBlu, the mandatory promise.
            console.warn(`${this.blu.arl.userPath} could not be found or is not valid.`, error);
            return {bRaw:null, vRaw:null};
        }
    }

    else if (this.bundle.arl) {

        const rawCode = await this.bundle.arl.get('text')
        .catch( error => {
            console.error(`${this.bundle.arl.userPath} is not a valid bundle`, error)
        })

        //check
        if (!rawCode) return {bRaw:null, vRaw: null}

        // analyze the source to find the raw this
        const raw = this.analyzeJSLib(rawCode)

        // error if failed
        if (! raw) console.error(`model not found in bundle: ${this.bundle.arl.userPath}`)

        // we are done 
        return {bRaw:raw, vRaw: null}
    }
    // it's one or the other !
    else return {bRaw:null, vRaw: null}
},

// get the raw model from two files and combine in one
async getRaw() {

    // get both parts of a model
    const {bRaw:bRaw, vRaw:vRaw} = await this.fetch()

    // we need a blu file , and it should have at least a header
    if (!bRaw || !bRaw.header) return null;

    // make the header
    this.joinHeader(bRaw, vRaw)

    // combine bRaw and vRaw in bRaw
    if (vRaw?.root) this.joinNode(bRaw.root, vRaw.root) 

    // set raw in the model
    this.raw = bRaw

    // We also return the result
    return bRaw
},

saveRaw() {

    // now split the result in two parts
    const split = this.splitRaw(this.raw)

    // and return raw and the stringified results
    const blu = JSON.stringify(split.blu,null,2)
    const viz = JSON.stringify(split.viz,null,2)

    // save both parts of the model
    if (blu) this.blu.arl.save( blu )
    if (viz) this.viz.arl.save( viz )
},

// Splits raw into a part for the blu file and the viz file
splitRaw(raw) {

    // Split the raw model in a blu and viz section
    const sHeader = this.splitHeader(raw.header)
    const sRoot = this.splitNode(raw.root)

    const blu = {
        header: sHeader.blu
    }

    if (raw.imports) blu.imports = raw.imports;
    if (raw.factories) blu.factories = raw.factories;
    if (raw.types) blu.types = raw.types;
    blu.root = sRoot.blu

    const viz = {
        header: sHeader.viz,
        root: sRoot.viz
    }

    return { blu, viz}
},

splitHeader(rHeader) {

    const {version, created, saved, utc, runtime, style} = {...rHeader}
    const headerVersion = version ?? 'no version'
    const styleRgb = (typeof style === 'string') ? style : style?.rgb ?? style?.color ?? null

    return { 
            blu : {version: headerVersion, created, saved, utc, runtime},
            viz : {version: headerVersion, utc, style: styleRgb}
    }
},

splitInterfaces(rawInterfaces) {

    // check
    if (! rawInterfaces?.length) return {blu:[], viz:[]}

    // map
    const blu = rawInterfaces.map( rif => {

        const pins = rif.pins.map( pin => {
                const bluPin = {    name: pin.name, 
                                    kind: pin.kind,
                                    contract: pin.contract
                                }
                if (pin.prompt?.length) bluPin.prompt = pin.prompt
                return bluPin
            })
        return { interface: rif.interface, pins}
    })
    const viz = rawInterfaces.map( rif => {

        const pins = rif.pins.map( pin => convert.pinToString(pin))
        return {interface: convert.interfaceToString(rif), pins}
    })

    return {blu, viz}
},

splitNode(rNode) {

    const interfaces = this.splitInterfaces(rNode.interfaces)

    const blu = {
        kind: rNode.kind,
        name: rNode.name,
    }
    if (rNode.label) blu.label = rNode.label
    if (rNode.prompt) blu.prompt = rNode.prompt;

    const viz = {
        kind: rNode.kind,
        name: rNode.name,
        rect: convert.rectToString(rNode.rect),     
    }

    if (rNode.kind == 'dock') {
        blu.link = rNode.link;
        if (interfaces.blu.length) blu.interfaces = interfaces.blu;
        if (rNode.sx) blu.sx = rNode.sx;
        if (rNode.dx) blu.dx = rNode.dx;

        if (interfaces.viz.length) viz.interfaces = interfaces.viz;
    }
    else if (rNode.kind == 'source') {
        blu.factory = rNode.factory;     
        if (interfaces.blu.length) blu.interfaces = interfaces.blu;
        if (rNode.sx) blu.sx = rNode.sx;
        if (rNode.dx) blu.dx = rNode.dx; 

        if (interfaces.viz.length) viz.interfaces = interfaces.viz;
    }
    else if (rNode.kind == 'group') {

        const splitNodes = rNode.nodes.map( rNode => this.splitNode(rNode))

        if (interfaces.blu.length) blu.interfaces = interfaces.blu;
        if (rNode.sx) blu.sx = rNode.sx;
        if (rNode.dx) blu.dx = rNode.dx;
        if (splitNodes.length) blu.nodes = splitNodes.map( node => node.blu )
        if (rNode.connections) blu.connections = rNode.connections

        if (rNode.view) viz.view = convert.toViewStrings(rNode.view) 
        if (interfaces.viz.length) viz.interfaces = interfaces.viz;
        if (rNode.pads) viz.pads = rNode.pads.map( pad => convert.padToString(pad))
        if (splitNodes.length) viz.nodes = splitNodes.map( node => node.viz )
        if (rNode.buses) viz.buses = rNode.buses
        if (rNode.routes) viz.routes = rNode.routes
    }

    return {blu, viz}
},


joinHeader(bRaw, vRaw) {
    const vStyle = vRaw?.header?.style
    bRaw.header.style = (typeof vStyle === 'string') ? vStyle : style.rgb;
    // this.header.cook(arl, bRaw.header)
},

joinNode(bNode, vNode) {

    // The rectangle and the view of the node
    bNode.rect = vNode.rect ? convert.stringToRect(vNode.rect) : null;

    // The interfaces
    if (bNode.interfaces?.length && vNode.interfaces?.length) this.joinInterfaces(bNode, vNode)

    // group node specific
    if (bNode.kind == "group") {

        // The node view
        bNode.view = vNode.view ? convert.fromViewStrings(vNode.view) : null;

        // The pads
        bNode.pads = vNode.pads ? vNode.pads.map( pad => convert.stringToPad(pad)) : [];

        // The nodes
        bNode.nodes = bNode.nodes?.map( bn => {
            const vn = vNode.nodes?.find(vn => bn.name == vn.name)
            if (vn) this.joinNode(bn, vn) 
            return bn;
        })

        // copy the buses
        bNode.buses = vNode.buses

        // copy the routes
        bNode.routes = vNode.routes
    }
},

joinInterfaces(bNode, vNode) {

    // first convert strings
    vNode.interfaces = vNode.interfaces.map( iface => {
        const vif = {...convert.stringToInterface(iface.interface)}
        vif.pins = iface.pins.map( pin => convert.stringToPin(pin))
        return vif
    })

    // combine b and v
    bNode.interfaces = bNode.interfaces.map( bInterface => {
        const vInterface = vNode.interfaces.find( vInterface => vInterface.text == bInterface.interface)
        if (vInterface) {
            bInterface.pins = bInterface.pins.map( pin => {
                const vpin = vInterface.pins.find( vpin => vpin.name == pin.name)
                return vpin ? {...pin, wid:vpin.wid, left: vpin.left} : {...pin, wid:0, left: false};
            })
        }
        return bInterface
    })
},

// Finds the model text in the library file...
analyzeJSLib(rawCode) {

    // find the libname in the code
    let start = rawCode.indexOf('"{\\n')
    let end = rawCode.indexOf('\\n}";', start)

    // check
    if (start < 0 || end < 0) return null

    // get the part between starting and ending bracket
    let rawText = rawCode.slice(start+1,end+3)

    // allocate an array for the resulting text
    const cleanArray = new Array(rawText.length)
    let iClean = 0
    let iRaw = 0

    // remove all the scape sequences
    while (iRaw < rawText.length) {

        // get the first character
        const char1 = rawText.charAt(iRaw++)

        // if not a backslash, just copy
        if (char1 != '\\') {
            cleanArray[iClean++] = char1
        }
        else {

            // get the character that has been escaped 
            const char2 = rawText.charAt(iRaw++)

            // handle the different escape sequences
            if (char2 == 'n') 
                cleanArray[iClean++] = '\n'
            else if (char2 == '"') 
                cleanArray[iClean++] = '"'
        }
    }

    // combine all characters into a new string
    const cleanText = cleanArray.join('')

    // and parse
    return JSON.parse(cleanText)
},

}
