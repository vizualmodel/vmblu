import childProcess from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import {reportSafetyEvent} from './safety-events.js'
import {isCapabilitySuppressed, suppressCapability} from './node-context.js'

const STATE_KEY = Symbol.for('vmblu.rt-als.safetyHooks')
const WRAPPED = Symbol.for('vmblu.rt-als.wrapped')

function getState() {
    if (!globalThis[STATE_KEY]) {
        globalThis[STATE_KEY] = {
            count: 0,
            restores: [],
        }
    }

    return globalThis[STATE_KEY]
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

function safeString(value) {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (value instanceof URL) return value.toString()
    return String(value)
}

function describeRequestUrl(input, options = null, protocol = '') {
    if (input instanceof URL) return input.toString()
    if (typeof input === 'string') return input
    if (input && typeof input === 'object') {
        const actualProtocol = input.protocol ?? options?.protocol ?? protocol
        const host = input.hostname ?? input.host ?? options?.hostname ?? options?.host ?? ''
        const port = input.port ?? options?.port
        const path = input.path ?? input.pathname ?? options?.path ?? options?.pathname ?? ''
        const authority = port ? `${host}:${port}` : host
        return authority ? `${actualProtocol}//${authority}${path}` : path
    }
    return safeString(input)
}

function emitCapability(cap, detail) {
    if (isCapabilitySuppressed(cap)) return
    reportSafetyEvent(cap, detail)
}

function installProcessHooks(restores) {
    wrapMethod(childProcess, 'exec', (original) => function wrappedExec(command, ...args) {
        emitCapability('proc:exec', {command: safeString(command)})
        return original.call(this, command, ...args)
    }, restores)

    wrapMethod(childProcess, 'execFile', (original) => function wrappedExecFile(file, args, options, callback) {
        const argv = Array.isArray(args) ? args : []
        emitCapability('proc:exec', {command: safeString(file), args: argv.slice()})
        return original.call(this, file, args, options, callback)
    }, restores)

    wrapMethod(childProcess, 'spawn', (original) => function wrappedSpawn(command, args, options) {
        emitCapability('proc:exec', {command: safeString(command), args: Array.isArray(args) ? args.slice() : []})
        return original.call(this, command, args, options)
    }, restores)

    wrapMethod(childProcess, 'fork', (original) => function wrappedFork(modulePath, args, options) {
        emitCapability('proc:exec', {command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : []})
        return original.call(this, modulePath, args, options)
    }, restores)
}

function installFsHooks(restores) {
    for (const key of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync']) {
        wrapMethod(fs, key, (original) => function wrappedFs(path, ...args) {
            emitCapability('fs:write', {path: safeString(path)})
            return original.call(this, path, ...args)
        }, restores)
    }

    for (const key of ['rm', 'rmSync', 'unlink', 'unlinkSync']) {
        wrapMethod(fs, key, (original) => function wrappedDelete(path, ...args) {
            emitCapability('fs:delete', {path: safeString(path)})
            return original.call(this, path, ...args)
        }, restores)
    }
}

function installFetchHook(restores) {
    if (typeof globalThis.fetch !== 'function') return

    wrapMethod(globalThis, 'fetch', (original) => function wrappedFetch(input, init) {
        const detail = {
            url: describeRequestUrl(input),
            method: init?.method ?? input?.method ?? 'GET',
        }

        emitCapability('net:egress', detail)
        return suppressCapability('net:egress', () => original.call(this, input, init))
    }, restores)
}

function installHttpHooks(restores) {
    wrapMethod(http, 'request', (original) => function wrappedHttpRequest(input, options, callback) {
        emitCapability('net:egress', {
            url: describeRequestUrl(input, options, 'http:'),
            method: options?.method ?? input?.method ?? 'GET',
        })
        return original.call(this, input, options, callback)
    }, restores)

    wrapMethod(https, 'request', (original) => function wrappedHttpsRequest(input, options, callback) {
        emitCapability('net:egress', {
            url: describeRequestUrl(input, options, 'https:'),
            method: options?.method ?? input?.method ?? 'GET',
        })
        return original.call(this, input, options, callback)
    }, restores)
}

export function installSafetyHooks({mode = 'off'} = {}) {
    if (mode === 'off') return () => {}

    const state = getState()
    state.count += 1

    if (state.count === 1) {
        state.restores = []
        installProcessHooks(state.restores)
        installFetchHook(state.restores)
        installHttpHooks(state.restores)
        installFsHooks(state.restores)
    }

    return () => {
        state.count = Math.max(0, state.count - 1)

        if (state.count > 0) return

        for (const restore of state.restores.splice(0).reverse()) restore()
    }
}
