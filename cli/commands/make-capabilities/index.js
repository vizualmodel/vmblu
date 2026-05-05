// vmblu make-capabilities <model-file> [--out <file>]
import path from 'path';

import { ModelBlueprint, ModelCompiler, UIDGenerator } from '../../../core/types/model/index.js';
import { ARL } from '../../../core/types/arl/arl-node.js';
import { normalizeSeparators } from '../../../core/types/arl/path.js';
import { resolveEntrypoint } from '../../lib/resolve-entrypoint.js';

export const command = 'make-capabilities <model-file>';
export const describe = 'Generate an agent capability manifest from a model';

export const builder = [
  { flag: '--out <file>', desc: 'specifies the output file' }
];

export const handler = async (argv) => {
  const args = parseCliArgs(argv);

  if (!args.modelFile) {
    console.error('Usage: vmblu make-capabilities <model-file> [--out <file>]');
    process.exit(1);
  }

  let resolved;
  try {
    resolved = resolveEntrypoint(args.modelFile);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const absoluteModelPath = resolved.modelPath;

  const outPath = args.outFile
    ? path.resolve(args.outFile)
    : defaultOutputPath(absoluteModelPath);

  const modelPath = normalizeSeparators(absoluteModelPath);
  const capPath = normalizeSeparators(outPath);

  const arl = new ARL(modelPath);
  const model = new ModelBlueprint(arl);
  const compiler = new ModelCompiler(new UIDGenerator());
  await compiler.refreshRaw(model);

  if (!model.raw?.root) {
    console.error('Failed to load model root.');
    process.exit(1);
  }

  model.preCook();
  model.makeAndSaveCapabilities(capPath);
  console.log(`Capabilities written to ${outPath}`);
};

function defaultOutputPath(modelPath) {
  const { dir, name, ext } = path.parse(modelPath);
  const baseName = ext === '.blu' && name.endsWith('.mod')
    ? name.slice(0, -'.mod'.length)
    : name;
  return path.join(dir, `${baseName}.cap.json`);
}

function parseCliArgs(argvInput) {
  const argv = Array.isArray(argvInput) ? argvInput : [];
  const result = {
    modelFile: null,
    outFile: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (token === '--out') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result.outFile = next;
        i += 1;
      } else {
        console.warn('Warning: --out requires a path argument; ignoring.');
      }
      continue;
    }

    if (token?.startsWith('--')) {
      console.warn(`Warning: unknown option "${token}" ignored.`);
      continue;
    }

    if (!result.modelFile) {
      result.modelFile = token;
    } else {
      console.warn(`Warning: extra positional argument "${token}" ignored.`);
    }
  }

  return result;
}
