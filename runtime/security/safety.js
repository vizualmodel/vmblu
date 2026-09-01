import childProcess from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

import {getCurrentNode, isCapabilitySuppressed, suppressCapability} from './node-context.js'

const STATE_KEY = Symbol.for('vmblu.runtime.security')
const WRAPPED = Symbol.for('vmblu.runtime.security.wrapped')

class Safety {
    claim(owner, {security, baseDir} = {}) {
        if (!owner) throw new Error('vmblu security instrumentation requires a runtime owner')
        if (!security) return false

        const state = getState()
        if (state.owner && state.owner !== owner) {
            throw new Error('vmblu security instrumentation is already owned by another runtime in this process')
        }
        if (state.owner === owner) return true

        state.owner = owner
        state.security = security
        state.baseDir = path.resolve(baseDir || process.cwd())
        state.subscribers = new Set()
        state.restores = []

        try {
            this.installProcessHooks(state.restores)
            this.installFetchHook(state.restores)
            this.installHttpHooks(state.restores)
            this.installFsHooks(state.restores)
            return true
        }
        catch (error) {
            this.release(owner)
            throw error
        }
    }

    release(owner) {
        const state = getState()
        if (!state.owner || state.owner !== owner) return false

        for (const restore of state.restores.splice(0).reverse()) restore()
        state.subscribers.clear()
        state.owner = null
        state.security = null
        state.baseDir = null
        return true
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => {}
        const state = getState()
        state.subscribers.add(listener)
        return () => state.subscribers.delete(listener)
    }

    isOwner(owner) {
        return getState().owner === owner
    }

    get owner() {
        return getState().owner
    }

    emit(event) {
        for (const listener of [...getState().subscribers]) {
            try {
                listener(event)
            }
            catch (error) {
                console.warn('vmblu security subscriber failed:', error)
            }
        }
    }

    report(operation, detail = {}) {
        if (isCapabilitySuppressed(operation)) return null

        const state = getState()
        if (!state.owner || !state.security) return null

        const parsed = parseOperation(operation)
        const configured = operationPolicy(state.security, parsed)
        const policy = classifyPolicy(parsed, detail, configured, state.baseDir)
        const event = {
            schemaVersion: 1,
            ts: Date.now(),
            node: getCurrentNode(),
            operation: parsed.name,
            cap: legacyCapabilityName(parsed.name),
            detail,
            policy,
        }

        if (policy.decision !== 'allowed') this.emit(event)
        if (policy.decision === 'denied') throw new SecurityPolicyError(event)
        return event
    }

    installProcessHooks(restores) {
        const report = (detail) => this.report('process.exec', detail)

        for (const key of ['exec', 'execSync']) {
            wrapMethod(childProcess, key, (original) => function wrappedExec(command, ...args) {
                report({command: safeString(command), shell: true})
                return original.call(this, command, ...args)
            }, restores)
        }

        for (const key of ['execFile', 'execFileSync']) {
            wrapMethod(childProcess, key, (original) => function wrappedExecFile(file, ...rest) {
                const argv = Array.isArray(rest[0]) ? rest[0] : []
                const actualOptions = Array.isArray(rest[0]) ? rest[1] : rest[0]
                report({command: safeString(file), args: argv.slice(), shell: !!actualOptions?.shell})
                return original.call(this, file, ...rest)
            }, restores)
        }

        for (const key of ['spawn', 'spawnSync']) {
            wrapMethod(childProcess, key, (original) => function wrappedSpawn(command, ...rest) {
                const argv = Array.isArray(rest[0]) ? rest[0] : []
                const options = Array.isArray(rest[0]) ? rest[1] : rest[0]
                report({command: safeString(command), args: argv.slice(), shell: !!options?.shell})
                return original.call(this, command, ...rest)
            }, restores)
        }

        wrapMethod(childProcess, 'fork', (original) => function wrappedFork(modulePath, ...rest) {
            const argv = Array.isArray(rest[0]) ? rest[0] : []
            report({command: safeString(process.execPath), args: [safeString(modulePath), ...argv], shell: false})
            return original.call(this, modulePath, ...rest)
        }, restores)
    }

    installFsHooks(restores) {
        for (const key of ['readFile', 'readFileSync']) {
            wrapMethod(fs, key, (original) => function wrappedFsRead(target, ...args) {
                safety.report('fs.read', {path: safeString(target)})
                return original.call(this, target, ...args)
            }, restores)
        }

        for (const key of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync']) {
            wrapMethod(fs, key, (original) => function wrappedFsWrite(target, ...args) {
                safety.report('fs.write', {path: safeString(target)})
                return original.call(this, target, ...args)
            }, restores)
        }

        for (const key of ['rm', 'rmSync', 'unlink', 'unlinkSync']) {
            wrapMethod(fs, key, (original) => function wrappedFsDelete(target, ...args) {
                safety.report('fs.delete', {path: safeString(target)})
                return original.call(this, target, ...args)
            }, restores)
        }
    }

    installFetchHook(restores) {
        if (typeof globalThis.fetch !== 'function') return

        wrapMethod(globalThis, 'fetch', (original) => function wrappedFetch(input, init) {
            safety.report('net.egress', {
                url: describeRequestUrl(input),
                method: init?.method ?? input?.method ?? 'GET',
            })
            return suppressCapability('net.egress', () => original.call(this, input, init))
        }, restores)
    }

    installHttpHooks(restores) {
        wrapMethod(http, 'request', (original) => function wrappedHttpRequest(input, options, callback) {
            safety.report('net.egress', {
                url: describeRequestUrl(input, options, 'http:'),
                method: options?.method ?? input?.method ?? 'GET',
            })
            return original.call(this, input, options, callback)
        }, restores)

        wrapMethod(https, 'request', (original) => function wrappedHttpsRequest(input, options, callback) {
            safety.report('net.egress', {
                url: describeRequestUrl(input, options, 'https:'),
                method: options?.method ?? input?.method ?? 'GET',
            })
            return original.call(this, input, options, callback)
        }, restores)
    }
}

export class SecurityPolicyError extends Error {
    constructor(event) {
        super(`vmblu security policy denied ${event?.operation ?? 'operation'}`)
        this.name = 'SecurityPolicyError'
        this.event = event
    }
}

function getState() {
    if (!globalThis[STATE_KEY]) {
        globalThis[STATE_KEY] = {
            owner: null,
            security: null,
            baseDir: null,
            restores: [],
            subscribers: new Set(),
        }
    }
    return globalThis[STATE_KEY]
}

function wrapMethod(target, key, wrapFactory, restores) {
    const original = target[key]
    if (typeof original !== 'function') return
    if (original[WRAPPED]) throw new Error(`Node.js API ${key} is already wrapped by vmblu security`)

    const wrapped = wrapFactory(original)
    Object.defineProperty(wrapped, WRAPPED, {value: true})
    target[key] = wrapped
    restores.push(() => {
        if (target[key] === wrapped) target[key] = original
    })
}

function classifyPolicy(operation, detail, policy, baseDir) {
    if (!policy || policy.mode === 'deny') return denied(operation, 'operation_denied')
    if (!policy.all) {
        if (operation.area === 'fs' && !isPathAllowed(detail.path, policy.roots, baseDir)) return denied(operation, 'fs_root_not_allowed')
        if (operation.area === 'net' && !isHostAllowed(detail.url, policy.hosts)) return denied(operation, 'net_host_not_allowed')
        if (operation.area === 'process') {
            if (detail.shell) return denied(operation, 'process_shell_not_allowed')
            if (!isCommandAllowed(detail.command, policy.commands, baseDir)) return denied(operation, 'process_command_not_allowed')
        }
    }

    return {
        decision: policy.mode === 'warn' ? 'warning' : 'allowed',
        area: operation.area,
        action: operation.action,
        mode: policy.mode,
    }
}

function denied(operation, reason) {
    return {
        decision: 'denied',
        area: operation.area,
        action: operation.action,
        mode: 'deny',
        reason,
    }
}

function operationPolicy(security, operation) {
    return security?.[operation.area]?.[operation.action] ?? null
}

function isPathAllowed(value, roots = [], baseDir) {
    if (!value || !Array.isArray(roots) || !roots.length) return false
    const target = canonicalPath(value, process.cwd())
    return roots.some(root => {
        const allowed = canonicalPath(root, baseDir)
        return target === allowed || target.startsWith(`${allowed}/`)
    })
}

function canonicalPath(value, baseDir) {
    const absolute = path.resolve(baseDir, String(value ?? ''))
    let existing = absolute
    const suffix = []

    while (!fs.existsSync(existing)) {
        const parent = path.dirname(existing)
        if (parent === existing) break
        suffix.unshift(path.basename(existing))
        existing = parent
    }

    let resolved = existing
    try {
        resolved = fs.realpathSync.native(existing)
    }
    catch {
        resolved = existing
    }
    resolved = path.join(resolved, ...suffix).replaceAll('\\', '/').replace(/\/+$/, '')
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isHostAllowed(value, hosts = []) {
    try {
        const observed = new URL(String(value)).hostname.toLowerCase()
        return hosts.some(host => normalizeConfiguredHost(host) === observed)
    }
    catch {
        return false
    }
}

function normalizeConfiguredHost(value) {
    try {
        const text = String(value ?? '').trim()
        if (!text || text.includes('/') || text.includes(':')) return ''
        return new URL(`http://${text}`).hostname.toLowerCase()
    }
    catch {
        return ''
    }
}

function isCommandAllowed(value, commands = [], baseDir) {
    const observed = executableIdentity(value, baseDir)
    return !!observed && commands.some(command => executableIdentity(command, baseDir) === observed)
}

function executableIdentity(value, baseDir) {
    const command = String(value ?? '').trim()
    if (!command) return ''
    if (path.isAbsolute(command) || command.includes('/') || command.includes('\\')) return canonicalPath(command, baseDir)

    const extensions = process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
        : ['']
    for (const folder of (process.env.PATH ?? '').split(path.delimiter)) {
        for (const extension of extensions) {
            const candidate = path.join(folder, process.platform === 'win32' && !path.extname(command) ? `${command}${extension}` : command)
            if (fs.existsSync(candidate)) return canonicalPath(candidate, baseDir)
        }
    }
    return process.platform === 'win32' ? command.toLowerCase() : command
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
        const requestPath = input.path ?? input.pathname ?? options?.path ?? options?.pathname ?? ''
        const authority = port ? `${host}:${port}` : host
        return authority ? `${actualProtocol}//${authority}${requestPath}` : requestPath
    }
    return safeString(input)
}

function parseOperation(value) {
    const normalized = String(value ?? '').replace(':', '.')
    if (normalized === 'proc.exec') return {name: 'process.exec', area: 'process', action: 'exec'}
    const [area = 'unknown', action = 'unknown'] = normalized.split('.')
    return {name: `${area}.${action}`, area, action}
}

function legacyCapabilityName(value) {
    const operation = parseOperation(value)
    if (operation.name === 'process.exec') return 'proc:exec'
    return operation.name.replace('.', ':')
}

export const safety = new Safety()
