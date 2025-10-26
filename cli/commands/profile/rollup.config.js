import path from 'path';
import { fileURLToPath } from 'url';
import { builtinModules } from 'module';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const externalDeps = new Set([
  ...builtinModules,
  ...builtinModules.map((mod) => `node:${mod}`),
  'ts-morph',
  'typescript'
]);

const externalPackages = ['ts-morph', 'typescript'];

export default {
  input: path.join(__dirname, 'profile.js'),
  output: {
    file: path.join(__dirname, 'profile.bundle.js'),
    format: 'esm',
    sourcemap: true
  },
  external: (id) => {
    if (externalDeps.has(id)) return true;
    return externalPackages.some((name) => id === name || id.startsWith(`${name}/`));
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    json()
  ]
};
