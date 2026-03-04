import * as fs from 'fs/promises';
import * as fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_FILES = [
  'blu.schema.json',
  'blu.annex.md',
  'viz.schema.json',
  'prf.schema.json',
  'vmblu.prompt.md',
  'develop.prompt.md',
  'test.prompt.md'
];

export const command = 'migrate <version> [folder name]';
export const describe = 'Refresh an existing vmblu project to a newer template version';
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
    templatesDir: path.join(__dirname, '..', '..', 'templates'),
    ui: {
      info: (m) => console.log(m),
      warn: (m) => console.warn(m),
      error: (m) => console.error(m)
    }
  });

  console.log(`vmblu project templates migrated in ${targetDir}`);
};

async function migrateProject(opts) {
  const {
    targetDir,
    targetVersion,
    dryRun = false,
    templatesDir,
    ui = {
      info: console.log,
      warn: console.warn,
      error: console.error
    }
  } = opts || {};

  if (!targetDir) throw new Error('migrateProject: targetDir is required');
  if (!targetVersion) throw new Error('migrateProject: targetVersion is required');

  const absTarget = path.resolve(targetDir);
  const vmbluDir = path.join(absTarget, '.vmblu');
  const targetTemplateDir = path.join(templatesDir, targetVersion);

  if (!fssync.existsSync(absTarget) || !fssync.statSync(absTarget).isDirectory()) {
    throw new Error(`Target folder does not exist: ${absTarget}`);
  }

  if (!fssync.existsSync(vmbluDir) || !fssync.statSync(vmbluDir).isDirectory()) {
    throw new Error(`No .vmblu folder found in ${absTarget}`);
  }

  if (!fssync.existsSync(targetTemplateDir) || !fssync.statSync(targetTemplateDir).isDirectory()) {
    throw new Error(`Template version '${targetVersion}' was not found in ${templatesDir}`);
  }

  const currentVersion = await readCurrentProjectVersion(absTarget);
  if (!currentVersion) {
    throw new Error(`Could not determine current project schema version from a .mod.blu file in ${absTarget}`);
  }

  const versionCmp = compareVersions(targetVersion, currentVersion);
  if (versionCmp < 0) {
    throw new Error(`Refusing to migrate from ${currentVersion} to older version ${targetVersion}`);
  }

  if (versionCmp === 0) {
    ui.warn(`Target version ${targetVersion} matches current project version ${currentVersion}; refreshing template files only.`);
  } else {
    ui.info(`Migrating template files from ${currentVersion} to ${targetVersion}`);
  }

  for (const fileName of TEMPLATE_FILES) {
    const src = path.join(targetTemplateDir, fileName);
    const dst = path.join(vmbluDir, fileName);

    if (!fssync.existsSync(src)) {
      throw new Error(`Missing template file for ${targetVersion}: ${src}`);
    }

    ui.info(`copy ${src} -> ${dst}${dryRun ? ' (dry run)' : ''}`);
    if (!dryRun) {
      await fs.copyFile(src, dst);
    }
  }

  return {
    targetDir: absTarget,
    currentVersion,
    targetVersion,
    dryRun
  };
}

async function readCurrentProjectVersion(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const modelFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.mod.blu'))
    .map(entry => entry.name)
    .sort();

  if (modelFiles.length === 0) return null;

  const modelPath = path.join(targetDir, modelFiles[0]);
  const raw = await fs.readFile(modelPath, 'utf8');
  const model = JSON.parse(raw);
  return model?.header?.version || null;
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
