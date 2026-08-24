import test from 'node:test'
import assert from 'node:assert/strict'

import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {applyLayoutPatch, layoutElk, normalizeLayoutRoutes, restoreAutoLayoutState, captureAutoLayoutState, toElkGraph} from '../types/elk/index.js'
import {splitRouteWireForCable} from '../types/node/node-group-conx.js'
import {canonicalOrthogonalWire, diagonalWireSegments, style} from '../types/util/index.js'
import {zap} from '../types/view/index.js'
import {redoxCable} from '../nodes/model-manager/redox-cable.js'

const model = {
    fullPath: () => 'elk-layout-test.mod.blu',
    getArl: () => null
}

function compileFixture({legacyCable = false, legacyBus = false} = {}) {
    const raw = {
        kind: 'group',
        name: 'Root',
        nodes: [
            {
                kind: 'source',
                name: 'Source',
                rect: {x: 0, y: 0, w: 150, h: 0},
                factory: {path: './index.js', function: 'SourceFactory'},
                interfaces: [
                    {
                        interface: 'main',
                        pins: [
                            {name: 'out', kind: 'output', wid: 1}
                        ]
                    }
                ]
            },
            {
                kind: 'source',
                name: 'Sink',
                rect: {x: 300, y: 0, w: 150, h: 0},
                factory: {path: './index.js', function: 'SinkFactory'},
                interfaces: [
                    {
                        interface: 'main',
                        pins: [
                            {name: 'in', kind: 'input', wid: 1}
                        ]
                    }
                ]
            }
        ],
        connections: [
            {
                src: {pin: 'out', node: 'Source'},
                dst: {pin: 'in', node: 'Sink'}
            }
        ]
    }

    if (legacyCable) {
        raw.cables = [
            {
                start: 'x 150 y 25',
                wire: 'y 0.5 y 49.5 x 150.0'
            }
        ]
        raw.routes = [
            {
                from: '(pin 1) out @ Source',
                to: '(cable 0 endpoint nonselective)',
                wire: 'x 0.0'
            },
            {
                from: '(cable 0 endpoint nonselective)',
                to: '(pin 1) in @ Sink',
                wire: 'x 0.0'
            }
        ]
    }

    if (legacyBus) {
        raw.buses = [
            {
                name: 'legacy.cable',
                start: 'x 150 y 25',
                wire: 'x 150.0'
            }
        ]
        raw.routes = [
            {
                from: '(pin 1) out @ Source',
                to: '(bus) @ legacy.cable',
                wire: 'x 75.0'
            },
            {
                from: '(bus) @ legacy.cable',
                to: '(pin 1) in @ Sink',
                wire: 'x 75.0'
            }
        ]
    }

    return new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
}

test('vmblu flat pin connection maps to an ELK graph with ports and an edge', () => {
    const root = compileFixture()
    const {graph, diagnostics} = toElkGraph(root)

    assert.equal(diagnostics.length, 0)
    assert.equal(graph.children.length, 2)
    assert.equal(graph.children[0].ports.length, 1)
    assert.equal(graph.children[1].ports.length, 1)
    assert.equal(graph.edges.length, 1)
    assert.equal(graph.edges[0].sources.length, 1)
    assert.equal(graph.edges[0].targets.length, 1)
})

test('ELK graph uses the visible node box as the routing obstacle', () => {
    const root = compileFixture()
    const source = root.nodes.find(node => node.name === 'Source')
    source.look.addLabel('Source label')

    const box = source.look.widgets.find(widget => widget.is.box)
    assert.notEqual(source.look.rect.h, box.rect.h)

    const {graph, diagnostics} = toElkGraph(root)
    const child = graph.children.find(item => item.id === source.uid)

    assert.equal(diagnostics.length, 0)
    assert.equal(child.height, box.rect.h)
    assert.equal(child.height, source.look.rect.h - (box.rect.y - source.look.rect.y))
})

test('ELK layout returns a vmblu geometry patch for a flat pin connection', async () => {
    const root = compileFixture()
    const result = await layoutElk(root)

    assert.equal(result.ok, true)
    assert.equal(result.patch.nodes.length, 2)
    assert.equal(result.patch.pins.length, 2)
    assert.equal(result.patch.routes.length, 1)
    assert.ok(result.patch.routes[0].wire.length >= 2)
})

test('ELK layout preserves pin vertical offsets within their node', async () => {
    const root = compileFixture()
    const offsets = new Map()

    for (const node of root.nodes) {
        for (const widget of node.look.widgets) {
            if (widget.is.pin) offsets.set(widget, widget.rect.y - node.look.rect.y)
        }
    }

    const result = await layoutElk(root)
    assert.equal(result.ok, true)

    const nodeY = new Map(result.patch.nodes.map(item => [item.node, item.y]))
    for (const item of result.patch.pins) {
        assert.equal(item.y - nodeY.get(item.pin.node), offsets.get(item.pin))
    }
})

test('ELK layout route endpoints remain orthogonal after applying vmblu pin positions', async () => {
    const root = compileFixture()
    const result = await layoutElk(root)

    assert.equal(result.ok, true)
    applyLayoutPatch(result.patch)

    const route = root.getInternalRoutes(root.nodes)[0]
    assert.ok(route.wire.length >= 2)

    for (let i = 0; i < route.wire.length - 1; i++) {
        const a = route.wire[i]
        const b = route.wire[i + 1]
        assert.ok(
            a.x === b.x || a.y === b.y,
            `expected segment ${i} to be orthogonal: ${JSON.stringify({a, b})}`
        )
    }
})

test('auto-layout normalization replaces cable routes with direct logical routes', () => {
    const root = compileFixture()
    const before = captureAutoLayoutState(root)
    const route = root.getInternalRoutes(root.nodes)[0]

    root.convertRouteToCable(route, 1)
    assert.equal(root.cables.length, 1)
    assert.equal(root.getInternalRoutes(root.nodes).length, 0)

    const routes = normalizeLayoutRoutes(root)

    assert.equal(root.cables.length, 0)
    assert.equal(routes.length, 1)
    assert.equal(root.getInternalRoutes(root.nodes).length, 1)

    const [src, dst] = routes[0].messageFlow()
    assert.equal(src.name, 'out')
    assert.equal(dst.name, 'in')

    restoreAutoLayoutState(root, before)
    assert.equal(root.cables.length, 0)
    assert.equal(root.getInternalRoutes(root.nodes).length, 1)
})

test('route-to-cable conversion trims the route and attaches its branches at cable endpoints', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const from = route.from.center()
    const to = route.to.center()
    const x1 = from.x + 80
    const x2 = to.x - 80
    const yMid = from.y + 120

    route.wire = [
        {...from},
        {x: x1, y: from.y},
        {x: x1, y: yMid},
        {x: x2, y: yMid},
        {x: x2, y: to.y},
        {...to}
    ]

    const conversion = root.convertRouteToCable(route, 3)

    assert.ok(conversion)
    assert.deepEqual(conversion.cable.wire, [
        {x: from.x + style.cable.extraLength, y: from.y},
        {x: x1, y: from.y},
        {x: x1, y: yMid},
        {x: x2, y: yMid},
        {x: x2, y: to.y},
        {x: to.x - style.cable.extraLength, y: to.y}
    ])
    assert.deepEqual(conversion.routes[0].wire, [
        {...from},
        {x: from.x + style.cable.extraLength, y: from.y}
    ])
    assert.deepEqual(conversion.routes[1].wire, [
        {...to},
        {x: to.x - style.cable.extraLength, y: to.y}
    ])
    assert.deepEqual(conversion.tacks.map(tack => tack.endpointLabel()), ['start', 'end'])
    assert.deepEqual(conversion.tacks.map(tack => tack.center()), [
        conversion.cable.wire[0],
        conversion.cable.wire.at(-1)
    ])
    assert.equal(conversion.cable.shouldRenderEndpoint(conversion.cable.wire[0]), true)
    assert.equal(conversion.cable.shouldRenderEndpoint(conversion.cable.wire.at(-1)), true)
    assert.equal(conversion.cable.hitTest(conversion.cable.wire[0])[0], zap.busLabel)
    assert.equal(conversion.cable.hitTest(conversion.cable.wire.at(-1))[0], zap.busLabel)
    assert.deepEqual(diagonalWireSegments(conversion.cable.wire), [])
})

test('collapsing an endpoint-only cable restores the complete original route geometry', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const originalWire = canonicalOrthogonalWire(route.copyWire())
    const conversion = root.convertRouteToCable(route, 1)

    const collapse = conversion.cable.collapseToRoute(root)

    assert.ok(collapse?.route)
    assert.deepEqual(collapse.route.wire, originalWire)
    assert.deepEqual(collapse.route.wire[0], collapse.route.from.center())
    assert.deepEqual(collapse.route.wire.at(-1), collapse.route.to.center())
    assert.deepEqual(diagonalWireSegments(collapse.route.wire), [])
    assert.equal(root.cables.includes(conversion.cable), false)

    conversion.cable.undoCollapse(collapse)
    assert.equal(root.cables.includes(conversion.cable), true)
    assert.equal(conversion.cable.tacks.length, 2)

    conversion.cable.redoCollapse(collapse)
    assert.deepEqual(collapse.route.wire, originalWire)
    assert.equal(root.cables.includes(conversion.cable), false)
})

test('a rejected endpoint-only collapse leaves the cable and its routes connected', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const tacks = cable.tacks.slice()
    const widgets = tacks.map(tack => tack.getOther())
    widgets[0].is.input = widgets[1].is.input

    assert.equal(cable.collapseToRoute(root), null)
    assert.equal(root.cables.includes(cable), true)
    assert.deepEqual(cable.tacks, tacks)
    assert.equal(tacks.every(tack => tack.route.from && tack.route.to), true)
})

test('orthogonal routes are trimmed by the cable endpoint inset', () => {
    assert.deepEqual(
        splitRouteWireForCable([{x: 0, y: 0}, {x: 90, y: 0}]),
        {
            cableWire: [{x: 15, y: 0}, {x: 75, y: 0}],
            fromWire: [{x: 0, y: 0}, {x: 15, y: 0}],
            toWire: [{x: 90, y: 0}, {x: 75, y: 0}]
        }
    )

    assert.deepEqual(
        splitRouteWireForCable([{x: 0, y: 0}, {x: 60, y: 0}, {x: 60, y: 80}]),
        {
            cableWire: [{x: 15, y: 0}, {x: 60, y: 0}, {x: 60, y: 65}],
            fromWire: [{x: 0, y: 0}, {x: 15, y: 0}],
            toWire: [{x: 60, y: 80}, {x: 60, y: 65}]
        }
    )
})

test('very short routes fall back to a vertical cable', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const from = route.from.center()
    route.wire = [{...from}, {x: from.x + 40, y: from.y}]

    const conversion = root.convertRouteToCable(route, 1, {x: from.x + 20, y: from.y})

    assert.ok(conversion)
    assert.equal(conversion.cable.wire[0].x, conversion.cable.wire[1].x)
    assert.equal(conversion.tacks.every(tack => !tack.isEndpoint()), true)
    assert.deepEqual(diagonalWireSegments(conversion.cable.wire), [])
})

test('redrawing a cable endpoint keeps the bend threshold and carries endpoint tacks through successive bends', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const endTack = conversion.tacks[1]
    const oldEnd = {...cable.wire.at(-1)}

    cable.resumeDrawXY('end', {x: oldEnd.x, y: oldEnd.y + style.cable.split - 1}, {x: 0, y: style.cable.split - 1})

    assert.equal(cable.wire.length, 2)
    assert.deepEqual(cable.wire.at(-1), oldEnd)
    assert.deepEqual(endTack.center(), oldEnd)

    cable.resumeDrawXY('end', {x: oldEnd.x, y: oldEnd.y + style.cable.split + 1}, {x: 0, y: 2})

    assert.equal(cable.wire.length, 3)
    assert.deepEqual(endTack.center(), cable.wire.at(-1))

    const firstBendEnd = {...cable.wire.at(-1)}
    cable.resumeDrawXY('end', {x: firstBendEnd.x + style.cable.split + 1, y: firstBendEnd.y}, {x: 2, y: 0})

    assert.equal(cable.wire.length, 4)
    assert.deepEqual(endTack.center(), cable.wire.at(-1))
    assert.equal(endTack.segment, 3)
    assert.equal(endTack.isEndpoint('end'), true)
    assert.deepEqual(diagonalWireSegments(cable.wire), [])
    assert.deepEqual(diagonalWireSegments(endTack.route.wire), [])
})

test('moving a horizontal cable endpoint keeps its route arrow horizontal', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const endTack = conversion.tacks[1]
    const oldEnd = {...cable.wire.at(-1)}

    assert.equal(cable.wire.at(-2).y, oldEnd.y)
    assert.equal(endTack.zone, 'E')

    cable.resumeDrawXY('end', {x: oldEnd.x - 30, y: oldEnd.y}, {x: -30, y: 0})

    assert.equal(endTack.zone, 'E')
    assert.equal(endTack.drawingRect().y, endTack.rect.y)
    assert.deepEqual(endTack.center(), cable.wire.at(-1))
    assert.deepEqual(diagonalWireSegments(endTack.route.wire), [])
})

test('extending an endpoint releases its tacks as interior tacks', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const startTack = conversion.tacks[0]
    const oldCenter = startTack.center()

    const released = cable.releaseEndpointTacks('start')
    cable.reverse()
    const endpoint = cable.wire.at(-1)
    cable.resumeDrawXY('end', {x: endpoint.x - 30, y: endpoint.y}, {x: -30, y: 0})

    assert.deepEqual(released, [startTack])
    assert.equal(startTack.isEndpoint(), false)
    assert.deepEqual(startTack.center(), oldCenter)
    assert.equal(cable.hitSegment(oldCenter) > 0, true)
})

test('dragging a vertically approaching endpoint tack turns it into an interior tack without moving the cable', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const tack = conversion.tacks[0]
    cable.drag({x: 0, y: 30})
    const oldCableWire = cable.copyWire()
    const oldCenter = tack.center()

    tack.slide({x: 20, y: 0})

    assert.equal(tack.isEndpoint(), false)
    assert.notDeepEqual(tack.center(), oldCenter)
    assert.deepEqual(cable.wire, oldCableWire)
    assert.equal(cable.hitSegment(tack.center()) > 0, true)
})

test('tack drag undo and redo restore the authoritative attachment', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const tack = conversion.tacks[0]
    cable.drag({x: 0, y: 30})
    const oldWire = tack.route.copyWire()
    const oldAttachment = tack.copyAttachment()
    const oldCableWire = cable.copyWire()
    const oldCableTackWires = cable.copyTackWires()

    tack.slide({x: 20, y: 0})
    const newWire = tack.route.copyWire()
    const newAttachment = tack.copyAttachment()
    const newCableWire = cable.copyWire()
    const newCableTackWires = cable.copyTackWires()
    const history = {
        saveEdit(verb, saved) {
            this.verb = verb
            this.saved = saved
        }
    }

    redoxCable.tackDrag.doit.call(history, {
        tack, oldWire, newWire, oldAttachment, newAttachment,
        oldCableWire, newCableWire, oldCableTackWires, newCableTackWires
    })
    redoxCable.tackDrag.undo(history.saved)

    assert.equal(tack.isEndpoint('start'), true)
    assert.deepEqual(tack.copyAttachment(), oldAttachment)

    redoxCable.tackDrag.redo(history.saved)

    assert.equal(tack.isEndpoint(), false)
    assert.deepEqual(tack.copyAttachment(), newAttachment)
})

test('convert to routes removes the cable while preserving geometry and supports undo and redo', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const history = {
        saveEdit(verb, saved) {
            this.verb = verb
            this.saved = saved
        }
    }

    redoxCable.cableToRoutes.doit.call(history, {view: {root}, cable})

    assert.equal(history.verb, 'cableToRoutes')
    assert.equal(root.cables.length, 0)
    assert.equal(root.getInternalRoutes(root.nodes).length, 1)
    assert.deepEqual(diagonalWireSegments(root.getInternalRoutes(root.nodes)[0].wire), [])

    redoxCable.cableToRoutes.undo.call(history, history.saved)
    assert.equal(root.cables.includes(cable), true)
    assert.equal(cable.tacks.length, 2)

    redoxCable.cableToRoutes.redo.call(history, history.saved)
    assert.equal(root.cables.length, 0)
    assert.equal(root.getInternalRoutes(root.nodes).length, 1)
})

test('route-to-cable conversion rejects diagonal route geometry', () => {
    assert.equal(
        splitRouteWireForCable([{x: 0, y: 0}, {x: 50, y: 20}, {x: 100, y: 20}]),
        null
    )
})

test('moving a pin adjusts its new endpoint branch without changing the cable trunk', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const from = route.from.center()
    const to = route.to.center()
    route.wire = [
        {...from},
        {x: from.x + 60, y: from.y},
        {x: from.x + 60, y: to.y + 80},
        {x: to.x - 60, y: to.y + 80},
        {x: to.x - 60, y: to.y},
        {...to}
    ]

    const conversion = root.convertRouteToCable(route, 3)
    const before = conversion.cable.copyWire()
    const branch = conversion.routes[0]
    const sourceNode = branch.from.node

    sourceNode.look.moveTo(sourceNode.look.rect.x, sourceNode.look.rect.y + 40)
    branch.adjust()

    assert.deepEqual(conversion.cable.wire, before)
    assert.deepEqual(diagonalWireSegments(branch.wire), [])
})

test('redrawing a free regular cable endpoint keeps the cable and supports undo', () => {
    const root = compileFixture()
    const route = root.getInternalRoutes(root.nodes)[0]
    const conversion = root.convertRouteToCable(route, 1)
    const cable = conversion.cable
    const oldWire = cable.copyWire()
    const oldTacks = cable.tacks.slice()
    const oldTackWires = cable.copyTackWires()
    const end = cable.wire.at(-1)
    const previous = cable.wire.at(-2)

    previous.x === end.x ? end.y += 30 : end.x += 30

    const edit = {
        view: {root},
        cable,
        conx: null,
        redraw: true,
        oldWire,
        newWire: cable.copyWire(),
        oldTacks,
        oldTackWires,
        newTacks: cable.tacks.slice(),
        newTackWires: cable.copyTackWires()
    }
    const history = {
        saveEdit(verb, saved) {
            this.verb = verb
            this.saved = saved
        }
    }

    redoxCable.cableDraw.doit.call(history, edit)

    assert.equal(history.verb, 'cableDraw')
    assert.equal(root.cables.includes(cable), true)
    assert.equal(cable.tacks.length, oldTacks.length)

    redoxCable.cableDraw.undo.call(history, history.saved)
    assert.deepEqual(cable.wire, oldWire)
    assert.equal(cable.tacks.length, oldTacks.length)
})

test('legacy pin-to-pin cables retain attachments and expose normal cable handles', () => {
    const root = compileFixture({legacyCable: true})
    const cable = root.cables[0]

    assert.equal(cable.tacks.length, 2)
    assert.equal(cable.tacks.every(tack => tack.isEndpoint()), true)
    assert.deepEqual(diagonalWireSegments(cable.wire), [])
    assert.equal(cable.shouldRenderEndpoint(cable.wire[0]), true)
    assert.equal(cable.shouldRenderEndpoint(cable.wire.at(-1)), true)
    assert.equal(cable.hitTest(cable.wire[0])[0], zap.busLabel)

    const tack = cable.tacks[0]
    const pin = tack.getOther()
    pin.node.look.moveTo(pin.node.look.rect.x + 20, pin.node.look.rect.y + 30)
    tack.route.adjust()

    assert.deepEqual(diagonalWireSegments(cable.wire), [])
    for (let index = 2; index < cable.wire.length; index++) {
        const first = cable.wire[index - 2]
        const middle = cable.wire[index - 1]
        const last = cable.wire[index]
        assert.equal(
            (first.x === middle.x && middle.x === last.x) ||
            (first.y === middle.y && middle.y === last.y),
            false
        )
    }
})

test('legacy bus loading preserves omitted tack selectivity without retaining bus behavior', () => {
    const root = compileFixture({legacyBus: true})
    const cable = root.cables[0]

    assert.equal(cable.is.floating, true)
    assert.equal(cable.tacks.length, 2)
    assert.deepEqual(cable.tacks.map(tack => tack.is.selective).sort(), [false, true])
    assert.equal(cable.defaultTackSelectivity({is: {pin: true, input: true}}), false)
    assert.equal(cable.shouldRenderEndpoint(cable.wire[0]), true)
})

test('new free cables survive their initial draw and support undo and redo', () => {
    const root = compileFixture()
    const cable = root.addCable({x: 500, y: 100})
    const oldWire = cable.copyWire()
    cable.wire.at(-1).x += 80

    const history = {
        saveEdit(verb, saved) {
            this.verb = verb
            this.saved = saved
        }
    }

    redoxCable.cableDraw.doit.call(history, {
        view: {root},
        cable,
        conx: null,
        oldWire,
        newWire: cable.copyWire(),
        oldTacks: [],
        oldTackWires: [],
        newTacks: [],
        newTackWires: []
    })

    const drawnWire = cable.copyWire()
    assert.equal(root.cables.includes(cable), true)

    redoxCable.cableDraw.undo.call(history, history.saved)
    assert.deepEqual(cable.wire, oldWire)

    redoxCable.cableDraw.redo.call(history, history.saved)
    assert.deepEqual(cable.wire, drawnWire)
})
