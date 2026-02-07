#!/usr/bin/env node
/* Minimal subcommand router: vmblu <command> [args] */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const commandsDir = path.join(root, 'commands');

function printGlobalHelp() {
  const cmds = fs.readdirSync(commandsDir)
    .filter((name) => fs.existsSync(path.join(commandsDir, name, 'index.js')));
  console.log(`vmblu <command> [options]

Commands:
  ${cmds.map((c) => `- ${c}`).join('\n  ')}

Run "vmblu <command> --help" for details.`);
}

async function run() {
  const [, , cmd, ...rest] = process.argv;

  if (!cmd || ['-h', '--help', 'help'].includes(cmd)) {
    printGlobalHelp();
    process.exit(0);
  }

  if (['-v', '--version', 'version'].includes(cmd)) {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    console.log('version: ' + pkg.version + ' schema: ' + pkg.schemaVersion);
    process.exit(0);
  }

  const entry = path.join(commandsDir, cmd, 'index.js');
  if (!fs.existsSync(entry)) {
    console.error(`Unknown command: ${cmd}\n`);
    printGlobalHelp();
    process.exit(1);
  }

  const mod = await import(pathToFileURL(entry));
  const handler = mod.handler ?? mod.default;
  if (typeof handler !== 'function') {
    console.error(`Command "${cmd}" does not export a runnable handler.`);
    process.exit(1);
  }

  if (rest.includes('--help') || rest.includes('-h')) {
    const command = mod.command ?? cmd;
    const describe = mod.describe ?? '';
    const builder = Array.isArray(mod.builder) ? mod.builder : [];
    console.log(`vmblu ${command}\n\n${describe}\n\nOptions:\n${builder.map((o) => `  ${o.flag}\t${o.desc}`).join('\n')}`);
    process.exit(0);
  }

  await handler(rest);
}

run().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
