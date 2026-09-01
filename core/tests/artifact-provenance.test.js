import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import {ARL} from '../types/arl/arl-node.js'
import {makeArtifactProvenance, ModelBlueprint, ModelHeader, sourceHash} from '../types/model/index.js'
import {runtimeSettingsForSave} from '../types/node/runtime-settings-json.js'

test('artifact provenance is deterministic and insensitive to object key order', () => {
    const first = {header: {version: '1.10.1'}, root: {name: 'App', kind: 'group'}}
    const second = {root: {kind: 'group', name: 'App'}, header: {version: '1.10.1'}}

    assert.equal(sourceHash(first), sourceHash(second))
    assert.deepEqual(
        makeArtifactProvenance({artifact: 'application', model: 'app.mod.blu', source: first}),
        makeArtifactProvenance({artifact: 'application', model: 'app.mod.blu', source: second})
    )
})

test('safe runtime generation embeds the root model base directory', () => {
    const projectRoot = path.resolve('project').replaceAll('\\', '/')
    const modelBaseDir = `${projectRoot}/model`
    const model = new ModelBlueprint(new ARL(`${modelBaseDir}/app.mod.blu`))
    model.raw = {header: {version: '1.12.0'}, root: {kind: 'group', name: 'App', nodes: []}}
    model.header.runtime = '@vizualmodel/vmblu-runtime/rt-als'
    model.header.runtimeSettings = {security: {
        fs: {read: {mode: 'deny'}, write: {mode: 'allow', roots: ['./out']}, delete: {mode: 'deny'}},
        net: {egress: {mode: 'deny'}},
        process: {exec: {mode: 'deny'}},
    }}
    const root = {name: 'App', collectImports() {}, makeSourceLists() {}}

    const source = model.makeJSApp(root, new ARL(`${projectRoot}/build/app.app.js`), new ARL(`${modelBaseDir}/index.js`), model.header.runtime)
    assert.ok(source.includes(`securityBaseDir: ${JSON.stringify(modelBaseDir)}`))
})

test('model header canonicalizes legacy application security on load', () => {
    const header = new ModelHeader()
    header.cook(null, {
        version: '1.12.0',
        runtime: '@vizualmodel/vmblu-runtime/rt-als',
        runtimeSettings: {security: {
            defaults: {fs: 'warn', net: 'allow', process: 'deny'},
            allow: {fsRoots: ['./out'], netHosts: ['localhost']},
        }},
    })
    const saved = header.copyWithoutStyle()
    assert.deepEqual(saved.runtimeSettings.security.fs.write, {mode: 'warn', roots: ['./out']})
    assert.equal(saved.runtimeSettings.security.defaults, undefined)
})

test('model header preserves and canonicalizes security for an unsupported runtime', () => {
    const header = new ModelHeader()
    header.cook(null, {
        version: '1.12.0',
        runtime: '@vizualmodel/vmblu-runtime/rt-base',
        runtimeSettings: {security: {
            mode: 'off',
            defaults: {fs: 'warn', net: 'allow', process: 'deny'},
            allow: {fsRoots: ['./out'], netHosts: ['localhost']},
        }},
    })

    const saved = header.copyWithoutStyle()
    assert.equal(saved.runtimeSettings.security.enabled, false)
    assert.deepEqual(saved.runtimeSettings.security.fs.write, {mode: 'warn', roots: ['./out']})
    assert.equal(saved.runtimeSettings.security.defaults, undefined)
})

test('node serialization removes legacy node-owned security', () => {
    assert.deepEqual(runtimeSettingsForSave({
        monitor: {logMessages: true},
        security: {enabled: true},
    }), {monitor: {logMessages: true}})
    assert.equal(runtimeSettingsForSave({security: {enabled: true}}), null)
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
