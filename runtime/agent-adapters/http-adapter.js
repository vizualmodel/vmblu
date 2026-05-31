import {AgentCapabilityFilter} from './capability-filter.js'

export class HttpAgentAdapter {
    constructor({capabilities = {}, agent = null, server = null} = {}) {
        this.capabilities = capabilities
        this.agent = agent
        this.server = server ?? agent?.server ?? {}
        this.filter = new AgentCapabilityFilter({agent})
    }

    project() {
        const view = this.filter.filter(this.capabilities)
        const basePath = this.server.basePath ?? '/agent'
        return {
            target: 'http',
            agentId: this.agent?.id ?? null,
            application: view.application,
            server: {
                host: this.server.host ?? '127.0.0.1',
                port: this.server.port ?? 8787,
                basePath,
            },
            endpoints: {
                capabilities: `${basePath}/capabilities`,
                callTool: `${basePath}/tools/{toolId}/call`,
                readProbe: `${basePath}/probes/{probeId}/read`,
                events: `${basePath}/events`,
                approvals: `${basePath}/approvals/{approvalId}`,
            },
            capabilities: view,
        }
    }
}
