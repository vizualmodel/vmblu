import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {createBundle} from '../types/widget/pin-bundle.js'

function fixture(gap, collapse = true, reverse = false) {
    const source = (name, x, y, input) => ({kind: 'source', name, rect: {x, y, w: 200, h: 0},
        factory: {path: './node.js', function: 'Node'},
        interfaces: [{interface: '', pins: ['a', 'b', 'c', 'div'].map(name => ({name, kind: input ? 'input' : 'output', left: input}))}]})
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'snap.mod.blu', getArl: () => null},
        {kind: 'group', name: 'Root', nodes: [source('Sender', 0, 0, false), source('Receiver', 500, gap, true)]})
    const [a, b] = root.nodes.map(node => node.look.widgets.filter(widget => widget.is.pin))
    if (collapse) createBundle(a.slice(0, 3))
    const route = root.createRoute(...(reverse ? [b[3], a[3]] : [a[3], b[3]]))
    const start = route.from.center(), end = route.to.center()
    route.wire = [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]
    return {root, a, b, route}
}

for (const reverse of [false, true]) {
    for (const moving of [0, 1]) {
        test(`nearby displayed pins snap below a bundle (reverse=${reverse}, moving=${moving})`, () => {
            const {root, route} = fixture(-25, true, reverse)
            const look = root.nodes[moving].look
            const before = look.rect.y
            look.snapRoutes()
            assert.equal(look.rect.y - before, moving === 0 ? 5 : -5)
            const display = route.bundleRouteWire()
            assert.equal(display[0].y, display.at(-1).y)
            assert.deepEqual(route.wire[0], route.from.center())
            assert.deepEqual(route.wire.at(-1), route.to.center())
        })

        test(`distant displayed pins do not snap despite close stored coordinates (reverse=${reverse}, moving=${moving})`, () => {
            const {root, route} = fixture(5, true, reverse)
            const look = root.nodes[moving].look
            const before = look.rect.y, wire = route.copyWire()
            look.snapRoutes()
            assert.equal(look.rect.y, before)
            assert.deepEqual(route.wire, wire)
        })
    }
}

test('ordinary unbundled pin snapping is unchanged', () => {
    const {root, route} = fixture(5, false)
    const before = root.nodes[0].look.rect.y
    root.nodes[0].look.snapRoutes()
    assert.equal(root.nodes[0].look.rect.y - before, 5)
    assert.equal(route.wire[0].y, route.wire.at(-1).y)
})

test('two bundled endpoints snap by their displayed rows rather than member offsets', () => {
    const {root, a, b, route} = fixture(5, false)
    route.disconnect()
    createBundle(a); createBundle(b)
    const bundled = root.createRoute(a[2], b[1])
    const start = bundled.from.center(), end = bundled.to.center()
    bundled.wire = [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]
    const before = root.nodes[0].look.rect.y
    root.nodes[0].look.snapRoutes()
    assert.equal(root.nodes[0].look.rect.y - before, 5)
    const display = bundled.bundleRouteWire()
    assert.equal(display[0].y, display.at(-1).y)
})

test('hidden bundle routes cannot supply a different snap target', () => {
    const {root, a, b, route} = fixture(80, false)
    createBundle(a); createBundle(b)
    // The earlier member supplies the rendered route. The div route is hidden
    // and has a nearby bend that must not pull the node away from its position.
    const visible = root.createRoute(a[0], b[0])
    const start = visible.from.center(), end = visible.to.center()
    visible.wire = [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]
    const p = route.from.center(), q = route.to.center()
    route.wire = [p, {x: 250, y: p.y}, {x: 250, y: p.y + 5},
        {x: 350, y: p.y + 5}, {x: 350, y: q.y}, q]
    assert.equal(route.bundleRoutes()[0], visible)
    const before = root.nodes[0].look.rect.y
    root.nodes[0].look.snapRoutes()
    assert.equal(root.nodes[0].look.rect.y, before)
})
