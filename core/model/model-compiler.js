import {rndAlfa, convert} from '../util/index.js'
import {ModelStore} from './model-store.js'
import {ModelBlueprint} from './model-blueprint.js'
import {FactoryMap} from './factory-map.js'
import {compileFunctions} from './compile.js'


export function ModelCompiler( UID ) {

    // The models used in the main model
    this.models = new ModelStore()

    // the list of factory files used 
    this.factories = new FactoryMap()

    // the model stack is used when reading files - it prevents circular references
    this.stack = []

    // set the uid generator (if any)
    this.UID = UID
}
ModelCompiler.prototype = {

    // reset the compiler - keep the UID
    reset() {

        // reset the factory map
        this.factories.reset()

        // reset
        this.models.reset()

        // reset the stack
        this.stack.length = 0
    },

    resetFresh() {
        for (const model of this.models.map.values()) model.is.fresh = false
    },

    // some functions that manipulate the stack - returns false if the node is already on the stack !
    pushCurrentNode(model, rawNode) {

        // get the name
        const nodeName = rawNode.source ?? rawNode.group ?? rawNode.dock
    
        // if the uid is already on the stack, this means that there is a risk of an inifinte loop in the construction of the node
        const L = this.stack.length

        // check if the uid is already on the stack
        if (L > 1) for (let i=0; i<L-1; i++) {
                if ( this.stack[i].nodeName === nodeName && this.stack[i].model === model) {

                console.log(nodeName, model.arl.userPath)

                return false
            }
        }
    
        // push the model and the uid on the stack
        this.stack.push({model, nodeName})
    
        // return true if ok
        return true
    },

    popCurrentNode() {
        this.stack.pop()
    },
    
    // returns the current model on the stack 
    getCurrentModel() {
        return this.stack.at(-1).model
    },

    getMainModel() {
        return this.stack[0].model
    },

    // recursive function to load a model and all dependencies of a model - only loads a model file if it is not yet loaded
    async getFactoriesAndModels(model) {

        // check if the model is in the model map
        if (this.models.contains(model.arl)) return

        // add the model to the model map
        this.models.add(model)

        // load the model only if not loaded yet 
        if ( ! model.raw && ! await model.getRaw()) return
 
        // if the model is a model, load the models referenced in the file
        if (model.is.blu) {

            // get the factories of the model
            if (model.raw.factories?.length > 0) this.factories.addRawFactories( model )

            // add the libraries but only for the main model
            if (model.is.main && model.raw.libraries)  model.addRawLibraries(model.arl, model.raw.libraries)

            // check if there are external models referenced
            if (! (model.raw.imports?.length > 0)) return

            // get the new models in this file - returns an array of new models (ie. not yet in the model map - size can be 0)
            const newModels = this.models.newModels( model.arl, model.raw.imports)

            // check
            if (newModels.length > 0) {

                // use an array of promise
                const pList = []

                // and now get the content for each of the models used in the file
                for (const newModel of newModels) pList.push( this.getFactoriesAndModels(newModel) )

                // wait for all...
                await Promise.all(pList)
            }
        }
    },

    // finds or adds a model based on the arl
    async findOrAddModel(arl) {
        
        // check if we have the model already
        let model = this.models.findArl(arl)

        // check
        if (model) return model

        // it is a new model
        model = new ModelBlueprint(arl)

        // make a key for the model (it is a new model !)
        model.makeKey()

        // load the model and its dependencies
        await this.getFactoriesAndModels(model)

        // done
        return model
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
            if (this.models.contains(model.arl)) continue

            // save the old utc before reloading the file
            const utcBefore = model.header.utc

            // load the model
            await model.getRaw()   

            // check
            if (!model.raw) continue

            // check if there was a time change
            if (utcBefore !== model.header.utc) {

console.log(`-SYNC- newer version of '${model.arl.userPath}'`)

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
}

Object.assign(ModelCompiler.prototype, compileFunctions)
