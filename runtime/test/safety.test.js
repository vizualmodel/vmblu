import test, {afterEach} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import {exec as execCallback} from 'node:child_process'
import {promisify} from 'node:util'
import {scaffold} from '../rt-als/scaffold.js'
import {runAsNode} from '../rt-als/node-context.js'
import {setSafetyEmitter} from '../rt-als/safety-events.js'
import {installSafetyHooks} from '../rt-als/safety-hooks.js'

const exec = promisify(execCallback)
const uninstallers = []

afterEach(async () => {
    while (uninstallers.length) {
        uninstallers.pop()()
    }

    setSafetyEmitter(null)
})

function install(mode = 'warn') {
    const uninstall = installSafetyHooks({mode})
    uninstallers.push(uninstall)
    return uninstall
}

function createCollector() {
    const events = []
    setSafetyEmitter((event) => {
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

    const runtime = scaffold([
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
