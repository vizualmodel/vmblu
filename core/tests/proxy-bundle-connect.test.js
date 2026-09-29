import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelBlueprint, ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {ARL} from '../types/arl/arl-node.js'
import {createBundle, expandBundle, matchBundleConnections} from '../types/widget/pin-bundle.js'
import {redoxBundle} from '../nodes/model-manager/redox-bundle.js'

function fixture(sourceProxy, targetProxy) {
    const leaf = (name, input) => ({kind: 'source', name, factory: {path: './node.js', function: 'Node'},
        interfaces: [{interface: '', pins: ['a', 'b'].map(name => ({name, kind: input ? 'input' : 'output', left: input}))}]})
    const endpoint = (name, input, proxy) => proxy ? {
        kind: 'group', name, nodes: [leaf(name + 'Inner', input)],
        interfaces: [{interface: name, pins: ['a', 'b'].map(local => ({name: name + '.' + local, kind: input ? 'input' : 'output', left: input}))}],
    } : leaf(name, input)
    const model = new ModelBlueprint(new ARL('C:/dev/artifacts/proxy-bundle.mod.blu'))
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: [
        endpoint('Sender', false, sourceProxy), endpoint('Receiver', true, targetProxy),
    ]})
    const pins = node => node.look.widgets.filter(widget => widget.is.pin)
    const [a, b] = root.nodes.map(pins)
    const leaves = root.nodes.map(node => node.nodes?.[0] ?? node)
    for (const node of root.nodes) {
        if (!node.nodes?.length) continue
        pins(node).forEach((proxy, i) => assert.ok(node.createRoute(pins(node.nodes[0])[i], proxy.pad)))
    }
    createBundle(a); createBundle(b)
    return {model, root, a, b, leaves}
}

for (const [sourceProxy, targetProxy] of [[true, true], [true, false], [false, true]]) {
    for (const reverse of [false, true]) {
        test(`proxy bundle wiring resolves internal connections and round-trips (${sourceProxy}, ${targetProxy}, reverse=${reverse})`, () => {
            const {model, root, a, b, leaves} = fixture(sourceProxy, targetProxy)
            const [from, to] = reverse ? [b[0], a[0]] : [a[0], b[0]]
            const edits = []
            const redox = {...redoxBundle, saveEdit(verb, param) { edits.push({verb, param}) },
                manager: {tx: {send(kind, data) { assert.fail(data.message) }}}}
            const start = from.center(), end = to.center()
            const drawnRoute = reverse ? {wire: [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]} : undefined
            const connect = () => redox.connectBundle.doit.call(redox, {view: {root}, from, to, drawnRoute})
            const targets = () => leaves[0].txTable.map(tx => tx.targets.map(pin => pin.name))
            connect()
            assert.equal(edits.length, 1)
            assert.equal(edits[0].param.routes.length, 2)
            assert.deepEqual(targets(), [['a'], ['b']])
            connect()
            assert.equal(edits.length, 1)
            assert.deepEqual(targets(), [['a'], ['b']])
            redox.connectBundle.undo(edits[0].param)
            assert.deepEqual(targets(), [[], []])
            assert.ok(a.every(pin => pin.routes.length === 0))
            redox.connectBundle.redo(edits[0].param)
            assert.deepEqual(targets(), [['a'], ['b']])

            const raw = {header: model.header.copyWithoutStyle(), root: root.makeRaw(model.getArl())}
            const saved = model.splitRaw(raw)
            const joined = structuredClone(saved.blu)
            model.joinNode(joined.root, structuredClone(saved.viz.root))
            const restored = new ModelCompiler(new UIDGenerator()).compileRawNode(model, joined.root)
            restored.rxtxBuildTxTable()
            const sender = restored.nodes[0].nodes?.[0] ?? restored.nodes[0]
            assert.deepEqual(sender.txTable.map(tx => tx.targets.map(pin => pin.name)), [['a'], ['b']])
            for (const node of restored.nodes) {
                const first = node.look.widgets.find(widget => widget.is.pin)
                assert.equal(first.bundle.length, 2)
                expandBundle(first)
            }
            assert.deepEqual(sender.txTable.map(tx => tx.targets.map(pin => pin.name)), [['a'], ['b']])
        })
    }
}

test('proxy bundles still reject invalid member kinds and non-pin endpoints', () => {
    const {a, b} = fixture(true, true)
    for (const target of [b[0].pad, {is: {cable: true}}]) {
        assert.match(matchBundleConnections(a[0], target).error, /buses or pads/)
    }
    b[1].is.channel = true
    assert.match(matchBundleConnections(a[0], b[0]).error, /Invalid connection/)
    b[1].is.channel = false
    b[1].is.input = false
    assert.match(matchBundleConnections(a[0], b[0]).error, /Invalid connection/)
})
