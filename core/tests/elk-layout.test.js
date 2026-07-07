import test from 'node:test'
import assert from 'node:assert/strict'

import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {applyLayoutPatch, layoutElk, normalizeLayoutRoutes, restoreAutoLayoutState, captureAutoLayoutState, toElkGraph} from '../types/elk/index.js'

const model = {
    fullPath: () => 'elk-layout-test.mod.blu',
    getArl: () => null
}

function compileFixture() {
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
