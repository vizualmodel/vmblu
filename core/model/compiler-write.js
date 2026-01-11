import {convert} from '../util/index.js'

export const CompilerWrite = {

// serialize the node 
encode(node, model) {

   if (!node) return null

    // get the factories
    node.collectFactories(this.factories)

    // get the imports
    node.collectModels(this.models)

    // the object to encode
    const raw = {
        header: model.header,
    }

    // add the models, factories and libraries
    if (this.models?.size() > 0) raw.imports = this.models.all( model => model.blu.arl.userPath)
    if (this.factories?.size() > 0) raw.factories = this.factories.all( 
        factory => ({   path: factory.arl?.userPath ?? "./index.js", 
                        function: factory.fName 
                    }))
    if (model.libraries?.size() > 0) raw.libraries = model.libraries.all( lib => lib.blu.arl.userPath)

    // add the types
    if (model.vmbluTypes) raw.types = model.vmbluTypes

    // set the root
    raw.root = node.makeRaw()

    // now split the result in two parts
    const split = this.splitRaw(raw)

    // and return raw and the stringified results
    return {raw,
            blu: JSON.stringify(split.blu,null,2),
            viz: JSON.stringify(split.viz,null,2)}
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

    const {schema, created, saved, utc,runtime, style} = {...rHeader}

    return { 
            blu : {schema, created, saved, utc,runtime},
            viz : {schema, utc, style: style.rgb}
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



}