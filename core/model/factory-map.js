import {Factory} from '../node/index.js'
import {convert} from '../util/index.js'

// The model file uses a factory map
export function FactoryMap() {

    // the key to the map is the full factory path
    this.map = new Map()
}
FactoryMap.prototype = {

    reset() {
        this.map.clear()
    },

    size() {
        return this.map.size
    },

    // get the factories from the strings in the file
    cook(model) {

        // get the arl of the model
        const modelArl = model.getArl()

        for (const rawFactory of model.raw.factories) {

            //const rawPath = typeof rawFactory === 'string' ? rawFactory : rawFactory?.path
            if (!rawFactory.path) continue

            // the factories have to be resolved wrt the file that contains them
            const arl = modelArl.resolve(rawFactory.path)

            // get the full path of the factory
            const fullPath = arl.getFullPath()

            // check if we have already handled this file...
            if ( this.map.has( fullPath)) continue

            // create the factory - we just need the arl here, so no factory name required
            const factory = new Factory()

            // save the arl
            factory.arl = arl

            // and add the factory
            this.map.set(fullPath, factory)
        }
    }, 

    // only adds new factory files
    add(factory) {

        const fullPath = factory.arl.getFullPath()

        // check if the key is already in the map
        const storedFactory = this.map.get(fullPath)

        // check
        if ( storedFactory ) return 

        // just add the key/value pair to the map
        this.map.set(fullPath, factory)
        
        // return the factoryMap
        return this
    },

    all(f) {
        const val = Array.from(this.map.values())
        if (!val?.length) return []
        return val.map( e => f(e))
    },

}
