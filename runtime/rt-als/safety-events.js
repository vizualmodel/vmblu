import {getCurrentNode} from './node-context.js'

let safetyEmitter = null

export function setSafetyEmitter(fn = null) {
    safetyEmitter = (typeof fn === 'function') ? fn : null
}

export function emitSafetyEvent(event) {
    if (!safetyEmitter) return

    try {
        safetyEmitter(event)
    } catch (error) {
        console.warn('vmblu safety emitter failed:', error)
    }
}

export function reportSafetyEvent(cap, detail = {}) {
    emitSafetyEvent({
        ts: Date.now(),
        node: getCurrentNode(),
        cap,
        detail,
    })
}
