import assert from 'node:assert/strict'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {ARL} from '@vizualmodel/vmblu-core/types/arl/arl-node'
import {makeArtifactProvenance, ModelBlueprint, ModelCompiler, UIDGenerator} from '@vizualmodel/vmblu-core/types/model'
import {verifyProject} from '../commands/verify/index.js'
import {chatProtocolFixture} from './fixtures/chat-protocol.js'

test('verify accepts a protocol document and runs semantic reference checks', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-protocol-'))
  try {
    const protocolPath = path.join(dir, 'chat.protocol.json')
    await writeFile(protocolPath, JSON.stringify(chatProtocolFixture('1.12.0')))

    const report = await verifyProject(protocolPath)

    assert.equal(report.ok, true, report.failures.join('\n'))
    assert.ok(report.checks.some(check => check.startsWith('protocol schema:')))
    assert.ok(report.checks.some(check => check.startsWith('protocol references:')))
  }
  finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('verify accepts current generated artifacts and reports stale output', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-verify-'))
  try {
    const modelPath = path.join(dir, 'sample.mod.blu')
    const visualPath = path.join(dir, 'sample.mod.viz')
    const header = {
      version: '1.12.0',
      created: '2026-08-05T00:00:00.000Z',
      saved: '2026-08-05T00:00:00.000Z',
      utc: '2026-08-05T00:00:00.000Z',
      runtime: '@vizualmodel/vmblu-runtime/rt-base',
    }
    await writeFile(modelPath, JSON.stringify({
      header,
      factories: ['./nodes.js'],
      root: {kind: 'group', name: 'Sample', nodes: []},
    }))
    await writeFile(visualPath, JSON.stringify({
      header: {
        version: header.version,
        created: header.created,
        saved: header.saved,
        utc: header.utc,
        style: '#202020',
      },
      root: {kind: 'group', name: 'Sample', nodes: []},
    }))

    const model = new ModelBlueprint(new ARL(modelPath))
    await model.getRaw()
    const common = {
      model: 'sample.mod.blu',
      source: model.raw,
      schemaVersion: '1.12.0',
    }
    const profile = makeArtifactProvenance({
      ...common,
      artifact: 'source-profile',
      generatorName: '@vizualmodel/vmblu-cli',
      generatorVersion: '1.12.0',
    })
    const compiler = new ModelCompiler(new UIDGenerator())
    const root = compiler.compileRawNode(model, model.raw.root)
    root.rxtxBuildTxTable()
    const application = model.makeJSApp(
      root,
      model.getArl().resolve('./sample.app.js'),
      model.getArl().resolve('./index.js'),
      '@vizualmodel/vmblu-runtime/rt-base'
    )
    model.preCook()
    const capabilities = model.makeCapabilityObject(root)

    await writeFile(path.join(dir, 'sample.src.prf'), JSON.stringify({version: '1.12.0', provenance: profile, entries: []}))
    await writeFile(path.join(dir, 'sample.app.js'), application)
    await writeFile(path.join(dir, 'sample.cap.json'), JSON.stringify(capabilities))

    const current = await verifyProject(modelPath, {requireGenerated: true})
    assert.equal(current.ok, true, current.failures.join('\n'))

    const staleProfile = structuredClone(profile)
    staleProfile.source.hash = 'fnv1a64:0000000000000000'
    await writeFile(path.join(dir, 'sample.src.prf'), JSON.stringify({version: '1.12.0', provenance: staleProfile, entries: []}))

    const stale = await verifyProject(modelPath, {requireGenerated: true})
    assert.equal(stale.ok, false)
    assert.ok(stale.failures.some(message => message.includes('stale source hash')))
  }
  finally {
    await rm(dir, {recursive: true, force: true})
  }
})

test('verify diagnoses application security runtime, sidecar, and legacy node settings', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vmblu-security-verify-'))
  const modelPath = path.join(dir, 'secure.mod.blu')
  const visualPath = path.join(dir, 'secure.mod.viz')
  const header = {
    version: '1.12.0',
    created: '2026-09-01T00:00:00.000Z',
    saved: '2026-09-01T00:00:00.000Z',
    utc: '2026-09-01T00:00:00.000Z',
    runtime: '@vizualmodel/vmblu-runtime/rt-als',
  }
  const policy = {
    fs: {read: {mode: 'deny'}, write: {mode: 'allow', roots: ['./out']}, delete: {mode: 'deny'}},
    net: {egress: {mode: 'deny'}},
    process: {exec: {mode: 'deny'}},
  }

  try {
    await writeFile(visualPath, JSON.stringify({header: {
      version: header.version,
      created: header.created,
      saved: header.saved,
      utc: header.utc,
      style: '#202020',
    }, root: {kind: 'group', name: 'Secure', nodes: []}}))

    await writeFile(modelPath, JSON.stringify({header: {...header, runtimeSettings: {security: policy}}, root: {kind: 'group', name: 'Secure', nodes: []}}))
    let report = await verifyProject(modelPath)
    assert.equal(report.ok, true, report.failures.join('\n'))
    assert.ok(report.checks.some(check => check.includes('runtime security: rt-als')))

    await writeFile(modelPath, JSON.stringify({header: {...header, runtime: '@vizualmodel/vmblu-runtime/rt-base', runtimeSettings: {security: policy}}, root: {kind: 'group', name: 'Secure', nodes: []}}))
    report = await verifyProject(modelPath)
    assert.equal(report.ok, true, report.failures.join('\n'))
    assert.ok(report.checks.some(check => check.includes('runtime security: configured, unsupported by rt-base')))

    await writeFile(modelPath, JSON.stringify({header, root: {kind: 'group', name: 'Secure', dx: {security: {enabled: true}}, nodes: []}}))
    report = await verifyProject(modelPath)
    assert.equal(report.ok, false)
    assert.ok(report.failures.some(message => message.includes('ignored legacy node security')))

    await writeFile(modelPath, JSON.stringify({header: {...header, runtimeSettings: './missing.rt.json'}, root: {kind: 'group', name: 'Secure', nodes: []}}))
    report = await verifyProject(modelPath)
    assert.equal(report.ok, false)
    assert.ok(report.failures.some(message => message.includes('runtime sidecar is unresolved')))
  }
  finally {
    await rm(dir, {recursive: true, force: true})
  }
})
