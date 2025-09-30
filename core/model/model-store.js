import {ModelBlueprint} from './model-blueprint.js'
import {convert} from '../util/index.js'

// The model file uses a model map
export function ModelStore() {

    // the key to the map is the full path - the value is a model or an array of models...
    this.map = new Map()
}
ModelStore.prototype = {

    reset() {
        this.map.clear()
    },

    size() {
        return this.map.size
    },

    // New models are returned in an array but not added to the map
    newModels(ref, rawModels) {

        // a list of models that are new, i.e. not yet in the ModelStore
        const modelList=[]

        // check
        if (rawModels.length < 1) return modelList

        // for each model in the array
        for (const rawModel of rawModels) {

            // now we have to resolve the user path to an absolute path
            const arl = ref.resolve(rawModel)

            // check if we have already handled this file...
            if ( this.contains(arl) ) continue

            // create the new model - there is no uid !
            const newModel = new ModelBlueprint(arl)

            // also add it to the new model list
            modelList.push(newModel)
        }

        // return the list of models that are not yet in the map
        return modelList
    }, 
    
    add(model) {

        const fullPath = model.arl.getFullPath()

        // check if the key is already in the map
        const storedLink = this.map.get(fullPath)

        // if the stored model is for a different arl, we have a key-clash and we have to add an array of links for the key
        if ( storedLink ) return this

        // just add the model to the map
        this.map.set(fullPath, model)
        
        // return the linkmap
        return this
    },

    contains(arl) {

        // check
        return this.map.has(arl.getFullPath())
    },

    get(key) {
        return this.map.get(key)
    },

    valuesArray() {

        return Array.from(this.map.values())

    },

    // find the model if you only have the arl
    findArl(arl) {

        // check 
        if (!arl) return null

        for(const model of this.map.values()) {
            if (model.arl?.equals(arl)) return model
        }
        return null
    },

    toJSON(){
        // return the list of links
        return [...this.map.values()]
    },

    // (re)loads all the model in the map
    async load() {

        // a promise array
        const pList = []

        // build the library for the modcom in the node library....
        for (const model of this.map.values()) {

            // set it as selectable
            model.is.selectable = true

            // get the content of the file
            pList.push( model.getRaw() )
        }

        // wait for all...
        await Promise.all(pList)
    },



    // // check all models if they have changed
    // async checkForChanges() {

    //     // a promiss array
    //     const pList = []

    //     // build the library for the modcom in the node library....
    //     for (const model of this.map.values()) {

    //         // check if it has changed
    //         pList.push( model.hasChanged() )
    //     }

    //     // wait for all...
    //     await Promise.all(pList)
    // },
}