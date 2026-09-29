import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelBlueprint, ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {ARL} from '../types/arl/arl-node.js'
import {Route} from '../types/node/route.js'
import {Cable} from '../types/node/cable.js'

function fixture() {
    const model = new ModelBlueprint(new ARL('C:/dev/artifacts/pending.mod.blu'))
    const compiler = new ModelCompiler(new UIDGenerator())
    const source = (name, input, x) => ({kind: 'source', name, rect: {x, y: 0, w: 160, h: 0},
        factory: {path: './node.js', function: 'Node'},
        interfaces: [{interface: '', pins: ['a', 'b', 'c'].map(name => ({name, kind: input ? 'input' : 'output'}))}]})
    const root = compiler.compileRawNode(model, {kind: 'group', name: 'Root',
        interfaces: [{interface: '', pins: [{name: 'entry', kind: 'input'}]}],
        nodes: [source('Sender', false, 0), source('Receiver', true, 600)]})
    const [output, input] = root.nodes.map(node => node.look.widgets.filter(w => w.is.pin))
    root.createRoute(output[0], input[0])
    const cable = new Cable({x: 350, y: 0})
    cable.wire = [{x: 350, y: 0}, {x: 350, y: 200}]
    root.cables.push(cable)
    for (const widget of [output[1], input[1]]) {
        const p = widget.center(), route = new Route(widget, null)
        route.wire = [p, {x: 350, y: p.y}]
        widget.routes.push(route)
        assert.ok(route.connect(cable))
    }
    return {model, compiler, root, output, input, cable}
}

for (const start of ['output', 'input', 'pad', 'cable']) {
    test(`saving during route drawing from ${start} preserves completed connections and the live gesture`, () => {
        const {model, compiler, root, output, input, cable} = fixture()
        const save = () => root.makeRaw(model.getArl())
        const baseline = save()
        const from = start === 'output' ? output[2] : start === 'input' ? input[2]
            : start === 'pad' ? root.pads[0] : cable.newTack()
        const pending = new Route(from, null)
        pending.wire = [{x: 350, y: 80}, {x: 450, y: 80}]
        if (from.is.tack) {
            from.route = pending
            from.placeOnSegment(pending.wire[0], 1)
        }
        else from.routes.push(pending)
        const wire = pending.copyWire()
        const tacks = cable.tacks.slice()
        assert.deepEqual(save(), baseline)
        assert.deepEqual(pending.wire, wire)
        assert.equal(pending.to, null)
        assert.deepEqual(cable.tacks, tacks)
        assert.ok(from.is.tack ? from.route === pending : from.routes.includes(pending))
        const restored = compiler.compileRawNode(model, baseline)
        assert.equal(restored.getConnectionRoutes().length, 3)
        assert.equal(restored.cables[0].tacks.length, 2)

        // Continue the very same gesture after saving; its completed route now
        // becomes persistent instead of being canceled or lost by the save.
        const to = start === 'input' ? output[2] : input[2]
        pending.endpoint(to)
        assert.ok(pending.connect(to))
        const complete = save()
        assert.equal(complete.routes.length, baseline.routes.length + 1)
        const reloaded = compiler.compileRawNode(model, complete)
        assert.equal(reloaded.getConnectionRoutes().length, 4)
    })
}

test('a newly allocated tack without a route is omitted from serialization and cable fan-out', () => {
    const {model, root, cable} = fixture()
    const baseline = root.makeRaw(model.getArl())
    const pending = cable.newTack()
    assert.equal(pending.route, null)
    assert.deepEqual(root.makeRaw(model.getArl()), baseline)
    assert.ok(cable.tacks.includes(pending))
})
