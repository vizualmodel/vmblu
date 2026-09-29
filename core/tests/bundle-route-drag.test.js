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
import {Route} from '../types/node/route.js'
import {zap} from '../types/view/mouse.js'
import {bundleRect} from '../types/widget/pin-bundle.js'

test('drawing previews snap to collapsed destination rows before release', () => {
    const {a, b, routes} = fixture()
    for (const route of routes) route.disconnect()
    expandBundle(a[0]); expandBundle(b[0])
    createBundle(b.slice(0, 2))
    const target = b[2] // An ordinary pin shifted upwards by the bundle above it.
    const route = new Route(a[0], null)
    a[0].routes.push(route)
    const start = a[0].center(), end = target.center()
    route.wire = [start, {x: 350, y: start.y}, {x: 350, y: end.y}, end]
    const view = {hit: {what: zap.pin, lookWidget: target}, mouseHit() {}, hover() {}}
    mouseMoveHandling.drawRoute.call(view, route, end)
    const preview = route.bundleRouteWire()
    assert.equal(preview.at(-1).y, bundleRect(target).y + target.rect.h / 2)
    assert.notEqual(preview.at(-1).y, target.center().y)
    assert.deepEqual(route.wire.at(-1), target.center())
    orthogonal(preview)
    route.setBundlePreviewTarget(null)
    assert.ok(route.connect(target))
    assert.deepEqual(route.bundleRouteWire(), preview)
    route.disconnect()
    route.to = null
    view.hit.what = zap.pin
    view.hit.lookWidget = b[0]
    mouseMoveHandling.drawRoute.call(view, route, b[0].center())
    assert.equal(route.bundleRouteWire().at(-1).y, bundleRect(b[0]).y + b[0].rect.h / 2)
    view.hit.what = null
    mouseMoveHandling.drawRoute.call(view, route, {x: 400, y: 400})
    assert.equal(route.bundlePreviewTarget, undefined)
})

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

test('bundle projection tolerates rounded endpoint bends without changing stored geometry', () => {
    const {route} = fixture()
    route.wire[1].y = Math.round(route.wire[0].y)
    route.wire.at(-2).y = Math.round(route.wire.at(-1).y)
    const saved = route.copyWire()
    const display = route.bundleRouteWire()
    orthogonal(display)
    assert.equal(display[1].x, saved[1].x)
    assert.equal(display.at(-2).x, saved.at(-2).x)
    assert.deepEqual(route.wire, saved)
    route.restoreBundleRouteWire(display)
    orthogonal(route.wire)
})

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

test('a straight bundled line stays anchored without acquiring bends', () => {
    const {route, routes} = fixture(true)
    const oldWire = route.copyWire()
    const other = routes.find(member => member !== route)
    const otherWire = other.copyWire()
    route.beginBundleRouteDrag(1)
    route.moveBundleRouteDrag({x: 0, y: 35})
    route.moveBundleRouteDrag({x: 0, y: 10})
    const display = structuredClone(route.bundleRouteWire())
    assert.equal(display.length, 2)
    route.endBundleRouteDrag()
    assert.deepEqual(route.bundleRouteWire(), display)
    assert.deepEqual(route.wire[0], oldWire[0])
    assert.deepEqual(route.wire.at(-1), oldWire.at(-1))
    assert.deepEqual(route.wire, oldWire)
    assert.deepEqual(other.wire, otherWire)
    orthogonal(route.wire)
})

test('unbundled pins on a bundled node retain fixed end segments', () => {
    const {a, b, route} = fixture()
    expandBundle(a[0]); expandBundle(b[0])
    createBundle(b.filter(pin => pin !== route.to))
    assert.ok(!route.from.bundle && !route.to.bundle)
    const before = route.copyWire()
    for (const segment of [1, route.wire.length - 1]) {
        assert.equal(route.beginBundleRouteDrag(segment), true)
        route.moveBundleRouteDrag({x: 0, y: 30})
        route.endBundleRouteDrag()
        assert.deepEqual(route.wire, before)
    }
})

for (const bundled of [false, true]) {
    for (const side of ['before', 'after']) {
        test(`projected horizontal segments fuse ${side} the drag (bundled pins: ${bundled})`, () => {
            const {a, b, route} = fixture()
            if (!bundled) {
                expandBundle(a[0]); expandBundle(b[0])
                createBundle(b.filter(pin => pin !== route.to))
            }
            const start = route.from.center(), end = route.to.center()
            route.wire = [start, {x: 300, y: start.y}, {x: 300, y: start.y + 60},
                {x: 450, y: start.y + 60}, {x: 450, y: end.y}, end]
            const before = route.copyWire()
            const display = structuredClone(route.bundleRouteWire())
            const targetY = side === 'before' ? display[0].y : display.at(-1).y
            route.beginBundleRouteDrag(3)
            route.moveBundleRouteDrag({x: 0, y: targetY + 5 - display[2].y})
            route.endBundleRouteDrag()
            assert.equal(route.wire.length, 4)
            assert.deepEqual(route.wire[0], start)
            assert.deepEqual(route.wire.at(-1), end)
            orthogonal(route.wire)
            orthogonal(route.bundleRouteWire())
            const after = route.copyWire()
            redoxRoute.routeDrag.undo({route, oldWire: before, newWire: after})
            assert.deepEqual(route.wire, before)
            redoxRoute.routeDrag.redo({route, oldWire: before, newWire: after})
            assert.deepEqual(route.wire, after)
        })
    }
}

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
