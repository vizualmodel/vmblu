import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: './profile.js',
  output: {
    file: './profile.cjs', // ⬅️ Use .cjs extension and CommonJS format
    format: 'cjs',
    sourcemap: true
  },
  external: [
    'ts-morph',
    'typescript', // Exclude heavy dependencies from bundle
  ],
  plugins: [
    commonjs(),
    resolve({ preferBuiltins: true }),
    json()
  ]
};

