import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator, makeArtifactProvenance, ModelBlueprint} from '../types/model/index.js'
import {ARL} from '../types/arl/arl-node.js'
import {Route} from '../types/node/route.js'
import {RawHandling} from '../types/model/blueprint-raw.js'
import {convert} from '../types/util/convert.js'
import {createBundle, expandBundle, bundleRect, restorePinBundles, matchBundleConnections, createBundleFromList, removeBundleMember} from '../types/widget/pin-bundle.js'
import {redoxBundle} from '../nodes/model-manager/redox-bundle.js'
import {redoxWidget} from '../nodes/model-manager/redox-widget.js'
import {Selection} from '../types/view/selection.js'
import {redoxPinArea} from '../nodes/model-manager/redox-pin-area.js'
import {dragBundle} from '../types/widget/pin-bundle.js'
import {beginBundleTextEdit} from '../types/widget/bundle-text-edit.js'
import {TextEdit} from '../types/util/text-edit.js'

const model = {fullPath: () => 'bundle.mod.blu', getArl: () => null, header: {copyWithoutStyle: () => ({version: '1.12.3'})}}
function fixture(names = ['new', 'add', 'remove'], input = true, iface = 'items') {
    const raw = {kind: 'source', name: iface || 'node', rect: {x: 0, y: 0, w: 200, h: 0}, factory: {path: './node.js', function: 'Node'},
        interfaces: [{interface: iface, pins: names.map(name => ({name: iface ? iface + '.' + name : name, kind: input ? 'input' : 'output', left: input}))}]}
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
    return {node, pins: node.look.widgets.filter(widget => widget.is.pin)}
}
function harness() {
    return {...redoxBundle, saveEdit(verb, param) { this.edit = {verb, param} }, manager: {tx: {send() {}}}}
}

test('bundle list edits reuse renamed pins and preserve connections and layout through undo', () => {
    const {node, pins} = fixture(['a', 'b', 'c'])
    const output = fixture(['a', 'b', 'c'], false, 'out')
    output.node.look.moveDelta(500, 0)
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: []})
    root.nodes = [node, output.node]
    const routes = pins.map((pin, i) => root.createRoute(output.pins[i], pin))
    const wires = routes.map(route => route.copyWire())
    const positions = node.look.widgets.map(widget => [widget, {...widget.rect}])
    pins[2].prompt = 'Keep this profile'
    createBundle(pins)
    const view = {selection: new Selection()}
    const redox = harness()
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: 'c, a, d'})
    const edit = redox.edit.param
    const next = edit.next
    assert.equal(next[0], pins[2])
    assert.equal(next[1], pins[0])
    assert.equal(next[2].name, 'items.d')
    assert.equal(next[0].prompt, 'Keep this profile')
    assert.equal(next[2], pins[1])
    assert.equal(next[2].routes[0], routes[1])
    assert.ok(node.look.widgets.includes(pins[1]))
    assert.equal(output.pins[1].routes.length, 1)
    assert.equal(next[0].routes[0], routes[2])
    assert.equal(new Set(next.map(pin => pin.rect.y)).size, 3)
    const wid = next[2].wid
    for (let i = 0; i < 3; i++) {
        redox.editBundle.undo(edit)
        assert.deepEqual(pins[0].bundle, pins)
        assert.deepEqual(routes.map(route => route.copyWire()), wires)
        assert.deepEqual(node.look.widgets.map(widget => [widget, {...widget.rect}]), positions)
        assert.equal(pins[1].routes[0], routes[1])
        redox.editBundle.redo(edit)
        assert.deepEqual(next[0].bundle, next)
        assert.equal(next[2].wid, wid)
        assert.equal(output.pins[1].routes.length, 1)
    }
})

test('bundle list validation, no-op, singleton and empty edits are atomic', () => {
    const {node, pins} = fixture(['a', 'b', 'c', 'other'])
    createBundle(pins.slice(0, 3))
    const view = {selection: new Selection()}
    const redox = harness()
    for (const text of ['a,b,c', 'a,,b', 'a,a', 'a,other']) {
        redox.editBundle.doit.call(redox, {view, pin: pins[0], text})
        assert.equal(redox.edit, undefined)
        assert.equal(pins[0].bundle.length, 3)
    }
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: 'b'})
    assert.equal(pins[1].bundle, null)
    assert.ok(node.look.widgets.includes(pins[1]))
    redox.editBundle.undo(redox.edit.param)
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: ''})
    assert.ok(pins.slice(0, 3).every(pin => !node.look.widgets.includes(pin)))
    assert.ok(node.look.widgets.includes(pins[3]))
    redox.editBundle.undo(redox.edit.param)
    assert.equal(pins[0].bundle.length, 3)
})

test('inline bundle buffer never changes pin names and Escape discards it', () => {
    const {pins} = fixture(['a', 'b'])
    createBundle(pins)
    const field = new TextEdit()
    const view = {textField: field, beginTextEdit(session) {
        const {prop, index} = session.startEdit({measureText: text => ({width: text.length * 8})})
        field.newEdit(session, prop, index)
    }}
    const commits = []
    beginBundleTextEdit(view, pins[0], null, false, text => commits.push(text))
    field.obj.text = 'a, c'
    assert.deepEqual(pins.map(pin => pin.name), ['items.a', 'items.b'])
    field.handleSpecialKey({key: 'Escape'})
    field.obj.endEdit(field.saved)
    assert.deepEqual(commits, [])
    assert.equal(pins[0].bundleEdit, undefined)
    assert.equal(field.saved, null)
    beginBundleTextEdit(view, pins[0], null, false, text => commits.push(text))
    field.obj.text = 'b, d'
    field.obj.endEdit(field.saved)
    assert.deepEqual(commits, ['b, d'])
    assert.equal(field.obj.text, '')
})

test('bundle editing preserves retained postfix names rather than reinterpreting their labels', () => {
    const {node, pins} = fixture(['a', 'b'])
    pins[0].name = 'a.items'
    pins[0].pxlen = -5
    pins[1].name = 'b.items'
    pins[1].pxlen = -5
    createBundle(pins)
    const redox = harness(), view = {selection: new Selection()}
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: `${pins[1].displayName(false)},${pins[0].displayName(false)},c`})
    assert.deepEqual(redox.edit.param.next.map(pin => pin.name), ['b.items', 'a.items', 'items.c'])
    assert.equal(redox.edit.param.next[0], pins[1])
    redox.editBundle.undo(redox.edit.param)
    assert.deepEqual(node.look.widgets.filter(widget => widget.is.pin), pins)
})

test('proxy bundle renames reuse pads, metadata and both sets of connections', () => {
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Group', nodes: [],
        interfaces: [{interface: 'commands', pins: ['a', 'b', 'c'].map(name => ({name: 'commands.' + name, kind: 'input', left: true}))}]})
    const pins = node.look.widgets.filter(widget => widget.is.pin)
    createBundle(pins)
    const pads = node.pads.slice()
    const inside = fixture(['b'], true), outside = fixture(['b'], false)
    node.nodes = [inside.node]
    const internal = new Route(pads[1], null)
    pads[1].routes.push(internal)
    assert.ok(internal.connect(inside.pins[0]))
    internal.wire = [pads[1].center(), inside.pins[0].center()]
    const external = new Route(outside.pins[0], null)
    outside.pins[0].routes.push(external)
    assert.ok(external.connect(pins[1]))
    external.wire = [outside.pins[0].center(), pins[1].center()]
    pins[1].prompt = 'Preserve metadata'
    const contact = pads[1].center(), padRects = pads.map(pad => ({...pad.rect}))
    const wire = internal.copyWire(), outerWire = external.copyWire()
    const ids = pins.map(pin => pin.wid)
    const redox = harness(), view = {selection: new Selection()}
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: 'c,a,muchLongerName'})
    const edit = redox.edit.param
    assert.deepEqual(edit.next, [pins[2], pins[0], pins[1]])
    assert.equal(edit.added.length, 0)
    assert.equal(edit.deleted.length, 0)
    for (let i = 0; i < 3; i++) {
        assert.equal(pins[1].name, 'commands.muchLongerName')
        assert.equal(pads[1].text, pins[1].name)
        assert.equal(pins[1].pad, pads[1])
        assert.deepEqual(pads[1].center(), contact)
        assert.equal(pins[1].prompt, 'Preserve metadata')
        assert.deepEqual(pins.map(pin => pin.wid), ids)
        assert.deepEqual(node.pads, pads)
        assert.equal(pads[1].routes[0], internal)
        assert.equal(pins[1].routes[0], external)
        assert.deepEqual(internal.wire, wire)
        redox.editBundle.undo(edit)
        assert.deepEqual(pins.map(pin => pin.name), ['commands.a', 'commands.b', 'commands.c'])
        assert.deepEqual(pads.map(pad => pad.text), ['commands.a', 'commands.b', 'commands.c'])
        assert.deepEqual(pads.map(pad => pad.rect), padRects)
        assert.deepEqual(external.wire, outerWire)
        redox.editBundle.redo(edit)
    }
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: []})
    root.nodes = [node, outside.node]
    const loaded = new ModelCompiler(new UIDGenerator()).compileRawNode(model, root.makeRaw(null))
    const renamed = loaded.nodes[0].look.widgets.find(pin => pin.name === 'commands.muchLongerName')
    assert.equal(renamed.pad.text, renamed.name)
    assert.equal(renamed.routes.length, 1)
    assert.equal(renamed.pad.routes.length, 1)
})

test('bundle lists reuse unmatched members in order and only add or delete excess members', () => {
    const {pins} = fixture(['a', 'b', 'c'])
    createBundle(pins)
    const redox = harness(), view = {selection: new Selection()}
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: 'x,c,y,z'})
    const growth = redox.edit.param
    assert.deepEqual(growth.next.slice(0, 3), [pins[0], pins[2], pins[1]])
    assert.equal(growth.added.length, 1)
    assert.equal(growth.deleted.length, 0)
    redox.editBundle.undo(growth)
    assert.deepEqual(pins.map(pin => pin.name), ['items.a', 'items.b', 'items.c'])
    redox.editBundle.doit.call(redox, {view, pin: pins[0], text: 'c,x'})
    const shrink = redox.edit.param
    assert.deepEqual(shrink.next, [pins[2], pins[0]])
    assert.equal(shrink.added.length, 0)
    assert.equal(shrink.deleted.length, 1)
    redox.editBundle.undo(shrink)
    assert.deepEqual(pins.map(pin => pin.name), ['items.a', 'items.b', 'items.c'])
})

test('editing proxy bundles restores both internal pad routes and external routes', () => {
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Group', nodes: [], interfaces: [{interface: 'commands', pins: []}]})
    const pin = node.look.addPin('', {x: 0, y: NaN}, {input: true, proxy: true, left: true})
    node.addPad(pin)
    createBundleFromList(pin, 'a,b,c')
    const members = pin.bundle.slice(), pads = node.pads.slice()
    const inside = fixture(['b'], true, 'in')
    const outside = fixture(['b'], false, 'out')
    const internal = new Route(members[1].pad, null)
    members[1].pad.routes.push(internal)
    assert.ok(internal.connect(inside.pins[0]))
    internal.wire = [members[1].pad.center(), inside.pins[0].center()]
    const external = new Route(outside.pins[0], null)
    outside.pins[0].routes.push(external)
    assert.ok(external.connect(members[1]))
    external.wire = [outside.pins[0].center(), members[1].center()]
    const view = {selection: new Selection()}, redox = harness()
    redox.editBundle.doit.call(redox, {view, pin, text: 'c,d'})
    const edit = redox.edit.param
    assert.equal(inside.pins[0].routes.length, 0)
    assert.equal(outside.pins[0].routes.length, 0)
    assert.equal(edit.next[1].pad.text, 'commands.d')
    for (let i = 0; i < 2; i++) {
        redox.editBundle.undo(edit)
        assert.deepEqual(node.pads, pads)
        assert.equal(inside.pins[0].routes[0], internal)
        assert.equal(outside.pins[0].routes[0], external)
        redox.editBundle.redo(edit)
        assert.equal(inside.pins[0].routes.length, 0)
        assert.equal(outside.pins[0].routes.length, 0)
    }
})

for (const reverse of [false, true]) for (const targetBundle of [false, true]) {
    test(`drawn bundle connections preserve bends and pin sides (reverse=${reverse}, targetBundle=${targetBundle})`, () => {
        const a = fixture(['a', 'b'], false, 'out')
        const b = fixture(targetBundle ? ['a', 'b'] : ['b'], true, 'in')
        b.node.move({x: -500, y: 180})
        createBundle(a.pins)
        if (targetBundle) createBundle(b.pins)
        const from = reverse ? b.pins[0] : a.pins[0]
        const to = reverse ? a.pins[0] : b.pins[0]
        const f = from.center(), t = to.center()
        const wire = [f, {x: f.x + 80, y: f.y}, {x: f.x + 80, y: -100},
            {x: t.x - 80, y: -100}, {x: t.x - 80, y: t.y}, t]
        const sides = [...a.pins, ...b.pins].map(pin => pin.is.left)
        const view = {root: {nodes: [a.node, b.node], createRoute() { assert.fail('manual drawing must not auto-route') }}}
        const redox = harness()
        redox.connectBundle.doit.call(redox, {view, from, to, drawnRoute: {wire}})
        const routes = redox.edit.param.routes
        assert.equal(routes.length, targetBundle ? 2 : 1)
        for (const route of routes) {
            assert.deepEqual(route.bundleRouteWire(), wire)
            assert.deepEqual(route.wire[0], route.from.center())
            assert.deepEqual(route.wire.at(-1), route.to.center())
        }
        assert.deepEqual([...a.pins, ...b.pins].map(pin => pin.is.left), sides)
        redox.connectBundle.undo(redox.edit.param)
        assert.ok([...a.pins, ...b.pins].every(pin => !pin.routes.length))
        redox.connectBundle.redo(redox.edit.param)
        for (const route of routes) assert.deepEqual(route.bundleRouteWire(), wire)
    })
}

test('bundle metadata round-trips only on the representative and leaves the semantic model unchanged', () => {
    const {node, pins} = fixture()
    const before = RawHandling.splitInterfaces(node.look.makeRaw().interfaces)
    const positions = pins.map(pin => ({...pin.rect}))
    createBundle(pins)
    assert.ok(pins.every(pin => pin.bundle === pins[0].bundle))
    const collapsed = RawHandling.splitInterfaces(node.look.makeRaw().interfaces)
    assert.deepEqual(collapsed.blu, before.blu)
    assert.deepEqual(pins.map(pin => pin.rect), positions)
    assert.deepEqual(convert.stringToPin(collapsed.viz[0].pins[0]).bundleWids, pins.map(pin => pin.wid))
    assert.equal(convert.stringToPin(collapsed.viz[0].pins[1]).bundleWids, undefined)
    const bNode = {interfaces: structuredClone(collapsed.blu)}
    RawHandling.joinInterfaces(bNode, {interfaces: structuredClone(collapsed.viz)})
    const raw = {kind: 'source', name: 'restored', rect: {x: 0, y: 0, w: 200, h: 0}, interfaces: bNode.interfaces, factory: {path: './node.js', function: 'Node'}}
    const restored = new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
    const members = restored.look.widgets.filter(widget => widget.is.pin)
    assert.deepEqual(members[0].bundle.map(pin => pin.name), pins.map(pin => pin.name))
    expandBundle(members[0])
    assert.deepEqual(RawHandling.splitInterfaces(restored.look.makeRaw().interfaces).blu, before.blu)
    assert.ok(members.every(pin => pin.bundle === null))
})

test('collapsed geometry reduces rows without changing expanded pin layout or interface membership', () => {
    const {node, pins} = fixture(['a', 'b', 'c', 'd'])
    const original = pins.map(pin => ({...pin.rect}))
    createBundle(pins.slice(0, 3))
    assert.equal(bundleRect(pins[1]).y, bundleRect(pins[0]).y)
    assert.equal(bundleRect(pins[3]).y, original[3].y - 2 * pins[0].rect.h)
    assert.equal(node.hitTest({x: bundleRect(pins[0]).x + 10, y: bundleRect(pins[0]).y + 5})[2], pins[0])
    expandBundle(pins[0])
    assert.deepEqual(pins.map(pin => pin.rect), original)
})

test('bundle loading rejects overlaps and mixed kinds and diagnoses missing members', () => {
    const {pins} = fixture()
    const messages = []
    restorePinBundles(pins, [{pin: pins[0], wids: [pins[0].wid, 9999, pins[1].wid]}], message => messages.push(message))
    assert.equal(pins[0].bundle.length, 2)
    assert.equal(messages.length, 1)
    expandBundle(pins[0])
    restorePinBundles(pins, [{pin: pins[0], wids: [pins[0].wid, pins[1].wid]}, {pin: pins[1], wids: [pins[1].wid, pins[2].wid]}], message => messages.push(message))
    assert.ok(pins.every(pin => !pin.bundle))
    pins[1].is.channel = true
    restorePinBundles(pins, [{pin: pins[0], wids: pins.map(pin => pin.wid)}], message => messages.push(message))
    assert.ok(pins.every(pin => !pin.bundle))
})

test('removing representatives promotes the next member and dissolves singleton bundles', () => {
    const {pins} = fixture()
    createBundle(pins)
    removeBundleMember(pins[0])
    assert.equal(pins[1].bundle[0], pins[1])
    assert.equal(pins[1].bundle, pins[2].bundle)
    removeBundleMember(pins[1])
    assert.equal(pins[2].bundle, null)
})

test('comma-list creation qualifies independent pins and rejects the entire invalid list', () => {
    for (const text of ['a,,b', 'a,a', 'new pin,new-pin', 'a,@bad']) {
        const {node} = fixture([])
        const pin = node.look.addPin('', {x: 0, y: NaN}, {input: true, left: true})
        node.rxtxAddPin(pin)
        const before = node.look.makeRaw()
        const wid = node.look.widGenerator
        assert.throws(() => createBundleFromList(pin, text))
        assert.deepEqual(node.look.makeRaw(), before)
        assert.equal(node.look.widGenerator, wid)
    }
    const {node} = fixture([])
    const pin = node.look.addPin('', {x: 0, y: NaN}, {input: true, left: true})
    node.rxtxAddPin(pin)
    pin.startEdit(null)
    pin.name = 'a, b, c'
    pin.endEdit('')
    assert.deepEqual(pin.bundle.map(member => member.name), ['items.a', 'items.b', 'items.c'])
    assert.equal(node.rxTable.length, 3)
    assert.notEqual(pin.contract, pin.bundle[1].contract)
    const ids = pin.bundle.map(member => member.wid)
    const view = {selection: new Selection()}
    redoxWidget.newPin.undo.call({}, {view, pin})
    assert.equal(node.rxTable.length, 0)
    redoxWidget.newPin.redo.call({}, {view, pin})
    assert.deepEqual(pin.bundle.map(member => member.wid), ids)
    assert.equal(node.rxTable.length, 3)
})

test('bulk matching uses exact local names, reports unmatched pins and rejects ambiguity', () => {
    const a = fixture(['new', 'add', 'remove'], false, 'toolbar').pins
    const b = fixture(['add', 'remove', 'clear'], true).pins
    createBundle(a); createBundle(b)
    const match = matchBundleConnections(a[0], b[0])
    assert.equal(match.error, null)
    assert.deepEqual(match.pairs.map(pair => pair.map(pin => pin.name)), [['toolbar.add', 'items.add'], ['toolbar.remove', 'items.remove']])
    assert.deepEqual(match.unmatched.map(pin => pin.name), ['toolbar.new', 'items.clear'])
    assert.equal(matchBundleConnections(a[0], fixture(['add'], true).pins[0]).pairs.length, 1)
    b[1].name = b[0].name
    assert.match(matchBundleConnections(a[0], b[0]).error, /Ambiguous/)
})

test('collapse and expand undo restore the shared array without touching semantic pins', () => {
    const {pins} = fixture()
    const redox = harness()
    redox.collapseBundle.doit.call(redox, {pins})
    const state = redox.edit.param
    redox.collapseBundle.undo(state)
    assert.ok(pins.every(pin => !pin.bundle))
    redox.collapseBundle.redo(state)
    assert.ok(pins.every(pin => pin.bundle === pins[0].bundle))
})

test('bundle route projection retains exact constituent endpoints and saved wires', () => {
    const a = fixture(['a', 'b'], false, 'source').pins
    const b = fixture(['a', 'b'], true, 'target').pins
    b[0].node.look.moveDelta(400, 0)
    const routes = a.map((pin, index) => {
        const route = new Route(pin, b[index])
        route.restoreWire([pin.center(), b[index].center()])
        return route
    })
    for (const route of routes) { route.from.routes.push(route); route.to.routes.push(route) }
    const wires = structuredClone(routes.map(route => route.wire))
    createBundle(a); createBundle(b)
    assert.equal(routes[1].bundleRoutes().length, 2)
    assert.deepEqual(routes[0].bundleRouteWire(), routes[1].bundleRouteWire())
    expandBundle(a[0]); expandBundle(b[0])
    assert.deepEqual(routes.map(route => route.wire), wires)
    assert.equal(routes[0].bundleRoutes().length, 1)
})

test('visual-only saves preserve existing model bytes and never write its file', async () => {
    const {node, pins} = fixture()
    const raw = {header: {version: '1.12.3', saved: 'unchanged'}, root: {kind: 'source', name: 'Node', ...node.look.makeRaw()}}
    const baseline = JSON.stringify(RawHandling.splitRaw.call(RawHandling, raw).blu)
    const writes = []
    createBundle(pins)
    raw.root.interfaces = node.look.makeRaw().interfaces
    await RawHandling.saveRaw.call({...RawHandling, raw,
        blu: {arl: {get: async () => baseline, save: async text => writes.push(['blu', text])}},
        viz: {arl: {save: async text => writes.push(['viz', text])}},
    })
    assert.deepEqual(writes.map(([kind]) => kind), ['viz'])
    assert.match(writes[0][1], new RegExp(pins.map(pin => pin.wid).join(' ')))
})

test('bulk wiring commits without confirmation, reports unmatched pins, deduplicates, and undoes as one action', () => {
    const a = fixture(['new', 'add', 'remove'], false, 'toolbar')
    const b = fixture(['add', 'remove', 'clear'], true)
    b.node.look.moveDelta(400, 0)
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: []})
    root.nodes = [a.node, b.node]
    const view = {root}
    createBundle(a.pins); createBundle(b.pins)
    const redox = harness()
    const feedback = []
    redox.manager.tx.send = (kind, data) => { feedback.push({kind, ...data}) }
    redox.connectBundle.doit.call(redox, {view, from: a.pins[0], to: b.pins[0]})
    assert.ok(feedback.every(message => message.kind !== 'save point.confirm'))
    assert.match(feedback[0].message, /Unmatched: toolbar.new, items.clear/)
    assert.equal(redox.edit.param.routes.length, 2)
    const edit = redox.edit
    redox.connectBundle.doit.call(redox, {view, from: a.pins[0], to: b.pins[0]})
    assert.equal(redox.edit, edit)
    assert.equal(a.pins.flatMap(pin => pin.routes).length, 2)
    redox.connectBundle.undo(edit.param)
    assert.equal(a.pins.flatMap(pin => pin.routes).length, 0)
    redox.connectBundle.redo(edit.param)
    assert.equal(a.pins.flatMap(pin => pin.routes).length, 2)
    redox.connectBundle.undo(edit.param)
    b.pins[1].is.channel = true
    redox.connectBundle.doit.call(redox, {view, from: a.pins[0], to: b.pins[0]})
    assert.equal(a.pins.flatMap(pin => pin.routes).length, 0)
})

test('paste remaps bundle IDs, preserves metadata, and retains the bundle after undo/redo', () => {
    const source = fixture()
    createBundle(source.pins)
    source.pins[1].prompt = 'Add one item'
    source.pins[1].tool = {enabled: true, title: 'Add'}
    const raw = source.pins.map(pin => pin.makeRaw())
    const target = fixture(['existing'])
    const pos = target.node.look.nextPinPosition(true)
    const copies = target.node.look.rawWidgetsToPinArea(raw, pos)
    target.node.rxtxAddPinArea(copies)
    assert.equal(copies[0].bundle.length, 3)
    assert.ok(copies.every(pin => !source.pins.includes(pin)))
    assert.equal(copies[1].prompt, 'Add one item')
    assert.deepEqual(copies[1].tool, source.pins[1].tool)
    const view = {selection: new Selection()}
    const state = {view, node: target.node, widgets: copies, pos, wids: copies.map(pin => pin.wid), pads: [], bundles: [copies.slice()]}
    redoxPinArea.pasteWidgetsFromClipboard.undo(state)
    redoxPinArea.pasteWidgetsFromClipboard.redo(state)
    assert.ok(copies.every(pin => pin.bundle === copies[0].bundle))
    assert.deepEqual(copies.map(pin => pin.wid), state.wids)
})

test('explicit member deletion promotes the representative and undo restores IDs and membership', () => {
    const {node, pins} = fixture()
    createBundle(pins)
    const view = {selection: new Selection()}
    view.selection.switchToWidget(pins[0])
    const redox = harness()
    const ids = pins.map(pin => pin.wid)
    redoxWidget.deletePin.doit.call(redox, {view, pin: pins[0], bundleMember: true})
    assert.equal(pins[1].bundle[0], pins[1])
    redoxWidget.deletePin.undo(redox.edit.param)
    assert.deepEqual(pins.map(pin => pin.wid), ids)
    assert.deepEqual(pins[0].bundle, pins)
    assert.equal(node.rxTable.length, 3)
    redoxWidget.deletePin.redo(redox.edit.param)
    assert.equal(node.rxTable.length, 2)
})

test('bundle dragging preserves spacing, moves no unrelated pins into an interface and restores layout on undo', () => {
    const {node, pins} = fixture(['a', 'middle', 'b', 'last'])
    const bundle = createBundle([pins[0], pins[2]])
    const before = node.look.capturePinMove()
    const spacing = pins[2].rect.y - pins[0].rect.y
    dragBundle(pins[0], {x: pins[0].rect.x, y: bundleRect(pins[3]).y + 10})
    assert.equal(pins[2].rect.y - pins[0].rect.y, spacing)
    const visible = node.look.widgets.filter(widget => widget.is.pin && (!widget.bundle || widget.bundle[0] === widget))
    const positions = visible.map(pin => bundleRect(pin).y)
    assert.equal(new Set(positions).size, positions.length)
    node.look.restorePinMove(before)
    assert.deepEqual(node.look.capturePinMove(), before)
    assert.equal(pins[0].bundle, bundle)
})

test('bundling never constrains ordinary logical connections during loading or changes provenance', () => {
    const a = fixture(['source', 'other'], false, 'out').pins
    const b = fixture(['different', 'extra'], true, 'in').pins
    const raw = {root: {interfaces: a[0].node.look.makeRaw().interfaces}}
    const before = makeArtifactProvenance({artifact: 'application', model: 'app', source: raw})
    createBundle(a); createBundle(b)
    raw.root.interfaces = a[0].node.look.makeRaw().interfaces
    assert.deepEqual(makeArtifactProvenance({artifact: 'application', model: 'app', source: raw}), before)
    const route = new Route(a[0], null)
    a[0].routes.push(route)
    assert.equal(route.connect(b[0]), true)
    assert.equal(route.to, b[0])
    assert.ok(matchBundleConnections(a[0], b[0]).error)
})

test('comma-list proxy creation updates every pad and preserves existing pad connections when expanded', () => {
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Group', nodes: [], interfaces: [{interface: 'commands', pins: []}]})
    const pin = node.look.addPin('', {x: 0, y: NaN}, {input: true, proxy: true, left: true})
    node.addPad(pin)
    createBundleFromList(pin, 'a,b,c')
    assert.deepEqual(node.pads.map(pad => pad.text), ['commands.a', 'commands.b', 'commands.c'])
    const pads = pin.bundle.map(member => member.pad)
    expandBundle(pin)
    assert.deepEqual(node.pads, pads)
})

test('editing an existing proxy into a list preserves its pad and routes and undoes as one edit', () => {
    const node = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Group', nodes: [],
        interfaces: [{interface: 'commands', pins: [{name: 'commands.a', kind: 'input', left: true}]}]})
    const pin = node.look.widgets.find(widget => widget.is.pin), pad = pin.pad
    const inside = fixture(['a'], true), outside = fixture(['a'], false)
    node.nodes = [inside.node]
    const internal = node.createRoute(pad, inside.pins[0])
    const external = node.createRoute(outside.pins[0], pin)
    const wire = internal.copyWire(), outerWire = external.copyWire()
    const view = {selection: new Selection(), textField: new TextEdit(), beginTextEdit(widget) {
        const {prop, index} = widget.startEdit(null)
        this.textField.newEdit(widget, prop, index)
    }}
    const redox = harness()
    redoxWidget.widgetTextEdit.doit.call(redox, {view, widget: pin})
    const edit = redox.edit
    pin.name = 'a,b,c'
    pin.endEdit(view.textField.saved)
    assert.equal(redox.edit, edit)
    assert.ok(edit.param.bundleChange)
    const members = pin.bundle.slice(), pads = node.pads.slice()
    assert.deepEqual(members.map(member => member.name), ['commands.a', 'commands.b', 'commands.c'])
    assert.deepEqual(pads.map(member => member.text), ['commands.a', 'commands.b', 'commands.c'])
    assert.equal(members[0], pin)
    assert.equal(pads[0], pad)
    assert.equal(pin.routes[0], external)
    assert.equal(pad.routes[0], internal)
    assert.equal(members[1].routes.length, 0)
    assert.equal(pads[1].routes.length, 0)
    for (let i = 0; i < 3; i++) {
        redoxWidget.widgetTextEdit.undo.call(redox, edit.param)
        assert.equal(pin.bundle, null)
        assert.deepEqual(node.pads, [pad])
        assert.deepEqual(node.look.widgets.filter(widget => widget.is.pin), [pin])
        assert.deepEqual(internal.wire, wire)
        assert.deepEqual(external.wire, outerWire)
        redoxWidget.widgetTextEdit.redo.call(redox, edit.param)
        assert.deepEqual(pin.bundle, members)
        assert.deepEqual(node.pads, pads)
        assert.equal(pin.routes[0], external)
        assert.equal(pad.routes[0], internal)
    }
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: []})
    root.nodes = [node, outside.node]
    const restored = new ModelCompiler(new UIDGenerator()).compileRawNode(model, root.makeRaw(null))
    const group = restored.nodes[0]
    const restoredPin = group.look.widgets.find(widget => widget.is.pin && widget.name === 'commands.a')
    assert.equal(restoredPin.bundle.length, 3)
    assert.equal(group.pads.length, 3)
    assert.equal(restoredPin.routes.length, 1)
    assert.equal(restoredPin.pad.routes.length, 1)
})

test('existing-pin list edits preserve absolute names and reject invalid lists without extra members', () => {
    for (const text of ["'a,b,c", "'a,b,b", "'a,,b", 'a']) {
        const {node, pins: [pin]} = fixture(['a'])
        pin.name = 'a'
        pin.pxlen = 0
        const view = {selection: new Selection(), textField: new TextEdit(), beginTextEdit(widget) {
            const {prop, index} = widget.startEdit(null)
            this.textField.newEdit(widget, prop, index)
        }}
        const redox = harness()
        redoxWidget.widgetTextEdit.doit.call(redox, {view, widget: pin})
        pin.name = text
        if (text === 'a') view.textField.handleSpecialKey({key: 'Escape'})
        pin.endEdit(view.textField.saved)
        if (text === "'a,b,c") {
            assert.equal(pin.bundle[0], pin)
            assert.equal(pin.name, 'a')
            assert.equal(pin.pxlen, 0)
            assert.deepEqual(pin.bundle.map(member => member.name), ['a', 'items.b', 'items.c'])
        } else {
            assert.equal(pin.name, 'a')
            assert.equal(pin.pxlen, 0)
            assert.deepEqual(node.look.widgets.filter(widget => widget.is.pin), [pin])
        }
    }
})

test('generated application and differently named fan-out connections are unchanged by bundle save/reload', () => {
    const blueprint = new ModelBlueprint(new ARL('C:/dev/artifacts/bundle.mod.blu'))
    const rawNode = {kind: 'group', name: 'App', nodes: [
        {kind: 'source', name: 'Sender', factory: {path: './sender.js', function: 'Sender'}, interfaces: [{interface: '', pins: ['a', 'b'].map(name => ({name, kind: 'output'}))}]},
        {kind: 'source', name: 'Receiver', factory: {path: './receiver.js', function: 'Receiver'}, rect: {x: 400, y: 0, w: 200, h: 0}, interfaces: [{interface: '', pins: ['x', 'y'].map(name => ({name, kind: 'input'}))}]},
    ]}
    const compiler = new ModelCompiler(new UIDGenerator())
    const root = compiler.compileRawNode(blueprint, rawNode)
    const a = root.nodes[0].look.widgets.filter(pin => pin.is.pin)
    const b = root.nodes[1].look.widgets.filter(pin => pin.is.pin)
    root.createRoute(a[0], b[0]); root.createRoute(a[0], b[1]); root.createRoute(a[1], b[1])
    blueprint.raw = {header: blueprint.header.copyWithoutStyle(), root: root.makeRaw(blueprint.getArl())}
    const before = blueprint.splitRaw(blueprint.raw)
    const app = () => blueprint.makeJSApp(root, blueprint.getArl().resolve('./app.js'), blueprint.getArl().resolve('./index.js'), blueprint.header.runtime)
    const source = app()
    createBundle(a); createBundle(b)
    blueprint.raw.root = root.makeRaw(blueprint.getArl())
    assert.deepEqual(blueprint.splitRaw(blueprint.raw).blu, before.blu)
    assert.equal(app(), source)
    const saved = blueprint.splitRaw(blueprint.raw)
    const joined = structuredClone(saved.blu)
    blueprint.joinNode(joined.root, structuredClone(saved.viz.root))
    const restored = new ModelCompiler(new UIDGenerator()).compileRawNode(blueprint, joined.root)
    assert.equal(restored.getConnectionRoutes().length, 3)
    const restoredPins = restored.nodes[0].look.widgets.filter(pin => pin.is.pin)
    assert.equal(restoredPins[0].bundle.length, 2)
    expandBundle(restoredPins[0])
    assert.equal(restored.getConnectionRoutes().length, 3)
})

test('external deletions promote surviving members and newly discovered pins never reuse missing bundle IDs', t => {
    t.mock.method(console, 'warn', () => {})
    for (const removedIndex of [0, 2]) {
        const {node, pins} = fixture(['a', 'b', 'c'], false)
        pins.forEach((pin, index) => { pin.wid = [10, 18, 19][index] })
        createBundle(pins)
        const saved = RawHandling.splitInterfaces(node.look.makeRaw().interfaces)
        const edited = {interfaces: structuredClone(saved.blu)}
        edited.interfaces[0].pins.splice(removedIndex, 1)
        edited.interfaces[0].pins.push({name: 'items.external', kind: 'output'})
        RawHandling.joinInterfaces(edited, {interfaces: structuredClone(saved.viz)})
        const restored = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'source', name: 'Restored', interfaces: edited.interfaces, factory: {path: './node.js', function: 'Node'}})
        const members = restored.look.widgets.filter(pin => pin.is.pin)
        assert.equal(members[0].bundle.length, 2)
        assert.equal(members[2].bundle, null)
        assert.ok(members[2].wid > 19)
    }
})
