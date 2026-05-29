import test, {afterEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {exec as execCallback} from 'node:child_process'
import {promisify} from 'node:util'
import {Runtime} from '../rt-als/runtime.js'
import {runAsNode} from '../rt-als/node-context.js'
import {safety} from '../rt-als/safety.js'

const exec = promisify(execCallback)
const uninstallers = []

afterEach(async () => {
    while (uninstallers.length) {
        uninstallers.pop()()
    }

    safety.setEmitter(null)
    safety.setPolicyClassifier(null)
})

function install(mode = 'warn') {
    const uninstall = safety.installHooks({mode})
    uninstallers.push(uninstall)
    return uninstall
}

function createCollector() {
    const events = []
    safety.setEmitter((event) => {
        events.push(event)
    })
    return events
}

function waitFor(predicate, timeoutMs = 2000) {
    const start = Date.now()

    return new Promise((resolve, reject) => {
        const tick = () => {
            const value = predicate()
            if (value) return resolve(value)
            if ((Date.now() - start) > timeoutMs) return reject(new Error('Timed out waiting for condition'))
            setTimeout(tick, 10)
        }

        tick()
    })
}

async function withServer(handler, fn) {
    const server = http.createServer(handler)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

    try {
        const {port} = server.address()
        return await fn(`http://127.0.0.1:${port}`)
    } finally {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
}

test('attributes fs writes to the active node across await in runtime dispatch', async () => {
    install('warn')
    const events = createCollector()
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'event.txt')

    function TriggerFactory(tx) {
        return {tx}
    }

    class SinkFactory {
        async onWrite() {
            await Promise.resolve()
            await new Promise((resolve, reject) => {
                fs.writeFile(targetFile, 'ok', (error) => error ? reject(error) : resolve())
            })
        }
    }

    const runtime = new Runtime([
        {
            name: 'Trigger',
            uid: 'trigger',
            factory: TriggerFactory,
            inputs: [],
            outputs: ['write -> write @ Sink (sink)'],
        },
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: ['-> write'],
            outputs: [],
        }
    ])

    runtime.start()

    try {
        runtime.actors[0].cell.tx.send('write')

        const event = await waitFor(() => events.find((item) => item.cap === 'fs:write'))
        assert.equal(event.node, 'Sink')
        assert.equal(event.detail.path, targetFile)
        assert.equal(await fsp.readFile(targetFile, 'utf8'), 'ok')
    } finally {
        runtime.stop()
    }
})

test('reports child_process.exec usage', async () => {
    install('warn')
    const events = createCollector()

    await runAsNode('ExecNode', async () => {
        await exec(`"${process.execPath}" -e "process.exit(0)"`)
    })

    const event = events.find((item) => item.cap === 'proc:exec')
    assert.ok(event)
    assert.equal(event.node, 'ExecNode')
    assert.match(event.detail.command, /node|node\.exe/i)
})

test('reports fetch network egress', async () => {
    install('warn')
    const events = createCollector()

    await withServer((req, res) => {
        res.writeHead(200, {'content-type': 'text/plain'})
        res.end('ok')
    }, async (url) => {
        await runAsNode('FetchNode', async () => {
            const response = await fetch(`${url}/fetch`)
            await response.text()
        })
    })

    const event = events.find((item) => item.cap === 'net:egress')
    assert.ok(event)
    assert.equal(event.node, 'FetchNode')
    assert.match(event.detail.url, /\/fetch$/)
})

test('reports http.request network egress', async () => {
    install('warn')
    const events = createCollector()

    await withServer((req, res) => {
        res.writeHead(200)
        res.end('ok')
    }, async (url) => {
        await runAsNode('HttpNode', async () => {
            await new Promise((resolve, reject) => {
                const req = http.request(`${url}/request`, {method: 'POST'}, (res) => {
                    res.resume()
                    res.on('end', resolve)
                })
                req.on('error', reject)
                req.end('payload')
            })
        })
    })

    const event = events.find((item) => item.cap === 'net:egress')
    assert.ok(event)
    assert.equal(event.node, 'HttpNode')
    assert.equal(event.detail.method, 'POST')
    assert.match(event.detail.url, /\/request$/)
})

test('reports fs writes outside runtime dispatch too', async () => {
    install('warn')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'direct.txt')

    await runAsNode('FsNode', async () => {
        fs.writeFileSync(targetFile, 'direct')
    })

    const event = events.find((item) => item.cap === 'fs:write')
    assert.ok(event)
    assert.equal(event.node, 'FsNode')
    assert.equal(event.detail.path, targetFile)
})

test('off mode emits nothing', async () => {
    install('off')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'off.txt')

    await runAsNode('OffNode', async () => {
        fs.writeFileSync(targetFile, 'off')
    })

    assert.equal(events.length, 0)
})

test('installing hooks twice does not double report', async () => {
    install('warn')
    install('warn')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'single.txt')

    await runAsNode('SingleNode', async () => {
        fs.writeFileSync(targetFile, 'single')
    })

    const writeEvents = events.filter((item) => item.cap === 'fs:write')
    assert.equal(writeEvents.length, 1)
})

test('classifies safety events against model runtime security settings', async () => {
    install('warn')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'classified.txt')

    class SinkFactory {
        onWrite() {
            fs.writeFileSync(targetFile, 'classified')
        }
    }

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: [],
            outputs: [],
        }
    ], {
        runtimeSettings: {
            security: {
                defaults: {
                    fs: 'deny',
                    net: 'warn',
                    process: 'deny',
                }
            }
        }
    })

    runtime.start()

    try {
        await runAsNode('Sink', async () => {
            fs.writeFileSync(targetFile, 'classified')
        })

        const event = events.find((item) => item.cap === 'fs:write')
        assert.ok(event)
        assert.equal(event.node, 'Sink')
        assert.equal(event.policy.decision, 'denied')
        assert.equal(event.policy.domain, 'fs')
        assert.equal(event.policy.permission, 'deny')
    } finally {
        runtime.stop()
    }
})

test('does not let node security settings broaden the model security envelope', async () => {
    install('warn')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'clipped.txt')

    class SinkFactory {
        onWrite() {
            fs.writeFileSync(targetFile, 'clipped')
        }
    }

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: SinkFactory,
            inputs: [],
            outputs: [],
            dx: {
                security: {
                    enabled: true,
                    request: {
                        fs: 'allow',
                    }
                }
            }
        }
    ], {
        runtimeSettings: {
            security: {
                defaults: {
                    fs: 'warn',
                    net: 'warn',
                    process: 'deny',
                }
            }
        }
    })

    runtime.start()

    try {
        await runAsNode('Sink', async () => {
            fs.writeFileSync(targetFile, 'clipped')
        })

        const event = events.find((item) => item.cap === 'fs:write')
        assert.ok(event)
        assert.equal(event.node, 'Sink')
        assert.equal(event.policy.decision, 'warning')
        assert.equal(event.policy.domain, 'fs')
        assert.equal(event.policy.permission, 'warn')
    } finally {
        runtime.stop()
    }
})

test('classifies safety events outside fs allow-list as denied', async () => {
    install('warn')
    const events = createCollector()
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmblu-als-'))
    const targetFile = path.join(tmpDir, 'outside.txt')

    const runtime = new Runtime([
        {
            name: 'Sink',
            uid: 'sink',
            factory: class SinkFactory {},
            inputs: [],
            outputs: [],
        }
    ], {
        runtimeSettings: {
            security: {
                defaults: {
                    fs: 'allow',
                    net: 'warn',
                    process: 'deny',
                },
                allow: {
                    fsRoots: ['./approved'],
                },
            },
        },
    })

    runtime.start()

    try {
        await runAsNode('Sink', async () => {
            fs.writeFileSync(targetFile, 'outside')
        })

        const event = events.find((item) => item.cap === 'fs:write')
        assert.ok(event)
        assert.equal(event.policy.decision, 'denied')
        assert.equal(event.policy.reason, 'fs_root_not_allowed')
    } finally {
        runtime.stop()
    }
})
