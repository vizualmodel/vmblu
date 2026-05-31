import {AgentCapabilityFilter} from './capability-filter.js'

export class VmbluAgentAdapter {
    constructor({capabilities = {}, agent = null} = {}) {
        this.capabilities = capabilities
        this.agent = agent
        this.filter = new AgentCapabilityFilter({agent})
    }

    project() {
        return {
            target: 'vmblu',
            agentId: this.agent?.id ?? null,
            capabilities: this.filter.filter(this.capabilities),
        }
    }
}
