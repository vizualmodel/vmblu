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
    assert.equal(dx.security, undefined)
})

test('als runtime settings normalize legacy safety into enabled node security', () => {
    const dx = alsSettings.normalize({
        safety: {
            on: true,
        },
    })

    assert.equal(dx.security.enabled, true)
    assert.equal(dx.security.fs.write.mode, 'deny')
    assert.equal(dx.security.net.egress.mode, 'deny')
    assert.equal(dx.security.process.exec.mode, 'deny')
})

test('als runtime settings normalize operation-shaped node security', () => {
    const dx = alsSettings.normalize({
        security: {
            enabled: true,
            fs: {
                write: {
                    mode: 'warn',
                    roots: ['./tmp'],
                },
            },
            net: {
                egress: {
                    mode: 'allow',
                    hosts: ['localhost'],
                },
            },
        },
    })

    assert.equal(dx.security.enabled, true)
    assert.deepEqual(dx.security.fs.write, {
        mode: 'warn',
        roots: ['./tmp'],
    })
    assert.deepEqual(dx.security.net.egress, {
        mode: 'allow',
        hosts: ['localhost'],
    })
    assert.equal(dx.security.process.exec.mode, 'deny')
})

test('als runtime settings normalize legacy request into operation-shaped node security', () => {
    const dx = alsSettings.normalize({
        security: {
            enabled: true,
            request: {
                fs: 'warn',
                net: 'allow',
                process: 'deny',
                allow: {
                    netHosts: ['localhost'],
                    fsRoots: ['./tmp'],
                },
            },
        },
    })

    assert.deepEqual(dx.security.fs.write, {
        mode: 'warn',
        roots: ['./tmp'],
    })
    assert.deepEqual(dx.security.fs.delete, {
        mode: 'warn',
        roots: ['./tmp'],
    })
    assert.deepEqual(dx.security.net.egress, {
        mode: 'allow',
        hosts: ['localhost'],
    })
    assert.deepEqual(dx.security.process.exec, {
        mode: 'deny',
        commands: [],
    })
})

test('default runtime settings are not saved as node dx', () => {
    assert.equal(baseSettings.isDefault(baseSettings.make()), true)
    assert.equal(alsSettings.isDefault(alsSettings.make()), true)
    assert.equal(alsSettings.isDefault({security: {enabled: true}}), true)
    assert.equal(alsSettings.isDefault({security: {enabled: true, fs: {write: {mode: 'warn'}}}}), false)
})

test('als effective runtime policy clips node requests to model envelope', () => {
    const policy = alsSettings.effectivePolicy(
        {
            security: {
                fs: {
                    write: {mode: 'warn', roots: ['./data']},
                },
                net: {
                    egress: {mode: 'deny', hosts: ['localhost']},
                },
                process: {
                    exec: {mode: 'deny', commands: []},
                },
            },
        },
        {
            security: {
                enabled: true,
                fs: {
                    write: {mode: 'allow', roots: ['./data', './secret']},
                },
                net: {
                    egress: {mode: 'allow', hosts: ['localhost', 'example.com']},
                },
                process: {
                    exec: {mode: 'warn', commands: ['node']},
                },
            },
        }
    )

    assert.equal(policy.active, true)
    assert.deepEqual(policy.security.fs.write, {
        mode: 'warn',
        roots: ['./data'],
    })
    assert.deepEqual(policy.security.net.egress, {
        mode: 'deny',
        hosts: [],
    })
    assert.deepEqual(policy.security.process.exec, {
        mode: 'deny',
        commands: [],
    })
})

test('als effective runtime policy lets node requests narrow model envelope', () => {
    const policy = alsSettings.effectivePolicy(
        {
            security: {
                fs: {
                    write: {mode: 'allow', roots: ['./data']},
                },
                net: {
                    egress: {mode: 'warn', hosts: ['localhost']},
                },
                process: {
                    exec: {mode: 'warn', commands: ['node']},
                },
            },
        },
        {
            security: {
                enabled: true,
                fs: {
                    write: {mode: 'deny'},
                },
                net: {
                    egress: {mode: 'deny'},
                },
            },
        }
    )

    assert.equal(policy.security.fs.write.mode, 'deny')
    assert.equal(policy.security.net.egress.mode, 'deny')
    assert.equal(policy.security.process.exec.mode, 'deny')
})

test('als effective runtime policy denies all node operations by default', () => {
    const policy = alsSettings.effectivePolicy(
        {
            security: {
                fs: {
                    write: {mode: 'allow', roots: ['./data']},
                },
                net: {
                    egress: {mode: 'allow', hosts: ['localhost']},
                },
            },
        },
        null
    )

    assert.equal(policy.security.fs.write.mode, 'deny')
    assert.equal(policy.security.net.egress.mode, 'deny')
    assert.equal(policy.security.process.exec.mode, 'deny')
})

test('base model runtime settings do not expose node security policy', () => {
    assert.deepEqual(baseSettings.makeModel(), {
        run: {},
        monitor: {},
    })
})

test('browser agent runtime uses browser-safe base runtime settings', () => {
    assert.equal(getRuntimeSettings(RT_BROWSER_AGENT), baseSettings)
})
