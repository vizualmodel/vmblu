import {AgentCapabilityFilter} from './capability-filter.js'

export class OpenAIAgentAdapter {
    constructor({capabilities = {}, agent = null} = {}) {
        this.capabilities = capabilities
        this.agent = agent
        this.filter = new AgentCapabilityFilter({agent})
    }

    project() {
        const view = this.filter.filter(this.capabilities)
        const map = new Map()
        const tools = [
            ...this.projectTools(view.tools, map),
            ...this.projectProbes(view.probes, map),
        ]

        return {
            target: 'openai',
            agentId: this.agent?.id ?? null,
            application: view.application,
            tools,
            map,
        }
    }

    projectTools(tools = [], map) {
        return tools.map((tool, index) => {
            const name = this.capabilityName('tool', tool.id, index)
            map?.set(name, {kind: 'tool', capability: tool})
            return {
                type: 'function',
                function: {
                    name,
                    description: tool.description || tool.title || tool.id,
                    parameters: normalizeOpenAIJsonSchema(tool.input?.schema ?? {type: 'object', additionalProperties: true}),
                },
            }
        })
    }

    projectProbes(probes = [], map) {
        return probes.map((probe, index) => {
            const name = this.capabilityName('probe', probe.id, index)
            map?.set(name, {kind: 'probe', capability: probe})
            return {
                type: 'function',
                function: {
                    name,
                    description: `Read-only probe: ${probe.description || probe.title || probe.id}`,
                    parameters: normalizeOpenAIJsonSchema(probe.schema ?? {type: 'object', additionalProperties: true}),
                },
            }
        })
    }

    capabilityName(prefix, id, index) {
        const base = String(id || `${prefix}_${index + 1}`)
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48)
        return `${prefix}_${base || 'capability'}_${index + 1}`
    }
}

export function normalizeOpenAIJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return {type: 'object', additionalProperties: true}
    if (Array.isArray(schema)) return schema.map(item => normalizeOpenAIJsonSchema(item))

    const normalized = {...schema}
    const types = Array.isArray(normalized.type) ? normalized.type : [normalized.type]

    if (types.includes('array') && !normalized.items) {
        normalized.items = {}
    }

    if (normalized.properties && typeof normalized.properties === 'object') {
        normalized.properties = Object.fromEntries(
            Object.entries(normalized.properties).map(([key, value]) => [key, normalizeOpenAIJsonSchema(value)])
        )
    }

    if (normalized.items && typeof normalized.items === 'object') {
        normalized.items = normalizeOpenAIJsonSchema(normalized.items)
    }

    return normalized
}
