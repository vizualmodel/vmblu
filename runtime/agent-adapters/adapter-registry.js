import {HttpAgentAdapter} from './http-adapter.js'
import {OpenAIAgentAdapter} from './openai-adapter.js'
import {VmbluAgentAdapter} from './vmblu-adapter.js'

export class AgentAdapterRegistry {
    constructor() {
        this.adapters = new Map([
            ['http', HttpAgentAdapter],
            ['openai', OpenAIAgentAdapter],
            ['vmblu', VmbluAgentAdapter],
        ])
    }

    get(target) {
        return this.adapters.get(normalizeTarget(target)) ?? null
    }

    create(target, options = {}) {
        const Adapter = this.get(target)
        if (!Adapter) throw new Error(`Unknown agent adapter target: ${target}`)
        return new Adapter(options)
    }

    project({target, capabilities, agent = null, server = null} = {}) {
        return this.create(target, {capabilities, agent, server}).project()
    }

    targets() {
        return [...this.adapters.keys()]
    }
}

export function normalizeTarget(target) {
    const normalized = String(target ?? 'vmblu').trim().toLowerCase()
    if (normalized === 'openai-tools' || normalized === 'openai-agents') return 'openai'
    if (normalized === 'native') return 'vmblu'
    return normalized
}

export const agentAdapterRegistry = new AgentAdapterRegistry()
