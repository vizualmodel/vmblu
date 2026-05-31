import {runtimeSettings as baseRuntimeSettings} from './rt-base/runtime-settings.js'
import {runtimeSettings as alsRuntimeSettings} from './rt-als/runtime-settings.js'
import {runtimeSettings as browserAgentRuntimeSettings} from './rt-browser-agent/runtime-settings.js'
import {runtimeSettings as nodejsAgentRuntimeSettings} from './rt-nodejs-agent/runtime-settings.js'

export const RT_BASE = '@vizualmodel/vmblu-runtime/rt-base'
export const RT_ALS = '@vizualmodel/vmblu-runtime/rt-als'
export const RT_BROWSER_AGENT = '@vizualmodel/vmblu-runtime/rt-browser-agent'
export const RT_NODEJS_AGENT = '@vizualmodel/vmblu-runtime/rt-nodejs-agent'
export const RT_AGENT = '@vizualmodel/vmblu-runtime/rt-agent'

export const RUNTIME_DESCRIPTORS = [
    {
        id: RT_BASE,
        name: 'rt-base',
        settings: baseRuntimeSettings,
        supportsAgents: false,
    },
    {
        id: RT_ALS,
        name: 'rt-als',
        settings: alsRuntimeSettings,
        supportsAgents: false,
    },
    {
        id: RT_BROWSER_AGENT,
        name: 'rt-browser-agent',
        settings: browserAgentRuntimeSettings,
        supportsAgents: true,
    },
    {
        id: RT_NODEJS_AGENT,
        name: 'rt-nodejs-agent',
        settings: nodejsAgentRuntimeSettings,
        supportsAgents: true,
        aliases: [RT_AGENT, 'rt-agent'],
    },
]

export function listRuntimeDescriptors() {
    return RUNTIME_DESCRIPTORS.map(({id, name, supportsAgents}) => ({id, name, supportsAgents}))
}

export function getRuntimeDescriptor(runtime) {
    return RUNTIME_DESCRIPTORS.find(candidate => {
        return candidate.id === runtime
            || candidate.name === runtime
            || candidate.aliases?.includes(runtime)
    }) ?? RUNTIME_DESCRIPTORS[0]
}

export function getRuntimeSettings(runtime) {
    return getRuntimeDescriptor(runtime).settings
}
