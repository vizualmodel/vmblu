import {CORE_VERSION, SCHEMA_VERSION} from './release-version.js'

import {compatibilityFamily} from './version-policy.js'
export {compatibilityFamily} from './version-policy.js'

export function canonicalJson(value) {
    return JSON.stringify(normalize(value))
}

export function sourceHash(value) {
    const text = typeof value === 'string' ? value : canonicalJson(value)
    let hash = 0xcbf29ce484222325n
    for (let i = 0; i < text.length; i++) {
        hash ^= BigInt(text.charCodeAt(i))
        hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
    return `fnv1a64:${hash.toString(16).padStart(16, '0')}`
}

export function makeArtifactProvenance({
    artifact,
    model,
    source,
    generatorName = '@vizualmodel/vmblu-core',
    generatorVersion = CORE_VERSION,
    schemaVersion = SCHEMA_VERSION,
} = {}) {
    if (!artifact) throw new Error('Artifact provenance requires an artifact kind')
    if (!model) throw new Error('Artifact provenance requires a model identity')

    return {
        generated: true,
        artifact,
        compatibilityFamily: compatibilityFamily(generatorVersion),
        schemaVersion,
        generator: {
            name: generatorName,
            version: generatorVersion,
        },
        source: {
            model,
            hash: sourceHash(sourceWithoutPinBundles(source)),
        },
    }
}

// Bundle membership is visualization data even in the combined in-memory raw model.
function sourceWithoutPinBundles(source) {
    if (!source?.root || typeof source !== 'object') return source
    const withoutBundles = node => ({
        ...node,
        ...(node.interfaces ? {interfaces: node.interfaces.map(iface => ({...iface,
            pins: iface.pins.map(pin => {
                const {bundleWids, ...semanticPin} = pin
                return semanticPin
            }),
        }))} : {}),
        ...(node.nodes ? {nodes: node.nodes.map(withoutBundles)} : {}),
    })
    return {...source, root: withoutBundles(source.root)}
}

function normalize(value) {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(item => item === undefined ? null : normalize(item))
    if (typeof value.toJSON === 'function') return normalize(value.toJSON())

    const normalized = {}
    for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) normalized[key] = normalize(value[key])
    }
    return normalized
}
