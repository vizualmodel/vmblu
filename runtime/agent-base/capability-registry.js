export class CapabilityRegistry {
    constructor(capabilities = null) {
        this.capabilities = this.normalizeCapabilities(capabilities)
        this.tools = new Map()
        this.probes = new Map()
        this.events = new Map()
        this.index()
    }

    normalizeCapabilities(capabilities) {
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

    index() {
        for (const tool of this.capabilities.tools) {
            if (tool?.id) this.tools.set(tool.id, tool)
        }
        for (const probe of this.capabilities.probes) {
            if (probe?.id) this.probes.set(probe.id, probe)
        }
        for (const event of this.capabilities.events) {
            if (event?.id) this.events.set(event.id, event)
        }
    }

    list() {
        return {
            ...this.capabilities,
            tools: [...this.tools.values()],
            probes: [...this.probes.values()],
            events: [...this.events.values()],
        }
    }

    getTool(id) {
        return this.tools.get(id) ?? null
    }

    getProbe(id) {
        return this.probes.get(id) ?? null
    }

    getEvent(id) {
        return this.events.get(id) ?? null
    }
}
