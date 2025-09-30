import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import css from 'rollup-plugin-css-only';
import json from "@rollup/plugin-json"
import {string}  from "rollup-plugin-string";


const production = !process.env.ROLLUP_WATCH;
const watch = {
	clearScreen: true
}
const plugins =  [
	svelte({
		emitCss:false,
		compilerOptions: {
			dev: !production,
			css: 'injected'
		},
		onwarn: (warning, handler) => {
			// e.g. don't warn on a11y-autofocus
			if (warning.code.startsWith('a11y')) return

			// let Rollup handle all other warnings normally
			handler(warning)			
		}
	}),
	css({ output: '../out/codemirror-bundle.css' }),
	string({
		include: "**/*.vmblu"
	}),
	resolve({
		browser: true,
		//dedupe: ['svelte']
	}),
	commonjs(),
	json(),
	!production && terser()
]
export default [
{
	input: 'codemirror.js',
	output: {
		sourcemap: true,
		format: 'es', 
		name: 'codemirror-bundle',
		file: '../out/codemirror-bundle.js',
	},
	plugins: plugins,
	watch: watch
},
];
