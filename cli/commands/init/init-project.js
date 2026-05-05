// core/initProject.js
// Node 18+ (fs/promises, crypto). No external deps.
import * as fs from 'fs/promises';
import path from 'path';
//import crypto from 'crypto';
import { makePackageJson } from './make-package-json.js';
import { createRequire } from 'module';

// Get the versions
const require = createRequire(import.meta.url);
const pckg = require('../../package.json');
const SCHEMA_VERSION = pckg.schemaVersion
const CLI_VERSION = pckg.version

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function ensureDir(dir, dry) {
  if (dry) return;
  await fs.mkdir(dir, { recursive: true });
}

async function writeFileSafe(file, contents, { force = false, dry = false } = {}) {
  const already = await exists(file);
  if (already && !force) return false;
  if (dry) return true;
  await fs.writeFile(file, contents);
  return true;
}

// async function sha256(file) {
//   const buf = await fs.readFile(file);
//   return crypto.createHash('sha256').update(buf).digest('hex');
// }

function defaultModel(projectName, schemaVersion = SCHEMA_VERSION) {
  const now = new Date().toISOString();
  return JSON.stringify({
    header: {
      version: schemaVersion,
      created: now,
      saved: now,
      utc: now,
      style: "#2c7be5",
      runtime: "@vizualmodel/vmblu-runtime/rt-base",
      description: `${projectName} - vmblu model (scaffolded)`
    },
    imports: [],
    factories: [],
    types: {},
    root: {
      kind: "group",
      name: "Root",
      prompt: "Root group for the application.",
      interfaces: [],
      nodes: [],
      connections: []
    }
  }, null, 2);
}

function defaultVizual(schemaVersion = SCHEMA_VERSION) {
  const now = new Date().toISOString();
  return JSON.stringify({
    header: {
      version: schemaVersion,
      utc: now,
      style: "#2c7be5"
    },
    root: {
      kind: "group",
      name: "Root",
      rect: "x 90 y 30 w 150 h 26",
      view: {
        state: "open",
        rect: "x 0 y 0 w 1200 h 800",
        transform: "sx 1.000 sy 1.000 dx 0.000 dy 0.000"
      },
      nodes: [],
      connections: []
    }
  }, null, 2);
}

function defaultEntrypoint(projectName) {
  return JSON.stringify({
    kind: "vmblu.entrypoint",
    version: 1,
    model: `model/${projectName}.mod.blu`
  }, null, 2);
}

function defaultProjectPrompt(entrypointName) {
  return `# vmblu Project

This is a vmblu project.

- Use \`${entrypointName}\` to find the model entrypoint.
- Treat \`model/\` as the application model file set.
- Treat \`nodes/\` as model-owned implementation code.
- Use installed vmblu agent support, plugin support, or CLI package docs for general vmblu instructions.
- Do not assume copied schemas or general docs in \`.vmblu/\` are canonical.
`;
}

/**
 * Initialize a vmblu project directory.
 *
 * @param {Object} opts
 * @param {string} opts.targetDir           Absolute path to project dir (created if missing)
 * @param {string} [opts.projectName]       Defaults to basename(targetDir)
 * @param {string} [opts.schemaVersion]     e.g. "0.8.2"
 * @param {boolean}[opts.force]             Overwrite existing files
 * @param {boolean}[opts.dryRun]            Print actions, do not write
 * @param {Object} [opts.ui]                { info, warn, error } callbacks (optional)
 */
async function initProject(opts) {
  const {
    targetDir,
    projectName = path.basename(opts.targetDir),
    schemaVersion = SCHEMA_VERSION,
    force = false,
    dryRun = false,
    ui = {
      info: console.log,
      warn: console.warn,
      error: console.error
    }
  } = opts || {};

  if (!targetDir) throw new Error("initProject: targetDir is required");

  const absTarget = path.resolve(targetDir);
  const entrypointName = `${projectName}.blu`;
  const entrypointFile = path.join(absTarget, entrypointName);
  const modelDir = path.join(absTarget, 'model');
  const modelFile = path.join(modelDir, `${projectName}.mod.blu`);
  const vizualFile = path.join(modelDir, `${projectName}.mod.viz`);
  const vmbluDir = path.join(absTarget, '.vmblu');
  const overridesDir = path.join(vmbluDir, 'overrides');
  const cacheDir = path.join(vmbluDir, 'cache');
  const logsDir = path.join(vmbluDir, 'logs');
  const nodesDir = path.join(absTarget, 'nodes');
  const promptPrjDst = path.join(vmbluDir, 'vmblu.prompt.md');
  
  // 1) Create folders
  for (const dir of [absTarget, modelDir, nodesDir, vmbluDir, overridesDir, cacheDir, logsDir]) {
    ui.info(`mkdir -p ${dir}`);
    await ensureDir(dir, dryRun);
  }

  // 2) Create root files
  ui.info(`create ${entrypointFile}${force ? ' (force)' : ''}`);
  await writeFileSafe(entrypointFile, defaultEntrypoint(projectName), { force, dry: dryRun });

  ui.info(`create ${modelFile}${force ? ' (force)' : ''}`);
  await writeFileSafe(modelFile, defaultModel(projectName, schemaVersion), { force, dry: dryRun });

  ui.info(`create ${vizualFile}${force ? ' (force)' : ''}`);
  await writeFileSafe(vizualFile, defaultVizual(schemaVersion), { force, dry: dryRun });

  ui.info(`create ${promptPrjDst}${force ? ' (force)' : ''}`);
  await writeFileSafe(promptPrjDst, defaultProjectPrompt(entrypointName), { force, dry: dryRun });

  // 4) Build manifest with hashes DELETED

  // 5) Make the package file
  await makePackageJson({ absTarget, projectName, entrypointName, force, dryRun, addCliDep: true, cliVersion: "^" + CLI_VERSION }, ui);

  // 6) Final tree hint
  ui.info(`\nScaffold complete${dryRun ? ' (dry run)' : ''}:\n` +
`  ${absTarget}/
    ${entrypointName}
    package.json
    model/
      ${projectName}.mod.blu
      ${projectName}.mod.viz
    nodes/
    .vmblu/
      vmblu.prompt.md
      overrides/
      cache/
      logs/\n`);

  return {
    targetDir: absTarget,
    projectName,
    schemaVersion,
    files: {
      entrypoint: entrypointFile,
      model: modelFile,
      vizual: vizualFile,
      projectPrompt: promptPrjDst,
      // manifest: path.join(vmbluDir, 'manifest.json')
    },
    dryRun,
    //manifest
  };
}

export { initProject };
