import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {Selection} from '../types/view/selection.js'
import {mouseDownHandling} from '../types/view/mouse-down.js'
import {mouseHandling, zap} from '../types/view/mouse.js'
import {doing} from '../types/view/view-base.js'
import {redoxRoute} from '../nodes/model-manager/redox-route.js'

function fixture() {
    const source = (name, x, kind) => ({kind: 'source', name, rect: {x, y: 100, w: 150, h: 0},
        factory: {path: './node.js', function: name}, interfaces: [{interface: '', pins: [{name: 'message', kind, left: kind === 'input'}]}]})
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode({fullPath: () => 'alt.mod.blu', getArl: () => null},
        {kind: 'group', name: 'Root', nodes: [source('Sender', 0, 'output'), source('Receiver', 400, 'input'), source('Other', 800, 'input')]})
    const pins = root.nodes.map(n => n.look.widgets.find(w => w.is.pin))
    const edits = []
    const manager = {saveEdit(verb, data) { edits.push({verb, ...data}) }}
    const view = {...mouseDownHandling, root, selection: new Selection(),
        state: {action: doing.nothing}, hit: {xyLocal: {}, xyScreen: {}}, keyMask: mouseHandling.keyMask,
        saveHitSpot: mouseDownHandling.saveHitSpot,
        mouseHit() {}, stateSwitch(action) { this.state.action = action }, blinkToWarn() {},
        doEdit(tx, verb, data) { redoxRoute[verb].doit.call(manager, data) },
    }
    const click = (pin, event = {}) => {
        view.hit.what = zap.pin
        view.hit.node = pin.node
        view.hit.lookWidget = pin
        view.onMouseDown(pin.center(), {button: 0, altKey: true, x: 0, y: 0, ...event}, {})
    }
    return {root, pins, edits, manager, view, click}
}

test('Alt-click creates an automatic route, preserves selection and supports undo/redo', () => {
    const {pins: [from, to, other], edits, manager, view, click} = fixture()
    view.selection.singleNodeAndWidget(from.node, from)
    click(to)
    assert.equal(edits.length, 1)
    const edit = edits[0]
    assert.equal(edit.verb, 'routeAutoConnect')
    assert.equal(from.routes[0], to.routes[0])
    assert.ok(edit.route.wire.length >= 2)
    for (let i=1; i<edit.route.wire.length; i++) {
        const a = edit.route.wire[i-1], b = edit.route.wire[i]
        assert.ok(a.x === b.x || a.y === b.y)
    }
    assert.equal(view.selection.getSelectedWidget(), from)
    assert.equal(view.state.action, doing.nothing)
    const wire = structuredClone(edit.route.wire)
    redoxRoute.routeAutoConnect.undo.call(manager, edit)
    assert.equal(from.routes.length, 0)
    assert.equal(to.routes.length, 0)
    redoxRoute.routeAutoConnect.redo.call(manager, edit)
    assert.deepEqual(edit.route.wire, wire)
    assert.equal(from.routes[0], to.routes[0])
    click(to)
    click(from)
    assert.equal(edits.length, 1)
    click(other)
    assert.equal(edits.length, 2)
    assert.equal(from.routes.length, 2)
    assert.equal(view.selection.getSelectedWidget(), from)
})

test('Alt-click accepts reverse selection order and rejects incompatible directions', () => {
    const {pins: [from, to, other], edits, view, click} = fixture()
    view.selection.singleNodeAndWidget(to.node, to)
    click(other)
    assert.equal(edits.length, 0)
    click(from)
    assert.equal(edits.length, 1)
    assert.equal(view.selection.getSelectedWidget(), to)
})

test('Alt-click without a selected pin or with a non-left button creates no route', () => {
    const {pins: [from, to], edits, view, click} = fixture()
    click(to)
    view.selection.singleNode(from.node)
    click(to)
    view.selection.singleNodeAndWidget(from.node, from)
    click(to, {button: 2})
    assert.equal(edits.length, 0)
    assert.equal(from.routes.length, 0)
})
