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

const defaultSecurity = () => ({
    enabled: false,
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
        security: {
            ...defaults.security,
            ...(dx.security ?? {}),
        },
    }

    normalized.run.worker.on = !!normalized.run.worker.on
    normalized.run.worker.path = normalized.run.worker.path ?? ''
    normalized.monitor.logMessages = !!normalized.monitor.logMessages
    normalized.monitor.logTimings = !!normalized.monitor.logTimings
    normalized.security.enabled = !!normalized.security.enabled

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

    return target
}

function isDefault(dx = null) {

    const normalized = normalize(dx)

    return JSON.stringify(normalized) === JSON.stringify(make())
}

function makeModel() {
    return {
        run: {},
        monitor: {},
        security: {
            mode: 'warn',
            forwardEvents: true,
            defaults: {},
            allow: {},
        },
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
        security: {
            ...defaults.security,
            ...(settings.security ?? {}),
            defaults: {
                ...defaults.security.defaults,
                ...(settings.security?.defaults ?? {}),
            },
            allow: {
                ...defaults.security.allow,
                ...(settings.security?.allow ?? {}),
            },
        },
    }
}

function effectivePolicy(modelSettings = null, nodeDx = null) {
    return {
        model: normalizeModel(modelSettings),
        node: normalize(nodeDx),
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
}
