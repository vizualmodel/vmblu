// core/initProject.js
// Node 18+ (fs/promises, crypto). No external deps.
const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');
//const crypto = require('crypto');
const pckg = require('./make-package-json');

function rel(from, to) {
  return path.posix.join(...path.relative(from, to).split(path.sep));
}

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

async function copyOrWriteFallback(src, dst, fallback, { force = false, dry = false } = {}) {
  const already = await exists(dst);
  if (already && !force) return false;

  if (dry) return true;

  if (src && fssync.existsSync(src)) {
    await fs.copyFile(src, dst);
  } else {
    await fs.writeFile(dst, fallback);
  }
  return true;
}

// async function sha256(file) {
//   const buf = await fs.readFile(file);
//   return crypto.createHash('sha256').update(buf).digest('hex');
// }

function defaultModel(projectName) {
  const now = new Date().toISOString();
  return JSON.stringify({
    header: {
      version: "0.8.2",
      created: now,
      saved: now,
      utc: now,
      style: "#2c7be5",
      runtime: "@vizualmodel/vmblu/runtime",
      description: `${projectName} — vmblu model (scaffolded)`
    },
    models: [],
    factories: [],
    root: {
      group: "Root",
      pins: [],
      nodes: [],
      routes: [],
      prompt: "Root group for the application."
    }
  }, null, 2);
}

function defaultDoc(projectName) {
  const now = new Date().toISOString();
  return JSON.stringify({
    project: projectName,
    generator: "vmblu-docgen",
    generatorVersion: "0.0.0",
    created: now,
    files: [],
    nodes: [],
    pins: [],
    handlers: []
  }, null, 2);
}

function fallbackAnnex() {
  return `# vmblu Annex (placeholder)
This is a minimal scaffold. Replace with the official annex matching your pinned schema version.

- Nodes: Source, Group, Dock
- Pins: input/output/channel, 'profile' describes payloads
- Routes: "output@NodeA" -> "input@NodeB" (or via group pads)
- Keep names normalized; avoid ambiguous magic.
`;
}

function fallbackSchema() {
  return `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "vmblu.schema (placeholder)",
  "type": "object",
  "description": "Placeholder schema. Replace with official version."
}`;
}

function fallbackSrcdocSchema() {
  return `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "srcdoc.schema (placeholder)",
  "type": "object",
  "description": "Placeholder schema. Replace with official version."
}`;
}

function fallbackSeed() {
  return `# Session Seed (System Prompt)

vmblu (Vizual Model Blueprint) is a graphical editor that maintains a visual, runnable model of a software system.
vmblu models software as interconnected nodes that pass messages via pins.  
The model has a well defined format described by a schema. An additional annex gives semantic background information about the schema.
The parameter profiles of messages and where in the actual source code messages are received and sent, is stored in a second file, the srcdoc file.
The srcdoc file is generated automatically by vmblu and is only to be consulted, not written.

You are an expert **architecture + code copilot** for **vmblu** .
You can find the location of the model file, the model schema, the model annex, the srcdoc file and the srcdoc schema in the 'manifest.json' file of this project.
The location of all other files in the project can be found via the model file.

Your job is to co-design the architecture and the software for the system.
For modifications of the model, always follow the schema. 
If the srcdoc does not contain profile information it could be that the code for a message has not been written yet, this should not stop you from continuing
`}

/**
 * Initialize a vmblu project directory.
 *
 * @param {Object} opts
 * @param {string} opts.targetDir           Absolute path to project dir (created if missing)
 * @param {string} [opts.projectName]       Defaults to basename(targetDir)
 * @param {string} [opts.schemaVersion]     e.g. "0.8.2"
 * @param {boolean}[opts.force]             Overwrite existing files
 * @param {boolean}[opts.dryRun]            Print actions, do not write
 * @param {string} [opts.templatesDir]      Root where templates live (defaults to package templates)
 *                                          expects:
 *                                            templates/schemas/<ver>/vmblu.schema.json
 *                                            templates/annex/<ver>/vmblu.annex.md
 * @param {Object} [opts.ui]                { info, warn, error } callbacks (optional)
 */
async function initProject(opts) {
  const {
    targetDir,
    projectName = path.basename(opts.targetDir),
    schemaVersion = "0.8.2",
    force = false,
    dryRun = false,
    templatesDir = path.join(__dirname, '..', 'templates'),
    ui = {
      info: console.log,
      warn: console.warn,
      error: console.error
    }
  } = opts || {};

  if (!targetDir) throw new Error("initProject: targetDir is required");

  const absTarget = path.resolve(targetDir);
  const modelFile = path.join(absTarget, `${projectName}.vmblu`);
  const docFile   = path.join(absTarget, `${projectName}-doc.json`);

  const llmDir     = path.join(absTarget, 'llm');
  const sessionDir = path.join(llmDir, 'session');
  const nodesDir   = path.join(absTarget, 'nodes');

  // Template sources
  // const schemaSrc = path.join(templatesDir, 'schemas', schemaVersion, 'vmblu.schema.json');
  // const annexSrc  = path.join(templatesDir, 'annex',   schemaVersion, 'vmblu.annex.md');

  // Template sources
  const schemaSrc = path.join(templatesDir, schemaVersion, 'vmblu.schema.json');
  const annexSrc  = path.join(templatesDir, schemaVersion, 'vmblu.annex.md');
  const srcdocSchemaSrc = path.join(templatesDir, schemaVersion, 'srcdoc.schema.json');
  const seedSrc = path.join(templatesDir, schemaVersion, 'seed.md');
  
  // 1) Create folders
  for (const dir of [absTarget, llmDir, sessionDir, nodesDir]) {
    ui.info(`mkdir -p ${dir}`);
    await ensureDir(dir, dryRun);
  }

  // 2) Create root files
  ui.info(`create ${modelFile}${force ? ' (force)' : ''}`);
  await writeFileSafe(modelFile, defaultModel(projectName), { force, dry: dryRun });

  ui.info(`create ${docFile}${force ? ' (force)' : ''}`);
  await writeFileSafe(docFile, defaultDoc(projectName), { force, dry: dryRun });

  // 3) Copy schema + annex into llm/
  const schemaDst = path.join(llmDir, 'vmblu.schema.json');
  const annexDst  = path.join(llmDir, 'vmblu.annex.md');
  const srcdocSchemaDst = path.join(llmDir, 'srcdoc.schema.json');
  const seedDst  = path.join(llmDir, 'seed.md');


  ui.info(`copy ${schemaSrc} -> ${schemaDst}${force ? ' (force)' : ''}`);
  await copyOrWriteFallback(schemaSrc, schemaDst, fallbackSchema(), { force, dry: dryRun });

  ui.info(`copy ${annexSrc} -> ${annexDst}${force ? ' (force)' : ''}`);
  await copyOrWriteFallback(annexSrc, annexDst, fallbackAnnex(), { force, dry: dryRun });

   ui.info(`copy ${srcdocSchemaSrc} -> ${srcdocSchemaDst}${force ? ' (force)' : ''}`);
  await copyOrWriteFallback(srcdocSchemaSrc, srcdocSchemaDst, fallbackSrcdocSchema(), { force, dry: dryRun });

  ui.info(`copy ${seedSrc} -> ${seedDst}${force ? ' (force)' : ''}`);
  await copyOrWriteFallback(seedSrc, seedDst, fallbackSeed(), { force, dry: dryRun });

  // 4) Build manifest with hashes
  const willWriteManifest = !(await exists(path.join(llmDir, 'manifest.json'))) || force;
  let manifest = null;

  if (dryRun) {
    ui.info(`would write manifest.json in ${llmDir}`);
  } else {

    // I don't need the hashes
    // const [schemaHash, annexHash, modelHash, docHash] = await Promise.all([
    //   sha256(schemaDst), sha256(annexDst), sha256(modelFile), sha256(docFile)
    // ]);

    // Paths in manifest should be relative to /llm to keep it portable
    const llmPosix = llmDir; // absolute
    manifest = {
      version: schemaVersion,
      model:  { 
        path: rel(llmPosix, modelFile),
        schema: 'vmblu.schema.json',
        annex: 'vmblu.annex.md',
      },
      srcdoc: { 
        path: rel(llmPosix, docFile), 
        schema: 'srcdoc.schema.json',
      },
    };

    if (willWriteManifest) {
      const manifestPath = path.join(llmDir, 'manifest.json');
      ui.info(`create ${manifestPath}${force ? ' (force)' : ''}`);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } else {
      ui.warn(`manifest.json exists and --force not set. Skipped.`);
    }
  }

  // 5) Make the package file
  pckg.makePackageJson(  {absTarget, projectName, force, dryRun, addCliDep: true, cliVersion: "^0.1.0"}, ui);

  // 6) Final tree hint
  ui.info(`\nScaffold complete${dryRun ? ' (dry run)' : ''}:\n` +
`  ${absTarget}/
    ${path.basename(modelFile)}
    ${path.basename(docFile)}
    package.json
    llm/
      seed.md
      manifest.json
      vmblu.schema.json
      vmblu.annex.md
      srcdoc.schema.json
      session/
    nodes/\n`);

  return {
    targetDir: absTarget,
    projectName,
    schemaVersion,
    files: {
      model: modelFile,
      doc: docFile,
      schema: schemaDst,
      annex: annexDst,
      srdocSchema: srcdocSchemaDst,
      manifest: path.join(llmDir, 'manifest.json')
    },
    dryRun,
    manifest
  };
}

module.exports = { initProject };
