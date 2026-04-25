export {rtFlags} from '../shared/runtime.js'
export {Runtime}

import {createRuntime} from '../shared/runtime.js'
import {runAsNode} from './node-context.js'

const Runtime = createRuntime({
    invokeHandler(dest, hix, param) {
        return runAsNode(dest.name, () => dest.rxSink[hix].handler.call(dest.cell, param))
    }
})
