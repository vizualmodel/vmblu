import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'

const schemaUrl = new URL('../context/1.11.0/sys.schema.json', import.meta.url)

async function makeValidator() {
  const schema = JSON.parse(await readFile(schemaUrl, 'utf8'))
  const ajv = new Ajv2020({strict: false, validateFormats: false})
  return ajv.compile(schema)
}

function chatSystem() {
  return {
    header: {
      version: '1.11.0',
      name: 'Chat application',
      description: 'Browser chat client and WebSocket server.',
    },
    nodes: [
      {
        id: 'chat-client',
        kind: 'application',
        name: 'Chat client',
        vmblu: true,
        position: {x: 80, y: 120},
        references: [
          {kind: 'model', target: '../chat-client/chat-client.blu'},
          {kind: 'documentation', target: '../docs/chat-client.md'},
          {
            kind: 'build',
            target: '../chat-client/package.json',
            command: 'npm run build',
            workingDirectory: '../chat-client',
          },
        ],
        endpoints: [
          {
            id: 'chat',
            name: 'Live messages',
            role: 'client',
            protocol: '../protocols/chat.protocol.json',
          },
        ],
      },
      {
        id: 'chat-server',
        kind: 'application',
        name: 'Chat server',
        vmblu: true,
        position: {x: 480, y: 120},
        endpoints: [
          {
            id: 'chat',
            name: 'Live messages',
            role: 'server',
            protocol: '../protocols/chat.protocol.json',
          },
        ],
      },
      {
        id: 'identity-provider',
        kind: 'application',
        name: 'Identity provider',
        vmblu: false,
        position: {x: 480, y: 360},
        references: [{kind: 'documentation', target: 'https://example.test/oauth'}],
        endpoints: [{id: 'oauth', name: 'OAuth 2.0 API', role: 'server', protocol: 'https://example.test/oauth'}],
      },
    ],
    connections: [
      {
        id: 'realtime-chat',
        from: {node: 'chat-client', endpoint: 'chat'},
        to: {node: 'chat-server', endpoint: 'chat'},
        transport: 'websocket',
      },
      {
        id: 'login',
        from: {node: 'chat-client', endpoint: 'chat'},
        to: {node: 'identity-provider', endpoint: 'oauth'},
        transport: 'https',
      },
    ],
    references: [
      {kind: 'prompt', label: 'Application prompt', target: '../prompt.md'},
      {kind: 'documentation', label: 'System overview', target: '../README.md'},
    ],
    view: {offset: {x: 0, y: 0}, zoom: 1},
  }
}

test('1.11.0 system schema accepts vmblu and non-vmblu applications with protocol connections', async () => {
  const validate = await makeValidator()
  const system = chatSystem()

  assert.equal(validate(system), true, JSON.stringify(validate.errors))
})

test('1.11.0 system schema accepts Chat command references', async () => {
  const validate = await makeValidator()
  const system = chatSystem()

  assert.equal(validate(system), true, JSON.stringify(validate.errors))
  assert.equal(system.nodes[0].references.find(reference => reference.kind === 'build').command, 'npm run build')
})

test('1.11.0 system schema accepts an explicit project-level prompt reference', async () => {
  const validate = await makeValidator()
  const system = chatSystem()

  assert.equal(system.references[0].kind, 'prompt')
  assert.equal(validate(system), true, JSON.stringify(validate.errors))
})

test('1.11.0 system schema requires command and workingDirectory together', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  const reference = system.nodes[0].references[2]
  assert.equal(validate(system), true, JSON.stringify(validate.errors))

  delete reference.workingDirectory
  assert.equal(validate(system), false)

  reference.workingDirectory = '../chat-client'
  delete reference.command
  assert.equal(validate(system), false)
})

test('1.11.0 system schema requires the vmblu rendering flag', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  delete system.nodes[0].vmblu

  assert.equal(validate(system), false)
})

test('1.11.0 system schema rejects undeclared fields but permits explicit extensions', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  system.nodes[0].extensions = {vendor: {color: 'blue'}}
  assert.equal(validate(system), true, JSON.stringify(validate.errors))

  system.nodes[0].unexpected = true
  assert.equal(validate(system), false)
})

test('1.11.0 system schema requires an explicit connection transport', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  delete system.connections[0].transport
  assert.equal(validate(system), false)

  system.connections[0].transport = 'unspecified'
  assert.equal(validate(system), true, JSON.stringify(validate.errors))
})

test('1.11.0 system schema permits an API endpoint without an owned protocol document', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  delete system.nodes[0].endpoints[0].protocol

  assert.equal(validate(system), true, JSON.stringify(validate.errors))
})

test('1.11.0 system schema rejects obsolete endpoint and connection fields', async () => {
  const validate = await makeValidator()
  const system = chatSystem()
  system.nodes[0].endpoints[0].direction = 'required'
  system.nodes[0].endpoints[0].references = [{kind: 'documentation', target: '../endpoint.md'}]
  system.connections[0].protocol = {name: 'Chat protocol'}
  system.connections[0].name = 'Realtime chat'
  system.connections[0].flow = 'two-way'

  assert.equal(validate(system), false)
})
