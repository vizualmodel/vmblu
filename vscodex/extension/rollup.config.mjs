import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve} from '@rollup/plugin-node-resolve'

export default {
  input: './out/extension/extension.js',
  output: {
    file: './out/extension/vmblu-bundle.js',
    format: 'commonjs',
    sourcemap: true,
  },
  external: ['vscode'],
  plugins: [
    nodeResolve({preferBuiltins: true}),
    commonjs(),
    json(),
  ],
}
