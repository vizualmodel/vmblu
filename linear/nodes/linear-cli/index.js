import { analyzeProject } from './lib/analyzer.js';
import { profileModel } from './lib/profile.js';

export async function handler(argvInput) {
  const argv = Array.isArray(argvInput) ? argvInput : [];
  const [subcommand, ...rest] = argv;

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printHelp();
    return;
  }

  if (subcommand === 'analyze') {
    const args = parseAnalyzeArgs(rest);
    const result = await analyzeProject(args);
    console.log(`Linear Code Model written to ${result.outFile}`);
    console.log(`files=${result.counts.files} modules=${result.counts.modules} symbols=${result.counts.symbols} imports=${result.counts.imports} exports=${result.counts.exports} calls=${result.counts.calls} diagnostics=${result.counts.diagnostics}`);
    return;
  }

  if (subcommand === 'profile') {
    const args = parseProfileArgs(rest);
    const result = await profileModel(args);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error(`Unknown linear subcommand: ${subcommand}`);
  printHelp();
  process.exit(1);
}

function printHelp() {
  console.log(`vmblu linear <subcommand>

Subcommands:
  analyze [project-root] [--out <file>]
  profile callers <symbol-or-name> [--model <file>]
  profile imports [file-or-module] [--model <file>]
  profile dependencies [file-or-module] [--model <file>]`);
}

function parseAnalyzeArgs(argv) {
  const args = {
    projectRoot: '.',
    outFile: null
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out') {
      args.outFile = readValue(argv, ++i, '--out');
      continue;
    }
    if (token?.startsWith('--')) {
      throw new Error(`Unknown analyze option: ${token}`);
    }
    args.projectRoot = token;
  }

  return args;
}

function parseProfileArgs(argv) {
  const args = {
    query: null,
    target: null,
    modelFile: null
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--model') {
      args.modelFile = readValue(argv, ++i, '--model');
      continue;
    }
    if (token?.startsWith('--')) {
      throw new Error(`Unknown profile option: ${token}`);
    }
    positional.push(token);
  }

  args.query = positional[0] ?? null;
  args.target = positional.slice(1).join(' ') || null;
  return args;
}

function readValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}
