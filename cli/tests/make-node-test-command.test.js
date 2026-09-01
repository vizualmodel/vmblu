import fs from 'node:fs/promises'
import path from 'node:path'
import {tmpdir} from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'

import {makeNodeTests} from '../commands/make-test/index.js'
import {runNodeTest} from '../commands/run-test/index.js'

test('make-test node translates a dedicated node test specification to a colocated artifact', async () => {
    const project = await fs.mkdtemp(path.join(tmpdir(), 'vmblu-node-test-'))
    try {
        await fs.mkdir(path.join(project, 'model'))
        await fs.mkdir(path.join(project, 'tests', 'nodes'), {recursive: true})
        await fs.writeFile(path.join(project, 'package.json'), '{"type":"module"}\n')
        await fs.writeFile(path.join(project, 'nodes.js'), `export function Adder(tx) {
    let total = 0
    return {onAdd(value) { total += value; tx.send('total', total) }}
}\n`)
        await fs.writeFile(path.join(project, 'tests', 'nodes', 'Adder.md'), `# Adder tests

## Adds two values
- Purpose: Verify accumulated output.
- When: \`2\` and then \`3\` are sent to \`add\`.
- Then: the node sends \`2\` on \`total\`.
- Then: the node sends \`5\` on \`total\`.
`)
        await fs.writeFile(path.join(project, 'model', 'sample.mod.blu'), JSON.stringify({
            header: {version: '1.12.0', runtime: '@vizualmodel/vmblu-runtime/rt-base'},
            factories: ['../nodes.js'],
            root: {
                kind: 'group', name: 'Sample', nodes: [{
                    kind: 'source', name: 'Adder',
                    factory: {path: '../nodes.js', function: 'Adder'},
                    testRepo: {arl: '../tests/nodes/Adder.md', pathKind: 2},
                    interfaces: [{interface: '', pins: [
                        {name: 'add', kind: 'input', contract: 'number'},
                        {name: 'total', kind: 'output', contract: 'number'},
                    ]}],
                }],
            },
        }))
        await fs.writeFile(path.join(project, 'model', 'sample.mod.viz'), JSON.stringify({
            header: {version: '1.12.0', style: '#202020'},
            root: {
                kind: 'group', name: 'Sample', rect: 'x 0 y 0 w 400 h 300', nodes: [{
                    kind: 'source', name: 'Adder', rect: 'x 20 y 20 w 140 h 100',
                    interfaces: [{interface: '(0)', pins: ['(1 L)add', '(2 R)total']}],
                }],
            },
        }))

        const results = await makeNodeTests(path.join(project, 'model', 'sample.mod.blu'), ['Adder'])
        const artifactPath = path.join(project, 'tests', 'nodes', 'Adder.test.json')
        const artifact = JSON.parse(await fs.readFile(artifactPath, 'utf8'))

        assert.equal(results[0].status, 'written')
        assert.equal(artifact.kind, 'vmblu.model-test')
        assert.deepEqual(artifact.target, {scope: 'node', name: 'Adder', path: ['Adder']})
        assert.equal(artifact.scenarios[0].actions.length, 2)
        assert.deepEqual(artifact.scenarios[0].expect.map(item => item.message), [2, 5])

        const execution = await runNodeTest(path.join(project, 'model', 'sample.mod.blu'), 'Adder')
        assert.equal(execution.report.status, 'passed')
        assert.equal(execution.report.summary.passed, 1)
        assert.equal(execution.report.test, 'tests/nodes/Adder.test.json')
        assert.equal(execution.reportFile, path.join(project, 'tests', 'nodes', 'Adder.result.json'))
        assert.match(execution.report.artifactHash, /^fnv1a64:/)
    }
    finally {
        await fs.rm(project, {recursive: true, force: true})
    }
})
