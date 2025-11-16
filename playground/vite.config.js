import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import string from 'vite-plugin-string';

const production = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        dev: !production,
      },
      emitCss: true,
    }),
    string({
      include: ['**/*.vmblu', '**/*.txt'], // Added support for .txt
    }),
  ],
  build: {
    sourcemap: true, // !production,
    minify: production ? 'esbuild' : false, // Use esbuild for faster builds
    emptyOutDir: false, // Clean output directory before building
    outDir: './out', // Set the output directory
    rollupOptions: {
      input: 'playground.js',
      output: {
        format: 'es',
        entryFileNames: '[name]-bundle.js', // Remove hash
        chunkFileNames: '[name]-chunk.js', // Remove hash
        assetFileNames: '[name]-bundle.[ext]', // Remove hash
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src', // Optional alias
    },
  },
  server: {
    watch: {
      clearScreen: true,
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    },
  },
  publicDir: '../public', 
});
