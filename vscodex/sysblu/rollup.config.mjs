import svelte from 'rollup-plugin-svelte'
import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import css from 'rollup-plugin-css-only'
import json from '@rollup/plugin-json'

export default {
    input: './model/sysblu.app.js',
    output: {
        sourcemap: true,
        format: 'es',
        name: 'vmbluSystem',
        inlineDynamicImports: true,
        file: './sysblu-bundle.js',
    },
    plugins: [
        svelte({
            emitCss: true,
            compilerOptions: {dev: false},
            onwarn(warning, handler) {
                if (warning?.code?.startsWith?.('a11y')) return
                handler(warning)
            },
        }),
        css({output: 'sysblu-bundle.css'}),
        resolve({browser: true, dedupe: ['svelte']}),
        commonjs(),
        json(),
    ],
}
