import fs from 'fs';
import path from 'path';

const ENTRYPOINT_KIND = 'vmblu.entrypoint';

export function resolveEntrypoint(inputPath) {
  if (!inputPath) {
    throw new Error('resolveEntrypoint: inputPath is required');
  }

  const absoluteInputPath = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInputPath) || !fs.statSync(absoluteInputPath).isFile()) {
    throw new Error(`${inputPath} is not a file`);
  }

  if (absoluteInputPath.endsWith('.mod.blu')) {
    return {
      inputPath: absoluteInputPath,
      inputKind: 'model',
      entrypointPath: null,
      modelPath: absoluteInputPath,
      entrypoint: null
    };
  }

  const entrypoint = readJson(absoluteInputPath);
  if (entrypoint?.kind !== ENTRYPOINT_KIND) {
    return {
      inputPath: absoluteInputPath,
      inputKind: 'model',
      entrypointPath: null,
      modelPath: absoluteInputPath,
      entrypoint: null
    };
  }

  validateEntrypoint(entrypoint, absoluteInputPath);

  const modelPath = path.resolve(path.dirname(absoluteInputPath), entrypoint.model);
  if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isFile()) {
    throw new Error(`Entrypoint ${absoluteInputPath} references missing model file: ${entrypoint.model}`);
  }

  return {
    inputPath: absoluteInputPath,
    inputKind: 'entrypoint',
    entrypointPath: absoluteInputPath,
    modelPath,
    entrypoint
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (file.endsWith('.blu')) {
      throw new Error(`Failed to parse ${file} as JSON: ${err.message}`);
    }
    return null;
  }
}

function validateEntrypoint(entrypoint, file) {
  if (entrypoint.version !== 1) {
    throw new Error(`Unsupported vmblu entrypoint version in ${file}: ${entrypoint.version}`);
  }

  if (!entrypoint.model || typeof entrypoint.model !== 'string') {
    throw new Error(`Entrypoint ${file} requires a string "model" field`);
  }

  if (path.isAbsolute(entrypoint.model) || entrypoint.model.includes('..')) {
    throw new Error(`Entrypoint ${file} model path must be a relative path without ".."`);
  }
}

