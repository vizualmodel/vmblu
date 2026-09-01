import test from 'node:test'
import assert from 'node:assert/strict'

import {ARL} from '../types/arl/arl-node.js'
import {Look, SourceNode, TestRepo} from '../types/node/index.js'
import {redoxNode} from '../nodes/model-manager/redox-node.js'

test('test repositories resolve relative to their owning model and serialize unchanged', () => {
    const modelArl = new ARL('C:/project/model/app.mod.blu')
    const repository = new TestRepo().resolve({arl: '../tests/nodes/Worker.md', pathKind: 2}, modelArl)

    assert.equal(repository.arl.getFullPath(), new ARL('C:/project/tests/nodes/Worker.md').getFullPath())
    assert.deepEqual(repository.makeRaw(modelArl), {arl: '../tests/nodes/Worker.md', pathKind: 2})
    assert.equal(repository.readOnly, false)

    const node = sourceNode('Worker')
    node.testRepo = repository
    assert.deepEqual(node.makeRaw(modelArl).testRepo, {arl: '../tests/nodes/Worker.md', pathKind: 2})
})

test('a dock inherits its linked test repository as read-only and never serializes it', () => {
    const modelArl = new ARL('C:/library/model/library.mod.blu')
    const linked = sourceNode('Worker')
    linked.testRepo = new TestRepo().resolve({arl: '../tests/nodes/Worker.md', pathKind: 2}, modelArl)

    const dock = sourceNode('Imported worker')
    dock.fuse(linked)
    dock.link = {makeRaw: () => ({path: '../library/model/library.mod.blu', node: 'Worker'})}
    const raw = dock.makeRaw(new ARL('C:/application/model/app.mod.blu'))

    assert.equal(dock.testRepo.readOnly, true)
    assert.equal(raw.kind, 'dock')
    assert.equal(raw.testRepo, undefined)
})

test('Node Properties updates a local test repository but not a linked one', () => {
    const modelArl = new ARL('C:/project/model/app.mod.blu')
    const local = {link: null, testRepo: null, model: {getArl: () => modelArl}, sx: null, team: null}
    redoxNode.changeNodeSettings.doit({node: local, sx: null, team: null, testRepo: '../tests/nodes/Local.md'})
    assert.equal(local.testRepo.getPath(modelArl), '../tests/nodes/Local.md')

    const linked = {link: {}, testRepo: local.testRepo.clone({readOnly: true}), model: local.model, sx: null, team: null}
    redoxNode.changeNodeSettings.doit({node: linked, sx: null, team: null, testRepo: '../tests/nodes/Changed.md'})
    assert.equal(linked.testRepo.getPath(modelArl), '../tests/nodes/Local.md')
})

function sourceNode(name) {
    return new SourceNode(new Look({x: 0, y: 0, w: 120, h: 80}), name)
}
