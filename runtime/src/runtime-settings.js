const defaultWorker = () => ({
    on: false,
    path: '',
})

export function makeRuntimeSettings() {
    return {
        logMessages: false,
        worker: defaultWorker(),
    }
}

export function normalizeRuntimeSettings(dx = null) {

    const defaults = makeRuntimeSettings()

    if (!dx || typeof dx !== 'object') return defaults

    const normalized = {
        ...dx,
        logMessages: !!dx.logMessages,
        worker: {
            ...defaults.worker,
            ...(dx.worker ?? {}),
        }
    }

    normalized.worker.on = !!normalized.worker.on
    normalized.worker.path = normalized.worker.path ?? ''

    return normalized
}

export function cloneRuntimeSettings(dx = null) {
    return normalizeRuntimeSettings(dx)
}

export function resetRuntimeSettings(target) {

    const defaults = makeRuntimeSettings()

    target.logMessages = defaults.logMessages
    target.worker = target.worker ?? {}
    target.worker.on = defaults.worker.on
    target.worker.path = defaults.worker.path

    return target
}

export function assignRuntimeSettings(target, dx = null) {

    const normalized = normalizeRuntimeSettings(dx)

    target.logMessages = normalized.logMessages
    target.worker = target.worker ?? {}
    target.worker.on = normalized.worker.on
    target.worker.path = normalized.worker.path

    for (const key of Object.keys(normalized)) {
        if ((key === 'logMessages') || (key === 'worker')) continue
        target[key] = normalized[key]
    }

    for (const key of Object.keys(target)) {
        if ((key === 'logMessages') || (key === 'worker')) continue
        if (!(key in normalized)) delete target[key]
    }

    for (const key of Object.keys(normalized.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        target.worker[key] = normalized.worker[key]
    }

    for (const key of Object.keys(target.worker)) {
        if ((key === 'on') || (key === 'path')) continue
        if (!(key in normalized.worker)) delete target.worker[key]
    }

    return target
}

export function isDefaultRuntimeSettings(dx = null) {

    const normalized = normalizeRuntimeSettings(dx)
    const workerKeys = Object.keys(normalized.worker ?? {})
    const topKeys = Object.keys(normalized)

    if (normalized.logMessages) return false
    if (normalized.worker?.on) return false
    if ((normalized.worker?.path ?? '') !== '') return false
    if (topKeys.some(key => !['logMessages', 'worker'].includes(key))) return false
    if (workerKeys.some(key => !['on', 'path'].includes(key))) return false

    return true
}
