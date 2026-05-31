import {AgentPolicy} from '../agent-base/agent-policy.js'

export class AgentCapabilityFilter {
    constructor({agent = null} = {}) {
        this.agent = agent
        this.policy = AgentPolicy.fromAgent(agent ?? {})
    }

    filter(capabilities = {}) {
        return this.policy.filterCapabilities(normalizeCapabilities(capabilities))
    }
}

export function normalizeCapabilities(capabilities = {}) {
    return {
        schema: capabilities?.schema ?? 'https://vmblu.dev/schemas/capabilities.v1.json',
        version: capabilities?.version ?? 1,
        application: capabilities?.application ?? {},
        tools: Array.isArray(capabilities?.tools) ? capabilities.tools : [],
        probes: Array.isArray(capabilities?.probes) ? capabilities.probes : [],
        events: Array.isArray(capabilities?.events) ? capabilities.events : [],
        policies: capabilities?.policies ?? {},
        usageGuidance: capabilities?.usageGuidance ?? {},
    }
}
