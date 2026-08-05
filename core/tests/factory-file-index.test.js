import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'

import {ARL} from '../types/arl/arl-node.js'
import {FactoryMap, ModelBlueprint, ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {Factory} from '../types/node/index.js'
import {importExportHandling} from '../nodes/model-manager/import-export.js'

const header = {
    version: '0.10.0',
    created: '2026-08-05T00:00:00.000Z',
    saved: '2026-08-05T00:00:00.000Z',
    utc: '2026-08-05T00:00:00.000Z',
    runtime: '@vizualmodel/vmblu-runtime/rt-base'
}

function makeModel(modelPath, raw) {
    const model = new ModelBlueprint(new ARL(modelPath))
    model.raw = raw
    model.is.main = true
    model.preCook()
    return model
}

function source(name, factoryPath, factoryFunction) {
    return {
        kind: 'source',
        name,
        factory: {
            path: factoryPath,
            function: factoryFunction
        }
    }
}

function compileAndEncode(modelPath, raw) {
    const model = makeModel(modelPath, raw)
    const compiler = new ModelCompiler(new UIDGenerator())
    const root = compiler.compileRawNode(model, raw.root)
    return {model, encoded: compiler.encode(root, model)}
}

test('FactoryMap reads canonical strings and legacy objects as file paths', () => {
    const model = makeModel('C:/project/model/main.mod.blu', {
        header,
        factories: [
            '../nodes/workspaces.js',
            {path: '../nodes/layout.js', function: 'ignoredLegacyName'}
        ],
        root: {kind: 'group', name: 'Root', nodes: []}
    })
    const factories = new FactoryMap()

    factories.cook(model)

    assert.deepEqual(factories.makeRaw(model.getArl()), [
        '../nodes/workspaces.js',
        '../nodes/layout.js'
    ])
})

test('encoding legacy input writes a string index and preserves node factory bindings', () => {
    const raw = {
        header,
        factories: [{path: '../nodes/workspaces.js', function: 'legacyIndexName'}],
        root: {
            kind: 'group',
            name: 'Root',
            nodes: [source('Spatial Workspace', '../nodes/workspaces.js', 'createSpatialWorkspaceNode')]
        }
    }

    const {encoded} = compileAndEncode('C:/project/model/main.mod.blu', raw)

    assert.deepEqual(encoded.factories, ['../nodes/workspaces.js'])
    assert.deepEqual(encoded.root.nodes[0].factory, {
        path: '../nodes/workspaces.js',
        function: 'createSpatialWorkspaceNode'
    })
})

test('encoding deduplicates factory files without merging node functions', () => {
    const raw = {
        header,
        root: {
            kind: 'group',
            name: 'Root',
            nodes: [
                source('Spatial Workspace', '../nodes/workspaces.js', 'createSpatialWorkspaceNode'),
                source('Action Workspace', '../nodes/workspaces.js', 'createActionWorkspaceNode')
            ]
        }
    }

    const {encoded} = compileAndEncode('C:/project/model/main.mod.blu', raw)

    assert.deepEqual(encoded.factories, ['../nodes/workspaces.js'])
    assert.equal(encoded.root.nodes[0].factory.function, 'createSpatialWorkspaceNode')
    assert.equal(encoded.root.nodes[1].factory.function, 'createActionWorkspaceNode')
})

test('exporting a node writes a canonical factory file index', async () => {
    const modelArl = new ARL('C:/project/library/exported.mod.blu')
    const firstFactory = new Factory()
    const secondFactory = new Factory()
    firstFactory.resolve('createSpatialWorkspaceNode', '../nodes/workspaces.js', modelArl)
    secondFactory.resolve('createActionWorkspaceNode', '../nodes/workspaces.js', modelArl)

    let savedRaw = null
    modelArl.save = async body => { savedRaw = JSON.parse(body) }
    const model = {header, getArl: () => modelArl}
    const exportedNode = {
        name: 'Exported',
        collectFactories(factories) {
            factories.add(firstFactory)
            factories.add(secondFactory)
        },
        collectModels() {},
        makeRaw(refArl) {
            return {
                kind: 'group',
                name: this.name,
                nodes: [
                    {kind: 'source', name: 'Spatial', factory: firstFactory.makeRaw(refArl)},
                    {kind: 'source', name: 'Action', factory: secondFactory.makeRaw(refArl)}
                ]
            }
        }
    }
    const node = {
        link: null,
        is: {group: false},
        copy: () => exportedNode,
        setLink() {}
    }
    const manager = {model: {getArl: () => modelArl}}

    await importExportHandling.exportToModel.call(manager, node, 'Workspace Group', model)

    assert.deepEqual(savedRaw.factories, ['../nodes/workspaces.js'])
    assert.equal(savedRaw.root.nodes[0].factory.function, 'createSpatialWorkspaceNode')
    assert.equal(savedRaw.root.nodes[1].factory.function, 'createActionWorkspaceNode')
})

test('encoding retains distinct factory files and produces schema-valid blueprint output', async () => {
    const raw = {
        header,
        root: {
            kind: 'group',
            name: 'Root',
            nodes: [
                source('Workspace', '../nodes/workspaces.js', 'createWorkspaceNode'),
                source('Layout', '../nodes/layout.js', 'createLayoutNode')
            ]
        }
    }

    const {model, encoded} = compileAndEncode('C:/project/model/main.mod.blu', raw)
    const blueprint = model.splitRaw(encoded).blu
    const schemaUrl = new URL('../../cli/context/0.10.0/blu.schema.json', import.meta.url)
    const schema = JSON.parse(await readFile(schemaUrl, 'utf8'))
    const validate = new Ajv2020({strict: false, validateFormats: false}).compile(schema)

    assert.deepEqual(encoded.factories, ['../nodes/workspaces.js', '../nodes/layout.js'])
    assert.equal(validate(blueprint), true, JSON.stringify(validate.errors))
})

test('factory paths round trip relative to the declaring model', () => {
    const model = makeModel('C:/project/models/main.mod.blu', {
        header,
        factories: ['../nodes/shared'],
        root: {kind: 'group', name: 'Root', nodes: []}
    })
    const factories = new FactoryMap()

    factories.cook(model)

    assert.deepEqual(factories.makeRaw(model.getArl()), ['../nodes/shared.js'])
    assert.equal(
        Array.from(factories.map.values())[0].arl.getFullPath(),
        'C:/project/nodes/shared.js'
    )
})

test('linked models contribute factory files relative to their own location', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-factory-links-'))

    try {
        const mainPath = path.join(dir, 'app', 'main.mod.blu')
        const linkedPath = path.join(dir, 'library', 'linked.mod.blu')
        await mkdir(path.dirname(mainPath), {recursive: true})
        await mkdir(path.dirname(linkedPath), {recursive: true})
        await writeFile(mainPath, JSON.stringify({
            header,
            imports: ['../library/linked.mod.blu'],
            factories: ['./main.js'],
            root: {kind: 'group', name: 'Root', nodes: []}
        }))
        await writeFile(linkedPath, JSON.stringify({
            header,
            factories: ['./nodes/linked.js'],
            root: {kind: 'group', name: 'Linked Root', nodes: []}
        }))
        await writeFile(mainPath.replace('.blu', '.viz'), JSON.stringify({
            header: {...header, style: '#202020'},
            root: {kind: 'group', name: 'Root', nodes: []}
        }))
        await writeFile(linkedPath.replace('.blu', '.viz'), JSON.stringify({
            header: {...header, style: '#202020'},
            root: {kind: 'group', name: 'Linked Root', nodes: []}
        }))

        const model = new ModelBlueprint(new ARL(mainPath))
        model.is.main = true
        await model.getRaw()
        const factories = await new ModelCompiler(new UIDGenerator()).getFactories(model)
        const indexedPaths = Array.from(factories.map.keys()).map(value => value.replace(/\\/g, '/'))

        assert.deepEqual(indexedPaths.sort(), [
            path.join(dir, 'app', 'main.js').replace(/\\/g, '/'),
            path.join(dir, 'library', 'nodes', 'linked.js').replace(/\\/g, '/')
        ].sort())
    } finally {
        await rm(dir, {recursive: true, force: true})
    }
})
