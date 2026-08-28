import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'

import {validateProtocolReferences} from '../lib/protocol-validation.js'
import {chatProtocolFixture} from './fixtures/chat-protocol.js'

const contextUrl = new URL('../context/1.11.0/', import.meta.url)

async function makeValidator() {
  const blueprintSchema = JSON.parse(await readFile(new URL('blu.schema.json', contextUrl), 'utf8'))
  const protocolSchema = JSON.parse(await readFile(new URL('protocol.schema.json', contextUrl), 'utf8'))
  const ajv = new Ajv2020({strict: false, validateFormats: false})
  ajv.addSchema(blueprintSchema)
  return ajv.compile(protocolSchema)
}

test('1.11.0 protocol schema accepts the Chat protocol fixture', async () => {
  const validate = await makeValidator()
  const protocol = chatProtocolFixture()

  assert.equal(validate(protocol), true, JSON.stringify(validate.errors))
  assert.deepEqual(validateProtocolReferences(protocol), {ok: true, errors: []})
})

test('protocol interactions require explicit flow, type, and response semantics', async () => {
  const validate = await makeValidator()
  const protocol = chatProtocolFixture()
  delete protocol.interactions[0].response

  assert.equal(validate(protocol), false)

  protocol.interactions[0].response = []
  protocol.interactions[0].flow = 'client-server'
  assert.equal(validate(protocol), false)
})

test('protocol semantic validation rejects duplicate and dangling interaction references', async () => {
  const protocol = chatProtocolFixture()
  protocol.interactions[1].id = protocol.interactions[0].id
  protocol.interactions[0].response = [{id: 'missing-reply'}]

  const result = validateProtocolReferences(protocol)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('Duplicate protocol interaction id')))
  assert.ok(result.errors.some(error => error.includes('unknown response missing-reply')))
})

test('protocol semantic validation accepts recursive types and rejects unknown type references', async () => {
  const protocol = chatProtocolFixture()
  protocol.types.ChatMessage.fields.replyTo = {vmbluType: 'ChatMessage'}
  assert.equal(validateProtocolReferences(protocol).ok, true)

  protocol.types.ChatMessage.fields.author = {vmbluType: 'UnknownUser'}
  const result = validateProtocolReferences(protocol)
  assert.equal(result.ok, false)
  assert.ok(result.errors.some(error => error.includes('unknown type UnknownUser')))
})
