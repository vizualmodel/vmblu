const PRIMITIVE_SCHEMA_TYPES = new Set(['string', 'number', 'boolean', 'integer', 'object', 'array', 'null'])

export const ANY_PAYLOAD_SCHEMA = Object.freeze({type: 'object'})
export const CAPABILITY_ID_PATTERN = /^[A-Za-z0-9_.-]+$/

export function schemaFromPinContract(pin, vmbluTypes = null, direction = 'request') {
    const payload = pin?.contract?.payload
    if (!payload) return {...ANY_PAYLOAD_SCHEMA}

    if (typeof payload === 'object' && payload !== null) {
        const selected = direction === 'reply'
            ? payload.reply
            : (payload.request ?? payload.payload)
        return schemaFromVmbluType(selected, vmbluTypes)
    }

    return schemaFromVmbluType(payload, vmbluTypes)
}

export function schemaFromVmbluType(typeName, vmbluTypes = null, ancestors = new Set()) {
    if (!typeName || typeName === 'any') return {...ANY_PAYLOAD_SCHEMA}
    if (typeof typeName !== 'string') return {...ANY_PAYLOAD_SCHEMA}

    const lower = typeName.toLowerCase()
    if (PRIMITIVE_SCHEMA_TYPES.has(lower)) return {type: lower}
    if (lower === 'int') return {type: 'integer'}
    if (lower === 'float') return {type: 'number'}

    const typeMap = normalizeTypeMap(vmbluTypes)
    const def = typeMap?.[typeName]
    if (!def || ancestors.has(typeName)) return {type: 'object', title: typeName}

    const nextAncestors = new Set(ancestors)
    nextAncestors.add(typeName)
    const kind = def.kind ?? (def.fields ? 'object' : def.items ? 'array' : def.external ? 'external' : 'primitive')

    if (kind === 'object') {
        const properties = {}
        for (const [fieldName, field] of Object.entries(def.fields ?? {})) {
            properties[fieldName] = schemaFromVmbluType(field.vmbluType, typeMap, nextAncestors)
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
            items: schemaFromVmbluType(def.items?.vmbluType, typeMap, nextAncestors)
        }
        if (def.summary) schema.description = def.summary
        return schema
    }

    if (kind === 'primitive') {
        return schemaFromVmbluType(def.vmbluType || 'string', typeMap, nextAncestors)
    }

    return {type: 'object', title: typeName, description: def.summary || `External type ${typeName}.`}
}

export function hasReplyContract(pin) {
    const payload = pin?.contract?.payload
    return !!(payload && typeof payload === 'object' && payload.reply)
}

export function makeCapabilityId(nodePath, name) {
    const parts = [...(Array.isArray(nodePath) ? nodePath : [nodePath]), name]
        .map(slugCapabilityPart)
        .filter(Boolean)
    return parts.join('.') || 'capability'
}

export function isValidCapabilityId(value) {
    return CAPABILITY_ID_PATTERN.test(String(value ?? ''))
}

export function capabilityTitle(value) {
    return String(value ?? '')
        .replace(/[-_.]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, char => char.toUpperCase())
}

function slugCapabilityPart(value) {
    return String(value ?? '')
        .trim()
        .replace(/[^A-Za-z0-9_.-]+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
}

function normalizeTypeMap(value) {
    if (typeof value !== 'string') return value ?? null
    try {
        return JSON.parse(value)
    }
    catch {
        return null
    }
}
