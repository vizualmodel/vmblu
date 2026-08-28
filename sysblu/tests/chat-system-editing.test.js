import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

import {SysbluManager} from '../nodes/sysblu-manager/sysblu-manager.js'
import {validateSystemDocument} from '../nodes/sysblu-manager/system-document.js'
import {transmitter} from './fixtures.js'
import {validateProtocolReferences} from '../../cli/lib/protocol-validation.js'

const chatSystemUrl = new URL('../../../vmblu-examples/chat-application/system/active.sys.blu', import.meta.url)

test('real Chat system completes endpoint and connection editing without changing its fixture', async () => {
    const originalText = await readFile(chatSystemUrl, 'utf8')
    const document = JSON.parse(originalText)
    const protocolUrl = new URL(document.nodes[0].endpoints[0].protocol, chatSystemUrl)
    const protocol = JSON.parse(await readFile(protocolUrl, 'utf8'))
    assert.equal(protocol.header.name, 'Chat')
    assert.equal(validateProtocolReferences(protocol).ok, true)
    const saved = []
    const arl = {
        getPath: () => chatSystemUrl.pathname,
        canWrite: () => true,
        async save(text) { saved.push(text) },
    }
    const manager = new SysbluManager(transmitter())
    await manager.onSysbluSet({model: document, arl})

    const originalConnection = structuredClone(manager.document.connections[0])
    manager.onSysmodDoit({
        verb: 'addConnection',
        param: {
            connection: {
                ...originalConnection,
                id: 'realtime-chat-test',
            },
        },
    })
    manager.onSysmodDoit({
        verb: 'editConnection',
        param: {
            id: 'realtime-chat-test',
            remarks: 'Temporary in-memory validation binding.',
            transport: 'websocket',
        },
    })

    const edited = manager.document.connections.find(connection => connection.id === 'realtime-chat-test')
    assert.equal(edited.remarks, 'Temporary in-memory validation binding.')
    assert.equal(edited.transport, 'websocket')
    assert.deepEqual(edited.references, originalConnection.references)

    manager.onSysmodDoit({verb: 'deleteEndpoint', param: {nodeId: 'chat-client', id: 'chat-websocket'}})
    assert.equal(manager.document.connections.length, 0)
    manager.onSysmodUndo()
    assert.equal(manager.document.connections.length, 2)
    manager.onSysmodRedo()
    manager.onSysmodUndo()

    const savedText = await manager.onSysbluSave()
    const reopened = JSON.parse(savedText)
    assert.equal(saved.length, 1)
    assert.equal(validateSystemDocument(reopened).ok, true)
    assert.equal(reopened.connections.find(connection => connection.id === 'realtime-chat-test').transport, 'websocket')
    assert.equal(await readFile(chatSystemUrl, 'utf8'), originalText)
})
