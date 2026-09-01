import fs from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'

import {makeAppTest, makeGroupTest} from '../commands/make-test/index.js'
import {runAppTest, runGroupTest} from '../commands/run-test/index.js'

test('group and app commands use their natural model boundaries', async () => {
    const project = await fs.mkdtemp(path.join(tmpdir(), 'vmblu-model-perimeters-'))
    try {
        await writeFixture(project)
        const model = path.join(project, 'model', 'pipeline.mod.blu')

        const groupGeneration = await makeGroupTest(model, 'Pipeline')
        assert.equal(groupGeneration.status, 'written')
        assert.equal(groupGeneration.file, path.join(project, 'tests', 'nodes', 'Pipeline.test.json'))
        const groupArtifact = JSON.parse(await fs.readFile(groupGeneration.file, 'utf8'))
        assert.deepEqual(groupArtifact.target, {scope: 'group', name: 'Pipeline', path: ['Pipeline']})

        const groupRun = await runGroupTest(model, 'Pipeline')
        assert.equal(groupRun.report.status, 'passed')
        assert.deepEqual(groupRun.report.scenarios[0].observations[0].message, 6)

        const appGeneration = await makeAppTest(model)
        assert.equal(appGeneration.status, 'written')
        assert.equal(appGeneration.file, path.join(project, 'tests', 'app', 'application.test.json'))
        const appArtifact = JSON.parse(await fs.readFile(appGeneration.file, 'utf8'))
        assert.deepEqual(appArtifact.target, {scope: 'model', name: 'App', path: []})

        const appRun = await runAppTest(model)
        assert.equal(appRun.report.status, 'passed')
        assert.deepEqual(appRun.report.scenarios[0].observations[0].message, 8)
    }
    finally {
        await fs.rm(project, {recursive: true, force: true})
    }
})

async function writeFixture(project) {
    await fs.mkdir(path.join(project, 'model'), {recursive: true})
    await fs.mkdir(path.join(project, 'tests', 'nodes'), {recursive: true})
    await fs.mkdir(path.join(project, 'tests', 'app'), {recursive: true})
    await fs.writeFile(path.join(project, 'package.json'), '{"type":"module"}\n')
    await fs.writeFile(path.join(project, 'nodes.js'), `export function Worker(tx) {
    return {onIn(value) { tx.send('out', value * 2) }}
}\n`)
    await fs.writeFile(path.join(project, 'tests', 'nodes', 'Pipeline.md'), `# Pipeline tests

## Doubles through the group
- Send: \`group.in\` = \`3\`
- Expect send: \`group.out\` = \`6\`
`)
    await fs.writeFile(path.join(project, 'tests', 'app', 'application.md'), `# Application tests

## Doubles through the model
- Send: \`app.in\` = \`4\`
- Expect send: \`app.out\` = \`8\`
`)

    const pin = (name, kind) => ({name, kind, contract: {role: kind === 'input' ? 'follower' : 'owner', payload: 'number'}})
    const blu = {
        header: {version: '1.12.0', runtime: '@vizualmodel/vmblu-runtime/rt-base'},
        factories: ['../nodes.js'],
        root: {
            kind: 'group', name: 'App', testRepo: {arl: '../tests/app/application.md', pathKind: 2},
            interfaces: [{interface: 'app', pins: [pin('app.in', 'input'), pin('app.out', 'output')]}],
            nodes: [{
                kind: 'group', name: 'Pipeline', testRepo: {arl: '../tests/nodes/Pipeline.md', pathKind: 2},
                interfaces: [{interface: 'group', pins: [pin('group.in', 'input'), pin('group.out', 'output')]}],
                nodes: [{
                    kind: 'source', name: 'Worker', factory: {path: '../nodes.js', function: 'Worker'},
                    interfaces: [{interface: '', pins: [pin('in', 'input'), pin('out', 'output')]}],
                }],
                connections: [
                    {src: {pin: 'group.in'}, dst: {pin: 'in', node: 'Worker'}},
                    {src: {pin: 'out', node: 'Worker'}, dst: {pin: 'group.out'}},
                ],
            }],
            connections: [
                {src: {pin: 'app.in'}, dst: {pin: 'group.in', node: 'Pipeline'}},
                {src: {pin: 'group.out', node: 'Pipeline'}, dst: {pin: 'app.out'}},
            ],
        },
    }
    const viz = {
        header: {version: '1.12.0', style: '#202020'},
        root: {
            kind: 'group', name: 'App', rect: 'x 0 y 0 w 800 h 600',
            interfaces: [{interface: '(1) app', pins: ['(2 L)app.in', '(3 R)app.out']}],
            pads: ['(2 L)x 10 y 80 w 90 h 15|app.in', '(3 R)x 700 y 80 w 90 h 15|app.out'],
            nodes: [{
                kind: 'group', name: 'Pipeline', rect: 'x 150 y 100 w 400 h 300',
                interfaces: [{interface: '(1) group', pins: ['(2 L)group.in', '(3 R)group.out']}],
                pads: ['(2 L)x 10 y 80 w 90 h 15|group.in', '(3 R)x 300 y 80 w 90 h 15|group.out'],
                nodes: [{
                    kind: 'source', name: 'Worker', rect: 'x 120 y 100 w 140 h 100',
                    interfaces: [{interface: '(0)', pins: ['(1 L)in', '(2 R)out']}],
                }],
            }],
        },
    }
    await fs.writeFile(path.join(project, 'model', 'pipeline.mod.blu'), JSON.stringify(blu))
    await fs.writeFile(path.join(project, 'model', 'pipeline.mod.viz'), JSON.stringify(viz))
}
