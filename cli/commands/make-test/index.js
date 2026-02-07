// vmblu make-test <model-file> [--outDir <dir>]
import fs from 'fs';
import path from 'path';

import { ModelBlueprint, ModelCompiler } from '../../../core/model/index.js';
import { ARL } from '../../../core/arl/arl-node.js';
import { UIDGenerator } from '../../../core/document/uid-generator.js';
import { normalizeSeparators } from '../../../core/arl/path.js';

export const command = 'make-test <model-file>';
export const describe = 'Generate test app files from a model';

export const builder = [
  { flag: '--out-dir <dir>', desc: 'output directory for test files (default: ./test)' },
  { flag: '--out <dir>', desc: 'alias for --out-dir' },
  { flag: '-o <dir>', desc: 'alias for --out-dir' }
];

export const handler = async (argv) => {
  const args = parseCliArgs(argv);

  // Require a model file path to proceed.
  if (!args.modelFile) {
    console.error('Usage: vmblu make-test <model-file> [--outDir <dir>]');
    process.exit(1);
  }

  // Resolve and validate the model file path.
  const absoluteModelPath = path.resolve(args.modelFile);
  if (!fs.existsSync(absoluteModelPath) || !fs.statSync(absoluteModelPath).isFile()) {
    console.error(args.modelFile, 'is not a file');
    process.exit(1);
  }

  // Resolve the output directory (default: <model-dir>/test).
  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.join(path.dirname(absoluteModelPath), 'test');

  // Ensure the output directory exists.
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    const mirrorsDir = path.join(outDir, 'mirrors');
    fs.mkdirSync(mirrorsDir, { recursive: true });
  }

  // Normalize to forward slashes so ARL resolution is consistent.
  const modelPath = normalizeSeparators(absoluteModelPath);

  // Build the model root via the compiler.
  const arl = new ARL(modelPath);
  const model = new ModelBlueprint(arl);
  const compiler = new ModelCompiler(new UIDGenerator());

  // Compile the model into a root node.
  const root = await compiler.getRoot(model);
  if (!root) {
    console.error('Failed to compile model root.');
    process.exit(1);
  }

  // Build runtime connection tables from the compiled routes.
  root.rxtxBuildTxTable();

  // Generate and save the test app files from the compiled model.
  model.makeTestApp(normalizeSeparators(outDir), root);
  console.log(`Test app written to ${outDir}`);
};

function parseCliArgs(argvInput) {
  const argv = Array.isArray(argvInput) ? argvInput : [];
  const result = {
    outDir: null,
    modelFile: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--out-dir' || token === '--out' || token === '-o') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        result.outDir = next;
        i += 1;
      } else {
        console.warn('Warning: --out-dir requires a path argument; ignoring.');
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
