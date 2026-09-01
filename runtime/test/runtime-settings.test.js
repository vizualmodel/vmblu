import test from 'node:test'
import assert from 'node:assert/strict'

import {runtimeSettings as baseSettings} from '../rt-base/runtime-settings.js'
import {runtimeSettings as alsSettings} from '../rt-als/runtime-settings.js'
import {getRuntimeSettings, RT_BROWSER_AGENT} from '../runtime-settings-registry.js'

test('base runtime settings normalize legacy node settings', () => {
    const dx = baseSettings.normalize({logMessages: true, worker: {on: true, path: './worker.js'}})
    assert.equal(dx.monitor.logMessages, true)
    assert.deepEqual(dx.run.worker, {on: true, path: './worker.js'})
})

test('als node settings ignore legacy and canonical node security', () => {
    const dx = alsSettings.normalize({
        safety: {on: true},
        security: {enabled: true, fs: {write: {mode: 'allow', all: true}}},
        monitor: {logMessages: true},
    })
    assert.equal(dx.security, undefined)
    assert.equal(dx.safety, undefined)
    assert.equal(dx.monitor.logMessages, true)
    assert.equal(alsSettings.isDefault({security: {enabled: true}}), true)
})

test('new application policies default every operation to explicit deny', () => {
    const security = alsSettings.makeModel().security
    assert.equal(security.enabled, true)
    assert.deepEqual(security.fs.read, {mode: 'deny'})
    assert.deepEqual(security.fs.write, {mode: 'deny'})
    assert.deepEqual(security.fs.delete, {mode: 'deny'})
    assert.deepEqual(security.net.egress, {mode: 'deny'})
    assert.deepEqual(security.process.exec, {mode: 'deny'})
    assert.equal('audit' in security, false)
})

test('canonical application policy preserves explicit all and non-empty scopes', () => {
    const model = alsSettings.normalizeModel({security: {
        enabled: false,
        audit: {allowed: true},
        fs: {
            read: {mode: 'allow', all: true},
            write: {mode: 'warn', roots: ['./out', './out']},
            delete: {mode: 'deny'},
        },
        net: {egress: {mode: 'allow', hosts: ['Example.COM']}},
        process: {exec: {mode: 'warn', commands: ['node']}},
    }})
    assert.deepEqual(model.security.fs.read, {mode: 'allow', all: true})
    assert.equal(model.security.enabled, false)
    assert.deepEqual(model.security.fs.write, {mode: 'warn', roots: ['./out']})
    assert.deepEqual(model.security.net.egress, {mode: 'allow', hosts: ['Example.COM']})
    assert.equal('audit' in model.security, false)
})

test('malformed or empty canonical scopes normalize to deny', () => {
    const model = alsSettings.normalizeModel({security: {
        fs: {read: {mode: 'allow', roots: []}, write: {mode: 'invalid', all: true}, delete: {mode: 'warn'}},
        net: {egress: {mode: 'allow', hosts: []}},
        process: {exec: {mode: 'warn', commands: []}},
    }})
    assert.deepEqual(model.security.fs.read, {mode: 'deny'})
    assert.deepEqual(model.security.fs.write, {mode: 'deny'})
    assert.deepEqual(model.security.fs.delete, {mode: 'deny'})
    assert.deepEqual(model.security.net.egress, {mode: 'deny'})
    assert.deepEqual(model.security.process.exec, {mode: 'deny'})
})

test('legacy model settings normalize into canonical application policy', () => {
    const model = alsSettings.normalizeModel({security: {
        forwardEvents: true,
        defaults: {fs: 'warn', net: 'allow', process: 'deny'},
        allow: {fsRoots: ['./tmp'], netHosts: ['localhost']},
    }})
    assert.deepEqual(model.security.fs.write, {mode: 'warn', roots: ['./tmp']})
    assert.deepEqual(model.security.net.egress, {mode: 'allow', hosts: ['localhost']})
    assert.deepEqual(model.security.process.exec, {mode: 'deny'})
    assert.equal('audit' in model.security, false)
})

test('effective application policy ignores node security', () => {
    const settings = {security: {
        fs: {read: {mode: 'deny'}, write: {mode: 'allow', all: true}, delete: {mode: 'deny'}},
        net: {egress: {mode: 'deny'}},
        process: {exec: {mode: 'deny'}},
    }}
    const policy = alsSettings.effectivePolicy(settings, {security: {enabled: true, fs: {write: {mode: 'deny'}}}})
    assert.equal(policy.active, true)
    assert.deepEqual(policy.security.fs.write, {mode: 'allow', all: true})
    assert.equal(policy.node, undefined)
})

test('a disabled application policy remains normalized but is not active', () => {
    const policy = alsSettings.effectivePolicy({security: {
        enabled: false,
        fs: {read: {mode: 'deny'}, write: {mode: 'deny'}, delete: {mode: 'deny'}},
        net: {egress: {mode: 'deny'}},
        process: {exec: {mode: 'deny'}},
    }})

    assert.equal(policy.active, false)
    assert.equal(policy.security.enabled, false)
    assert.deepEqual(policy.security.fs.write, {mode: 'deny'})
})

test('application policy validation rejects misspellings and ambiguous scopes', () => {
    const errors = alsSettings.validateModel({security: {
        enabled: 'sometimes',
        audit: {allowed: true},
        fs: {read: {mode: 'allow', all: true, roots: ['./x']}, write: {mode: 'deny'}, remove: {mode: 'allow', all: true}},
        net: {egress: {mode: 'sometimes', hosts: ['https://example.com']}},
        process: {exec: {mode: 'allow', commands: []}},
    }})
    assert.ok(errors.some(error => error.path === 'security.fs.remove'))
    assert.ok(errors.some(error => error.path === 'security.audit'))
    assert.ok(errors.some(error => error.path === 'security.enabled'))
    assert.ok(errors.some(error => error.path === 'security.fs.read'))
    assert.ok(errors.some(error => error.path === 'security.net.egress.mode'))
    assert.ok(errors.some(error => error.code === 'invalid_security_target'))
    assert.ok(errors.some(error => error.path === 'security.process.exec'))
})

test('browser agent uses browser-safe settings without security', () => {
    assert.equal(getRuntimeSettings(RT_BROWSER_AGENT).makeModel().security, undefined)
})
