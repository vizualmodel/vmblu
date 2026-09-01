export function hashTestArtifact(value) {
    const text = JSON.stringify(normalize(value))
    let hash = 0xcbf29ce484222325n
    for (let index = 0; index < text.length; index++) {
        hash ^= BigInt(text.charCodeAt(index))
        hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
    return `fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

function normalize(value) {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : normalize(item))

    const normalized = {}
    for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) normalized[key] = normalize(value[key])
    }
    return normalized
}
