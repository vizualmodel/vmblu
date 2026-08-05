import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

import {compatibilityFamily, familyRange} from '../lib/version-policy.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')

const cli = readJson('cli/package.json')
const core = readJson('core/package.json')
const runtime = readJson('runtime/package.json')
const versions = {
  cli: cli.version,
  core: core.version,
  runtime: runtime.version,
  schema: cli.schemaVersion,
}

const families = new Set(Object.values(versions).map(compatibilityFamily))
if (families.size !== 1) {
  throw new Error(`Release components do not share one compatibility family: ${JSON.stringify(versions)}`)
}

const expectedRange = familyRange(cli.version)
for (const [name, range] of Object.entries({
  core: cli.dependencies['@vizualmodel/vmblu-core'],
  runtime: cli.dependencies['@vizualmodel/vmblu-runtime'],
})) {
  if (range !== expectedRange) {
    throw new Error(`CLI ${name} dependency must be '${expectedRange}', found '${range}'`)
  }
}

if (!cli.files.includes('commands/verify')) {
  throw new Error('CLI package files must include commands/verify')
}

const contextDir = path.join(root, 'cli', 'context', cli.schemaVersion)
for (const file of ['blu.schema.json', 'blu.annex.md', 'viz.schema.json', 'prf.schema.json', 'capabilities.schema.json']) {
  if (!fs.existsSync(path.join(contextDir, file))) throw new Error(`Missing release context file: ${file}`)
}

for (const [file, title] of [
  ['blu.schema.json', `vmblu Blueprint Model (v${cli.schemaVersion})`],
  ['viz.schema.json', `vmblu Visual Model (v${cli.schemaVersion})`],
]) {
  const schema = JSON.parse(fs.readFileSync(path.join(contextDir, file), 'utf8'))
  const expectedId = `https://vmblu.dev/context/${cli.schemaVersion}/${file}`
  if (schema.$id !== expectedId || schema.title !== title) {
    throw new Error(`${file} metadata does not match schema version ${cli.schemaVersion}`)
  }
}

const releaseModule = await import(pathToFileURL(path.join(root, 'core', 'types', 'model', 'release-version.js')))
if (releaseModule.CORE_VERSION !== core.version || releaseModule.SCHEMA_VERSION !== cli.schemaVersion) {
  throw new Error('Generated core release-version.js is stale; run npm run build --workspace=@vizualmodel/vmblu-cli')
}

const cliReleaseModule = await import(pathToFileURL(path.join(root, 'cli', 'lib', 'release-version.js')))
if (cliReleaseModule.CLI_VERSION !== cli.version || cliReleaseModule.SCHEMA_VERSION !== cli.schemaVersion) {
  throw new Error('Generated cli release-version.js is stale; run npm run build --workspace=@vizualmodel/vmblu-cli')
}

const runtimeReleaseModule = await import(pathToFileURL(path.join(root, 'runtime', 'shared', 'release-version.js')))
if (runtimeReleaseModule.RUNTIME_VERSION !== runtime.version) {
  throw new Error('Generated runtime release-version.js is stale; run npm run build --workspace=@vizualmodel/vmblu-cli')
}

console.log(`Release compatibility check passed for family ${Array.from(families)[0]}.`)
console.log(`CLI ${cli.version}; core ${core.version}; runtime ${runtime.version}; schema ${cli.schemaVersion}.`)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'))
}
