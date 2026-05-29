import test from 'node:test'
import assert from 'node:assert/strict'

import {runtimeSettings as baseSettings} from '../rt-base/runtime-settings.js'
import {runtimeSettings as alsSettings} from '../rt-als/runtime-settings.js'
import {getRuntimeSettings, RT_BROWSER_AGENT} from '../runtime-settings-registry.js'

test('base runtime settings normalize legacy dx into run and monitor sections', () => {
    const dx = baseSettings.normalize({
        logMessages: true,
        worker: {
            on: true,
            path: './worker.js',
        },
    })

    assert.equal(dx.monitor.logMessages, true)
    assert.equal(dx.run.worker.on, true)
    assert.equal(dx.run.worker.path, './worker.js')
    assert.equal(dx.security.enabled, false)
})

test('als runtime settings normalize legacy safety into security section', () => {
    const dx = alsSettings.normalize({
        safety: {
            on: true,
            mode: 'enforce',
            forward: false,
        },
    })

    assert.equal(dx.security.enabled, true)
    assert.equal(dx.security.mode, 'enforce')
    assert.equal(dx.security.forward, false)
    assert.equal(dx.security.request.fs, 'inherit')
})

test('als runtime settings keep node security requests inside explicit shape', () => {
    const dx = alsSettings.normalize({
        security: {
            enabled: true,
            request: {
                fs: 'deny',
                net: 'warn',
                process: 'allow',
                allow: {
                    netHosts: ['localhost'],
                    fsRoots: ['./tmp'],
                },
            },
        },
    })

    assert.deepEqual(dx.security.request, {
        fs: 'deny',
        net: 'warn',
        process: 'allow',
        allow: {
            netHosts: ['localhost'],
            fsRoots: ['./tmp'],
        },
    })
})

test('default runtime settings are not saved as node dx', () => {
    assert.equal(baseSettings.isDefault(baseSettings.make()), true)
    assert.equal(alsSettings.isDefault(alsSettings.make()), true)
    assert.equal(alsSettings.isDefault({security: {enabled: true}}), false)
})

test('als effective runtime policy clips node requests to model envelope', () => {
    const policy = alsSettings.effectivePolicy(
        {
            security: {
                defaults: {
                    fs: 'warn',
                    net: 'deny',
                    process: 'deny',
                },
                allow: {
                    netHosts: ['localhost'],
                    fsRoots: ['./data'],
                },
            },
        },
        {
            security: {
                enabled: true,
                request: {
                    fs: 'allow',
                    net: 'allow',
                    process: 'warn',
                    allow: {
                        netHosts: ['localhost', 'example.com'],
                        fsRoots: ['./data', './secret'],
                    },
                },
            },
        }
    )

    assert.equal(policy.security.fs, 'warn')
    assert.equal(policy.security.net, 'deny')
    assert.equal(policy.security.process, 'deny')
    assert.deepEqual(policy.security.allow.netHosts, ['localhost'])
    assert.deepEqual(policy.security.allow.fsRoots, ['./data'])
})

test('als effective runtime policy lets node requests narrow model envelope', () => {
    const policy = alsSettings.effectivePolicy(
        {
            security: {
                defaults: {
                    fs: 'allow',
                    net: 'warn',
                    process: 'warn',
                },
            },
        },
        {
            security: {
                enabled: true,
                request: {
                    fs: 'deny',
                    net: 'deny',
                    process: 'inherit',
                },
            },
        }
    )

    assert.equal(policy.security.fs, 'deny')
    assert.equal(policy.security.net, 'deny')
    assert.equal(policy.security.process, 'warn')
})

test('browser agent runtime uses browser-safe base runtime settings', () => {
    assert.equal(getRuntimeSettings(RT_BROWSER_AGENT), baseSettings)
})
