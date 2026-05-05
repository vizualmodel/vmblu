import {Path} from '../arl/index.js'

const PRIMITIVE_SCHEMA_TYPES = new Set(['string', 'number', 'boolean', 'integer', 'object', 'array', 'null'])
const ANY_SCHEMA = {type: 'object'}

export const CapabilityHandling = {

makeCapabilityObject(root = null) {
    const appName = root?.name || this.raw?.root?.name || Path.getSplit(this.getArl()?.getPath?.() ?? '').name || ''

    const capability = {
        schema: 'https://vmblu.dev/schemas/capabilities.v1.json',
        version: 1,
        application: {
            id: appName || 'application',
            title: appName || 'Application',
            description: this.raw?.header?.description || `${appName || 'vmblu'} application.`
        },
        tools: [],
        probes: [],
        events: [],
        policies: {
            defaultApproval: 'never'
        },
        usageGuidance: {
            principles: [
                'Use tools to change application state.',
                'Use probes to verify effects.',
                'Use events for asynchronous observations.',
                'Do not assume that a tool call succeeded unless a result, probe, or event confirms it.'
            ]
        }
    }

    this.collectCapabilitiesFromNode(this.raw?.root, capability, [])

    capability.tools.sort((a, b) => a.id.localeCompare(b.id))
    capability.probes.sort((a, b) => a.id.localeCompare(b.id))
    capability.events.sort((a, b) => a.id.localeCompare(b.id))

    return capability
},

makeCapabilityString(root = null) {
    return JSON.stringify(this.makeCapabilityObject(root), null, 2)
},

makeAndSaveCapabilities(capPath, root = null) {
    if (!capPath) return null

    const capArl = this.getArl().resolve(capPath)
    capArl.save(this.makeCapabilityString(root))

    return capArl
},

collectCapabilitiesFromNode(rawNode, capability, path = []) {
    if (!rawNode) return

    const nodePath = [...path, rawNode.name]

    if (rawNode.kind === 'source') {
        this.collectNodeProbes(rawNode, capability, nodePath)
        this.collectPinCapabilities(rawNode, capability, nodePath)
    }

    for (const child of rawNode.nodes ?? []) {
        this.collectCapabilitiesFromNode(child, capability, nodePath)
    }
},

collectNodeProbes(rawNode, capability, nodePath) {
    if (!Array.isArray(rawNode.probes)) return

    for (const probeMeta of rawNode.probes) {
        if (!probeMeta || probeMeta.enabled === false) continue

        const id = probeMeta.id || this.defaultCapabilityId(nodePath, probeMeta.name || 'probe')
        const probe = {
            id,
            title: probeMeta.title || this.titleFromId(id),
            description: probeMeta.description || '',
            kind: probeMeta.kind || 'state',
            schema: probeMeta.schema || ANY_SCHEMA,
            binding: probeMeta.binding || {
                kind: 'stub',
                node: rawNode.name
            }
        }

        if (!probe.binding.node) probe.binding.node = rawNode.name
        if (!probe.binding.ref) probe.binding.ref = `${probe.id}@${rawNode.name}`

        capability.probes.push(probe)
    }
},

collectPinCapabilities(rawNode, capability, nodePath) {
    for (const iface of rawNode.interfaces ?? []) {
        for (const pin of iface.pins ?? []) {
            if (pin.tool?.enabled === true) {
                capability.tools.push(this.makeToolCapability(rawNode, pin, nodePath))
            }
            if (pin.event?.enabled === true) {
                capability.events.push(this.makeEventCapability(rawNode, pin, nodePath))
            }
        }
    }
},

makeToolCapability(rawNode, pin, nodePath) {
    const meta = pin.tool || {}
    const id = meta.id || this.defaultCapabilityId(nodePath, pin.name)
    const tool = {
        id,
        title: meta.title || this.titleFromId(id),
        description: meta.description || pin.prompt || `Send ${pin.name} to ${rawNode.name}.`,
        input: {
            node: rawNode.name,
            pin: pin.name,
            ref: `${pin.name}@${rawNode.name}`,
            payload: this.pinPayloadName(pin),
            schema: meta.schema || this.schemaFromPinContract(pin, 'request')
        },
        effects: Array.isArray(meta.effects) ? meta.effects : [],
        risk: meta.risk || 'low',
        approval: meta.approval || 'never'
    }

    if (meta.timeoutMs) tool.timeoutMs = meta.timeoutMs
    if (meta.examples) tool.examples = meta.examples
    if (meta.usageGuidance) tool.usageGuidance = meta.usageGuidance

    return tool
},

pinPayloadName(pin) {
    const payload = pin?.contract?.payload
    if (!payload) return undefined
    if (typeof payload === 'string') return payload
    if (typeof payload === 'object' && payload !== null) return payload.request || payload.payload || undefined
    return undefined
},

makeEventCapability(rawNode, pin, nodePath) {
    const meta = pin.event || {}
    const id = meta.id || this.defaultCapabilityId(nodePath, pin.name)
    const event = {
        id,
        title: meta.title || this.titleFromId(id),
        description: meta.description || pin.prompt || `Observed when ${rawNode.name} emits ${pin.name}.`,
        source: {
            node: rawNode.name,
            pin: pin.name,
            ref: `${pin.name}@${rawNode.name}`
        },
        schema: meta.schema || this.schemaFromPinContract(pin, 'event')
    }

    return event
},

schemaFromPinContract(pin, direction = 'request') {
    const payload = pin?.contract?.payload
    if (!payload) return ANY_SCHEMA

    if (typeof payload === 'object' && payload !== null) {
        const selected = direction === 'reply' ? payload.reply : payload.request
        return this.schemaFromVmbluType(selected)
    }

    return this.schemaFromVmbluType(payload)
},

schemaFromVmbluType(typeName, seen = new Set()) {
    if (!typeName || typeName === 'any') return ANY_SCHEMA

    if (typeof typeName !== 'string') return ANY_SCHEMA

    const lower = typeName.toLowerCase()
    if (PRIMITIVE_SCHEMA_TYPES.has(lower)) return {type: lower}
    if (lower === 'int') return {type: 'integer'}
    if (lower === 'float') return {type: 'number'}

    const typeMap = typeof this.vmbluTypes === 'string'
        ? JSON.parse(this.vmbluTypes)
        : (this.vmbluTypes ?? null)

    const def = typeMap?.[typeName]
    if (!def || seen.has(typeName)) return {type: 'object', title: typeName}

    seen.add(typeName)

    const kind = def.kind ?? (def.fields ? 'object' : def.items ? 'array' : def.external ? 'external' : 'primitive')

    if (kind === 'object') {
        const properties = {}
        for (const [fieldName, field] of Object.entries(def.fields ?? {})) {
            properties[fieldName] = this.schemaFromVmbluType(field.vmbluType, seen)
            if (field.summary) properties[fieldName].description = field.summary
        }

        const schema = {type: 'object', properties}
        if (Array.isArray(def.required) && def.required.length > 0) schema.required = def.required
        if (def.summary) schema.description = def.summary
        return schema
    }

    if (kind === 'array') {
        const schema = {
            type: 'array',
            items: this.schemaFromVmbluType(def.items?.vmbluType, seen)
        }
        if (def.summary) schema.description = def.summary
        return schema
    }

    if (kind === 'primitive') {
        return this.schemaFromVmbluType(def.vmbluType || 'string', seen)
    }

    return {type: 'object', title: typeName, description: def.summary || `External type ${typeName}.`}
},

defaultCapabilityId(nodePath, name) {
    const pinName = String(name ?? '').trim()
    const nodeName = String(nodePath?.at?.(-1) ?? '').trim()

    if (pinName && nodeName) return `${pinName} @ ${nodeName}`
    return pinName || nodeName
},

titleFromId(id) {
    const first = String(id || '').split('@').at(0)?.trim() || id || ''
    return String(first)
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase())
}

}
