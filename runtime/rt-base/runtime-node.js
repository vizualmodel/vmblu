import {runtime} from './scaffold.js'
import {normalizeRuntimeSettings} from './runtime-settings.js'
import {rtFlags} from './runtime.js'
import {createRuntimeNode} from '../shared/runtime-node.js'

export const RuntimeNode = createRuntimeNode({
    getRuntime: () => runtime,
    normalizeRuntimeSettings,
    rtFlags,
})
