import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'
import Ajv2020 from 'ajv/dist/2020.js'

import {ARL} from '@vizualmodel/vmblu-core/types/arl/arl-node'
import {makeArtifactProvenance, ModelBlueprint} from '@vizualmodel/vmblu-core/types/model'

test('canonical generated JSON artifacts satisfy the release schemas', async () => {
  const context = new URL('../context/1.10.0/', import.meta.url)
  const prfSchema = JSON.parse(await readFile(new URL('prf.schema.json', context), 'utf8'))
  const capSchema = JSON.parse(await readFile(new URL('capabilities.schema.json', context), 'utf8'))
  const ajv = new Ajv2020({strict: false, validateFormats: false})
  const validateProfile = ajv.compile(prfSchema)
  const validateCapabilities = ajv.compile(capSchema)

  const model = new ModelBlueprint(new ARL('C:/project/model/app.mod.blu'))
  model.raw = {
    header: {version: '1.10.0', runtime: '@vizualmodel/vmblu-runtime/rt-base'},
    root: {kind: 'group', name: 'App', nodes: []},
  }
  const profile = {
    version: '1.10.0',
    provenance: makeArtifactProvenance({
      artifact: 'source-profile',
      model: 'app.mod.blu',
      source: model.raw,
      generatorName: '@vizualmodel/vmblu-cli',
      generatorVersion: '1.10.0',
      schemaVersion: '1.10.0',
    }),
    entries: [],
  }
  const capabilities = model.makeCapabilityObject()

  assert.equal(validateProfile(profile), true, JSON.stringify(validateProfile.errors))
  assert.equal(validateCapabilities(capabilities), true, JSON.stringify(validateCapabilities.errors))
})
