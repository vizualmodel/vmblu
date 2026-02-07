import {convert, style} from '../util/index.js'

// the blu file and the viz file are combind into a single format that is stored in blu version of node
// the viz part might have to be converted from a compact string to a raw json structure.
// The raw does not contain compact representations 

export const CompilerMapHandling = {
    
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
        if (! await model.getRaw()) return

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
        if (!await model.getRaw()) continue

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

//  // Finds the model text in the library file...
// analyzeJSLib(rawCode) {

//     // find the libname in the code
//     let start = rawCode.indexOf('"{\\n')
//     let end = rawCode.indexOf('\\n}";', start)

//     // check
//     if (start < 0 || end < 0) return null

//     // get the part between starting and ending bracket
//     let rawText = rawCode.slice(start+1,end+3)

//     // allocate an array for the resulting text
//     const cleanArray = new Array(rawText.length)
//     let iClean = 0
//     let iRaw = 0

//     // remove all the scape sequences
//     while (iRaw < rawText.length) {

//         // get the first character
//         const char1 = rawText.charAt(iRaw++)

//         // if not a backslash, just copy
//         if (char1 != '\\') {
//             cleanArray[iClean++] = char1
//         }
//         else {

//             // get the character that has been escaped 
//             const char2 = rawText.charAt(iRaw++)

//             // handle the different escape sequences
//             if (char2 == 'n') 
//                 cleanArray[iClean++] = '\n'
//             else if (char2 == '"') 
//                 cleanArray[iClean++] = '"'
//         }
//     }

//     // combine all characters into a new string
//     const cleanText = cleanArray.join('')

//     // and parse
//     return JSON.parse(cleanText)
// },

}