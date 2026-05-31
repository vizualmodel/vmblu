import {getCurrentNode, isCapabilitySuppressed, suppressCapability} from './node-context.js'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'

const STATE_KEY = Symbol.for('vmblu.rt-als.safetyHooks')
const WRAPPED = Symbol.for('vmblu.rt-als.wrapped')

class Safety {
    constructor() {
        this.emitter = null
        this.policyClassifier = null
    }

    setEmitter(fn = null) {
        this.emitter = (typeof fn === 'function') ? fn : null
    }

    setPolicyClassifier(fn = null) {
        this.policyClassifier = (typeof fn === 'function') ? fn : null
    }

    emit(event) {
        if (!this.emitter) return

        try {
            this.emitter(event)
        } catch (error) {
            console.warn('vmblu safety emitter failed:', error)
        }
    }

    makePolicyClassifier({runtime, runtimeSettings: modelRuntimeSettings} = {}) {
        return (event) => {
            const actor = runtime?.actors?.find?.(candidate => candidate.name === event?.node)
            const effectivePolicy = runtime?.settings?.effectivePolicy?.(modelRuntimeSettings, actor?.dx)
            if (!effectivePolicy?.security) return null

            const domain = capabilityDomain(event.cap ?? event.capability)
            const permission = effectivePolicy.security[domain]
            const allowListDecision = classifyAllowList(domain, event.detail, effectivePolicy.security.allow)
            const decision = allowListDecision?.decision
                ?? (permission === 'deny' ? 'denied' : permission === 'warn' ? 'warning' : 'allowed')

            return {
                decision,
                domain,
                permission,
                mode: effectivePolicy.mode,
                forward: effectivePolicy.forward,
                ...(allowListDecision?.reason ? {reason: allowListDecision.reason} : {}),
            }
        }
    }

    report(cap, detail = {}) {
        const event = {
            ts: Date.now(),
            node: getCurrentNode(),
            cap,
            detail,
        }

        const policy = this.classify(event)
        if (policy) event.policy = policy

        this.emit(event)
    }

    classify(event) {
        if (!this.policyClassifier) return null

        try {
            return this.policyClassifier(event) ?? null
        }
        catch (error) {
            return {
                decision: 'error',
                reason: 'policy_classifier_failed',
                message: error?.message || String(error),
            }
        }
    }

    emitCapability(cap, detail) {
        if (isCapabilitySuppressed(cap)) return
        this.report(cap, detail)
    }

    installHooks({mode = 'off'} = {}) {
        if (mode === 'off') return () => {}

        const state = getState()
        state.count += 1

        if (state.count === 1) {
            state.restores = []
            this.installProcessHooks(state.restores)
            this.installFetchHook(state.restores)
            this.installHttpHooks(state.restores)
            this.installFsHooks(state.restores)
        }

        return () => {
            state.count = Math.max(0, state.count - 1)

            if (state.count > 0) return

            for (const restore of state.restores.splice(0).reverse()) restore()
        }
    }

    installProcessHooks(restores) {
        const report = (cap, detail) => this.emitCapability(cap, detail)

        wrapMethod(childProcess, 'exec', (original) => function wrappedExec(command, ...args) {
            report('proc:exec', {command: safeString(command)})
            return original.call(this, command, ...args)
        }, restores)

        wrapMethod(childProcess, 'execFile', (original) => function wrappedExecFile(file, args, options, callback) {
            const argv = Array.isArray(args) ? args : []
            report('proc:exec', {command: safeString(file), args: argv.slice()})
            return original.call(this, file, args, options, callback)
        }, restores)

        wrapMethod(childProcess, 'spawn', (original) => function wrappedSpawn(command, args, options) {
            report('proc:exec', {command: safeString(command), args: Array.isArray(args) ? args.slice() : []})
            return original.call(this, command, args, options)
        }, restores)

        wrapMethod(childProcess, 'fork', (original) => function wrappedFork(modulePath, args, options) {
            report('proc:exec', {command: safeString(modulePath), args: Array.isArray(args) ? args.slice() : []})
            return original.call(this, modulePath, args, options)
        }, restores)
    }

    installFsHooks(restores) {
        const report = (cap, detail) => this.emitCapability(cap, detail)

        for (const key of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync']) {
            wrapMethod(fs, key, (original) => function wrappedFs(path, ...args) {
                report('fs:write', {path: safeString(path)})
                return original.call(this, path, ...args)
            }, restores)
        }

        for (const key of ['rm', 'rmSync', 'unlink', 'unlinkSync']) {
            wrapMethod(fs, key, (original) => function wrappedDelete(path, ...args) {
                report('fs:delete', {path: safeString(path)})
                return original.call(this, path, ...args)
            }, restores)
        }
    }

    installFetchHook(restores) {
        if (typeof globalThis.fetch !== 'function') return

        const report = (cap, detail) => this.emitCapability(cap, detail)

        wrapMethod(globalThis, 'fetch', (original) => function wrappedFetch(input, init) {
            const detail = {
                url: describeRequestUrl(input),
                method: init?.method ?? input?.method ?? 'GET',
            }

            report('net:egress', detail)
            return suppressCapability('net:egress', () => original.call(this, input, init))
        }, restores)
    }

    installHttpHooks(restores) {
        const report = (cap, detail) => this.emitCapability(cap, detail)

        wrapMethod(http, 'request', (original) => function wrappedHttpRequest(input, options, callback) {
            report('net:egress', {
                url: describeRequestUrl(input, options, 'http:'),
                method: options?.method ?? input?.method ?? 'GET',
            })
            return original.call(this, input, options, callback)
        }, restores)

        wrapMethod(https, 'request', (original) => function wrappedHttpsRequest(input, options, callback) {
            report('net:egress', {
                url: describeRequestUrl(input, options, 'https:'),
                method: options?.method ?? input?.method ?? 'GET',
            })
            return original.call(this, input, options, callback)
        }, restores)
    }

    enable({mode = 'off'} = {}, tx = null) {
        if (mode === 'off') {
            this.setEmitter(null)
            return {uninstall() {}}
        }

        this.setEmitter((event) => {
            tx?.send?.('security.event', event)
        })

        const uninstallHooks = this.installHooks({mode})

        return {
            uninstall: () => {
                uninstallHooks()
                this.setEmitter(null)
            }
        }
    }
}

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

function capabilityDomain(cap) {
    if (cap?.startsWith?.('fs:')) return 'fs'
    if (cap?.startsWith?.('net:')) return 'net'
    if (cap?.startsWith?.('proc:')) return 'process'
    return 'unknown'
}

function classifyAllowList(domain, detail = {}, allow = {}) {
    if (domain === 'fs' && allow.fsRoots?.length && detail?.path) {
        return isPathAllowed(detail.path, allow.fsRoots)
            ? null
            : {decision: 'denied', reason: 'fs_root_not_allowed'}
    }

    if (domain === 'net' && allow.netHosts?.length && detail?.url) {
        return isHostAllowed(detail.url, allow.netHosts)
            ? null
            : {decision: 'denied', reason: 'net_host_not_allowed'}
    }

    return null
}

function isPathAllowed(value, roots = []) {
    const target = normalizePath(value)
    return roots.some(root => {
        const normalizedRoot = normalizePath(root)
        return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`)
    })
}

function normalizePath(value) {
    return String(value ?? '').replaceAll('\\', '/').replace(/\/+$/, '')
}

function isHostAllowed(value, hosts = []) {
    try {
        const host = new URL(String(value)).hostname
        return hosts.includes(host)
    }
    catch {
        return false
    }
}

export const safety = new Safety()
