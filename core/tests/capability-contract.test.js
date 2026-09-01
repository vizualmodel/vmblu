import test from 'node:test'
import assert from 'node:assert/strict'

import {
    hasReplyContract,
    isValidCapabilityId,
    makeCapabilityId,
    schemaFromPinContract,
} from '../types/model/capability-contract.js'
import {ModelBlueprint} from '../types/model/blueprint.js'
import {ARL} from '../types/arl/arl-node.js'

const types = {
    Address: {
        kind: 'object',
        fields: {
            street: {vmbluType: 'string'},
        },
        required: ['street'],
    },
    OrderRequest: {
        kind: 'object',
        fields: {
            billing: {vmbluType: 'Address'},
            shipping: {vmbluType: 'Address'},
        },
    },
    OrderReply: {
        kind: 'object',
        fields: {
            orderId: {vmbluType: 'string'},
        },
        required: ['orderId'],
    },
}

test('pin contract derives independent request and reply schemas', () => {
    const pin = {
        contract: {
            payload: {request: 'OrderRequest', reply: 'OrderReply'},
        },
    }

    const input = schemaFromPinContract(pin, types, 'request')
    const output = schemaFromPinContract(pin, types, 'reply')

    assert.equal(hasReplyContract(pin), true)
    assert.equal(input.properties.billing.properties.street.type, 'string')
    assert.equal(input.properties.shipping.properties.street.type, 'string')
    assert.deepEqual(output.required, ['orderId'])
})

test('generated capability ids are stable protocol-safe slugs', () => {
    const id = makeCapabilityId(['Order manager'], 'Create @ order')

    assert.equal(id, 'Order-manager.Create-order')
    assert.equal(isValidCapabilityId(id), true)
    assert.equal(isValidCapabilityId('create @ order'), false)
})

test('capability generation includes a derived channel output schema', () => {
    const model = new ModelBlueprint(new ARL('C:/project/model/app.mod.blu'))
    model.raw = {
        header: {version: '1.12.0'},
        root: {
            kind: 'group',
            name: 'App',
            nodes: [{
                kind: 'source',
                name: 'Orders',
                interfaces: [{
                    name: 'main',
                    pins: [{
                        name: 'create',
                        tool: {enabled: true},
                        contract: {payload: {request: 'OrderRequest', reply: 'OrderReply'}},
                    }],
                }],
            }],
        },
    }
    model.vmbluTypes = types

    const tool = model.makeCapabilityObject().tools[0]
    assert.equal(tool.id, 'App.Orders.create')
    assert.equal(tool.input.schema.properties.billing.type, 'object')
    assert.equal(tool.output.schema.properties.orderId.type, 'string')
})

test('capability generation makes the application id protocol-safe', () => {
    const model = new ModelBlueprint(new ARL('C:/project/model/app.mod.blu'))
    model.raw = {
        header: {version: '1.12.0'},
        root: {kind: 'group', name: 'Customer portal', nodes: []},
    }

    const capabilities = model.makeCapabilityObject()

    assert.equal(capabilities.application.id, 'Customer-portal')
    assert.equal(capabilities.application.title, 'Customer portal')
    assert.equal(isValidCapabilityId(capabilities.application.id), true)
})
