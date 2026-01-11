import {convert, style} from '../util/index.js'

// the blu file and the viz file are combind into a single format that is stored in blu version of node
// the viz part might have to be converted from a compact string to a raw json structure.
// The raw does not contain compact representations 

export const CompilerRead = {

// gets the blu and viz file - only fails if blu is missing
async fetch(model) {

    // if the extension is json it is another node file
    if (model.blu.arl) {

        try {
            const [bRaw, vRaw] = await Promise.all([
                model.blu.arl.get('json'),
                model.viz.arl.get('json').catch(error => {
                    // viz file not found - return null which makes the promise resolve successfully !
                    console.warn(`Viz file failed to load, proceeding with null: ${error.message}`);
                    return null;
                })
            ]);

            // set the fresh bit 
            model.blu.is.fresh = true;
            model.viz.is.fresh = true;

            return {bRaw, vRaw};
        }
        catch( error ) {
            // This ONLY catches the rejection from pBlu, the mandatory promise.
            console.error(`${model.blu.arl.userPath} could not be found or is not valid.`, error);
            return {bRaw:null, vRaw:null};
        }
    }

    else if (model.bundle.arl) {

        const rawCode = await model.bundle.arl.get('text')
        .catch( error => {
            console.error(`${model.bundle.arl.userPath} is not a valid bundle`, error)
        })

        //check
        if (!rawCode) return {bRaw:null, vRaw: null}

        // analyze the source to find the raw model
        const raw = this.analyzeJSLib(rawCode)

        // error if failed
        if (! raw) console.error(`Model not found in bundle: ${model.bundle.arl.userPath}`)

        // we are done 
        return {bRaw:raw, vRaw: null}
    }
    // it's one or the other !
    else return {bRaw:null, vRaw: null}
},

// get the raw model from two files and combine in one
async getRaw(model) {

    // get both parts of a model
    const {bRaw:bRaw, vRaw:vRaw} = await this.fetch(model)

    // we need a blu file , and it should have at least a header
    if (!bRaw || !bRaw.header) return null;

    // make the header
    this.joinHeader(bRaw, vRaw)

    // combine bRaw and vRaw in bRaw
    if (vRaw?.root) this.joinNode(bRaw.root, vRaw.root) 

    // set raw in the model
    model.raw = bRaw

    // We also return the result
    return bRaw
},
    
// recursive function to load a model and all dependencies of a model - only loads a model file if it is not yet loaded
async getFactoriesAndModels(model) {

    // get the arl of the model
    const arl = model.getArl()

    // check if the model is in the model map
    if (this.models.contains(arl)) return;

    // add the model to the model map
    this.models.add(model)

    // load the model only if not loaded yet (I don't think this is possible though...)
    if ( ! model.raw ) {

        // get the raw model
        if (! await this.getRaw(model)) return

        // prepare the model 
        model.preCook()
    }

    // if the model is from a bundle, we're done
    if (model.isBundle() ) return

    // get the factories of the model
    if (model.raw.factories?.length > 0) this.factories.cook( model )

    // add the libraries but ONLY for the main model
    if (model.is.main && model.raw.libraries)  model.libraries.cook(arl, model.raw.libraries)

    // check if there are external models referenced
    if (! (model.raw.imports?.length > 0)) return

    // get the new models in this file - returns an array of new models (ie. not yet in the model map - size can be 0)
    const newModels = this.models.newModels( model.blu.arl, model.raw.imports)

    // check
    if (newModels.length > 0) {

        // use an array of promise
        const pList = []

        // and now get the content for each of the models used in the file
        for (const newModel of newModels) pList.push( this.getFactoriesAndModels(newModel) )

        // wait for all...
        await Promise.all(pList)
    }
},


// update the model and factory maps
async updateFactoriesAndModels() {

    // make a copy of the current model map
    const oldModels = this.models.valuesArray() 

    // reset the map
    this.models.reset()

    // The list with promises
    const pList = []

    // load the dependencies for the models that have changed
    for (const model of oldModels) {

        //the main model is always ok
        if (model.is.main) continue

        // if the model is in the model map, it is for sure the most recent one !
        if (this.models.contains(model.getArl())) continue

        // load the model
        if (!await this.getRaw(model)) continue

        // check
        if (!model.raw) continue

        // check if there was a time change
        if (model.header.utc !== model.raw.header.utc) {

            model.preCook();

console.log(`-SYNC- newer version of '${model.getArl().userPath}'`)

            // sync the model
            pList.push( this.getFactoriesAndModels(model))
        }
        else {
            // add the model
            this.models.add(model) 
            
            // change the freshness
            model.is.fresh = false
        }
    }

    // wait for all...
    await Promise.all(pList)
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

joinHeader(bRaw, vRaw) {
    bRaw.header.style = vRaw ? vRaw.header.style : style.rgb;
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

}