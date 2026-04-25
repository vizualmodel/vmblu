import {AsyncLocalStorage} from 'node:async_hooks'

const nodeStorage = new AsyncLocalStorage()

function cloneStore() {
    const store = nodeStorage.getStore()
    return store ? {node: store.node, suppressCaps: new Set(store.suppressCaps ?? [])} : {node: 'UNKNOWN', suppressCaps: new Set()}
}

export function runAsNode(nodeName, fn) {
    const store = cloneStore()
    store.node = nodeName ?? 'UNKNOWN'
    return nodeStorage.run(store, fn)
}

export function getCurrentNode() {
    return nodeStorage.getStore()?.node ?? 'UNKNOWN'
}

export function suppressCapability(cap, fn) {
    const store = cloneStore()
    store.suppressCaps.add(cap)
    return nodeStorage.run(store, fn)
}

export function isCapabilitySuppressed(cap) {
    return nodeStorage.getStore()?.suppressCaps?.has(cap) ?? false
}
