import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {ARL} from '../types/arl/arl-node.js'
import {defaultNodeTestPath, ensureNodeTestFile} from '../types/node/test-file.js'
import {nodeClickHandling} from '../types/node/node-icon-click.js'

test('default specification belongs to project tests/nodes, relative to the model', () => {
    const node = {name: 'Process Order', model: {getArl: () => new ARL('C:/project/model/app.mod.blu')}}
    assert.equal(defaultNodeTestPath(node), '../tests/nodes/process-order.md')
    node.model.entrypoint = {arl: new ARL('C:/project/app.blu')}
    node.model.getArl = () => new ARL('C:/project/architecture/nested/app.mod.blu')
    assert.equal(defaultNodeTestPath(node), '../../tests/nodes/process-order.md')
})

test('create uses the edited path and preserves existing specifications', async t => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vmblu-test-spec-'))
    t.after(() => fs.rm(dir, {recursive: true, force: true}))
    const node = {name: 'Worker', model: {getArl: () => new ARL(path.join(dir, 'model/app.mod.blu'))}}
    const arl = await ensureNodeTestFile(node, '../tests/nodes/custom.md')
    assert.match(await arl.get(), /Worker.*test specification/)
    await fs.writeFile(path.join(dir, 'tests/nodes/custom.md'), 'Existing user specification')
    await ensureNodeTestFile(node, '../tests/nodes/custom.md')
    assert.equal(await arl.get(), 'Existing user specification')
    assert.equal(node.testRepo, undefined)
})

test('read-only references only open their existing file; failures propagate', async () => {
    const arl = {createPromptFile: () => assert.fail('must not write linked files')}
    assert.equal(await ensureNodeTestFile({link: {}, testRepo: {arl}}, 'other.md'), arl)
    await assert.rejects(ensureNodeTestFile({model: {}}, 'test.md'), /Save the model/)
    const node = {model: {getArl: () => ({resolve: () => ({createPromptFile: async () => {throw new Error('Denied')}})})}}
    await assert.rejects(ensureNodeTestFile(node, 'test.md'), /Denied/)
    assert.equal(node.testRepo, undefined)
})

test('settings file action saves the edited reference and opens its file only after creation succeeds', async () => {
    const messages = []
    let requestedPath
    const arl = {createPromptFile: async () => ({created: true})}
    const node = {name: 'Worker', sx: {count: 1}, team: 'default', model: {getArl: () => ({
        getFullPath: () => 'C:/project/model/app.mod.blu',
        resolve: path => { requestedPath = path; return arl },
    })}}
    const tx = {send: (name, value) => messages.push({name, value})}
    nodeClickHandling.iconClick.call(node, tx, null, {type: 'cog'}, {x: 0, y: 0})
    const settings = messages[0].value
    assert.equal(settings.defaultTestRepo, '../tests/nodes/worker.md')
    await settings.openTestRepo('../tests/custom.md')
    assert.equal(requestedPath, '../tests/custom.md')
    assert.equal(messages[1].name, 'redox.doit')
    assert.equal(messages[1].value.param.testRepo, '../tests/custom.md')
    assert.deepEqual(messages[2], {name: 'open source file', value: {arl}})
    arl.createPromptFile = async () => { throw new Error('Denied') }
    await assert.rejects(settings.openTestRepo('failure.md'), /Denied/)
    assert.equal(messages.length, 3)
})
