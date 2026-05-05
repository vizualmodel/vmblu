import {Runtime} from './runtime.js'
import {RuntimeNode} from './runtime-node.js'

export let runtime = null

export function scaffold(nodeList, filterList = [], options = {}) {

    runtime = new Runtime()

    for (const rawNode of nodeList) {
        runtime.actors.push(new RuntimeNode(rawNode))
    }

    runtime.actors.forEach(actor => actor.resolveUIDs(runtime.actors))
    runtime.configureAgentRuntime(options)

    return runtime
}
