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
		emitCss:true,
		compilerOptions: {
			dev: !production,
		}, 
		onwarn: (warning, handler) => {
			// e.g. don't warn on a11y-autofocus
			// if (warning.code.startsWith('a11y')) return

			// let Rollup handle all other warnings normally
			// handler(warning)			
		}
	}),
	css({ output: 'ui-svelte-bundle.css' }),
	resolve({
		browser: true,
		dedupe: ['svelte']
	}),
	commonjs(),
	string({
		include: ["**/*.vmblu", "**/*.mod.blu"]
	}),
	json(),
	!production && terser()
]

export default [

{
	input: 'model/ui-svelte.app.js',
	output: {
		sourcemap: true,
		format: 'es', 
		name: 'ui-svelte',
		file: './out/ui-svelte-bundle.js',
	},
	plugins: plugins,
	watch: watch
},

];
