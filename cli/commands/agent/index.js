import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.join(__dirname, '..', '..');
const agentsRoot = path.join(cliRoot, 'agent');

export const command = 'agent <subcommand> [args]';
export const describe = 'Install coding-agent support files (skills/profiles) into the user home folder';
export const builder = [
  { flag: 'list', desc: 'List available agent integrations discovered from manifests' },
  { flag: 'install <agent>', desc: 'Install support files for an agent (for example: codex)' },
  { flag: '--force', desc: 'Overwrite existing files' },
  { flag: '--dry-run', desc: 'Show actions without writing' }
];

export const handler = async (argv) => {
  const args = parseCliArgs(argv);

  const subcommand = args._[0];
  if (subcommand === 'list') {
    const agents = listAvailableAgentsDetailed();
    if (!agents.length) {
      console.log('No agent integrations found.');
      return;
    }

    for (const agent of agents) {
      console.log(`${agent.id}${agent.displayName ? ` (${agent.displayName})` : ''}`);
    }
    return;
  }

  if (subcommand !== 'install' || !args._[1]) {
    printUsage();
    process.exit(1);
  }

  const agentId = String(args._[1]).toLowerCase();
  const manifestEntry = findAgentManifest(agentId);

  if (!manifestEntry) {
    console.error(`Unknown agent "${agentId}".`);
    const available = listAvailableAgents();
    if (available.length) {
      console.error(`Available agents: ${available.join(', ')}`);
    }
    process.exit(1);
  }

  const { agentDir, manifest } = manifestEntry;
  const files = manifest?.install?.files;
  const dirs = manifest?.install?.dirs;
  if ((!Array.isArray(files) || files.length === 0) && (!Array.isArray(dirs) || dirs.length === 0)) {
    console.error(`Agent "${agentId}" manifest has no install files or dirs.`);
    process.exit(1);
  }

  const homeDir = os.homedir();
  const dryRun = Boolean(args.dryRun);
  const force = Boolean(args.force);

  for (const entry of files || []) {
    validateManifestEntry(entry, manifest.id, 'file');

    const src = resolveSourcePath(entry, agentDir, manifest.id);
    const dest = path.join(homeDir, entry.toHomeRelative);

    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      throw new Error(`Missing source file for agent "${manifest.id}": ${src}`);
    }

    if (dryRun) {
      const action = fs.existsSync(dest) && !force ? 'would skip existing' : 'copy';
      console.log(`[dry-run] ${action} ${src} -> ${dest}`);
      continue;
    }

    if (fs.existsSync(dest) && !force) {
      throw new Error(`Destination exists (use --force to overwrite): ${dest}`);
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Installed ${path.basename(dest)} -> ${dest}`);
  }

  for (const entry of dirs || []) {
    validateManifestEntry(entry, manifest.id, 'dir');

    const src = resolveSourcePath(entry, agentDir, manifest.id);
    const dest = path.join(homeDir, entry.toHomeRelative);

    if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
      throw new Error(`Missing source directory for agent "${manifest.id}": ${src}`);
    }

    if (dryRun) {
      console.log(`[dry-run] copy directory ${src} -> ${dest}`);
      continue;
    }

    copyDirectory(src, dest, { force });
    console.log(`Installed ${path.basename(dest)} -> ${dest}`);
  }

  if (dryRun) {
    console.log(`Dry run complete for agent "${agentId}".`);
  } else {
    console.log(`Agent support installed for "${agentId}".`);
  }
};

function parseCliArgs(argvInput) {
  const argv = Array.isArray(argvInput) ? argvInput : [];
  const result = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--force') {
      result.force = true;
      continue;
    }
    if (token === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    result._.push(token);
  }

  return result;
}

function printUsage() {
  console.error('Usage: vmblu agent list');
  console.error('   or: vmblu agent install <agent> [--force] [--dry-run]');
}

function listAvailableAgentsDetailed() {
  if (!fs.existsSync(agentsRoot)) return [];

  return fs.readdirSync(agentsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => loadManifest(path.join(agentsRoot, d.name)))
    .filter(Boolean)
    .map((x) => ({
      id: x.manifest.id,
      displayName: x.manifest.displayName || ''
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function listAvailableAgents() {
  return listAvailableAgentsDetailed()
    .map((x) => x.id)
    .sort();
}

function findAgentManifest(agentId) {
  if (!fs.existsSync(agentsRoot)) return null;

  const dirs = fs.readdirSync(agentsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dirent of dirs) {
    const candidateDir = path.join(agentsRoot, dirent.name);
    const loaded = loadManifest(candidateDir);
    if (!loaded) continue;
    if (String(loaded.manifest.id).toLowerCase() === agentId) {
      return loaded;
    }
  }
  return null;
}

function loadManifest(agentDir) {
  const manifestPath = path.join(agentDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest?.id) {
    throw new Error(`Missing "id" in manifest: ${manifestPath}`);
  }

  return { agentDir, manifestPath, manifest };
}

function resolveSourcePath(entry, agentDir, agentId) {
  if (entry.fromCliRelative) {
    const resolved = path.resolve(cliRoot, entry.fromCliRelative);
    assertInsideRoot(resolved, cliRoot, `CLI-relative source for agent "${agentId}"`);
    return resolved;
  }

  return path.join(agentDir, entry.from);
}

function copyDirectory(srcDir, destDir, { force }) {
  fs.mkdirSync(destDir, { recursive: true });

  for (const dirent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, dirent.name);
    const dest = path.join(destDir, dirent.name);

    if (dirent.isDirectory()) {
      copyDirectory(src, dest, { force });
      continue;
    }

    if (!dirent.isFile()) continue;

    if (fs.existsSync(dest) && !force) {
      throw new Error(`Destination exists (use --force to overwrite): ${dest}`);
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function validateManifestEntry(entry, agentId, kind) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Invalid install entry for agent "${agentId}"`);
  }
  if ((!entry.from && !entry.fromCliRelative) || !entry.toHomeRelative) {
    throw new Error(`Manifest install entry for agent "${agentId}" requires "from" or "fromCliRelative", and "toHomeRelative"`);
  }
  if (entry.from && entry.fromCliRelative) {
    throw new Error(`Manifest install entry for agent "${agentId}" may not specify both "from" and "fromCliRelative"`);
  }

  const from = String(entry.from || '');
  const fromCliRelative = String(entry.fromCliRelative || '');
  const toHomeRelative = String(entry.toHomeRelative);
  if (path.isAbsolute(from) || path.isAbsolute(fromCliRelative) || path.isAbsolute(toHomeRelative)) {
    throw new Error(`Manifest paths must be relative for agent "${agentId}"`);
  }
  if (from.includes('..') || fromCliRelative.includes('..') || toHomeRelative.includes('..')) {
    throw new Error(`Manifest paths may not contain ".." for agent "${agentId}"`);
  }
  if (kind !== 'file' && kind !== 'dir') {
    throw new Error(`Invalid manifest entry kind for agent "${agentId}": ${kind}`);
  }
}

function assertInsideRoot(candidate, root, label) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside ${root}: ${candidate}`);
  }
}
