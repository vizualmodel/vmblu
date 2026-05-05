import * as fs from 'fs/promises';
import * as fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveEntrypoint } from '../../lib/resolve-entrypoint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const command = 'migrate <version> [folder name]';
export const describe = 'Update a vmblu project to a newer context/schema version';
export const builder = [
  { flag: '--dry-run', desc: 'Show actions without writing' }
];

export const handler = async (argv) => {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (!a.startsWith('-')) args._.push(a);
  }

  const targetVersion = args._[0];
  if (!targetVersion) {
    throw new Error('Usage: vmblu migrate <version> [folder name] [--dry-run]');
  }

  const targetDir = path.resolve(args._[1] || '.');
  await migrateProject({
    targetDir,
    targetVersion,
    dryRun: Boolean(args.dryRun),
    contextDir: path.join(__dirname, '..', '..', 'context'),
    ui: {
      info: (m) => console.log(m),
      warn: (m) => console.warn(m),
      error: (m) => console.error(m)
    }
  });

  console.log(`vmblu project migrated to context/schema ${targetVersion} in ${targetDir}`);
};

async function migrateProject(opts) {
  const {
    targetDir,
    targetVersion,
    dryRun = false,
    contextDir,
    ui = {
      info: console.log,
      warn: console.warn,
      error: console.error
    }
  } = opts || {};

  if (!targetDir) throw new Error('migrateProject: targetDir is required');
  if (!targetVersion) throw new Error('migrateProject: targetVersion is required');

  const absTarget = path.resolve(targetDir);
  const targetContextDir = path.join(contextDir, targetVersion);

  if (!fssync.existsSync(absTarget) || !fssync.statSync(absTarget).isDirectory()) {
    throw new Error(`Target folder does not exist: ${absTarget}`);
  }

  if (!fssync.existsSync(targetContextDir) || !fssync.statSync(targetContextDir).isDirectory()) {
    throw new Error(`Context version '${targetVersion}' was not found in ${contextDir}`);
  }

  const entrypointPath = await findEntrypoint(absTarget);
  const resolved = resolveEntrypoint(entrypointPath);
  const modelPath = resolved.modelPath;
  const vizPath = inferVizPath(modelPath);

  const model = await readJson(modelPath);
  const currentVersion = model?.header?.version;
  if (!currentVersion) {
    throw new Error(`Could not determine current project schema version from ${modelPath}`);
  }

  const versionCmp = compareVersions(targetVersion, currentVersion);
  if (versionCmp < 0) {
    throw new Error(`Refusing to migrate from ${currentVersion} to older version ${targetVersion}`);
  }

  if (versionCmp === 0) {
    ui.warn(`Target version ${targetVersion} matches current project version ${currentVersion}; no version change needed.`);
  } else {
    ui.info(`Migrating model schema version from ${currentVersion} to ${targetVersion}`);
    model.header.version = targetVersion;
    touchHeader(model.header);
    await writeJson(modelPath, model, dryRun, ui);
  }

  if (fssync.existsSync(vizPath) && fssync.statSync(vizPath).isFile()) {
    const viz = await readJson(vizPath);
    if (viz?.header) {
      const vizVersion = viz.header.version;
      if (vizVersion !== targetVersion) {
        ui.info(`Updating viz schema version from ${vizVersion || 'unknown'} to ${targetVersion}`);
        viz.header.version = targetVersion;
        viz.header.utc = new Date().toISOString();
        await writeJson(vizPath, viz, dryRun, ui);
      }
    }
  }

  await ensureProjectPrompt(absTarget, path.basename(entrypointPath), dryRun, ui);
  await ensureLocalDirs(absTarget, dryRun, ui);

  return {
    targetDir: absTarget,
    entrypointPath,
    modelPath,
    currentVersion,
    targetVersion,
    dryRun
  };
}

async function findEntrypoint(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const candidates = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.blu') && !entry.name.endsWith('.mod.blu'))
    .map(entry => path.join(targetDir, entry.name))
    .sort();

  for (const candidate of candidates) {
    try {
      const json = await readJson(candidate);
      if (json?.kind === 'vmblu.entrypoint') return candidate;
    } catch {
      // Ignore non-entrypoint .blu files and keep looking.
    }
  }

  throw new Error(`Could not find a root vmblu entrypoint (*.blu) in ${targetDir}`);
}

function inferVizPath(modelPath) {
  return modelPath.endsWith('.mod.blu')
    ? modelPath.slice(0, -'.mod.blu'.length) + '.mod.viz'
    : `${modelPath}.viz`;
}

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, data, dryRun, ui) {
  ui.info(`write ${file}${dryRun ? ' (dry run)' : ''}`);
  if (!dryRun) {
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  }
}

function touchHeader(header) {
  const now = new Date().toISOString();
  if ('saved' in header) header.saved = now;
  if ('utc' in header) header.utc = now;
}

async function ensureProjectPrompt(targetDir, entrypointName, dryRun, ui) {
  const vmbluDir = path.join(targetDir, '.vmblu');
  const promptPath = path.join(vmbluDir, 'vmblu.prompt.md');
  const prompt = `# vmblu Project

This is a vmblu project.

- Use \`${entrypointName}\` to find the model entrypoint.
- Treat \`model/\` as the application model file set.
- Treat \`nodes/\` as model-owned implementation code.
- Use installed vmblu agent support, plugin support, or CLI package docs for general vmblu instructions.
- Do not assume copied schemas or general docs in \`.vmblu/\` are canonical.
`;

  if (!fssync.existsSync(promptPath)) {
    ui.info(`create ${promptPath}${dryRun ? ' (dry run)' : ''}`);
    if (!dryRun) {
      await fs.mkdir(vmbluDir, { recursive: true });
      await fs.writeFile(promptPath, prompt);
    }
  }
}

async function ensureLocalDirs(targetDir, dryRun, ui) {
  const dirs = [
    path.join(targetDir, '.vmblu'),
    path.join(targetDir, '.vmblu', 'overrides'),
    path.join(targetDir, '.vmblu', 'cache'),
    path.join(targetDir, '.vmblu', 'logs')
  ];

  for (const dir of dirs) {
    if (fssync.existsSync(dir)) continue;
    ui.info(`mkdir -p ${dir}${dryRun ? ' (dry run)' : ''}`);
    if (!dryRun) await fs.mkdir(dir, { recursive: true });
  }
}

function compareVersions(left, right) {
  const a = normalizeVersion(left);
  const b = normalizeVersion(right);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

function normalizeVersion(version) {
  const text = String(version || '').trim();
  if (!/^\d+(?:\.\d+)*$/.test(text)) {
    throw new Error(`Invalid version '${version}'. Expected dotted numeric format like 0.9.4`);
  }

  return text.split('.').map(part => Number(part));
}
