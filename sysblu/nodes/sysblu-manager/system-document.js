export function cloneSystemDocument(document) {
    if (document == null) return null
    return JSON.parse(JSON.stringify(document))
}

export function validateSystemDocument(document) {
    const errors = []

    const validateReference = (reference, owner) => {
        if (typeof reference?.kind !== 'string' || !reference.kind) errors.push(`A reference on ${owner} needs a kind.`)
        if (typeof reference?.target !== 'string' || !reference.target) errors.push(`A reference on ${owner} needs a target.`)
        const hasCommand = Object.hasOwn(reference ?? {}, 'command')
        const hasWorkingDirectory = Object.hasOwn(reference ?? {}, 'workingDirectory')
        if (hasCommand && (typeof reference.command !== 'string' || !reference.command.trim())) {
            errors.push(`A command reference on ${owner} needs a non-empty command.`)
        }
        if (hasWorkingDirectory && (typeof reference.workingDirectory !== 'string' || !reference.workingDirectory.trim())) {
            errors.push(`A command reference on ${owner} needs a non-empty workingDirectory.`)
        }
        if (hasCommand !== hasWorkingDirectory) {
            errors.push(`A command reference on ${owner} needs both command and workingDirectory.`)
        }
    }

    if (!document || typeof document !== 'object' || Array.isArray(document)) {
        return {ok: false, errors: ['The system document must be an object.']}
    }

    if (!document.header || typeof document.header !== 'object') errors.push('Missing system header.')
    if (document.header?.version !== '1.11.0') errors.push('The system document must use schema version 1.11.0.')
    if (typeof document.header?.name !== 'string' || !document.header.name.trim()) errors.push('The system header needs a name.')
    if (!Array.isArray(document.nodes)) errors.push('The system document needs a nodes array.')
    if (!Array.isArray(document.connections)) errors.push('The system document needs a connections array.')

    const nodeIds = new Set()
    const endpointsByNode = new Map()
    for (const node of Array.isArray(document.nodes) ? document.nodes : []) {
        if (!node || typeof node !== 'object') {
            errors.push('Every system node must be an object.')
            continue
        }
        if (typeof node.id !== 'string' || !node.id) errors.push('Every system node needs an id.')
        else if (nodeIds.has(node.id)) errors.push(`Duplicate system node id: ${node.id}.`)
        else nodeIds.add(node.id)

        if (node.kind !== 'application') errors.push(`Unknown node kind for ${node.id ?? '<unknown>'}.`)
        if (typeof node.name !== 'string' || !node.name.trim()) errors.push(`System node ${node.id ?? '<unknown>'} needs a name.`)
        if (typeof node.vmblu !== 'boolean') errors.push(`Application ${node.id ?? '<unknown>'} needs a vmblu flag.`)
        for (const reference of Array.isArray(node.references) ? node.references : []) {
            validateReference(reference, node.id ?? '<unknown>')
        }
        if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
            errors.push(`Node ${node.id ?? '<unknown>'} needs a finite position.`)
        }

        const endpoints = new Map()
        for (const endpoint of Array.isArray(node.endpoints) ? node.endpoints : []) {
            if (typeof endpoint?.id !== 'string' || !endpoint.id) errors.push(`An endpoint on ${node.id ?? '<unknown>'} needs an id.`)
            else if (endpoints.has(endpoint.id)) errors.push(`Duplicate endpoint id ${endpoint.id} on ${node.id}.`)
            else endpoints.set(endpoint.id, endpoint)
            if (typeof endpoint?.name !== 'string' || !endpoint.name) errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} needs a name.`)
            if (!['client', 'server', 'peer'].includes(endpoint?.role)) {
                errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} has an invalid role.`)
            }
            if (Object.hasOwn(endpoint ?? {}, 'protocol') && (typeof endpoint.protocol !== 'string' || !endpoint.protocol.trim())) {
                errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} has an invalid protocol definition.`)
            }
            if (Object.hasOwn(endpoint ?? {}, 'references')) errors.push(`Endpoint ${endpoint?.id ?? '<unknown>'} on ${node.id} cannot own references.`)
        }
        if (node.id) endpointsByNode.set(node.id, endpoints)
    }

    const connectionIds = new Set()
    for (const connection of Array.isArray(document.connections) ? document.connections : []) {
        if (typeof connection?.id !== 'string' || !connection.id) errors.push('Every connection needs an id.')
        else if (connectionIds.has(connection.id)) errors.push(`Duplicate connection id: ${connection.id}.`)
        else connectionIds.add(connection.id)
        if (typeof connection?.transport !== 'string' || !connection.transport) {
            errors.push(`Connection ${connection?.id ?? '<unknown>'} has an invalid transport.`)
        }
        for (const reference of Array.isArray(connection?.references) ? connection.references : []) {
            validateReference(reference, `connection ${connection?.id ?? '<unknown>'}`)
        }

        for (const end of ['from', 'to']) {
            const nodeId = connection?.[end]?.node
            if (typeof nodeId !== 'string' || !nodeIds.has(nodeId)) {
                errors.push(`Connection ${connection?.id ?? '<unknown>'} has an unknown ${end} node.`)
            }
            const endpointId = connection?.[end]?.endpoint
            if (endpointId && !endpointsByNode.get(nodeId)?.has(endpointId)) {
                errors.push(`Connection ${connection?.id ?? '<unknown>'} has an unknown ${end} endpoint.`)
            }
        }
    }

    for (const reference of Array.isArray(document.references) ? document.references : []) {
        validateReference(reference, 'the system')
    }

    return {ok: errors.length === 0, errors}
}

export function documentFromActive(active) {
    if (!active) return null
    if (active.document) return active.document
    if (active.raw) return active.raw
    if (active.model?.raw) return active.model.raw
    if (active.model?.header && active.model?.nodes && active.model?.connections) return active.model
    if (active.header && active.nodes && active.connections) return active
    return null
}

export function arlFromActive(active) {
    return active?.arl ?? active?.model?.getArl?.() ?? active?.model?.arl ?? null
}
