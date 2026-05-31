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
  optimizeDeps: {
    exclude: [
      '@vizualmodel/vmblu-runtime/rt-base',
      '@vizualmodel/vmblu-runtime/rt-als',
      '@vizualmodel/vmblu-runtime/rt-browser-agent',
      '@vizualmodel/vmblu-runtime/rt-nodejs-agent',
    ],
  },
  build: {
    sourcemap: true,
    minify: production ? 'esbuild' : false,
    emptyOutDir: false,
    outDir: './out',
    rollupOptions: {
      input: 'model/playground.app.js',
      output: {
        format: 'es',
        entryFileNames: '[name]-bundle.js',
        chunkFileNames: '[name]-chunk.js',
        assetFileNames: '[name]-bundle.[ext]',
      },
    },
  },
});
