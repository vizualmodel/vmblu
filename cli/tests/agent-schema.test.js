import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'

const context = new URL('../context/1.12.0/', import.meta.url)

function exampleConfig() {
    return {
        schema: 'https://vmblu.dev/schemas/agents.v1.json',
        version: 1,
        enabled: true,
        defaultInterface: 'embedded',
        profiles: [
            {
                id: 'assistant',
                title: 'Assistant',
                enabled: true,
                permissions: {
                    tools: {allow: ['orders.search']},
                    events: {allow: []},
                    probes: {allow: ['orders.status']},
                },
                limits: {maxToolCallsPerTurn: 10},
            },
        ],
        interfaces: [
            {
                id: 'embedded',
                kind: 'embedded',
                profile: 'assistant',
                instructions: 'Help the user.',
                llm: {provider: 'openai', model: 'gpt-4.1-mini'},
                ui: {mode: 'overlay'},
            },
        ],
    }
}

test('agents.v1 validates canonical profiles and interfaces', async () => {
    const schema = JSON.parse(await readFile(new URL('agents.v1.json', context), 'utf8'))
    const validate = new Ajv2020({strict: false, validateFormats: false}).compile(schema)

    assert.equal(validate(exampleConfig()), true, JSON.stringify(validate.errors))

    const mcp = exampleConfig()
    mcp.defaultInterface = 'stdio'
    mcp.interfaces = [
        {id: 'stdio', kind: 'mcp-stdio', profile: 'assistant'},
        {
            id: 'remote',
            kind: 'mcp-http',
            profile: 'assistant',
            server: {host: '127.0.0.1', port: 8787, path: '/mcp'},
            authentication: {
                mode: 'oauth',
                issuer: 'https://auth.example.com',
                resourceServerUrl: 'https://app.example.com/mcp',
                requiredScopes: ['mcp'],
            },
        },
    ]
    assert.equal(validate(mcp), true, JSON.stringify(validate.errors))
})

test('blueprint schema accepts inline and sidecar agent configuration', async () => {
    const schema = JSON.parse(await readFile(new URL('blu.schema.json', context), 'utf8'))
    const agentProperty = schema.$defs.Header.properties.agent
    const validate = new Ajv2020({strict: false, validateFormats: false}).compile({
        $schema: schema.$schema,
        ...agentProperty,
        $defs: schema.$defs,
    })

    for (const agent of [exampleConfig(), './app.agent.json', {path: './app.agent.json'}]) {
        assert.equal(validate(agent), true, JSON.stringify(validate.errors))
    }
})
