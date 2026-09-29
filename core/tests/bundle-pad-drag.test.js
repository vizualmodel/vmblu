import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {createBundle, bundleRect} from '../types/widget/pin-bundle.js'
import {Route} from '../types/node/route.js'
import {Pad} from '../types/node/pad.js'

for (const member of [true, false]) {
    test(`pad dragging aligns with displayed ${member ? 'bundle member' : 'pin below bundle'} and keeps anchors`, () => {
        const node = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'pad.mod.blu', getArl: () => null},
            {kind: 'source', name: 'Node', rect: {x: 400, y: 100, w: 200, h: 0}, factory: {path: './node.js', function: 'Node'},
                interfaces: [{interface: '', pins: ['a', 'b', 'c'].map(name => ({name, kind: 'input', left: true}))}]})
        const pins = node.look.widgets.filter(widget => widget.is.pin)
        createBundle(pins.slice(0, 2))
        const pin = pins[member ? 1 : 2]
        const rect = bundleRect(pin), y = rect.y + rect.h / 2
        const pad = new Pad({x: 80, y: y + 50 - 5, w: 40, h: 10}, {is: {left: true}, name: 'pad'})
        const route = new Route(pin, pad)
        pin.routes.push(route); pad.routes.push(route)
        route.wire = [pin.center(), {x: pad.center().x, y: pin.center().y}, pad.center()]
        const before = route.copyWire()
        pad.drag({x: pad.center().x, y}, {x: 0, y: -50})
        assert.equal(pad.center().y, y)
        assert.ok(route.bundleRouteWire().every(point => point.y === y))
        assert.deepEqual(route.wire[0], pin.center())
        assert.deepEqual(route.wire.at(-1), pad.center())
        pad.endDrag()
        assert.ok(route.bundleRouteWire().every(point => point.y === y))
        assert.deepEqual(route.wire.at(-1), pad.center())
        // Repeated moves must not accumulate the collapsed/expanded offset.
        for (let i = 0; i < 3; i++) {
            pad.drag({x: pad.center().x - 20, y}, {x: -20, y: 0})
            pad.endDrag()
            assert.equal(pad.center().y, y)
            assert.deepEqual(route.wire[0], pin.center())
            assert.deepEqual(route.wire.at(-1), pad.center())
        }
        route.restoreWire(before)
        assert.deepEqual(route.wire, before)
    })
}
