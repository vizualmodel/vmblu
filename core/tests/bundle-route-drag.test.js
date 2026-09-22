import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {createBundle, expandBundle} from '../types/widget/pin-bundle.js'
import {mouseDownHandling} from '../types/view/mouse-down.js'
import {mouseMoveHandling} from '../types/view/mouse-move.js'
import {mouseUpHandling} from '../types/view/mouse-up.js'
import {mouseHandling} from '../types/view/mouse.js'
import {Selection} from '../types/view/selection.js'
import {doing} from '../types/view/view-base.js'
import {redoxRoute} from '../nodes/model-manager/redox-route.js'

function fixture(straight = false) {
    const source = (name, x, y, kind) => ({kind: 'source', name, rect: {x, y, w: 160, h: 0},
        factory: {path: './node.js', function: name},
        interfaces: [{interface: '', pins: ['a', 'b', 'c'].map(name => ({name, kind, left: kind === 'input'}))}]})
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'drag.mod.blu', getArl: () => null},
        {kind: 'group', name: 'Root', nodes: [source('Sender', 0, 0, 'output'), source('Receiver', 600, straight ? 0 : 120, 'input')]})
    const [a, b] = root.nodes.map(node => node.look.widgets.filter(widget => widget.is.pin))
    const routes = [root.createRoute(a[1], b[1]), root.createRoute(a[2], b[2])]
    for (const route of routes) {
        const start = route.from.center(), end = route.to.center()
        route.wire = straight ? [start, end] : [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]
    }
    createBundle(a); createBundle(b)
    return {root, a, b, route: routes[0].bundleRoutes()[0], routes}
}

function orthogonal(wire) {
    for (let i = 1; i < wire.length; i++) assert.ok(wire[i].x === wire[i - 1].x || wire[i].y === wire[i - 1].y)
}

test('projected segment dragging edits only its representative, preserves anchors, and survives expansion and undo', () => {
    const {a, b, route, routes} = fixture()
    const other = routes.find(member => member !== route)
    const oldWire = route.copyWire(), otherWire = other.copyWire()
    const display = structuredClone(route.bundleRouteWire())
    assert.notEqual(display[0].y, oldWire[0].y)
    assert.equal(route.beginBundleRouteDrag(2), true)
    route.moveBundleRouteDrag({x: 45, y: 0})
    const dragged = structuredClone(route.bundleRouteWire())
    assert.equal(dragged[1].x, display[1].x + 45)
    assert.deepEqual(other.bundleRouteWire(), dragged)
    assert.deepEqual(route.wire, oldWire)
    route.endBundleRouteDrag()
    assert.deepEqual(route.bundleRouteWire(), dragged)
    assert.deepEqual(route.wire[0], route.from.center())
    assert.deepEqual(route.wire.at(-1), route.to.center())
    assert.deepEqual(other.wire, otherWire)
    orthogonal(route.wire)
    const newWire = route.copyWire()
    redoxRoute.routeDrag.undo({route, oldWire, newWire})
    assert.deepEqual(route.bundleRouteWire(), display)
    redoxRoute.routeDrag.redo({route, oldWire, newWire})
    assert.deepEqual(route.bundleRouteWire(), dragged)
    expandBundle(a[0]); expandBundle(b[0])
    assert.deepEqual(route.wire, newWire)
    assert.deepEqual(other.wire, otherWire)
})

test('a straight bundled line can acquire bends without moving pins or other routes', () => {
    const {route, routes} = fixture(true)
    const oldWire = route.copyWire()
    const other = routes.find(member => member !== route)
    const otherWire = other.copyWire()
    route.beginBundleRouteDrag(1)
    route.moveBundleRouteDrag({x: 0, y: 35})
    route.moveBundleRouteDrag({x: 0, y: 10})
    const display = structuredClone(route.bundleRouteWire())
    assert.equal(display[2].y, display[0].y + 45)
    route.endBundleRouteDrag()
    assert.deepEqual(route.bundleRouteWire(), display)
    assert.deepEqual(route.wire[0], oldWire[0])
    assert.deepEqual(route.wire.at(-1), oldWire.at(-1))
    assert.deepEqual(other.wire, otherWire)
    orthogonal(route.wire)
})

test('clicking or moving along a segment does not change saved route geometry', () => {
    const {route} = fixture()
    const before = route.copyWire()
    route.beginBundleRouteDrag(2)
    route.moveBundleRouteDrag({x: 0, y: 12})
    route.endBundleRouteDrag()
    assert.deepEqual(route.wire, before)
    assert.equal(route.bundleDrag, undefined)
})

test('mouse handlers select bundled routes and commit the captured route when released over empty space', () => {
    const {root, route, routes} = fixture()
    const edits = []
    const tx = {send() { assert.fail('Dragging should not display a blocking message') }}
    const view = {...mouseHandling, ...mouseDownHandling, ...mouseMoveHandling, ...mouseUpHandling,
        root, selection: new Selection(), tf: {sx: 1, sy: 1},
        state: {action: doing.nothing, modo: {}}, hit: {xyLocal: {}, xyScreen: {}},
        stateSwitch(action) { this.state.action = action },
        doEdit(tx, verb, param) { edits.push({verb, param}) },
    }
    const wire = route.bundleRouteWire()
    const pos = {x: wire[1].x, y: (wire[1].y + wire[2].y) / 2}
    view.onMouseDown(pos, {button: 0, x: pos.x, y: pos.y}, tx)
    assert.equal(view.state.action, doing.routeDrag)
    assert.equal(view.state.route, route)
    assert.equal(route.is.selected, true)
    assert.equal(routes.filter(member => member.is.selected).length, 1)
    const oldWire = route.copyWire()
    view.onMouseMove({x: pos.x + 40, y: pos.y}, {movementX: 40, movementY: 0}, tx)
    view.onMouseUp({x: 2000, y: 2000}, {}, tx)
    assert.equal(edits.length, 1)
    assert.equal(edits[0].verb, 'routeDrag')
    assert.equal(edits[0].param.route, route)
    assert.deepEqual(edits[0].param.oldWire, oldWire)
    assert.notDeepEqual(route.wire, oldWire)
    assert.equal(view.state.action, doing.nothing)
    assert.equal(route.bundleDrag, undefined)
    assert.equal(route.is.selected, false)
})
