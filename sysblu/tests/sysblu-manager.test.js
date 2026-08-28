import assert from 'node:assert/strict'
import test from 'node:test'

import {SysbluManager} from '../nodes/sysblu-manager/sysblu-manager.js'
import {validateSystemDocument} from '../nodes/sysblu-manager/system-document.js'
import {chatSystem, transmitter} from './fixtures.js'

function fixture() {
    const tx = transmitter()
    const saved = []
    const arl = {
        getPath: () => 'system/chat.sys.blu',
        canWrite: () => true,
        async save(text) {
            saved.push(text)
        },
    }
    return {tx, saved, arl, manager: new SysbluManager(tx)}
}

test('manager loads a cloned document and publishes a snapshot', async () => {
    const {manager, tx, arl} = fixture()
    const input = chatSystem()

    await manager.onSysbluSet({model: input, arl})

    assert.notEqual(manager.document, input)
    assert.deepEqual(manager.document, input)
    assert.equal(tx.last('sysblu.loaded').payload, arl)
    assert.deepEqual(tx.last('sysblu.diagnostics').payload, {arl, errors: []})
    assert.notEqual(tx.last('system.updated').payload.document, manager.document)
    assert.equal(tx.last('system.updated').payload.dirty, false)
})

test('moveNode is reversible and clears redo after a new edit', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})

    manager.onSysmodDoit({verb: 'moveNode', param: {id: 'chat-client', position: {x: 180, y: 240}}})
    assert.deepEqual(manager.document.nodes[0].position, {x: 180, y: 240})
    assert.deepEqual(tx.last('sysmod.done').payload, {verb: 'moveNode', undo: true, redo: false, dirty: true})

    manager.onSysmodUndo()
    assert.deepEqual(manager.document.nodes[0].position, {x: 100, y: 100})
    assert.equal(tx.last('sysmod.done').payload.redo, true)
    assert.equal(tx.last('sysmod.done').payload.dirty, false)

    manager.onSysmodRedo()
    assert.deepEqual(manager.document.nodes[0].position, {x: 180, y: 240})
    assert.equal(tx.last('sysmod.done').payload.redo, false)
    assert.equal(tx.last('sysmod.done').payload.dirty, true)

    manager.onSysmodUndo()
    manager.onSysmodDoit({verb: 'moveNode', param: {id: 'chat-client', position: {x: 300, y: 320}}})
    assert.equal(tx.last('sysmod.done').payload.redo, false)
})

test('editApplication updates chat metadata and typed paths as one reversible edit', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})
    const originalEndpoints = structuredClone(manager.document.nodes[0].endpoints)

    manager.onSysmodDoit({
        verb: 'editApplication',
        param: {
            id: 'chat-client',
            name: 'Browser chat',
            role: 'Presents chat to the user.',
            vmblu: false,
            references: [
                {kind: 'model', label: 'Open application', target: '../client/browser-chat.blu'},
                {kind: 'documentation', label: 'Guide', target: '../client/guide.md'},
                {kind: 'test', label: 'Browser tests', target: '../client/tests'},
            ],
        },
    })

    const application = manager.document.nodes[0]
    assert.equal(application.name, 'Browser chat')
    assert.equal(application.description, 'Presents chat to the user.')
    assert.equal(application.vmblu, false)
    assert.deepEqual(application.references.map(({kind, target}) => ({kind, target})), [
        {kind: 'model', target: '../client/browser-chat.blu'},
        {kind: 'documentation', target: '../client/guide.md'},
        {kind: 'test', target: '../client/tests'},
    ])
    assert.deepEqual(application.endpoints, originalEndpoints)
    assert.equal(application.extensions.future.kept, true)
    assert.equal(tx.last('sysmod.done').payload.dirty, true)

    manager.onSysmodUndo()
    assert.equal(manager.document.nodes[0].name, 'Chat client')
    assert.equal(tx.last('sysmod.done').payload.dirty, false)

    manager.onSysmodRedo()
    assert.equal(manager.document.nodes[0].name, 'Browser chat')
    assert.equal(tx.last('sysmod.done').payload.dirty, true)
})

test('applications can be added and deleted with incident connections through undoable edits', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})

    manager.onSysmodDoit({
        verb: 'addApplication',
        param: {
            application: {
                id: 'chat-admin',
                kind: 'application',
                name: 'Chat admin',
                vmblu: true,
                description: 'Administers chat.',
                position: {x: 320, y: 360},
                references: [{kind: 'model', target: '../admin/chat-admin.blu'}],
                endpoints: [],
            },
        },
    })

    assert.equal(manager.document.nodes.at(-1).id, 'chat-admin')
    assert.equal(tx.last('sysmod.done').payload.dirty, true)

    manager.onSysmodUndo()
    assert.equal(manager.document.nodes.some(node => node.id === 'chat-admin'), false)
    manager.onSysmodRedo()
    assert.equal(manager.document.nodes.some(node => node.id === 'chat-admin'), true)

    manager.onSysmodDoit({verb: 'deleteApplication', param: {id: 'chat-server'}})
    assert.equal(manager.document.nodes.some(node => node.id === 'chat-server'), false)
    assert.equal(manager.document.connections.length, 0)

    manager.onSysmodUndo()
    assert.equal(manager.document.nodes.some(node => node.id === 'chat-server'), true)
    assert.equal(manager.document.connections.length, 1)
})

test('non-vmblu applications and web protocol endpoints are undoable', async () => {
    const {manager, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})
    manager.onSysmodDoit({verb: 'addApplication', param: {application: {
        id: 'identity-provider', kind: 'application', name: 'Identity provider', vmblu: false,
        position: {x: 320, y: 360}, references: [{kind: 'documentation', target: 'https://example.test/oauth'}], endpoints: [],
    }}})
    manager.onSysmodDoit({verb: 'addEndpoint', param: {nodeId: 'identity-provider', endpoint: {
        id: 'oauth', name: 'OAuth 2.0 API', role: 'server', protocol: 'https://example.test/oauth',
    }}})
    let application = manager.document.nodes.find(node => node.id === 'identity-provider')
    assert.equal(application.endpoints[0].protocol, 'https://example.test/oauth')
    manager.onSysmodDoit({verb: 'editApplication', param: {id: application.id, name: 'Identity API', role: 'Managed service.', vmblu: false, references: application.references}})
    application = manager.document.nodes.find(node => node.id === 'identity-provider')
    assert.equal(application.vmblu, false)
    assert.equal(application.description, 'Managed service.')
    manager.onSysmodDoit({verb: 'deleteApplication', param: {id: application.id}})
    assert.equal(manager.document.nodes.some(node => node.id === application.id), false)
    manager.onSysmodUndo()
    assert.equal(manager.document.nodes.some(node => node.id === application.id), true)
})

test('endpoints can be added, edited, and deleted with incident connections atomically', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})

    manager.onSysmodDoit({
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
    assert.equal(manager.document.nodes[0].endpoints.at(-1).id, 'history')

    manager.onSysmodDoit({
        verb: 'editEndpoint',
        param: {
            nodeId: 'chat-client',
            id: 'history',
            endpoint: {
                id: 'ignored-id-change',
                name: 'Chat history API',
                role: 'peer',
                protocol: '../protocols/history-v2.md',
                remarks: 'Optional historical access.',
            },
        },
    })
    const endpoint = manager.document.nodes[0].endpoints.at(-1)
    assert.equal(endpoint.id, 'history')
    assert.equal(endpoint.name, 'Chat history API')
    assert.equal(endpoint.role, 'peer')
    assert.equal(endpoint.protocol, '../protocols/history-v2.md')
    assert.equal(endpoint.remarks, 'Optional historical access.')

    manager.document.connections.push({
        id: 'history-link',
        from: {node: 'chat-client', endpoint: 'history'},
        to: {node: 'chat-server', endpoint: 'chat'},
        transport: 'https',
    })
    manager.sysmod.markClean()
    manager.onSysmodDoit({verb: 'deleteEndpoint', param: {nodeId: 'chat-client', id: 'history'}})
    assert.equal(manager.document.nodes[0].endpoints.some(candidate => candidate.id === 'history'), false)
    assert.equal(manager.document.connections.some(connection => connection.id === 'history-link'), false)

    manager.onSysmodUndo()
    assert.equal(manager.document.nodes[0].endpoints.some(candidate => candidate.id === 'history'), true)
    assert.equal(manager.document.connections.some(connection => connection.id === 'history-link'), true)
    assert.equal(tx.last('sysmod.done').payload.redo, true)
})

test('connections can be added, edited, and deleted without losing references and extensions', async () => {
    const {manager, arl} = fixture()
    const input = chatSystem()
    input.connections = []
    await manager.onSysbluSet({model: input, arl})

    manager.onSysmodDoit({
        verb: 'addConnection',
        param: {
            connection: {
                id: 'chat-link',
                remarks: 'Carries live chat.',
                from: {node: 'chat-client', endpoint: 'chat'},
                to: {node: 'chat-server', endpoint: 'chat'},
                transport: 'websocket',
                references: [{kind: 'documentation', target: '../transport.md'}],
                extensions: {vendor: {retryLimit: 3}},
            },
        },
    })
    assert.equal(manager.document.connections[0].transport, 'websocket')

    manager.onSysmodDoit({
        verb: 'editConnection',
        param: {
            id: 'chat-link',
            remarks: '',
            transport: 'websocket',
        },
    })
    const connection = manager.document.connections[0]
    assert.equal(connection.remarks, undefined)
    assert.equal(connection.transport, 'websocket')
    assert.equal(connection.references[0].target, '../transport.md')
    assert.equal(connection.extensions.vendor.retryLimit, 3)

    manager.onSysmodDoit({verb: 'deleteConnection', param: {id: 'chat-link'}})
    assert.equal(manager.document.connections.length, 0)
    manager.onSysmodUndo()
    assert.equal(manager.document.connections[0].id, 'chat-link')
})

test('adding a duplicate application id is rejected without mutation', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})
    const before = structuredClone(manager.document)

    const originalError = console.error
    console.error = () => {}
    try {
        manager.onSysmodDoit({
            verb: 'addApplication',
            param: {application: structuredClone(manager.document.nodes[0])},
        })
    }
    finally {
        console.error = originalError
    }

    assert.deepEqual(manager.document, before)
    assert.match(tx.last('sysmod.done').payload.error, /already exists/)
})

test('invalid application edits are rejected atomically with a semantic error', async () => {
    const {manager, tx, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})
    const before = structuredClone(manager.document)

    const originalError = console.error
    console.error = () => {}
    try {
        manager.onSysmodDoit({
            verb: 'editApplication',
            param: {
                id: 'chat-client',
                name: '',
                role: '',
                vmblu: true,
                references: [{kind: 'documentation', target: ''}],
            },
        })
    }
    finally {
        console.error = originalError
    }

    assert.deepEqual(manager.document, before)
    assert.match(tx.last('sysmod.done').payload.error, /needs a name/)
    assert.equal(tx.last('sysmod.done').payload.dirty, false)
})

test('save preserves extensions and writes formatted JSON through the active ARL', async () => {
    const {manager, tx, saved, arl} = fixture()
    await manager.onSysbluSet({model: chatSystem(), arl})
    manager.onSysmodDoit({verb: 'moveNode', param: {id: 'chat-client', position: {x: 180, y: 240}}})
    assert.equal(manager.sysmod.isDirty(), true)

    const text = await manager.onSysbluSave()
    const result = JSON.parse(text)

    assert.equal(saved.length, 1)
    assert.equal(result.nodes[0].extensions.future.kept, true)
    assert.equal(Number.isNaN(Date.parse(result.header.saved)), false)
    assert.equal(manager.sysmod.isDirty(), false)
    assert.equal(tx.last('system.updated').payload.dirty, false)

    const reopened = new SysbluManager(transmitter())
    await reopened.onSysbluSet({model: result, arl})
    assert.deepEqual(reopened.document.nodes[0].position, {x: 180, y: 240})
    assert.equal(reopened.sysmod.isDirty(), false)
})

test('invalid documents report a load failure without publishing editable state', async () => {
    const {manager, tx, arl} = fixture()
    const invalid = chatSystem()
    invalid.nodes[1].id = invalid.nodes[0].id

    const originalError = console.error
    console.error = () => {}
    try {
        await manager.onSysbluSet({model: invalid, arl})
    }
    finally {
        console.error = originalError
    }

    assert.equal(manager.document, null)
    assert.equal(tx.last('sysblu.failed').payload, arl)
    assert.equal(tx.last('sysblu.diagnostics').payload.arl, arl)
    assert.ok(tx.last('sysblu.diagnostics').payload.errors.some(error => error.includes('Duplicate system node id')))
})

test('semantic validation rejects connections to unknown endpoints', async () => {
    const {manager, tx, arl} = fixture()
    const invalid = chatSystem()
    invalid.connections[0].to.endpoint = 'missing'

    const originalError = console.error
    console.error = () => {}
    try {
        await manager.onSysbluSet({model: invalid, arl})
    }
    finally {
        console.error = originalError
    }

    assert.equal(manager.document, null)
    assert.equal(tx.last('sysblu.failed').payload, arl)
})

test('semantic validation allows connected endpoints to reference different protocol files', async () => {
    const {manager, arl} = fixture()
    const compatibleSubset = chatSystem()
    compatibleSubset.nodes[1].endpoints[0].protocol = '../protocols/chat-server-superset.md'

    await manager.onSysbluSet({model: compatibleSubset, arl})

    assert.equal(manager.document.nodes[1].endpoints[0].protocol, '../protocols/chat-server-superset.md')
})

test('semantic validation requires command and workingDirectory together', () => {
    const document = chatSystem()
    delete document.nodes[0].references.find(reference => reference.kind === 'build').workingDirectory

    const result = validateSystemDocument(document)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(error => error.includes('both command and workingDirectory')))
})
