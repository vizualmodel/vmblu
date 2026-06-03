const PERMISSIONS = ['allow', 'warn', 'deny']
const PERMISSION_ORDER = {deny: 0, warn: 1, allow: 2}

const defaultWorker = () => ({
    on: false,
    path: '',
})

const defaultRun = () => ({
    worker: defaultWorker(),
})

const defaultMonitor = () => ({
    logMessages: false,
    logTimings: false,
})

const defaultFsOperation = (mode = 'deny') => ({
    mode,
    roots: [],
})

const defaultNetOperation = (mode = 'deny') => ({
    mode,
    hosts: [],
})

const defaultProcessOperation = (mode = 'deny') => ({
    mode,
    commands: [],
})

const defaultSecurityPolicy = () => ({
    fs: {
        read: defaultFsOperation(),
        write: defaultFsOperation(),
        delete: defaultFsOperation(),
    },
    net: {
        egress: defaultNetOperation(),
    },
    process: {
        exec: defaultProcessOperation(),
    },
})

const defaultSecurity = () => ({
    enabled: false,
    ...defaultSecurityPolicy(),
})

function make() {
    return {
        run: defaultRun(),
        monitor: defaultMonitor(),
        security: defaultSecurity(),
    }
}

function normalize(dx = null) {

    const defaults = make()

    if (!dx || typeof dx !== 'object') return defaults

    const legacySafety = dx.safety ?? {}
    const security = normalizeNodeSecurity(dx.security, legacySafety)

    const normalized = {
        run: {
            ...defaults.run,
            ...(dx.run ?? {}),
            worker: {
                ...defaults.run.worker,
                ...(dx.run?.worker ?? dx.worker ?? {}),
            },
        },
        monitor: {
            ...defaults.monitor,
            ...(dx.monitor ?? {}),
            logMessages: dx.monitor?.logMessages ?? dx.logMessages ?? defaults.monitor.logMessages,
        },
        security,
    }

    normalized.run.worker.on = !!normalized.run.worker.on
    normalized.run.worker.path = normalized.run.worker.path ?? ''
    normalized.monitor.logMessages = !!normalized.monitor.logMessages
    normalized.monitor.logTimings = !!normalized.monitor.logTimings

    return normalized
}

function clone(dx = null) {
    return normalize(dx)
}

function reset(target) {

    const defaults = make()

    assign(target, defaults)

    return target
}

function assign(target, dx = null) {

    const normalized = normalize(dx)

    target.run = structuredClone(normalized.run)
    target.monitor = structuredClone(normalized.monitor)
    target.security = structuredClone(normalized.security)

    delete target.logMessages
    delete target.worker
    delete target.safety

    return target
}

function isDefault(dx = null) {

    const normalized = normalize(dx)
    const defaults = make()

    if (!normalized.security.enabled || isDefaultSecurityPolicy(normalized.security)) {
        normalized.security = structuredClone(defaults.security)
    }

    return JSON.stringify(normalized) === JSON.stringify(defaults)
}

function makeModel() {
    return {
        run: {},
        monitor: {},
        security: defaultSecurityPolicy(),
    }
}

function normalizeModel(settings = null) {
    const defaults = makeModel()
    if (!settings || typeof settings !== 'object') return defaults

    return {
        run: {
            ...defaults.run,
            ...(settings.run ?? {}),
        },
        monitor: {
            ...defaults.monitor,
            ...(settings.monitor ?? {}),
        },
        security: normalizeModelSecurity(settings.security),
    }
}

function effectivePolicy(modelSettings = null, nodeDx = null) {
    const hasModelSecurity = !!(modelSettings && typeof modelSettings === 'object' && modelSettings.security)
    const model = normalizeModel(modelSettings)
    const node = normalize(nodeDx)
    const nodeSecurity = node.security?.enabled ? node.security : defaultSecurity()

    return {
        active: hasModelSecurity,
        security: intersectSecurity(model.security, nodeSecurity),
        model,
        node,
    }
}

function normalizeNodeSecurity(security = null, legacySafety = {}) {
    const source = security ?? {}
    const legacy = legacyNodeSecurity(source)
    const enabled = source.enabled ?? legacySafety.on ?? false

    return {
        enabled: !!enabled,
        ...normalizeSecurityPolicy(source, legacy),
    }
}

function normalizeModelSecurity(security = null) {
    return normalizeSecurityPolicy(security, legacyModelSecurity(security))
}

function normalizeSecurityPolicy(source = null, legacy = {}) {
    const defaults = defaultSecurityPolicy()
    const value = source ?? {}

    return {
        fs: {
            read: normalizeFsOperation(value.fs?.read ?? legacy.fs?.read ?? defaults.fs.read),
            write: normalizeFsOperation(value.fs?.write ?? legacy.fs?.write ?? defaults.fs.write),
            delete: normalizeFsOperation(value.fs?.delete ?? legacy.fs?.delete ?? defaults.fs.delete),
        },
        net: {
            egress: normalizeNetOperation(value.net?.egress ?? legacy.net?.egress ?? defaults.net.egress),
        },
        process: {
            exec: normalizeProcessOperation(value.process?.exec ?? legacy.process?.exec ?? defaults.process.exec),
        },
    }
}

function normalizeFsOperation(value = null) {
    const mode = normalizeMode(value?.mode)
    return {
        mode,
        roots: mode === 'deny' ? [] : normalizeList(value?.roots),
    }
}

function normalizeNetOperation(value = null) {
    const mode = normalizeMode(value?.mode)
    return {
        mode,
        hosts: mode === 'deny' ? [] : normalizeList(value?.hosts),
    }
}

function normalizeProcessOperation(value = null) {
    const mode = normalizeMode(value?.mode)
    return {
        mode,
        commands: mode === 'deny' ? [] : normalizeList(value?.commands),
    }
}

function normalizeMode(value) {
    return PERMISSIONS.includes(value) ? value : 'deny'
}

function normalizeList(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(item => String(item)) : []
}

function legacyModelSecurity(security = null) {
    if (!security?.defaults && !security?.allow) return {}

    const defaults = security.defaults ?? {}
    const allow = security.allow ?? {}

    return {
        fs: {
            read: defaultFsOperation('deny'),
            write: {mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots)},
            delete: {mode: normalizeLegacyMode(defaults.fs), roots: normalizeList(allow.fsRoots)},
        },
        net: {
            egress: {mode: normalizeLegacyMode(defaults.net), hosts: normalizeList(allow.netHosts)},
        },
        process: {
            exec: {mode: normalizeLegacyMode(defaults.process), commands: []},
        },
    }
}

function legacyNodeSecurity(security = null) {
    if (!security?.request) return {}

    const request = security.request ?? {}
    const allow = request.allow ?? {}

    return {
        fs: {
            read: defaultFsOperation('deny'),
            write: {mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots)},
            delete: {mode: normalizeLegacyMode(request.fs), roots: normalizeList(allow.fsRoots)},
        },
        net: {
            egress: {mode: normalizeLegacyMode(request.net), hosts: normalizeList(allow.netHosts)},
        },
        process: {
            exec: {mode: normalizeLegacyMode(request.process), commands: []},
        },
    }
}

function normalizeLegacyMode(value) {
    return value === 'inherit' ? 'deny' : normalizeMode(value)
}

function intersectSecurity(model, node) {
    return {
        fs: {
            read: intersectFsOperation(model.fs.read, node.fs.read),
            write: intersectFsOperation(model.fs.write, node.fs.write),
            delete: intersectFsOperation(model.fs.delete, node.fs.delete),
        },
        net: {
            egress: intersectNetOperation(model.net.egress, node.net.egress),
        },
        process: {
            exec: intersectProcessOperation(model.process.exec, node.process.exec),
        },
    }
}

function intersectFsOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode)
    return {
        mode,
        roots: mode === 'deny' ? [] : intersectScope(model.roots, node.roots),
    }
}

function intersectNetOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode)
    return {
        mode,
        hosts: mode === 'deny' ? [] : intersectScope(model.hosts, node.hosts),
    }
}

function intersectProcessOperation(model, node) {
    const mode = stricterMode(model.mode, node.mode)
    return {
        mode,
        commands: mode === 'deny' ? [] : intersectScope(model.commands, node.commands),
    }
}

function stricterMode(modelMode, nodeMode) {
    return PERMISSION_ORDER[nodeMode] <= PERMISSION_ORDER[modelMode] ? nodeMode : modelMode
}

function intersectScope(modelValues = [], nodeValues = []) {
    if (!Array.isArray(modelValues) || !modelValues.length) return Array.isArray(nodeValues) ? nodeValues.slice() : []
    if (!Array.isArray(nodeValues) || !nodeValues.length) return modelValues.slice()
    const allowed = new Set(modelValues)
    return nodeValues.filter(value => allowed.has(value))
}

function isDefaultSecurityPolicy(security = {}) {
    const {enabled, ...policy} = security
    return JSON.stringify(policy) === JSON.stringify(defaultSecurityPolicy())
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
}
