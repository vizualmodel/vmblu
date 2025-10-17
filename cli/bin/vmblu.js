#!/usr/bin/env node
/* Minimal subcommand router: vmblu <command> [args] */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const commandsDir = path.join(root, 'commands');

function printGlobalHelp() {
  const cmds = fs.readdirSync(commandsDir)
    .filter(n => fs.existsSync(path.join(commandsDir, n, 'index.js')));
  console.log(`vmblu <command> [options]

Commands:
  ${cmds.map(c => `- ${c}`).join('\n  ')}

Run "vmblu <command> --help" for details.`);
}

async function run() {
  const [,, cmd, ...rest] = process.argv;

  if (!cmd || ['-h','--help','help'].includes(cmd)) {
    printGlobalHelp(); process.exit(0);
  }
  if (['-v','--version','version'].includes(cmd)) {
    console.log(require(path.join(root, 'package.json')).version); process.exit(0);
  }

  const entry = path.join(commandsDir, cmd, 'index.js');
  if (!fs.existsSync(entry)) {
    console.error(`Unknown command: ${cmd}\n`); printGlobalHelp(); process.exit(1);
  }

  const mod = require(entry);
  // Optional per-command help
  if (rest.includes('--help') || rest.includes('-h')) {
    console.log(`vmblu ${mod.command}\n\n${mod.describe}\n\nOptions:\n${(mod.builder || []).map(o => `  ${o.flag}\t${o.desc}`).join('\n')}`);
    process.exit(0);
  }
  await mod.handler(rest);
}

run().catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
