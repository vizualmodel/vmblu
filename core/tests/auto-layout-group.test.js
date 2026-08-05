import test from 'node:test'
import assert from 'node:assert/strict'

import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {redoxLayout} from '../nodes/model-manager/redox-layout.js'
import {bgCxMenu} from '../types/view/context-bg.js'

const model = {
    fullPath: () => 'auto-layout-group-test.mod.blu',
    getArl: () => null
}

function source(name, x, inputKind = null, outputKind = null) {
    const pins = []
    if (inputKind) pins.push({name: 'in', kind: inputKind, wid: 1})
    if (outputKind) pins.push({name: 'out', kind: outputKind, wid: 2})

    return {
        kind: 'source',
        name,
        rect: {x, y: 100, w: 150, h: 0},
        factory: {path: './index.js', function: `${name}Factory`},
        interfaces: [{interface: 'main', pins}]
    }
}

function compileNestedFixture() {
    const raw = {
        kind: 'group',
        name: 'Root',
        nodes: [
            {
                kind: 'group',
                name: 'Workspace',
                rect: {x: 50, y: 50, w: 150, h: 0},
                interfaces: [{
                    interface: 'boundary',
                    pins: [
                        {name: 'inbound', kind: 'reply', wid: 11, left: true},
                        {name: 'outbound', kind: 'request', wid: 12, left: false}
                    ]
                }],
                pads: [
                    {text: 'inbound', wid: 11, left: true, rect: {x: 20, y: 60, w: 80, h: 15}},
                    {text: 'outbound', wid: 12, left: false, rect: {x: 900, y: 60, w: 80, h: 15}}
                ],
                nodes: [
                    source('Source', 50, null, 'request'),
                    source('Sink', 500, 'reply', null)
                ],
                connections: [
                    {src: {pin: 'inbound'}, dst: {pin: 'in', node: 'Sink'}},
                    {src: {pin: 'out', node: 'Source'}, dst: {pin: 'outbound'}},
                    {src: {pin: 'out', node: 'Source'}, dst: {pin: 'in', node: 'Sink'}}
                ]
            },
            source('Outside', 700, 'input', null)
        ]
    }

    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, raw)
    return {root, group: root.nodes.find(node => node.name === 'Workspace')}
}

function nodePositions(root) {
    return root.nodes.map(node => ({node, x: node.look.rect.x, y: node.look.rect.y}))
}

function assertPositions(actualRoot, expected) {
    for (const item of expected) {
        assert.equal(item.node.look.rect.x, item.x)
        assert.equal(item.node.look.rect.y, item.y)
    }
    assert.equal(actualRoot.nodes.length, expected.length)
}

test('nested-group auto-layout preserves pad connections and targets undo/redo to that group', async () => {
    const {root, group} = compileNestedFixture()
    const outerPosition = {...root.nodes.find(node => node.name === 'Outside').look.rect}
    const beforePositions = nodePositions(group)
    const beforePadPositions = group.pads.map(pad => ({pad, x: pad.rect.x, y: pad.rect.y}))
    const cable = group.addCable({x: 300, y: 300})
    cable.wire.at(-1).x += 100
    const beforeConnectionCount = group.getRoutesAndConnections()[1].length

    assert.equal(beforeConnectionCount, 2)
    assert.equal(group.pads.every(pad => pad.routes.length === 1), true)
    assert.equal(group.cables.length, 1)

    const history = {
        manager: {model: {root}, tx: {send() {}}},
        saveEdit(verb, param) {
            this.verb = verb
            this.param = param
        }
    }

    await redoxLayout.autoLayout.doit.call(history, {root: group})

    assert.equal(history.verb, 'autoLayout')
    assert.equal(history.param.root, group)
    assert.equal(group.getRoutesAndConnections()[1].length, beforeConnectionCount)
    assert.equal(group.cables.length, 0)
    assert.deepEqual(root.nodes.find(node => node.name === 'Outside').look.rect, outerPosition)

    const leftEdge = Math.min(...group.nodes.map(node => node.look.rect.x))
    const rightEdge = Math.max(...group.nodes.map(node => node.look.rect.x + node.look.rect.w))
    for (const pad of group.pads) {
        assert.equal(pad.proxy.is.channel, true)
        if (pad.proxy.is.input) {
            assert.ok(pad.rect.x + pad.rect.w <= leftEdge)
            assert.equal(pad.is.leftText, true)
        }
        else {
            assert.ok(pad.rect.x >= rightEdge)
            assert.equal(pad.is.leftText, false)
        }
    }
    assert.equal(beforePadPositions.some(item => item.pad.rect.x !== item.x || item.pad.rect.y !== item.y), true)

    for (const pad of group.pads) {
        for (const route of pad.routes) {
            assert.deepEqual(route.wire[0], route.from.center())
            assert.deepEqual(route.wire.at(-1), route.to.center())
        }
    }

    redoxLayout.autoLayout.undo.call(history, history.param)
    assertPositions(group, beforePositions)
    for (const item of beforePadPositions) {
        assert.equal(item.pad.rect.x, item.x)
        assert.equal(item.pad.rect.y, item.y)
        assert.equal(item.pad.proxy.is.channel, true)
    }
    assert.equal(group.getRoutesAndConnections()[1].length, beforeConnectionCount)
    assert.equal(group.cables.length, 1)
    assert.equal(root.cables.length, 0)

    await redoxLayout.autoLayout.doit.call(history, {root: group})
    assert.equal(group.getRoutesAndConnections()[1].length, beforeConnectionCount)
    assert.equal(group.cables.length, 0)
    assert.equal(root.cables.length, 0)

    redoxLayout.autoLayout.undo.call(history, history.param)
    redoxLayout.autoLayout.redo.call(history, history.param)
    assert.equal(group.getRoutesAndConnections()[1].length, beforeConnectionCount)
    assert.equal(group.cables.length, 0)
})

test('background auto-layout confirmation captures the group shown by the clicked view', () => {
    const root = {name: 'Nested Group'}
    const view = {
        root,
        hit: {
            xyLocal: {x: 10, y: 20},
            xyScreen: {x: 100, y: 200}
        }
    }
    const edits = []
    const viewTx = {
        send(message, payload) {
            edits.push({message, payload})
        }
    }
    const confirmations = []
    const contextMenuTx = {
        send(message, payload) {
            confirmations.push({message, payload})
        }
    }

    bgCxMenu.prepare(view, viewTx)
    const choice = bgCxMenu.choices.find(item => item.text === 'auto layout')
    choice.action({clientX: 120, clientY: 220}, contextMenuTx)
    const confirmation = confirmations[0].payload

    bgCxMenu.prepare({...view, root: {name: 'Another Group'}}, viewTx)
    confirmation.ok()

    assert.equal(confirmations[0].message, 'confirm')
    assert.equal(confirmation.title, 'Confirm auto layout')
    assert.deepEqual(confirmation.pos, {x: 120, y: 220})

    assert.deepEqual(edits, [{
        message: 'redox.doit',
        payload: {verb: 'autoLayout', param: {root}}
    }])
})
