import fs from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'

import {makeNodeTests} from '../commands/make-test/index.js'
import {runNodeTest} from '../commands/run-test/index.js'

test('browser model-test host mounts a view, clicks it, and records the node output', {
    skip: process.env.VMBLU_BROWSER_TEST !== '1' ? 'set VMBLU_BROWSER_TEST=1 to run a real browser' : false,
}, async () => {
    const project = await fs.mkdtemp(path.join(tmpdir(), 'vmblu-browser-model-test-'))
    try {
        await writeBrowserFixture(project)
        const model = path.join(project, 'model', 'browser.mod.blu')
        const [generation] = await makeNodeTests(model, ['Logout view'])
        const artifact = JSON.parse(await fs.readFile(generation.file, 'utf8'))
        assert.equal(artifact.host, 'browser')

        const result = await runNodeTest(model, 'Logout view')
        assert.equal(result.report.status, 'passed', JSON.stringify(result.report, null, 2))
        assert.deepEqual(result.report.scenarios[0].observations.map(({kind, pin, message}) => ({kind, pin, message})), [
            {kind: 'send', pin: 'auth.logout-request', message: {}},
        ])
    }
    finally {
        await fs.rm(project, {recursive: true, force: true})
    }
})

async function writeBrowserFixture(project) {
    await fs.mkdir(path.join(project, 'model'), {recursive: true})
    await fs.mkdir(path.join(project, 'tests', 'nodes'), {recursive: true})
    await fs.writeFile(path.join(project, 'package.json'), '{"type":"module"}\n')
    await fs.writeFile(path.join(project, 'view.js'), `export function LogoutView(tx) {
    const element = document.createElement('section')
    const button = document.createElement('button')
    button.textContent = 'Logout'
    button.addEventListener('click', () => tx.send('auth.logout-request', {}))
    element.append(button)
    return {element, onUiGetView() { tx.reply({slot: 'main', element}) }}
}\n`)
    await fs.writeFile(path.join(project, 'tests', 'nodes', 'Logout-view.md'), `# Logout view tests

## Requests logout
- Mount: \`ui.get-view\`
- Click: \`{"role":"button","name":"Logout"}\`
- Expect send: \`auth.logout-request\` = \`{}\`
`)
    const blu = {
        header: {version: '1.12.0', runtime: '@vizualmodel/vmblu-runtime/rt-base'},
        factories: ['../view.js'],
        root: {kind: 'group', name: 'App', nodes: [{
            kind: 'source', name: 'Logout view', testRepo: {arl: '../tests/nodes/Logout-view.md', pathKind: 2},
            factory: {path: '../view.js', function: 'LogoutView'},
            interfaces: [
                {interface: 'ui', pins: [{
                    name: 'ui.get-view', kind: 'reply',
                    contract: {role: 'owner', payload: {request: 'any', reply: 'any'}},
                }]},
                {interface: 'auth', pins: [{
                    name: 'auth.logout-request', kind: 'output',
                    contract: {role: 'owner', payload: 'any'},
                }]},
            ],
        }]},
    }
    const viz = {
        header: {version: '1.12.0', style: '#202020'},
        root: {kind: 'group', name: 'App', rect: 'x 0 y 0 w 600 h 400', nodes: [{
            kind: 'source', name: 'Logout view', rect: 'x 100 y 100 w 180 h 120',
            interfaces: [
                {interface: '(1) ui', pins: ['(2 L)ui.get-view']},
                {interface: '(3) auth', pins: ['(4 R)auth.logout-request']},
            ],
        }]},
    }
    await fs.writeFile(path.join(project, 'model', 'browser.mod.blu'), JSON.stringify(blu))
    await fs.writeFile(path.join(project, 'model', 'browser.mod.viz'), JSON.stringify(viz))
}
