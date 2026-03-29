import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const production = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: !production,
      },
      emitCss: true,
    }),
  ],
  build: {
    sourcemap: true,
    minify: production ? 'esbuild' : false,
    emptyOutDir: false,
    outDir: './out',
    rollupOptions: {
      input: 'playground.app.js',
      output: {
        format: 'es',
        entryFileNames: '[name]-bundle.js',
        chunkFileNames: '[name]-chunk.js',
        assetFileNames: '[name]-bundle.[ext]',
      },
    },
  },
});
