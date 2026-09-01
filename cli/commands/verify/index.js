import fs from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'

import {ARL} from '@vizualmodel/vmblu-core/types/arl/arl-node'
import {ModelBlueprint, sourceHash} from '@vizualmodel/vmblu-core/types/model'
import {getRuntimeDescriptor, getRuntimeSettings, RT_ALS} from '@vizualmodel/vmblu-runtime/runtime-settings'
import {validateProtocolReferences} from '../../lib/protocol-validation.js'
import {resolveEntrypoint} from '../../lib/resolve-entrypoint.js'
import {assertCompatibleVersion, compatibilityFamily, CLI_VERSION, SCHEMA_VERSION} from '../../lib/version-policy.js'

export const command = 'verify <file>'
export const describe = 'Verify a model project or protocol document'

export const builder = [
  {flag: '--require-generated', desc: 'fail when standard generated artifacts are missing'}
]

export async function verifyProject(inputPath, {requireGenerated = false} = {}) {
  if (path.resolve(inputPath).toLowerCase().endsWith('.protocol.json')) return verifyProtocol(inputPath)

  const resolved = resolveEntrypoint(inputPath)
  const model = new ModelBlueprint(new ARL(resolved.modelPath))
  const raw = await model.getRaw()
  if (!raw) throw new Error(`Could not load model ${resolved.modelPath}`)
  model.preCook()
  const modelDocument = JSON.parse(fs.readFileSync(resolved.modelPath, 'utf8'))

  const checks = []
  const failures = []
  const skipped = []

  runCheck(checks, failures, 'compatibility', () => {
    const family = assertCompatibleVersion(raw.header?.version, 'model schema')
    return `family ${family}`
  })

  runCheck(checks, failures, 'canonical factories', () => {
    const invalid = (raw.factories ?? []).filter(factory => typeof factory !== 'string' || !factory.trim())
    if (invalid.length) throw new Error('top-level factories must contain canonical file-path strings')
    return `${raw.factories?.length ?? 0} entries`
  })

  runCheck(checks, failures, 'model schema', () => {
    validateDocument(modelDocument, 'blu.schema.json')
    return SCHEMA_VERSION
  })

  runCheck(checks, failures, 'runtime security', () => {
    return verifyRuntimeSecurity(modelDocument, resolved.modelPath)
  })

  const capabilities = model.makeCapabilityObject()
  runCheck(checks, failures, 'agent integration', () => {
    return verifyAgentIntegration(modelDocument.header?.agent, resolved.modelPath, capabilities)
  })

  runCheck(checks, failures, 'visual schema', () => {
    const visualPath = model.viz.arl?.getFullPath?.()
    if (!visualPath || !fs.existsSync(visualPath)) throw new Error('visual model is missing')
    const visual = JSON.parse(fs.readFileSync(visualPath, 'utf8'))
    assertCompatibleVersion(visual.header?.version, 'visual schema')
    if (compatibilityFamily(visual.header?.version) !== compatibilityFamily(raw.header?.version)) {
      throw new Error(`visual schema ${visual.header?.version} does not match model schema ${raw.header?.version}`)
    }
    validateDocument(visual, 'viz.schema.json')
    return `family ${compatibilityFamily(visual.header?.version)}`
  })

  const expectedHash = sourceHash(raw)
  const base = artifactBase(resolved.modelPath)
  const artifacts = [
    {kind: 'source-profile', file: `${base}.src.prf`, read: readJsonArtifact, schema: 'prf.schema.json'},
    {kind: 'application', file: `${base}.app.js`, read: readJavascriptProvenance},
    {kind: 'capabilities', file: `${base}.cap.json`, read: readJsonArtifact, schema: 'capabilities.schema.json'},
  ]
  if (raw.header?.agent && typeof raw.header.agent === 'object' && !raw.header.agent.path) {
    artifacts.push({kind: 'agent-configuration', file: `${base}.agent.json`, read: readJsonArtifact, schema: 'agents.v1.json'})
  }

  for (const artifact of artifacts) {
    if (!fs.existsSync(artifact.file)) {
      const message = `${artifact.kind}: missing ${artifact.file}`
      if (requireGenerated) failures.push(message)
      else skipped.push(message)
      continue
    }

    runCheck(checks, failures, artifact.kind, () => {
      const {provenance, document} = artifact.read(artifact.file)
      if (artifact.schema) validateDocument(document, artifact.schema)
      validateProvenance(
        provenance,
        artifact.kind,
        expectedHash,
        raw.header?.version,
        path.basename(resolved.modelPath)
      )
      return `current (${path.basename(artifact.file)})`
    })
  }

  return {
    ok: failures.length === 0,
    cliVersion: CLI_VERSION,
    compatibilityFamily: compatibilityFamily(CLI_VERSION),
    model: resolved.modelPath,
    checks,
    skipped,
    failures,
  }
}

function verifyRuntimeSecurity(document, modelPath) {
  const header = document.header ?? {}
  const settings = resolveRuntimeSettings(header.runtimeSettings, modelPath)
  const legacyNodes = collectLegacyNodeSecurity(document.root)
  if (legacyNodes.length) {
    throw new Error(`ignored legacy node security on ${legacyNodes.join(', ')}`)
  }
  if (!settings?.security) return 'not configured'

  const descriptor = getRuntimeDescriptor(header.runtime)
  const policySettings = descriptor.supportsSecurity ? getRuntimeSettings(header.runtime) : getRuntimeSettings(RT_ALS)
  const errors = policySettings.validateModel?.(settings) ?? []
  if (errors.length) throw new Error(errors.map(error => `${error.path}: ${error.message}`).join('; '))
  if (!descriptor.supportsSecurity) return `configured, unsupported by ${descriptor.name}`
  return `${descriptor.name}, model base ${path.dirname(modelPath)}`
}

function verifyAgentIntegration(agentHeader, modelPath, capabilities) {
  validateCapabilityReferences(capabilities)
  if (!agentHeader) return 'not configured'

  const config = resolveAgentConfiguration(agentHeader, modelPath)
  validateDocument(config, 'agents.v1.json')

  const profileIds = uniqueIds(config.profiles, 'agent profile')
  const interfaceIds = uniqueIds(config.interfaces, 'agent interface')
  if (config.defaultInterface && !interfaceIds.has(config.defaultInterface)) {
    throw new Error(`defaultInterface references unknown interface: ${config.defaultInterface}`)
  }

  const known = {
    tools: new Set(capabilities.tools.map(item => item.id)),
    probes: new Set(capabilities.probes.map(item => item.id)),
    events: new Set(capabilities.events.map(item => item.id)),
  }
  for (const profile of config.profiles) {
    for (const kind of ['tools', 'probes', 'events']) {
      for (const id of [...(profile.permissions?.[kind]?.allow ?? []), ...(profile.permissions?.[kind]?.deny ?? [])]) {
        if (id !== '*' && !known[kind].has(id)) throw new Error(`profile ${profile.id} references unknown ${kind} capability: ${id}`)
      }
    }
  }
  for (const item of config.interfaces) {
    if (!profileIds.has(item.profile)) throw new Error(`interface ${item.id} references unknown profile: ${item.profile}`)
  }

  const enabledEmbedded = config.interfaces.filter(item => item.kind === 'embedded' && item.enabled !== false)
  if (enabledEmbedded.length) {
    if (!config.defaultInterface) throw new Error('defaultInterface is required when an embedded interface is enabled')
    const selected = config.interfaces.find(item => item.id === config.defaultInterface)
    if (selected?.kind !== 'embedded') throw new Error(`defaultInterface must select an embedded interface: ${config.defaultInterface}`)
    if (selected.enabled === false) throw new Error(`default embedded interface is disabled: ${selected.id}`)
    const profile = config.profiles.find(item => item.id === selected.profile)
    if (profile?.enabled === false) throw new Error(`default embedded interface references disabled profile: ${selected.profile}`)
  }

  return `${config.profiles.length} profiles, ${config.interfaces.length} interfaces`
}

function resolveAgentConfiguration(agentHeader, modelPath) {
  const reference = typeof agentHeader === 'string' ? agentHeader : agentHeader?.path
  if (!reference) return agentHeader
  const sidecarPath = path.resolve(path.dirname(modelPath), reference)
  if (!fs.existsSync(sidecarPath)) throw new Error(`agent sidecar is unresolved: ${sidecarPath}`)
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`agent sidecar is malformed: ${sidecarPath}: ${error?.message ?? String(error)}`)
  }
}

function validateCapabilityReferences(capabilities) {
  const ids = new Set()
  for (const item of [...capabilities.tools, ...capabilities.probes, ...capabilities.events]) {
    if (ids.has(item.id)) throw new Error(`duplicate capability id: ${item.id}`)
    ids.add(item.id)
  }
  const probes = new Set(capabilities.probes.map(item => item.id))
  const events = new Set(capabilities.events.map(item => item.id))
  for (const tool of capabilities.tools) {
    for (const effect of tool.effects ?? []) {
      for (const id of effect.verifyWith?.probes ?? []) {
        const probeId = typeof id === 'string' ? id : id?.id
        if (probeId && !probes.has(probeId)) throw new Error(`tool ${tool.id} verifies with unknown probe: ${probeId}`)
      }
      for (const eventId of effect.verifyWith?.events ?? []) {
        if (!events.has(eventId)) throw new Error(`tool ${tool.id} verifies with unknown event: ${eventId}`)
      }
    }
  }
}

function uniqueIds(items, label) {
  const ids = new Set()
  for (const item of items ?? []) {
    if (ids.has(item.id)) throw new Error(`duplicate ${label} id: ${item.id}`)
    ids.add(item.id)
  }
  return ids
}

function resolveRuntimeSettings(settings, modelPath) {
  const reference = typeof settings === 'string' ? settings : settings?.path
  if (!reference) return settings
  const sidecarPath = path.resolve(path.dirname(modelPath), reference)
  if (!fs.existsSync(sidecarPath)) throw new Error(`runtime sidecar is unresolved: ${sidecarPath}`)
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, 'utf8'))
  }
  catch (error) {
    throw new Error(`runtime sidecar is malformed: ${sidecarPath}: ${error?.message ?? String(error)}`)
  }
}

function collectLegacyNodeSecurity(node, result = []) {
  if (!node || typeof node !== 'object') return result
  if (node.dx?.security || node.dx?.safety) result.push(node.name ?? '<unnamed node>')
  for (const child of node.nodes ?? []) collectLegacyNodeSecurity(child, result)
  return result
}

function verifyProtocol(inputPath) {
  const protocolPath = path.resolve(inputPath)
  if (!fs.existsSync(protocolPath) || !fs.statSync(protocolPath).isFile()) {
    throw new Error(`${inputPath} is not a file`)
  }
  const document = JSON.parse(fs.readFileSync(protocolPath, 'utf8'))
  const checks = []
  const failures = []

  runCheck(checks, failures, 'compatibility', () => {
    const family = assertCompatibleVersion(document.header?.version, 'protocol schema')
    return `family ${family}`
  })
  runCheck(checks, failures, 'protocol schema', () => {
    validateDocument(document, 'protocol.schema.json')
    return SCHEMA_VERSION
  })
  runCheck(checks, failures, 'protocol references', () => {
    const result = validateProtocolReferences(document)
    if (!result.ok) throw new Error(result.errors.join('; '))
    return `${document.interactions?.length ?? 0} interactions, ${Object.keys(document.types ?? {}).length} types`
  })

  return {
    ok: failures.length === 0,
    cliVersion: CLI_VERSION,
    compatibilityFamily: compatibilityFamily(CLI_VERSION),
    model: protocolPath,
    checks,
    skipped: [],
    failures,
  }
}

export const handler = async argv => {
  const args = parseArgs(argv)
  if (!args.modelFile) throw new Error('Usage: vmblu verify <model-file> [--require-generated]')

  const report = await verifyProject(args.modelFile, {requireGenerated: args.requireGenerated})
  console.log(`vmblu ${report.cliVersion} compatibility family ${report.compatibilityFamily}`)
  for (const check of report.checks) console.log(`ok: ${check}`)
  for (const skipped of report.skipped) console.log(`skip: ${skipped}`)
  if (!report.ok) throw new Error(`Verification failed:\n- ${report.failures.join('\n- ')}`)
  console.log('Verification passed.')
}

function artifactBase(modelPath) {
  const parsed = path.parse(modelPath)
  const name = parsed.ext === '.blu' && parsed.name.endsWith('.mod')
    ? parsed.name.slice(0, -'.mod'.length)
    : parsed.name
  return path.join(parsed.dir, name)
}

function readJsonArtifact(file) {
  const document = JSON.parse(fs.readFileSync(file, 'utf8'))
  return {document, provenance: document.provenance}
}

function readJavascriptProvenance(file) {
  const text = fs.readFileSync(file, 'utf8')
  const match = text.match(/^\/\/ @vmblu-generated (\{.*\})$/m)
  if (!match) throw new Error('generated marker is missing')
  return {provenance: JSON.parse(match[1]), document: null}
}

const validators = new Map()

function validateDocument(document, schemaFile) {
  let validate = validators.get(schemaFile)
  if (!validate) {
    const schemaUrl = new URL(`../../context/${SCHEMA_VERSION}/${schemaFile}`, import.meta.url)
    const schema = JSON.parse(fs.readFileSync(schemaUrl, 'utf8'))
    const ajv = new Ajv2020({strict: false, validateFormats: false})
    if (schemaFile === 'protocol.schema.json') {
      const blueprintUrl = new URL(`../../context/${SCHEMA_VERSION}/blu.schema.json`, import.meta.url)
      ajv.addSchema(JSON.parse(fs.readFileSync(blueprintUrl, 'utf8')))
    }
    validate = ajv.compile(schema)
    validators.set(schemaFile, validate)
  }
  if (!validate(document)) {
    const details = validate.errors?.map(error => `${error.instancePath || '/'} ${error.message}`).join('; ')
    throw new Error(details || `${schemaFile} validation failed`)
  }
}

function validateProvenance(provenance, expectedKind, expectedHash, schemaVersion, modelIdentity) {
  if (!provenance?.generated) throw new Error('generated marker is missing')
  if (provenance.artifact !== expectedKind) {
    throw new Error(`expected ${expectedKind} provenance, found ${provenance.artifact ?? 'none'}`)
  }
  assertCompatibleVersion(provenance.generator?.version, `${expectedKind} generator`)
  assertCompatibleVersion(provenance.schemaVersion, `${expectedKind} schema`)
  if (compatibilityFamily(provenance.schemaVersion) !== compatibilityFamily(schemaVersion)) {
    throw new Error(`artifact schema ${provenance.schemaVersion} does not match model schema ${schemaVersion}`)
  }
  if (provenance.source?.hash !== expectedHash) {
    throw new Error(`stale source hash ${provenance.source?.hash ?? '<missing>'}; expected ${expectedHash}`)
  }
  if (provenance.source?.model !== modelIdentity) {
    throw new Error(`source model is ${provenance.source?.model ?? '<missing>'}; expected ${modelIdentity}`)
  }
}

function runCheck(checks, failures, name, operation) {
  try {
    checks.push(`${name}: ${operation()}`)
  }
  catch (error) {
    failures.push(`${name}: ${error?.message ?? String(error)}`)
  }
}

function parseArgs(argv = []) {
  const args = {modelFile: null, requireGenerated: false}
  for (const token of argv) {
    if (token === '--require-generated') args.requireGenerated = true
    else if (String(token).startsWith('-')) throw new Error(`Unknown verify option: ${token}`)
    else if (!args.modelFile) args.modelFile = token
    else throw new Error(`Unexpected verify argument: ${token}`)
  }
  return args
}
