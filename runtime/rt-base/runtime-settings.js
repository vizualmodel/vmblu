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

function make() {
    return {
        run: defaultRun(),
        monitor: defaultMonitor(),
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

    delete target.logMessages
    delete target.worker
    delete target.security

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
