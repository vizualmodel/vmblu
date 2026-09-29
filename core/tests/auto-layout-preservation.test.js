import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {redoxLayout} from '../nodes/model-manager/redox-layout.js'
import {captureAutoLayoutState, layoutElk, applyLayoutPatch} from '../types/elk/index.js'
import {cableLayoutRegion} from '../types/elk/preserve-cables.js'
import {diagonalWireSegments, style} from '../types/util/index.js'
import {bgCxMenu} from '../types/view/context-bg.js'
import {Route} from '../types/node/index.js'

const model = {fullPath: () => 'layout.mod.blu', getArl: () => null}
const compile = raw => new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
const pin = (name, kind, wid) => ({name, kind, wid})
const source = (name, x, y) => ({
    kind: 'source', name, rect: {x, y, w: 150, h: 0},
    interfaces: [{interface: 'main', pins: [pin('in', 'input', 1), pin('out', 'output', 2)]}]
})
const connection = (from, to) => ({src: {node: from, pin: 'out'}, dst: {node: to, pin: 'in'}})
function fixture() {
    return compile({kind: 'group', name: 'Root',
        nodes: [source('A', -400, -200), source('B', 0, 100), source('Free', 900, 600)],
        connections: [connection('A', 'B'), connection('B', 'Free')]
    })
}
function history(root) {
    return {manager: {model: {root}, tx: {send() {}}}, saveEdit(verb, param) {this.param = param}}
}
function assertWires(root) {
    for (const {route} of captureAutoLayoutState(root).routes) {
        assert.deepEqual(route.wire[0], route.from.center())
        assert.deepEqual(route.wire.at(-1), route.to.center())
        assert.deepEqual(diagonalWireSegments(route.wire), [])
    }
}
function connections(root) {
    return root.getRoutesAndConnections()[1]
}

test('default layout preserves cable geometry, metadata and attached nodes but moves ordinary neighbours', async () => {
    const root = fixture()
    const route = root.getConnectionRoutes().find(r => r.from.node.name === 'A')
    const {cable} = root.convertRouteToCable(route, 1)
    cable.tacks.forEach(tack => {tack.alias = 'shared'; tack.is.selective = tack.canBeSelective()})
    const before = captureAutoLayoutState(root)
    const logical = connections(root)
    const tackData = cable.tacks.map(t => JSON.stringify({attachment: t.attachment, alias: t.alias, is: t.is}))
    const region = cableLayoutRegion(root)
    const h = history(root)
    await redoxLayout.autoLayout.doit.call(h, {root})
    assert.equal(root.cables[0], cable)
    assert.deepEqual(cable.wire, before.cables[0].wire)
    assert.deepEqual(cable.tacks, before.cables[0].tacks)
    assert.deepEqual(cable.tacks.map(t => JSON.stringify({attachment: t.attachment, alias: t.alias, is: t.is})), tackData)
    for (const item of before.nodes.slice(0, 2)) {
        assert.equal(item.node.look.rect.x, item.x)
        assert.equal(item.node.look.rect.y, item.y)
    }
    for (const item of before.pins.filter(p => region.nodes.has(p.pin.node))) {
        assert.equal(item.pin.rect.x, item.x)
        assert.equal(item.pin.rect.y, item.y)
        assert.equal(item.pin.is.left, item.left)
    }
    for (const item of before.routes.filter(r => region.routes.has(r.route))) assert.deepEqual(item.route.wire, item.wire)
    const free = root.nodes[2].look.rect
    assert.notDeepEqual({x: free.x, y: free.y}, {x: before.nodes[2].x, y: before.nodes[2].y})
    assert.ok(free.x >= region.x + region.width || free.x + free.w <= region.x ||
        free.y >= region.y + region.height || free.y + free.h <= region.y)
    assert.deepEqual(connections(root), logical)
    assertWires(root)
    const after = captureAutoLayoutState(root)
    redoxLayout.autoLayout.undo.call(h, h.param)
    assert.deepEqual(captureAutoLayoutState(root), before)
    assert.deepEqual(connections(root), logical)
    redoxLayout.autoLayout.redo.call(h, h.param)
    assert.deepEqual(captureAutoLayoutState(root), after)
    assert.deepEqual(connections(root), logical)
    const reloaded = compile(root.makeRaw())
    assert.equal(reloaded.cables.length, 1)
    assert.deepEqual(connections(reloaded), logical)
})

test('full layout converts cables only when requested and undo restores them', async () => {
    const root = fixture()
    root.convertRouteToCable(root.getConnectionRoutes().find(r => r.from.node.name === 'A'), 1)
    const before = captureAutoLayoutState(root)
    const logical = connections(root)
    const h = history(root)
    await redoxLayout.autoLayout.doit.call(h, {root, convertCables: true})
    assert.equal(root.cables.length, 0)
    assert.deepEqual(connections(root), logical)
    assertWires(root)
    redoxLayout.autoLayout.undo.call(h, h.param)
    assert.deepEqual(captureAutoLayoutState(root), before)
    redoxLayout.autoLayout.redo.call(h, h.param)
    assert.equal(root.cables.length, 0)
    assert.deepEqual(connections(root), logical)
})

function padsFixture() {
    return compile({kind: 'group', name: 'Pads',
        interfaces: [
            {interface: 'scene', pins: [pin('scene.add', 'input', 1), pin('scene.remove', 'input', 2), pin('scene.ready', 'output', 3)]},
            {interface: 'time', pins: [pin('time.tick', 'input', 4)]}
        ],
        pads: [
            {wid: 4, text: 'time.tick', rect: {x: 20, y: 300, w: 80, h: 15}},
            {wid: 2, text: 'scene.remove', rect: {x: 20, y: 100, w: 110, h: 15}},
            {wid: 1, text: 'scene.add', rect: {x: 20, y: 200, w: 85, h: 15}},
            {wid: 3, text: 'scene.ready', rect: {x: 600, y: 100, w: 100, h: 15}}
        ],
        nodes: [source('A', 200, 20)],
        connections: [
            ...['scene.add', 'scene.remove', 'time.tick'].map(name => ({src: {pin: name}, dst: {node: 'A', pin: 'in'}})),
            {src: {node: 'A', pin: 'out'}, dst: {pin: 'scene.ready'}}
        ]
    })
}

test('pads follow interface order at pin pitch, with interface gaps and aligned connectors', async () => {
    const root = padsFixture()
    for (let pass = 0; pass < 2; pass++) {
        const result = await layoutElk(root)
        assert.equal(result.ok, true)
        applyLayoutPatch(result.patch)
        const find = name => root.pads.find(p => p.text === name)
        const add = find('scene.add'), remove = find('scene.remove'), tick = find('time.tick')
        assert.equal(remove.rect.y - add.rect.y, style.pin.hPin)
        assert.equal(tick.rect.y - remove.rect.y, 2 * style.pin.hPin)
        assert.equal(add.center().x, remove.center().x)
        assert.equal(add.center().x, tick.center().x)
        assert.ok(find('scene.ready').rect.x > root.nodes[0].look.rect.x)
        assertWires(root)
    }
})

test('cable-attached pads and all-frozen groups remain unchanged', async () => {
    const root = padsFixture()
    const pad = root.pads.find(p => p.text === 'scene.add')
    root.convertRouteToCable(pad.routes[0], 1)
    const beforePad = {...pad.rect}
    const beforeSide = pad.is.leftText
    const h = history(root)
    await redoxLayout.autoLayout.doit.call(h, {root})
    assert.deepEqual(pad.rect, beforePad)
    assert.equal(pad.is.leftText, beforeSide)
    assert.equal(root.cables.length, 1)
    assertWires(root)

    const all = fixture()
    for (const route of all.getConnectionRoutes().slice()) all.convertRouteToCable(route, 1)
    const before = captureAutoLayoutState(all)
    await redoxLayout.autoLayout.doit.call(history(all), {root: all})
    assert.deepEqual(captureAutoLayoutState(all), before)
})

test('full-layout menu warns about conversion and captures the clicked group', () => {
    const root = {name: 'Clicked'}
    const edits = []
    const tx = {send: (...args) => edits.push(args)}
    const view = {root, hit: {xyLocal: {}, xyScreen: {}}}
    let confirmation
    bgCxMenu.prepare(view, tx)
    bgCxMenu.choices.find(c => c.text === 'auto layout everything…').action({clientX: 1, clientY: 2}, {
        send: (message, payload) => {confirmation = payload}
    })
    assert.match(confirmation.message, /Replace cables with direct connections/)
    bgCxMenu.prepare({...view, root: {}}, tx)
    confirmation.ok()
    assert.deepEqual(edits, [['redox.doit', {verb: 'autoLayout', param: {root, convertCables: true}}]])
})

test('default layout preserves bridged cables and unattached cable trunks', async () => {
    const root = fixture()
    const {cable} = root.convertRouteToCable(root.getConnectionRoutes().find(r => r.from.node.name === 'A'), 1)
    const second = root.addCable({x: -600, y: -300})
    second.wire = [{x: -600, y: -300}, {x: -600, y: 300}]
    const unattached = root.addCable({x: 300, y: -300})
    unattached.wire = [{x: 300, y: -300}, {x: 500, y: -300}]
    const from = cable.newTack(), to = second.newTack()
    from.is.bridge = to.is.bridge = true
    from.attachInterior(cable.wire[0], 1)
    to.attachInterior(second.wire[0], 1)
    const bridge = new Route(from, to)
    from.route = to.route = bridge
    bridge.wire = [from.center(), {x: to.center().x, y: from.center().y}, to.center()]
    const before = captureAutoLayoutState(root)
    const h = history(root)
    await redoxLayout.autoLayout.doit.call(h, {root})
    assert.deepEqual(root.cables, before.cables.map(item => item.cable))
    for (const item of before.cables) {
        assert.deepEqual(item.cable.wire, item.wire)
        assert.deepEqual(item.cable.tacks, item.tacks)
    }
    assert.deepEqual(bridge.wire, before.routes.find(item => item.route === bridge).wire)
    redoxLayout.autoLayout.undo.call(h, h.param)
    assert.deepEqual(captureAutoLayoutState(root), before)
})
