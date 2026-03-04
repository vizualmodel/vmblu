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
  if (!Array.isArray(files) || files.length === 0) {
    console.error(`Agent "${agentId}" manifest has no install files.`);
    process.exit(1);
  }

  const homeDir = os.homedir();
  const dryRun = Boolean(args.dryRun);
  const force = Boolean(args.force);

  for (const entry of files) {
    validateManifestEntry(entry, manifest.id);

    const src = path.join(agentDir, entry.from);
    const dest = path.join(homeDir, entry.toHomeRelative);

    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
      throw new Error(`Missing source file for agent "${manifest.id}": ${src}`);
    }

    if (fs.existsSync(dest) && !force) {
      throw new Error(`Destination exists (use --force to overwrite): ${dest}`);
    }

    if (dryRun) {
      console.log(`[dry-run] copy ${src} -> ${dest}`);
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
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

function validateManifestEntry(entry, agentId) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Invalid install entry for agent "${agentId}"`);
  }
  if (!entry.from || !entry.toHomeRelative) {
    throw new Error(`Manifest install entry for agent "${agentId}" requires "from" and "toHomeRelative"`);
  }

  const from = String(entry.from);
  const toHomeRelative = String(entry.toHomeRelative);
  if (path.isAbsolute(from) || path.isAbsolute(toHomeRelative)) {
    throw new Error(`Manifest paths must be relative for agent "${agentId}"`);
  }
  if (from.includes('..') || toHomeRelative.includes('..')) {
    throw new Error(`Manifest paths may not contain ".." for agent "${agentId}"`);
  }
}
