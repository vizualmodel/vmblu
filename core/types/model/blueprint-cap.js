import {Path} from '../arl/index.js'
import {makeArtifactProvenance} from './artifact-provenance.js'
import {
    ANY_PAYLOAD_SCHEMA,
    capabilityTitle,
    hasReplyContract,
    makeCapabilityId,
    schemaFromPinContract,
    schemaFromVmbluType,
} from './capability-contract.js'

export const CapabilityHandling = {

makeCapabilityObject(root = null) {
    const appName = root?.name || this.raw?.root?.name || Path.getSplit(this.getArl()?.getPath?.() ?? '').name || ''
    const appId = makeCapabilityId([], appName || 'application')

    const capability = {
        schema: 'https://vmblu.dev/schemas/capabilities.v1.json',
        version: 1,
        provenance: makeArtifactProvenance({
            artifact: 'capabilities',
            model: this.getArl().getName(),
            source: this.raw,
            schemaVersion: this.raw?.header?.version,
        }),
        application: {
            id: appId,
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
    capArl.save(this.makeCapabilityString(root)).catch(error => console.error(`Failed to save ${capArl.getPath()}:`, error))

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
            schema: probeMeta.schema || ANY_PAYLOAD_SCHEMA,
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
        title: this.titleFromId(pin.name),
        description: pin.prompt || `Send ${pin.name} to ${rawNode.name}.`,
        input: {
            node: rawNode.name,
            pin: pin.name,
            ref: `${pin.name}@${rawNode.name}`,
            payload: this.pinPayloadName(pin),
            schema: this.schemaFromPinContract(pin, 'request')
        },
        effects: Array.isArray(meta.effects) ? meta.effects : [],
        risk: meta.risk || 'low',
        approval: meta.approval || 'never'
    }

    if (hasReplyContract(pin)) {
        tool.output = {
            payload: pin.contract.payload.reply,
            schema: this.schemaFromPinContract(pin, 'reply')
        }
    }

    const verification = this.verificationFromEffects(tool.effects)
    if (verification) tool.verifyWith = verification

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
        title: this.titleFromId(pin.name),
        description: pin.prompt || `Observed when ${rawNode.name} emits ${pin.name}.`,
        source: {
            node: rawNode.name,
            pin: pin.name,
            ref: `${pin.name}@${rawNode.name}`
        },
        schema: this.schemaFromPinContract(pin, 'event')
    }

    return event
},

schemaFromPinContract(pin, direction = 'request') {
    return schemaFromPinContract(pin, this.vmbluTypes, direction)
},

schemaFromVmbluType(typeName) {
    return schemaFromVmbluType(typeName, this.vmbluTypes)
},

defaultCapabilityId(nodePath, name) {
    return makeCapabilityId(nodePath, name)
},

titleFromId(id) {
    return capabilityTitle(id)
},

verificationFromEffects(effects = []) {
    const events = new Set()
    const probes = new Set()
    let timeoutMs = null

    for (const effect of effects) {
        for (const id of effect?.verifyWith?.events ?? []) events.add(id)
        for (const value of effect?.verifyWith?.probes ?? []) {
            const id = typeof value === 'string' ? value : value?.id
            if (id) probes.add(id)
        }
        if (Number.isInteger(effect?.timeoutMs)) {
            timeoutMs = timeoutMs == null ? effect.timeoutMs : Math.max(timeoutMs, effect.timeoutMs)
        }
    }

    if (!events.size && !probes.size) return null
    const verification = {events: [...events], probes: [...probes].map(id => ({id}))}
    if (timeoutMs != null) verification.timeoutMs = timeoutMs
    return verification
}

}
