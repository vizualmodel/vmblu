export function runtimeSettingsForSave(dx) {
    if (!dx || typeof dx !== 'object') return null
    const next = structuredClone(dx)
    delete next.security
    return hasValues(next) ? next : null
}

function hasValues(value) {
    if (value == null) return false
    if (Array.isArray(value)) return value.some(hasValues)
    if (typeof value === 'object') return Object.values(value).some(hasValues)
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return !!value
    return true
}
