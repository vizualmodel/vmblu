import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import css from 'rollup-plugin-css-only';
import json from "@rollup/plugin-json";

const production = !process.env.ROLLUP_WATCH;
const watch = {
	clearScreen: true
};
const plugins =  [
	svelte({
		emitCss:true,
		compilerOptions: {
			dev: !production,
			//css: 'injected'
		},
		onwarn: (warning, handler) => {
			// e.g. don't warn on a11y-autofocus
			if (warning.code.startsWith('a11y')) return;

			// let Rollup handle all other warnings normally
			handler(warning);
		}
	}),
	css({ output: 'webview-bundle.css' }),
	resolve({
		browser: true,
		dedupe: ['svelte']
	}),
	commonjs(),
	json(),
	!production && terser()
];

export default [

{
	input: 'webview.js',
	output: {
		sourcemap: true,
		format: 'es', 
		name: 'vmblu',
		inlineDynamicImports:true,
		file: './webview-bundle.js',
	},
	plugins: plugins,
	watch: watch
},

];
