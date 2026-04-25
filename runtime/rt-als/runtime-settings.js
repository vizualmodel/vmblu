const defaultWorker = () => ({
    on: false,
    path: '',
})

const defaultSafety = () => ({
    on: false,
    mode: 'warn',
    forward: true,
})

export function makeRuntimeSettings() {
    return {
        logMessages: false,
        worker: defaultWorker(),
        safety: defaultSafety(),
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
        },
        safety: {
            ...defaults.safety,
            ...(dx.safety ?? {}),
        }
    }

    normalized.worker.on = !!normalized.worker.on
    normalized.worker.path = normalized.worker.path ?? ''
    normalized.safety.on = !!normalized.safety.on
    normalized.safety.forward = normalized.safety.forward !== false
    normalized.safety.mode = ['off', 'warn', 'enforce'].includes(normalized.safety.mode) ? normalized.safety.mode : defaults.safety.mode

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
    target.safety = target.safety ?? {}
    target.safety.on = defaults.safety.on
    target.safety.mode = defaults.safety.mode
    target.safety.forward = defaults.safety.forward

    return target
}

export function assignRuntimeSettings(target, dx = null) {

    const normalized = normalizeRuntimeSettings(dx)

    target.logMessages = normalized.logMessages
    target.worker = target.worker ?? {}
    target.worker.on = normalized.worker.on
    target.worker.path = normalized.worker.path
    target.safety = target.safety ?? {}
    target.safety.on = normalized.safety.on
    target.safety.mode = normalized.safety.mode
    target.safety.forward = normalized.safety.forward

    for (const key of Object.keys(normalized)) {
        if ((key === 'logMessages') || (key === 'worker') || (key === 'safety')) continue
        target[key] = normalized[key]
    }

    for (const key of Object.keys(target)) {
        if ((key === 'logMessages') || (key === 'worker') || (key === 'safety')) continue
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

    for (const key of Object.keys(normalized.safety)) {
        if ((key === 'on') || (key === 'mode') || (key === 'forward')) continue
        target.safety[key] = normalized.safety[key]
    }

    for (const key of Object.keys(target.safety)) {
        if ((key === 'on') || (key === 'mode') || (key === 'forward')) continue
        if (!(key in normalized.safety)) delete target.safety[key]
    }

    return target
}

export function isDefaultRuntimeSettings(dx = null) {

    const normalized = normalizeRuntimeSettings(dx)
    const workerKeys = Object.keys(normalized.worker ?? {})
    const safetyKeys = Object.keys(normalized.safety ?? {})
    const topKeys = Object.keys(normalized)

    if (normalized.logMessages) return false
    if (normalized.worker?.on) return false
    if ((normalized.worker?.path ?? '') !== '') return false
    if (normalized.safety?.on) return false
    if (normalized.safety?.mode !== 'warn') return false
    if (normalized.safety?.forward !== true) return false
    if (topKeys.some(key => !['logMessages', 'worker', 'safety'].includes(key))) return false
    if (workerKeys.some(key => !['on', 'path'].includes(key))) return false
    if (safetyKeys.some(key => !['on', 'mode', 'forward'].includes(key))) return false

    return true
}
