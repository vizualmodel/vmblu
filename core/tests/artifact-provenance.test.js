import assert from 'node:assert/strict'
import test from 'node:test'

import {ARL} from '../types/arl/arl-node.js'
import {makeArtifactProvenance, ModelBlueprint, sourceHash} from '../types/model/index.js'

test('artifact provenance is deterministic and insensitive to object key order', () => {
    const first = {header: {version: '1.10.1'}, root: {name: 'App', kind: 'group'}}
    const second = {root: {kind: 'group', name: 'App'}, header: {version: '1.10.1'}}

    assert.equal(sourceHash(first), sourceHash(second))
    assert.deepEqual(
        makeArtifactProvenance({artifact: 'application', model: 'app.mod.blu', source: first}),
        makeArtifactProvenance({artifact: 'application', model: 'app.mod.blu', source: second})
    )
})

test('application and capability generators embed current deterministic provenance', () => {
    const model = new ModelBlueprint(new ARL('C:/project/model/app.mod.blu'))
    model.raw = {
        header: {version: '1.10.1', runtime: '@vizualmodel/vmblu-runtime/rt-base'},
        root: {kind: 'group', name: 'App', nodes: []},
    }
    const root = {
        name: 'App',
        collectImports() {},
        makeSourceLists() {},
    }

    const first = model.makeJSApp(root, model.getArl().resolve('./app.app.js'), model.getArl().resolve('./index.js'), '@vizualmodel/vmblu-runtime/rt-base')
    const second = model.makeJSApp(root, model.getArl().resolve('./app.app.js'), model.getArl().resolve('./index.js'), '@vizualmodel/vmblu-runtime/rt-base')
    const marker = first.match(/^\/\/ @vmblu-generated (\{.*\})$/m)

    assert.equal(first, second)
    assert.ok(marker)
    assert.equal(JSON.parse(marker[1]).source.hash, sourceHash(model.raw))

    const capabilities = model.makeCapabilityObject(root)
    assert.equal(capabilities.provenance.artifact, 'capabilities')
    assert.equal(capabilities.provenance.source.hash, sourceHash(model.raw))
})
