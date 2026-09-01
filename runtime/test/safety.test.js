import test, {afterEach} from 'node:test'
import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import {Runtime} from '../rt-als/runtime.js'
import {Runtime as AgentRuntime} from '../rt-nodejs-agent/runtime.js'
import {Runtime as BaseRuntime} from '../rt-base/runtime.js'
import {Runtime as BrowserAgentRuntime} from '../rt-browser-agent/runtime.js'
import {runAsNode} from '../security/node-context.js'
import {SecurityReporterFactory} from '../security/security-reporter.js'
import {safety, SecurityPolicyError} from '../security/safety.js'

const runtimes = []

afterEach(() => {
    for (const runtime of runtimes.splice(0).reverse()) runtime.stop()
})

function security(overrides = {}) {
    return {
        fs: {
            read: {mode: 'allow', all: true},
            write: {mode: 'allow', all: true},
            delete: {mode: 'allow', all: true},
            ...overrides.fs,
        },
        net: {
            egress: {mode: 'deny'},
            ...overrides.net,
        },
        process: {
            exec: {mode: 'deny'},
            ...overrides.process,
        },
    }
}

function start(RuntimeClass = Runtime, policy = security(), options = {}) {
    const runtime = new RuntimeClass([], {
        runtimeSettings: {security: policy},
        securityBaseDir: options.baseDir ?? process.cwd(),
    })
    runtime.start()
    runtimes.push(runtime)
    return runtime
}

function collect() {
    const events = []
    const unsubscribe = safety.subscribe(event => events.push(event))
    return {events, unsubscribe}
}

test('rt-als enforces application policy without a reporter node', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'denied.txt')
    start(Runtime, security({fs: {write: {mode: 'deny'}}}))
    const {events} = collect()

    assert.throws(() => runAsNode('Writer', () => fs.writeFileSync(target, 'blocked')), SecurityPolicyError)
    assert.equal(fs.existsSync(target), false)
    assert.equal(events.length, 1)
    assert.equal(events[0].schemaVersion, 1)
    assert.equal(events[0].node, 'Writer')
    assert.equal(events[0].operation, 'fs.write')
    assert.equal(events[0].policy.decision, 'denied')
})

test('rt-nodejs-agent uses the same enforcement lifecycle', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'agent-denied.txt')
    start(AgentRuntime, security({fs: {write: {mode: 'deny'}}}))
    assert.throws(() => fs.writeFileSync(target, 'blocked'), SecurityPolicyError)
})

test('allow is silent', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-'))
    const first = path.join(folder, 'silent.txt')
    start()
    const collector = collect()

    fs.writeFileSync(first, 'ok')
    assert.equal(collector.events.length, 0)
})

test('warn proceeds and emits one event', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'warned.txt')
    start(Runtime, security({fs: {write: {mode: 'warn', all: true}}}))
    const {events} = collect()

    fs.writeFileSync(target, 'ok')
    assert.equal(fs.readFileSync(target, 'utf8'), 'ok')
    assert.equal(events.filter(event => event.operation === 'fs.write').length, 1)
    assert.equal(events[0].policy.decision, 'warning')
})

test('model-relative roots use the supplied base and enforce path boundaries', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-model-'))
    const allowedDir = path.join(baseDir, 'out', 'images')
    const siblingDir = path.join(baseDir, 'out-old')
    fs.mkdirSync(allowedDir, {recursive: true})
    fs.mkdirSync(siblingDir, {recursive: true})

    start(Runtime, security({fs: {write: {mode: 'allow', roots: ['./out/../out']}}}), {baseDir})
    const {events} = collect()
    fs.writeFileSync(path.join(allowedDir, 'ok.txt'), 'ok')
    assert.throws(() => fs.writeFileSync(path.join(siblingDir, 'blocked.txt'), 'blocked'), SecurityPolicyError)
    assert.equal(events.at(-1).policy.reason, 'fs_root_not_allowed')
})

test('existing symbolic-link escapes are denied', (context) => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-model-'))
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-outside-'))
    const allowedDir = path.join(baseDir, 'out')
    fs.mkdirSync(allowedDir)
    try {
        fs.symlinkSync(outsideDir, path.join(allowedDir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
    }
    catch (error) {
        if (error?.code === 'EPERM') return context.skip('symbolic links are not available')
        throw error
    }

    start(Runtime, security({fs: {write: {mode: 'allow', roots: ['./out']}}}), {baseDir})
    assert.throws(() => fs.writeFileSync(path.join(allowedDir, 'escape', 'blocked.txt'), 'blocked'), SecurityPolicyError)
})

test('relative observed paths follow the working directory, not the model base', () => {
    const originalCwd = process.cwd()
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-model-'))
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-cwd-'))
    fs.mkdirSync(path.join(baseDir, 'out'))
    fs.mkdirSync(path.join(otherDir, 'out'))
    start(Runtime, security({fs: {write: {mode: 'allow', roots: ['./out']}}}), {baseDir})

    try {
        process.chdir(otherDir)
        assert.throws(() => fs.writeFileSync('./out/blocked.txt', 'blocked'), SecurityPolicyError)
    }
    finally {
        process.chdir(originalCwd)
    }
})

test('shell execution is denied for a command list and allowed only by explicit all', () => {
    const listed = security({process: {exec: {mode: 'allow', commands: [process.execPath]}}})
    const runtime = start(Runtime, listed)
    assert.throws(() => childProcess.exec(`"${process.execPath}" -e "process.exit(0)"`), SecurityPolicyError)
    assert.doesNotThrow(() => childProcess.spawnSync(process.execPath, ['-e', 'process.exit(0)']))
    assert.doesNotThrow(() => childProcess.execFileSync(process.execPath, ['-e', 'process.exit(0)']))

    runtime.stop()
    runtimes.pop()
    start(Runtime, security({process: {exec: {mode: 'allow', all: true}}}))
    assert.doesNotThrow(() => childProcess.execSync(`"${process.execPath}" -e "process.exit(0)"`))
})

test('network host matching is exact and case-insensitive', async () => {
    const server = http.createServer((request, response) => response.end('ok'))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const port = server.address().port
    start(Runtime, security({net: {egress: {mode: 'warn', hosts: ['LOCALHOST']}}}))
    const {events} = collect()

    try {
        const response = await fetch(`http://localhost:${port}/allowed`)
        assert.equal(await response.text(), 'ok')
        assert.equal(events.filter(event => event.operation === 'net.egress').length, 1)
        assert.throws(() => http.request(`http://127.0.0.1:${port}/blocked`), SecurityPolicyError)
    }
    finally {
        await new Promise(resolve => server.close(resolve))
    }
})

test('a second security-enabled runtime is rejected without replacing the owner', () => {
    const first = start()
    const second = new Runtime([], {runtimeSettings: {security: security()}, securityBaseDir: process.cwd()})
    assert.throws(() => second.start(), /already owned by another runtime/)
    assert.equal(safety.isOwner(first), true)
    assert.equal(safety.isOwner(second), false)
})

test('ownership transfers after stop and repeated start does not duplicate hooks', () => {
    const first = start(Runtime, security({fs: {write: {mode: 'warn', all: true}}}))
    first.start()
    const {events} = collect()
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'once.txt')
    fs.writeFileSync(target, 'once')
    assert.equal(events.filter(event => event.operation === 'fs.write').length, 1)

    first.stop()
    runtimes.pop()
    const second = start()
    assert.equal(safety.isOwner(second), true)
})

test('startup failure releases instrumentation ownership', () => {
    const failing = new Runtime([{name: 'Broken', uid: 'broken', factory: () => { throw new Error('factory failed') }, inputs: [], outputs: []}], {
        runtimeSettings: {security: security()},
        securityBaseDir: process.cwd(),
    })
    assert.throws(() => failing.start(), /factory failed/)
    assert.equal(safety.owner, null)
    assert.doesNotThrow(() => start())
})

test('reporter subscribes to events but does not own enforcement', () => {
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'reported.txt')
    const runtime = start(Runtime, security({fs: {write: {mode: 'warn', all: true}}}))
    const events = []
    const reporter = SecurityReporterFactory({send(name, payload) { events.push({name, payload}) }})

    fs.writeFileSync(target, 'reported')
    assert.equal(events.length, 1)
    reporter.stop()
    assert.equal(safety.isOwner(runtime), true)
})

test('base and browser-agent runtimes do not claim Node.js security hooks', () => {
    for (const RuntimeClass of [BaseRuntime, BrowserAgentRuntime]) {
        const runtime = new RuntimeClass([])
        runtime.start()
        runtimes.push(runtime)
    }
    assert.equal(safety.owner, null)
})

test('a disabled policy is retained without claiming security hooks', () => {
    const policy = {...security({fs: {write: {mode: 'deny'}}}), enabled: false}
    const runtime = start(Runtime, policy)
    const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-security-')), 'allowed.txt')

    assert.equal(safety.isOwner(runtime), false)
    assert.doesNotThrow(() => fs.writeFileSync(target, 'allowed'))
})
