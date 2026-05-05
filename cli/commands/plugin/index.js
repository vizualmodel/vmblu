// vmblu plugin build
// Assemble the repo-local Codex plugin from the canonical agent files.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

async function copyFileSafe(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  if (path.resolve(from) === path.resolve(to)) return;
  await fs.copyFile(from, to);
}

async function copyDirSafe(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirSafe(src, dest);
    } else if (entry.isFile()) {
      await copyFileSafe(src, dest);
    }
  }
}

async function removeDirIfExists(dir) {
  if (await exists(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function buildCodexPlugin({ outDir = path.join(repoRoot, 'plugins', 'vmblu'), ui = console } = {}) {
  const sourceRoot = path.join(repoRoot, 'cli', 'agent', 'CODEX');
  const pluginSourceRoot = path.join(repoRoot, 'plugins', 'vmblu');
  const pluginRoot = path.resolve(outDir);
  const skillRoot = path.join(pluginRoot, 'skills', 'vmblu');
  const assetsRoot = path.join(pluginRoot, 'assets');

  await copyFileSafe(
    path.join(pluginSourceRoot, '.codex-plugin', 'plugin.json'),
    path.join(pluginRoot, '.codex-plugin', 'plugin.json')
  );
  await copyFileSafe(path.join(pluginSourceRoot, 'README.md'), path.join(pluginRoot, 'README.md'));

  await copyFileSafe(path.join(sourceRoot, 'SKILL.md'), path.join(skillRoot, 'SKILL.md'));
  await copyFileSafe(path.join(sourceRoot, 'openai.yaml'), path.join(skillRoot, 'agents', 'openai.yaml'));
  await removeDirIfExists(path.join(skillRoot, 'references'));
  await removeDirIfExists(path.join(skillRoot, 'context'));
  await copyDirSafe(path.join(repoRoot, 'cli', 'context'), path.join(skillRoot, 'context'));

  const assetCopies = [
    ['vscodex/assets/vmblu-logo-vscode.png', 'icon.png'],
    ['vscodex/assets/vmblu-header.png', 'logo.png'],
    ['vscodex/assets/vmblu-screenshot.png', 'screenshot.png']
  ];

  for (const [fromRelative, toName] of assetCopies) {
    const from = path.join(repoRoot, fromRelative);
    if (await exists(from)) {
      await copyFileSafe(from, path.join(assetsRoot, toName));
    } else {
      ui.warn?.(`missing optional plugin asset: ${fromRelative}`);
    }
  }

  ui.log?.(`Codex plugin assembled at ${pluginRoot}`);
  return { pluginRoot };
}

export const command = 'plugin build-codex';
export const describe = 'Assemble the repo-local Codex plugin from vmblu agent files.';
export const builder = [
  { flag: 'build-codex', desc: 'Copy Codex skill files and assets into plugins/vmblu.' },
  { flag: '--out <path>', desc: 'Write the assembled plugin to a custom directory.' }
];

export async function handler(args = []) {
  const [action = 'build-codex'] = args;
  if (!['build-codex', 'build', 'codex'].includes(action)) {
    console.error(`Unknown plugin action: ${action}`);
    console.error('Usage: vmblu plugin build-codex');
    process.exitCode = 1;
    return;
  }
  const outIndex = args.indexOf('--out');
  const outDir = outIndex >= 0 ? args[outIndex + 1] : undefined;
  if (outIndex >= 0 && !outDir) {
    console.error('Missing value for --out');
    process.exitCode = 1;
    return;
  }
  await buildCodexPlugin({ outDir });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  buildCodexPlugin().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
