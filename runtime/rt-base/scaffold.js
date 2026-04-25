import {Runtime} from './runtime.js'
import {RuntimeNode} from './runtime-node.js'
import {createScaffold} from '../shared/scaffold.js'

export let runtime = null

export const scaffold = createScaffold({
    createRuntime: () => new Runtime(),
    RuntimeNode,
    setRuntime(value) {
        runtime = value
    }
})
