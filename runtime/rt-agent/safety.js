import {getCurrentNode, isCapabilitySuppressed, suppressCapability} from './node-context.js'

const STATE_KEY = Symbol.for('vmblu.rt-agent.safetyHooks')
const WRAPPED = Symbol.for('vmblu.rt-agent.wrapped')

let safetyEmitter = null

function getState() {
    if (!globalThis[STATE_KEY]) {
        globalThis[STATE_KEY] = {
            count: 0,
            restores: [],
        }
    }

    return globalThis[STATE_KEY]
}

function setSafetyEmitter(emitter) {
    safetyEmitter = emitter
}

function reportSafetyEvent(capability, detail = {}) {
    safetyEmitter?.({
        kind: 'security.event',
        capability,
        node: getCurrentNode(),
        detail,
        timestamp: new Date().toISOString(),
    })
}

function wrapMethod(target, key, wrapFactory, restores) {
    const original = target[key]

    if (typeof original !== 'function') return
    if (original[WRAPPED]) return

    const wrapped = wrapFactory(original)
    wrapped[WRAPPED] = true
    target[key] = wrapped
    restores.push(() => {
        if (target[key] === wrapped) target[key] = original
    })
}

function describeRequestUrl(input) {
    if (input instanceof URL) return input.toString()
    if (typeof input === 'string') return input
    if (input?.url) return String(input.url)
    return String(input ?? '')
}

function emitCapability(capability, detail) {
    if (isCapabilitySuppressed(capability)) return
    reportSafetyEvent(capability, detail)
}

function installFetchHook(restores) {
    if (typeof globalThis.fetch !== 'function') return

    wrapMethod(globalThis, 'fetch', (original) => function wrappedFetch(input, init) {
        emitCapability('net:egress', {
            url: describeRequestUrl(input),
            method: init?.method ?? input?.method ?? 'GET',
        })

        return suppressCapability('net:egress', () => original.call(this, input, init))
    }, restores)
}

function installSafetyHooks({mode = 'off'} = {}) {
    if (mode === 'off') return () => {}

    const state = getState()
    state.count += 1

    if (state.count === 1) {
        state.restores = []
        installFetchHook(state.restores)
    }

    return () => {
        state.count = Math.max(0, state.count - 1)

        if (state.count > 0) return

        for (const restore of state.restores.splice(0).reverse()) restore()
    }
}

export function enableSafety({mode = 'off'} = {}, tx = null) {
    if (mode === 'off') {
        setSafetyEmitter(null)
        return {uninstall() {}}
    }

    setSafetyEmitter((event) => {
        tx?.send?.('security.event', event)
    })

    const uninstallHooks = installSafetyHooks({mode})

    return {
        uninstall() {
            uninstallHooks()
            setSafetyEmitter(null)
        }
    }
}
