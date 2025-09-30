import {Runtime} from './runtime.js'
import {RuntimeNode} from './runtime-node.js'
import {RuntimeFilter} from './runtime-filter.js'

export let runtime = null

// this function gets the name of the file to load from the initial page and starts the runtime
export function scaffold(nodeList, filterList = []) {

    // create a new runtime structure
    runtime = new Runtime()

    // create the run time nodes
    for (const rawNode of nodeList) {

        // create the node
        const actor = new RuntimeNode( rawNode )

        // save the node in the runtime
        runtime.actors.push( actor )
    }

    // create the routers
    for(const rawFilter of filterList) {

        // create the runtime router
        const actor = new RuntimeFilter( rawFilter )

        // save in the actors list
        runtime.actors.push( actor )
    }

    // resolve the uids in the target
    runtime.actors.forEach(actor => actor.resolveUIDs(runtime.actors))

    // done 
    return runtime
}