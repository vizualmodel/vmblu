import assert from 'node:assert/strict'
import test from 'node:test'

import {SysbluView} from '../nodes/sysblu-view/sysblu-view.js'
import {topRoundedRect} from '../nodes/sysblu-view/drawing.js'
import {systemStyle} from '../nodes/sysblu-view/system-style.js'
import {chatSystem, transmitter} from './fixtures.js'

function context() {
    const noop = () => {}
    return new Proxy({
        fills: [],
        texts: [],
        operations: [],
        fillRect(...args) { this.fills.push({style: this.fillStyle, args}) },
        fillText(...args) { this.texts.push({style: this.fillStyle, font: this.font, args}) },
        arc(...args) { this.operations.push({name: 'arc', args}) },
        lineTo(...args) { this.operations.push({name: 'lineTo', args}) },
        quadraticCurveTo(...args) { this.operations.push({name: 'quadraticCurveTo', args}) },
        measureText: text => ({width: String(text).length * 7}),
    }, {
        get(target, property) {
            return property in target ? target[property] : noop
        },
        set(target, property, value) {
            target[property] = value
            return true
        },
    })
}

function canvas() {
    const listeners = new Map()
    const ctx = context()
    return {
        width: 800,
        height: 600,
        style: {},
        listeners,
        focusCount: 0,
        capturedPointers: [],
        releasedPointers: [],
        addEventListener(name, handler) { listeners.set(name, handler) },
        setAttribute() {},
        focus() { this.focusCount++ },
        setPointerCapture(pointerId) { this.capturedPointers.push(pointerId) },
        releasePointerCapture(pointerId) { this.releasedPointers.push(pointerId) },
        getContext: () => ctx,
        getBoundingClientRect: () => ({left: 0, top: 0}),
    }
}

function fixture() {
    const tx = transmitter()
    const targetArl = {kind: 'resolved'}
    const arl = {resolve: target => ({...targetArl, target})}
    const view = new SysbluView(tx, {canvas: canvas()})
    view.onSizeChange({w: 800, h: 600, dpr: 1})
    view.onSystemUpdated({document: chatSystem(), arl})
    return {tx, view, arl}
}

test('client and server endpoints face each other in a left-to-right layout', () => {
    const {view, tx} = fixture()
    const client = view.widgets.get('chat-client')
    const server = view.widgets.get('chat-server')

    assert.equal(view.widgets.size, 2)
    assert.deepEqual(client.references.map(widget => widget.reference.kind), ['model', 'documentation', 'build'])
    assert.equal(client.endpoints[0].endpoint.protocol, '../protocols/chat.protocol.json')
    assert.equal(client.endpoints[0].side, 'right')
    assert.equal(server.endpoints[0].side, 'left')
    assert.equal(view.routes.length, 1)
    assert.equal(view.routes[0].points.length, 6)
    assert.ok(view.routes[0].points.every(point => point.y >= 100), 'inward-facing endpoints do not route around the cards')
    view.render()
    assert.ok(view.ctx.texts.some(entry => entry.args[0] === 'chat'))
    assert.equal(tx.messages.filter(message => message.pin === 'canvas').length, 1)
    assert.equal(tx.last('canvas').payload, view.canvas)
})

test('view publishes its canvas only when a system document becomes active', () => {
    const tx = transmitter()
    const view = new SysbluView(tx, {canvas: canvas()})

    assert.equal(tx.messages.filter(message => message.pin === 'canvas').length, 0)

    view.onSystemUpdated({document: null, arl: null})
    assert.equal(tx.messages.filter(message => message.pin === 'canvas').length, 0)

    view.onSystemUpdated({document: chatSystem(), arl: null})
    assert.equal(tx.messages.filter(message => message.pin === 'canvas').length, 1)
})

test('dragging a node previews movement and emits one sysmod command on release', () => {
    const {view, tx} = fixture()
    const preventDefault = () => {}

    view.pointerDown({button: 0, offsetX: 150, offsetY: 115, pointerId: 1, preventDefault})
    view.pointerMove({offsetX: 210, offsetY: 155})
    view.pointerUp({offsetX: 210, offsetY: 155, pointerId: 1})

    assert.deepEqual(view.widgets.get('chat-client').node.position, {x: 160, y: 140})
    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'moveNode',
        param: {id: 'chat-client', position: {x: 160, y: 140}},
    })
})

test('dragging the empty canvas pans without creating a document edit', () => {
    const {view, tx} = fixture()

    view.pointerDown({button: 0, offsetX: 700, offsetY: 500, pointerId: 7, preventDefault() {}})
    view.pointerMove({offsetX: 735, offsetY: 525})

    assert.deepEqual(view.transform, {x: 35, y: 25, zoom: 1})
    assert.equal(view.canvas.style.cursor, systemStyle.canvas.cursorGrabbing)
    assert.deepEqual(view.canvas.capturedPointers, [7])

    view.pointerUp({offsetX: 735, offsetY: 525, pointerId: 7})

    assert.equal(view.pan, null)
    assert.equal(view.canvas.style.cursor, systemStyle.canvas.cursorDefault)
    assert.deepEqual(view.canvas.releasedPointers, [7])
    assert.equal(tx.last('sysmod.doit'), undefined)
})

test('middle-button drag pans over nodes instead of moving them', () => {
    const {view, tx} = fixture()
    const originalPosition = {...view.widgets.get('chat-client').node.position}

    view.pointerDown({button: 1, offsetX: 150, offsetY: 115, pointerId: 8, preventDefault() {}})
    view.pointerMove({offsetX: 180, offsetY: 155})
    view.pointerUp({offsetX: 180, offsetY: 155, pointerId: 8})

    assert.deepEqual(view.transform, {x: 30, y: 40, zoom: 1})
    assert.deepEqual(view.widgets.get('chat-client').node.position, originalPosition)
    assert.equal(tx.last('sysmod.doit'), undefined)
})

test('space plus left drag pans over nodes and cancellation restores the viewport', () => {
    const {view, tx} = fixture()
    const keyEvent = {code: 'Space', key: ' ', preventDefault() {}}

    view.keydown(keyEvent)
    assert.equal(view.canvas.style.cursor, systemStyle.canvas.cursorGrab)

    view.pointerDown({button: 0, offsetX: 150, offsetY: 115, pointerId: 9, preventDefault() {}})
    view.pointerMove({offsetX: 200, offsetY: 175})
    assert.deepEqual(view.transform, {x: 50, y: 60, zoom: 1})

    view.cancelPointer()
    assert.deepEqual(view.transform, {x: 0, y: 0, zoom: 1})
    assert.equal(view.canvas.style.cursor, systemStyle.canvas.cursorGrab)

    view.keyup(keyEvent)
    assert.equal(view.canvas.style.cursor, systemStyle.canvas.cursorDefault)
    assert.equal(tx.last('sysmod.doit'), undefined)
})

test('the application title gear opens its inspector, submits commands, and restores canvas focus', async () => {
    const {view, tx} = fixture()
    const settings = view.widgets.get('chat-client').settingsRect

    view.pointerDown({
        button: 0,
        offsetX: settings.x + settings.w / 2,
        offsetY: settings.y + settings.h / 2,
        clientX: 118,
        clientY: 118,
        preventDefault() {},
    })

    const request = tx.last('application settings').payload
    assert.equal(request.title, 'Application')
    assert.equal(request.application.id, 'chat-client')
    assert.deepEqual(request.pos, {x: 118, y: 118})
    assert.equal(typeof request.trash, 'function')

    request.ok({
        name: 'Browser chat',
        role: 'Presents chat.',
        vmblu: false,
        references: [{kind: 'documentation', target: '../client/guide.md'}],
    })

    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'editApplication',
        param: {
            id: 'chat-client',
            name: 'Browser chat',
            role: 'Presents chat.',
            vmblu: false,
            references: [{kind: 'documentation', target: '../client/guide.md'}],
        },
    })
    await Promise.resolve()
    assert.equal(view.canvas.focusCount, 2)

    request.trash()
    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'deleteApplication',
        param: {id: 'chat-client'},
    })
    await Promise.resolve()
    assert.equal(view.canvas.focusCount, 3)
})

test('add application opens a blank inspector, emits a complete command, and restores canvas focus', async () => {
    const {view, tx} = fixture()

    view.onAddApplication({clientX: 40, clientY: 60})
    const request = tx.last('application settings').payload
    assert.equal(request.title, 'Application')
    assert.equal(request.application.name, '')
    assert.equal(request.application.vmblu, true)

    request.ok({
        name: 'Chat admin',
        role: 'Administers chat.',
        vmblu: true,
        references: [{kind: 'model', target: '../admin/chat-admin.blu'}],
    })

    const command = tx.last('sysmod.doit').payload
    assert.equal(command.verb, 'addApplication')
    assert.deepEqual(command.param.application, {
        id: 'chat-admin',
        kind: 'application',
        name: 'Chat admin',
        vmblu: true,
        description: 'Administers chat.',
        position: {x: 287, y: 296},
        references: [{kind: 'model', target: '../admin/chat-admin.blu'}],
        endpoints: [],
    })
    await Promise.resolve()
    assert.equal(view.canvas.focusCount, 1)

    const updated = chatSystem()
    updated.nodes.push(command.param.application)
    view.onSystemUpdated({document: updated, arl: null})
    assert.deepEqual(view.selection, {kind: 'node', id: 'chat-admin'})
    assert.equal(view.uniqueApplicationId('Chat client'), 'chat-client-2')
})

test('application endpoint action and endpoint rows open the shared endpoint inspector', async () => {
    const {view, tx} = fixture()
    const client = view.widgets.get('chat-client')

    view.pointerDown({
        button: 0,
        offsetX: client.addEndpointRect.x + client.addEndpointRect.w / 2,
        offsetY: client.addEndpointRect.y + client.addEndpointRect.h / 2,
        preventDefault() {},
    })
    const addRequest = tx.last('endpoint settings').payload
    assert.equal(addRequest.title, 'Endpoint')
    assert.equal(addRequest.endpoint.id, undefined)
    addRequest.ok({
        id: 'history',
        name: 'History API',
        role: 'client',
        protocol: '../protocols/history.md',
    })
    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'addEndpoint',
        param: {
            nodeId: 'chat-client',
            endpoint: {
                id: 'history',
                name: 'History API',
                role: 'client',
                protocol: '../protocols/history.md',
            },
        },
    })

    const endpoint = client.endpoints[0]
    view.pointerDown({button: 0, offsetX: endpoint.row.x + 40, offsetY: endpoint.center().y, preventDefault() {}})
    const editRequest = tx.last('endpoint settings').payload
    assert.equal(editRequest.endpoint.id, 'chat')
    assert.equal(typeof editRequest.trash, 'function')
    editRequest.open('../protocols/chat.protocol.json')
    assert.deepEqual(tx.last('open reference').payload, {
        kind: 'resolved',
        target: '../protocols/chat.protocol.json',
    })
    editRequest.trash()
    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'deleteEndpoint',
        param: {nodeId: 'chat-client', id: 'chat'},
    })
    await Promise.resolve()
    assert.ok(view.canvas.focusCount >= 2)
})

test('dragging between endpoint connectors opens a connection inspector and creates one command', async () => {
    const {view, tx} = fixture()
    const clientEndpoint = view.widgets.get('chat-client').endpoints[0]
    const serverEndpoint = view.widgets.get('chat-server').endpoints[0]

    view.pointerDown({button: 0, offsetX: clientEndpoint.center().x, offsetY: clientEndpoint.center().y, pointerId: 2, preventDefault() {}})
    view.pointerMove({offsetX: 400, offsetY: 220})
    view.pointerUp({offsetX: serverEndpoint.center().x, offsetY: serverEndpoint.center().y, pointerId: 2})

    const request = tx.last('connection settings').payload
    assert.equal(request.title, 'Transport')
    assert.deepEqual(request.connection.from, {node: 'chat-client', endpoint: 'chat'})
    assert.deepEqual(request.connection.to, {node: 'chat-server', endpoint: 'chat'})
    assert.equal(request.connection.transport, 'unspecified')
    request.ok(request.connection)

    const command = tx.last('sysmod.doit').payload
    assert.equal(command.verb, 'addConnection')
    assert.equal(command.param.connection.id, 'chat-client-chat-chat-server-chat-unspecified')
    assert.equal(command.param.connection.name, undefined)
    await Promise.resolve()
    assert.ok(view.canvas.focusCount >= 2)
})

test('clicking a route opens its connection inspector for editing and deletion', () => {
    const {view, tx} = fixture()
    const route = view.routes[0]
    const point = route.points[Math.floor(route.points.length / 2)]

    view.pointerDown({button: 0, offsetX: point.x, offsetY: point.y, preventDefault() {}})

    const request = tx.last('connection settings').payload
    assert.equal(request.title, 'Transport')
    assert.equal(request.connection.id, 'realtime-chat')
    request.ok({...request.connection, remarks: 'Edited transport remarks.'})
    assert.equal(tx.last('sysmod.doit').payload.verb, 'editConnection')
    request.trash()
    assert.deepEqual(tx.last('sysmod.doit').payload, {
        verb: 'deleteConnection',
        param: {id: 'realtime-chat'},
    })
})

test('ordinary application clicks select without opening the inspector', () => {
    const {view, tx} = fixture()

    view.pointerDown({button: 0, offsetX: 350, offsetY: 150, preventDefault() {}})

    assert.deepEqual(view.selection, {kind: 'node', id: 'chat-client'})
    assert.equal(tx.last('application settings'), undefined)
})

test('reference icons resolve relative to the active system document', () => {
    const {view, tx} = fixture()
    const reference = view.widgets.get('chat-client').references[0].reference

    view.activateReference(reference)

    assert.deepEqual(tx.last('open reference').payload, {
        kind: 'resolved',
        target: '../client/chat-client.blu',
    })
})

test('absolute web references stay URLs and request external navigation', () => {
    const {view, tx} = fixture()
    const url = 'https://developers.openai.com/api/reference/overview'

    view.activateReference({kind: 'documentation', target: url})

    assert.deepEqual(tx.last('open reference').payload, {externalUrl: url})
})

test('command references show a marker and modifier-click emits a resolved host request', () => {
    const {view, tx} = fixture()
    const build = view.widgets.get('chat-client').references.find(widget => widget.reference.kind === 'build')

    view.render()
    assert.ok(view.ctx.operations.some(operation => operation.name === 'arc' && operation.args[2] === systemStyle.reference.commandMarkerRadius))
    assert.match(build.tooltip(), /Ctrl\/Cmd\+click: npm run build/)

    const point = {offsetX: build.rect.x + build.rect.w / 2, offsetY: build.rect.y + build.rect.h / 2}
    view.pointerDown({button: 0, ...point, preventDefault() {}})
    view.pointerUp({...point, ctrlKey: true})

    assert.deepEqual(tx.last('execute command').payload, {
        command: 'npm run build',
        workingDirectory: {kind: 'resolved', target: '../client'},
    })
})

test('application prompt opens the explicit system-level prompt reference', () => {
    const {view, tx} = fixture()

    view.onApplicationPrompt()

    assert.deepEqual(tx.last('open reference').payload, {
        kind: 'resolved',
        target: '../prompt.md',
    })
})

test('system canvas uses the fixed black system style', () => {
    const {view} = fixture()

    view.ctx.fills.length = 0
    view.render()

    assert.equal(systemStyle.canvas.background, '#000000')
    assert.equal(view.ctx.fills[0].style, systemStyle.canvas.background)
})

test('application title shape rounds only its top corners', () => {
    const ctx = context()
    const rect = {x: 10, y: 20, w: 100, h: 36}

    topRoundedRect(ctx, rect, 8)

    assert.equal(ctx.operations.filter(operation => operation.name === 'quadraticCurveTo').length, 2)
    assert.ok(ctx.operations.some(operation => operation.name === 'lineTo' && operation.args[0] === 110 && operation.args[1] === 56))
    assert.ok(ctx.operations.some(operation => operation.name === 'lineTo' && operation.args[0] === 10 && operation.args[1] === 56))
})

test('application title renders the styled settings gear', () => {
    const {view} = fixture()

    view.ctx.texts.length = 0
    view.render()

    const gears = view.ctx.texts.filter(entry => entry.args[0] === systemStyle.application.settingsGlyph)
    assert.equal(gears.length, 2)
    assert.equal(gears[0].style, systemStyle.application.settingsText)
    assert.equal(gears[0].font, systemStyle.application.settingsFont)
})

test('node type colors replace separate border, title, divider, and dash styles', () => {
    assert.equal(typeof systemStyle.application.nodeColor, 'string')
    assert.equal(typeof systemStyle.application.externalNodeColor, 'string')
    assert.equal(Object.hasOwn(systemStyle.application, 'border'), false)
    assert.equal(Object.hasOwn(systemStyle.application, 'titleFill'), false)
    assert.equal(Object.hasOwn(systemStyle.application, 'divider'), false)
    assert.equal(Object.hasOwn(systemStyle.application, 'externalDash'), false)
})

test('connection label is larger and centered vertically on its route', () => {
    const {view} = fixture()
    const route = view.routes[0]
    const point = route.points[Math.floor(route.points.length / 2)]
    view.ctx.font = systemStyle.route.labelFont

    const rect = route.labelRect(view.ctx)

    assert.equal(rect.h, systemStyle.route.labelHeight)
    assert.equal(rect.y + rect.h / 2, point.y)
    assert.equal(rect.w, view.ctx.measureText(route.connection.transport).width + systemStyle.route.labelPaddingX * 2)
    assert.ok(systemStyle.route.labelBorderWidth > 0)
    assert.ok(systemStyle.route.labelCornerRadius > 0)
})

test('keyboard shortcuts use sysmod undo and redo pins', () => {
    const {view, tx} = fixture()
    const event = {ctrlKey: true, metaKey: false, shiftKey: false, key: 'z', preventDefault() {}, stopPropagation() {}}

    view.keydown(event)
    view.keydown({...event, shiftKey: true})

    assert.equal(tx.messages.at(-2).pin, 'sysmod.undo')
    assert.equal(tx.messages.at(-1).pin, 'sysmod.redo')
})
