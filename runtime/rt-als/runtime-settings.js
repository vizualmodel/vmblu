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

const defaultSecurityRequest = () => ({
    fs: 'inherit',
    net: 'inherit',
    process: 'inherit',
    allow: {
        netHosts: [],
        fsRoots: [],
    },
})

const defaultSecurity = () => ({
    enabled: false,
    mode: 'warn',
    forward: true,
    request: defaultSecurityRequest(),
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
        security: normalizeSecuritySettings(dx.security, legacySafety, defaults.security),
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

    return JSON.stringify(normalized) === JSON.stringify(make())
}

const defaultModelSecurity = () => ({
    mode: 'warn',
    forwardEvents: true,
    defaults: {
        fs: 'warn',
        net: 'warn',
        process: 'deny',
    },
    allow: {
        netHosts: [],
        fsRoots: [],
    },
})

function makeModel() {
    return {
        run: {},
        monitor: {},
        security: defaultModelSecurity(),
    }
}

function normalizeModel(settings = null) {
    const defaults = makeModel()
    if (!settings || typeof settings !== 'object') return defaults

    const security = settings.security ?? {}
    const normalized = {
        run: {
            ...defaults.run,
            ...(settings.run ?? {}),
        },
        monitor: {
            ...defaults.monitor,
            ...(settings.monitor ?? {}),
        },
        security: {
            ...defaults.security,
            ...security,
            defaults: {
                ...defaults.security.defaults,
                ...(security.defaults ?? {}),
            },
            allow: {
                ...defaults.security.allow,
                ...(security.allow ?? {}),
            },
        },
    }

    normalized.security.mode = ['off', 'warn', 'enforce'].includes(normalized.security.mode) ? normalized.security.mode : defaults.security.mode
    normalized.security.forwardEvents = normalized.security.forwardEvents !== false
    normalized.security.defaults.fs = normalizePermission(normalized.security.defaults.fs)
    normalized.security.defaults.net = normalizePermission(normalized.security.defaults.net)
    normalized.security.defaults.process = normalizePermission(normalized.security.defaults.process)
    normalized.security.allow.netHosts = Array.isArray(normalized.security.allow.netHosts) ? normalized.security.allow.netHosts : []
    normalized.security.allow.fsRoots = Array.isArray(normalized.security.allow.fsRoots) ? normalized.security.allow.fsRoots : []

    return normalized
}

function effectivePolicy(modelSettings = null, nodeDx = null) {
    const model = normalizeModel(modelSettings)
    const node = normalize(nodeDx)
    const request = node.security?.enabled ? node.security.request : defaultSecurityRequest()

    return {
        mode: node.security?.enabled ? node.security.mode : model.security.mode,
        forward: node.security?.enabled ? node.security.forward : model.security.forwardEvents,
        security: {
            fs: clipPermission(resolvePermission(request.fs, model.security.defaults.fs), model.security.defaults.fs),
            net: clipPermission(resolvePermission(request.net, model.security.defaults.net), model.security.defaults.net),
            process: clipPermission(resolvePermission(request.process, model.security.defaults.process), model.security.defaults.process),
            allow: intersectAllowLists(model.security.allow, request.allow),
        },
        model,
        node,
    }
}

function normalizeSecuritySettings(security = null, legacySafety = {}, defaults = defaultSecurity()) {
    const source = security ?? {}
    const request = source.request ?? {}
    const allow = request.allow ?? {}
    const normalized = {
        ...defaults,
        ...source,
        enabled: source.enabled ?? legacySafety.on ?? defaults.enabled,
        mode: source.mode ?? legacySafety.mode ?? defaults.mode,
        forward: source.forward ?? legacySafety.forward ?? defaults.forward,
        request: {
            ...defaults.request,
            ...request,
            allow: {
                ...defaults.request.allow,
                ...allow,
            },
        },
    }

    normalized.enabled = !!normalized.enabled
    normalized.forward = normalized.forward !== false
    normalized.mode = ['off', 'warn', 'enforce'].includes(normalized.mode) ? normalized.mode : defaults.mode
    normalized.request.fs = normalizePermission(normalized.request.fs)
    normalized.request.net = normalizePermission(normalized.request.net)
    normalized.request.process = normalizePermission(normalized.request.process)
    normalized.request.allow.netHosts = Array.isArray(normalized.request.allow.netHosts) ? normalized.request.allow.netHosts : []
    normalized.request.allow.fsRoots = Array.isArray(normalized.request.allow.fsRoots) ? normalized.request.allow.fsRoots : []

    return normalized
}

function normalizePermission(value) {
    return ['inherit', 'allow', 'warn', 'deny'].includes(value) ? value : 'inherit'
}

function resolvePermission(requested, fallback) {
    return requested === 'inherit' ? fallback : requested
}

function clipPermission(requested, envelope) {
    const order = {deny: 0, warn: 1, allow: 2, inherit: 1}
    return order[requested] <= order[envelope] ? requested : envelope
}

function intersectAllowLists(modelAllow = {}, nodeAllow = {}) {
    return {
        netHosts: intersect(modelAllow.netHosts, nodeAllow.netHosts),
        fsRoots: intersect(modelAllow.fsRoots, nodeAllow.fsRoots),
    }
}

function intersect(modelValues = [], nodeValues = []) {
    if (!Array.isArray(modelValues) || !modelValues.length) return []
    if (!Array.isArray(nodeValues) || !nodeValues.length) return modelValues.slice()
    const allowed = new Set(modelValues)
    return nodeValues.filter(value => allowed.has(value))
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
