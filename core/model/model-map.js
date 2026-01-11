import {ModelBlueprint} from './blueprint.js'
import {convert} from '../util/index.js'

// The model file uses a model map
export function ModelMap() {

    // the key to the map is the full path - the value is a model or an array of models...
    this.map = new Map()
}
ModelMap.prototype = {

    reset() {
        this.map.clear()
    },

    size() {
        return this.map.size
    },

    // New models are returned in an array but not added to the map
    newModels(ref, rawModels) {

        // a list of models that are new, i.e. not yet in the ModelMap
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

        // get the full path
        const fullPath = model.fullPath()

        if (!fullPath) return null;

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

        if (!arl) return true
        return this.map.has(arl.getFullPath())
    },

    get(key) {
        return this.map.get(key)
    },

    valuesArray() {
        return Array.from(this.map.values())
    },

    all(f) {
        const val = Array.from(this.map.values())
        if (!val?.length) return []
        return val.map( e => f(e))
    },

    // find the model if you only have the arl
    findArl(arl) {

        // check 
        if (!arl) return null

        for(const model of this.map.values()) {
            if ( model.getArl()?.equals(arl)) return model
        }
        return null
    },

    cook(arlRef, rawModels) {

        // get the models for the libraries
        const newModels = this.newModels(arlRef, rawModels)

        // add the model to the modellist - the model is not fetched yet 
        // this happens at the end when the model is loaded (see library.load)
        for(const model of newModels) this.add(model)
    },

/**** WE NEED A COMPILER HERE  */

    async load() {

        // a promise array
        const pList = []

        // build the library for the modcom in the node library....
        for (const model of this.map.values()) {

            // set it as selectable
            model.is.selectable = true

            // get the content of the file
            pList.push( compiler.getRaw(model) )
        }

        // wait for all...
        await Promise.all(pList)
    },

}