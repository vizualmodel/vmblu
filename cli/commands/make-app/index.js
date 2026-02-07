// vmblu make-app <model-file> [--out <file>]
import fs from 'fs';
import path from 'path';

import { ModelBlueprint, ModelCompiler } from '../../../core/model/index.js';
import { ARL } from '../../../core/arl/arl-node.js';
import { normalizeSeparators } from '../../../core/arl/path.js';
import { UIDGenerator } from '../../../core/document/uid-generator.js';

export const command = 'make-app <model-file>';
export const describe = 'Generate an application JS file from a model';

export const builder = [
  { flag: '--out <file>', desc: 'specifies the output file' }
];

export const handler = async (argv) => {
  // Parse the CLI arguments into a structured object.
  const args = parseCliArgs(argv);

  // Require a model file path to proceed.
  if (!args.modelFile) {
    console.error('Usage: vmblu make-app <model-file> [--out <file>]');
    process.exit(1);
  }

  // Resolve and validate the model file path.
  const absoluteModelPath = path.resolve(args.modelFile);
  if (!fs.existsSync(absoluteModelPath) || !fs.statSync(absoluteModelPath).isFile()) {
    console.error(args.modelFile, 'is not a file');
    process.exit(1);
  }

  // Normalize to forward slashes so ARL resolution is consistent.
  const modelPath = normalizeSeparators(absoluteModelPath);

  // Compute the output path (default: <model>.app.js).
  const outPath = args.outFile
    ? path.resolve(args.outFile)
    : (() => {
        const { dir, name, ext } = path.parse(absoluteModelPath);
        const baseName = ext === '.blu' && name.endsWith('.mod')
          ? name.slice(0, -'.mod'.length)
          : name;
        return path.join(dir, `${baseName}.app.js`);
      })();

  // Normalize output path for the model app writer.
  const appPath = normalizeSeparators(outPath);

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

  // Generate and save the app file from the compiled model.
  model.makeAndSaveApp(appPath, root);
  console.log(`App written to ${outPath}`);
};

function parseCliArgs(argvInput) {
  // Accept argv as-is when already an array.
  const argv = Array.isArray(argvInput) ? argvInput : [];
  const result = {
    modelFile: null,
    outFile: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    // Handle the --out flag which expects a following path.
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

    // Warn on unknown options but keep parsing.
    if (token?.startsWith('--')) {
      console.warn(`Warning: unknown option "${token}" ignored.`);
      continue;
    }

    // Treat the first positional token as the model file.
    if (!result.modelFile) {
      result.modelFile = token;
    } else {
      console.warn(`Warning: extra positional argument "${token}" ignored.`);
    }
  }

  return result;
}
