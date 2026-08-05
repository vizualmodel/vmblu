import fs from 'node:fs'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'

import {ARL} from '@vizualmodel/vmblu-core/types/arl/arl-node'
import {ModelBlueprint, sourceHash} from '@vizualmodel/vmblu-core/types/model'
import {resolveEntrypoint} from '../../lib/resolve-entrypoint.js'
import {assertCompatibleVersion, compatibilityFamily, CLI_VERSION, SCHEMA_VERSION} from '../../lib/version-policy.js'

export const command = 'verify <model-file>'
export const describe = 'Verify model compatibility, canonical format and generated artifact freshness'

export const builder = [
  {flag: '--require-generated', desc: 'fail when standard generated artifacts are missing'}
]

export async function verifyProject(inputPath, {requireGenerated = false} = {}) {
  const resolved = resolveEntrypoint(inputPath)
  const model = new ModelBlueprint(new ARL(resolved.modelPath))
  const raw = await model.getRaw()
  if (!raw) throw new Error(`Could not load model ${resolved.modelPath}`)
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
    validate = new Ajv2020({strict: false, validateFormats: false}).compile(schema)
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
