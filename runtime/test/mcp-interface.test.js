import test from 'node:test'
import assert from 'node:assert/strict'

import {ToolBroker} from '../agent-base/tool-broker.js'
import {
    createVmbluMcpHttpHandler,
    createVmbluMcpServer,
    startConfiguredVmbluMcpInterfaces,
    startVmbluMcpHttpServer,
} from '../mcp/index.js'
import {Runtime} from '../rt-nodejs-agent/runtime.js'

function makeBroker() {
    const broker = new ToolBroker({
        capabilities: {
            tools: [
                {id: 'allowed.tool', title: 'Allowed', description: 'Allowed tool', input: {schema: {type: 'object'}}},
                {id: 'hidden.tool', title: 'Hidden', description: 'Hidden tool', input: {schema: {type: 'object'}}},
            ],
            probes: [{
                id: 'state.current',
                title: 'Current state',
                argsSchema: {type: 'object'},
                schema: {type: 'object', properties: {value: {type: 'number'}}},
            }],
            events: [{id: 'app.changed', title: 'Changed', schema: {type: 'object', properties: {id: {type: 'string'}}}}],
        },
    })
    broker.registerAgent({
        id: 'external',
        enabled: true,
        permissions: {
            tools: {allow: ['allowed.tool']},
            probes: {allow: ['state.current']},
            events: {allow: ['app.changed']},
        },
    })
    return broker
}

function mcpRequest(method, params = {}) {
    return new Request('http://127.0.0.1/mcp', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    })
}

async function responseMessage(response) {
    const text = await response.text()
    const data = text.split('\n').find(line => line.startsWith('data: '))?.slice(6) ?? text
    return JSON.parse(data)
}

test('MCP projection contains only the fixed profile capabilities', async () => {
    const broker = makeBroker()
    assert.ok(createVmbluMcpServer({broker, profileId: 'external'}))

    const handler = createVmbluMcpHttpHandler({
        broker,
        profileId: 'external',
        authentication: {mode: 'loopback'},
    })
    const response = await handler.fetch(mcpRequest('tools/list'))
    const message = await responseMessage(response)
    const names = message.result.tools.map(tool => tool.name)

    assert.deepEqual(names, ['allowed.tool', 'probe.state.current', 'event.wait.app.changed'])
    assert.equal(names.includes('hidden.tool'), false)
    assert.equal(message.result.tools[1].outputSchema.properties.value.type, 'number')
    assert.equal(message.result.tools[2].outputSchema.properties.id.type, 'string')
})

test('MCP HTTP OAuth gate rejects missing tokens and accepts verified tokens', async () => {
    const broker = makeBroker()
    const authentication = {
        mode: 'oauth',
        resourceServerUrl: 'http://127.0.0.1/mcp',
        dangerouslyAllowInsecureIssuerUrl: true,
        requiredScopes: ['mcp'],
        oauthMetadata: {
            issuer: 'http://127.0.0.1:9000',
            authorization_endpoint: 'http://127.0.0.1:9000/authorize',
            token_endpoint: 'http://127.0.0.1:9000/token',
            response_types_supported: ['code'],
        },
        verifier: {
            async verifyAccessToken(token) {
                if (token !== 'valid-token') throw new Error('invalid token')
                return {
                    token,
                    clientId: 'external-client',
                    scopes: ['mcp'],
                    expiresAt: Math.floor(Date.now() / 1000) + 60,
                }
            },
        },
    }
    const handler = createVmbluMcpHttpHandler({broker, profileId: 'external', authentication})

    const denied = await handler.fetch(mcpRequest('tools/list'))
    assert.equal(denied.status, 401)
    assert.match(denied.headers.get('www-authenticate'), /^Bearer /)

    const authorizedRequest = mcpRequest('tools/list')
    authorizedRequest.headers.set('authorization', 'Bearer valid-token')
    const accepted = await handler.fetch(authorizedRequest)
    assert.equal(accepted.status, 200)
    assert.equal((await responseMessage(accepted)).result.tools[0].name, 'allowed.tool')
})

test('unauthenticated HTTP mode is restricted to a loopback listener', async () => {
    const broker = makeBroker()
    await assert.rejects(
        startVmbluMcpHttpServer({
            broker,
            profileId: 'external',
            host: '0.0.0.0',
            port: 0,
            authentication: {mode: 'loopback'},
        }),
        /loopback host/,
    )
})

test('node runtime explicitly starts configured MCP interfaces without an embedded agent', async () => {
    const runtime = new Runtime([], {
        capabilities: {tools: [], probes: [], events: []},
        agent: {
            schema: 'https://vmblu.dev/schemas/agents.v1.json',
            version: 1,
            defaultInterface: 'remote',
            profiles: [{
                id: 'external',
                permissions: {tools: {allow: []}, probes: {allow: []}, events: {allow: []}},
            }],
            interfaces: [{
                id: 'remote',
                kind: 'mcp-http',
                profile: 'external',
                server: {host: '127.0.0.1', port: 0, path: '/mcp'},
                authentication: {mode: 'loopback'},
            }],
        },
    })
    runtime.start()
    try {
        assert.equal(runtime.agent, null)
        const running = await startConfiguredVmbluMcpInterfaces({runtime})
        const [handle] = running.handles
        assert.equal(handle.profileId, 'external')
        assert.ok(handle.port > 0)
        await running.close()
    }
    finally {
        runtime.stop()
    }
})
