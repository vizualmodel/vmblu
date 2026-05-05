import * as baseRuntimeSettings from './rt-base/runtime-settings.js'
import * as alsRuntimeSettings from './rt-als/runtime-settings.js'
import * as agentRuntimeSettings from './rt-agent/runtime-settings.js'

export const RT_BASE = '@vizualmodel/vmblu-runtime/rt-base'
export const RT_ALS = '@vizualmodel/vmblu-runtime/rt-als'
export const RT_AGENT = '@vizualmodel/vmblu-runtime/rt-agent'

function selectRuntimeSettings(runtime) {
    if (runtime === RT_AGENT) return agentRuntimeSettings
    return runtime === RT_ALS ? alsRuntimeSettings : baseRuntimeSettings
}

export function makeRuntimeSettings(runtime) {
    return selectRuntimeSettings(runtime).makeRuntimeSettings()
}

export function cloneRuntimeSettings(runtime, dx = null) {
    return selectRuntimeSettings(runtime).cloneRuntimeSettings(dx)
}

export function normalizeRuntimeSettings(runtime, dx = null) {
    return selectRuntimeSettings(runtime).normalizeRuntimeSettings(dx)
}

export function isDefaultRuntimeSettings(runtime, dx = null) {
    return selectRuntimeSettings(runtime).isDefaultRuntimeSettings(dx)
}
