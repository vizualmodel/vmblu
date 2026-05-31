import test from 'node:test'
import assert from 'node:assert/strict'

import {HttpAgentAdapter, OpenAIAgentAdapter} from '../agent-adapters/index.js'

const capabilities = {
    application: {id: 'demo'},
    tools: [
        {
            id: 'allowed_tool',
            title: 'Allowed Tool',
            description: 'Allowed tool',
            input: {schema: {type: 'object', properties: {name: {type: 'string'}}}},
        },
        {
            id: 'blocked_tool',
            title: 'Blocked Tool',
            input: {schema: {type: 'object'}},
        },
    ],
    probes: [
        {
            id: 'allowed_probe',
            title: 'Allowed Probe',
            schema: {type: 'object'},
        },
        {
            id: 'blocked_probe',
            title: 'Blocked Probe',
            schema: {type: 'object'},
        },
    ],
    events: [
        {id: 'allowed_event', title: 'Allowed Event'},
        {id: 'blocked_event', title: 'Blocked Event'},
    ],
}

const agent = {
    id: 'operator',
    permissions: {
        tools: {allow: ['allowed_tool']},
        probes: {allow: ['allowed_probe']},
        events: {allow: ['allowed_event']},
    },
}

test('OpenAI adapter projects allowed tools and probes', () => {
    const projection = new OpenAIAgentAdapter({capabilities, agent}).project()
    const names = projection.tools.map(tool => tool.function.name)

    assert.equal(projection.target, 'openai')
    assert.equal(projection.agentId, 'operator')
    assert.equal(projection.tools.length, 2)
    assert(names.some(name => name.startsWith('tool_allowed_tool')))
    assert(names.some(name => name.startsWith('probe_allowed_probe')))
    assert.equal(projection.map.size, 2)
    assert.equal([...projection.map.values()].some(entry => entry.capability.id === 'blocked_tool'), false)
})

test('HTTP adapter includes filtered capabilities and gateway endpoints', () => {
    const projection = new HttpAgentAdapter({
        capabilities,
        agent: {
            ...agent,
            server: {host: '0.0.0.0', port: 9000, basePath: '/vmblu-agent'},
        },
    }).project()

    assert.equal(projection.target, 'http')
    assert.equal(projection.server.host, '0.0.0.0')
    assert.equal(projection.server.port, 9000)
    assert.equal(projection.endpoints.callTool, '/vmblu-agent/tools/{toolId}/call')
    assert.deepEqual(projection.capabilities.tools.map(tool => tool.id), ['allowed_tool'])
    assert.deepEqual(projection.capabilities.probes.map(probe => probe.id), ['allowed_probe'])
    assert.deepEqual(projection.capabilities.events.map(event => event.id), ['allowed_event'])
})
