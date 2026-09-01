import {runtimeSettings as baseSettings} from '../rt-base/runtime-settings.js'

const MODES = new Set(['allow', 'warn', 'deny'])

const denyOperation = () => ({mode: 'deny'})

const defaultSecurityPolicy = () => ({
    enabled: true,
    fs: {
        read: denyOperation(),
        write: denyOperation(),
        delete: denyOperation(),
    },
    net: {
        egress: denyOperation(),
    },
    process: {
        exec: denyOperation(),
    },
})

function make() {
    return baseSettings.make()
}

function normalize(dx = null) {
    return baseSettings.normalize(dx)
}

function clone(dx = null) {
    return baseSettings.clone(dx)
}

function reset(target) {
    return baseSettings.reset(target)
}

function assign(target, dx = null) {
    return baseSettings.assign(target, dx)
}

function isDefault(dx = null) {
    return baseSettings.isDefault(dx)
}

function makeModel() {
    return {
        ...baseSettings.makeModel(),
        security: defaultSecurityPolicy(),
    }
}

function normalizeModel(settings = null) {
    const base = baseSettings.normalizeModel(settings)
    if (!settings || typeof settings !== 'object' || !settings.security) return base

    return {
        ...base,
        security: normalizeModelSecurity(settings.security),
    }
}

function effectivePolicy(modelSettings = null) {
    const model = normalizeModel(modelSettings)
    return {
        active: !!model.security && model.security.enabled !== false,
        security: model.security ?? null,
        model,
    }
}

function normalizeModelSecurity(security = null) {
    const legacy = legacyModelSecurity(security)
    const source = legacy ?? security ?? {}

    return {
        enabled: source.enabled !== false,
        fs: {
            read: normalizeOperation(source.fs?.read, 'roots'),
            write: normalizeOperation(source.fs?.write, 'roots'),
            delete: normalizeOperation(source.fs?.delete, 'roots'),
        },
        net: {
            egress: normalizeOperation(source.net?.egress, 'hosts'),
        },
        process: {
            exec: normalizeOperation(source.process?.exec, 'commands'),
        },
    }
}

function normalizeOperation(value = null, scopeKey) {
    const mode = MODES.has(value?.mode) ? value.mode : 'deny'
    if (mode === 'deny') return denyOperation()
    if (value?.all === true) return {mode, all: true}

    const scope = normalizeList(value?.[scopeKey])
    return scope.length ? {mode, [scopeKey]: scope} : denyOperation()
}

function normalizeList(value) {
    if (!Array.isArray(value)) return []
    return [...new Set(value
        .filter(item => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean))]
}

function legacyModelSecurity(security = null) {
    if (!security || (!security.defaults && !security.allow && !security.mode && security.forwardEvents == null)) return null

    const defaults = security.defaults ?? {}
    const allow = security.allow ?? {}
    const fsRoots = normalizeList(allow.fsRoots)
    const hosts = normalizeList(allow.netHosts)

    return {
        enabled: security.mode !== 'off',
        fs: {
            read: denyOperation(),
            write: legacyOperation(defaults.fs, 'roots', fsRoots),
            delete: legacyOperation(defaults.fs, 'roots', fsRoots),
        },
        net: {
            egress: legacyOperation(defaults.net, 'hosts', hosts),
        },
        process: {
            exec: legacyOperation(defaults.process, 'commands', []),
        },
    }
}

function legacyOperation(value, scopeKey, scope) {
    const mode = MODES.has(value) ? value : 'deny'
    if (mode === 'deny') return denyOperation()
    return scope.length ? {mode, [scopeKey]: scope} : {mode, all: true}
}

function validateModel(settings = null) {
    const errors = []
    if (!settings || typeof settings !== 'object' || !settings.security) return errors
    const security = settings.security

    if (legacyModelSecurity(security)) {
        errors.push({code: 'legacy_security', path: 'security', message: 'legacy application security settings are deprecated'})
        return errors
    }

    validateKeys(errors, security, ['enabled', 'fs', 'net', 'process'], 'security')
    if (security.enabled != null && typeof security.enabled !== 'boolean') {
        errors.push({code: 'malformed_security', path: 'security.enabled', message: 'security.enabled must be a boolean'})
    }
    validateKeys(errors, security.fs, ['read', 'write', 'delete'], 'security.fs')
    validateKeys(errors, security.net, ['egress'], 'security.net')
    validateKeys(errors, security.process, ['exec'], 'security.process')
    validateOperation(errors, security.fs?.read, 'roots', 'security.fs.read')
    validateOperation(errors, security.fs?.write, 'roots', 'security.fs.write')
    validateOperation(errors, security.fs?.delete, 'roots', 'security.fs.delete')
    validateOperation(errors, security.net?.egress, 'hosts', 'security.net.egress')
    validateOperation(errors, security.process?.exec, 'commands', 'security.process.exec')
    return errors
}

function validateKeys(errors, value, allowed, location) {
    if (value == null) return
    if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({code: 'malformed_security', path: location, message: `${location} must be an object`})
        return
    }
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) errors.push({code: 'unknown_security_field', path: `${location}.${key}`, message: `unknown security field ${location}.${key}`})
    }
}

function validateOperation(errors, value, scopeKey, location) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({code: 'malformed_security', path: location, message: `${location} must be an object`})
        return
    }
    validateKeys(errors, value, ['mode', 'all', scopeKey], location)
    if (!MODES.has(value.mode)) errors.push({code: 'invalid_security_mode', path: `${location}.mode`, message: `${location}.mode must be allow, warn, or deny`})

    const hasAll = value.all === true
    const hasScope = Array.isArray(value[scopeKey]) && value[scopeKey].length > 0
    if (value.mode === 'deny' && (value.all != null || value[scopeKey] != null)) {
        errors.push({code: 'invalid_security_scope', path: location, message: `${location} deny mode cannot define a scope`})
    }
    else if (value.mode !== 'deny' && hasAll === hasScope) {
        errors.push({code: 'invalid_security_scope', path: location, message: `${location} must define either all: true or a non-empty ${scopeKey} array`})
    }
    if (value[scopeKey] != null && (!Array.isArray(value[scopeKey]) || value[scopeKey].some(item => typeof item !== 'string' || !item.trim()))) {
        errors.push({code: 'invalid_security_scope', path: `${location}.${scopeKey}`, message: `${location}.${scopeKey} must contain non-empty strings`})
    }
    else if (Array.isArray(value[scopeKey])) {
        for (const item of value[scopeKey]) {
            if (!validScopeValue(item, scopeKey)) {
                errors.push({code: 'invalid_security_target', path: `${location}.${scopeKey}`, message: `${location}.${scopeKey} contains an invalid ${scopeKey} value: ${item}`})
            }
        }
    }
}

function validScopeValue(value, scopeKey) {
    if (typeof value !== 'string' || !value.trim() || value.includes('\0')) return false
    if (scopeKey !== 'hosts') return true
    const text = value.trim()
    if (text.includes('/') || text.includes(':')) return false
    try {
        const parsed = new URL(`http://${text}`)
        return !!parsed.hostname && parsed.pathname === '/'
    }
    catch {
        return false
    }
}

export const runtimeSettings = {
    make,
    normalize,
    clone,
    reset,
    assign,
    isDefault,
    makeModel,
    normalizeModel,
    effectivePolicy,
    validateModel,
}
