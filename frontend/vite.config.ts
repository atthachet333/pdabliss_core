import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ports are fixed by the project spec. strictPort makes Vite fail loudly
// instead of silently moving to another port when 1111 is taken.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: 'localhost', port: 1111, strictPort: true },
  preview: { host: 'localhost', port: 1111, strictPort: true },
  // The manifest maps source modules to hashed chunks; scripts/prerender.mjs
  // reads it to preload each route's own chunk, then moves it out of dist/.
  build: {
    target: 'es2022',
    sourcemap: false,
    manifest: true,
    rolldownOptions: {
      output: {
        // Icon groups are named after every route that shares them; keep the file short.
        chunkFileNames: (chunk) =>
          chunk.name.startsWith('icons') ? 'assets/icons-[hash].js' : 'assets/[name]-[hash].js',
        codeSplitting: {
          // EP20: lucide icons shared between routes would otherwise each become
          // a sub-kilobyte chunk (one request apiece; up to 40 per page). Icons
          // are grouped by the set of routes that use them and groups under
          // 2 kB merge with a neighbour: ~11 files per page for +0.6 % bytes.
          groups: [
            {
              name: 'icons',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              entriesAware: true,
              entriesAwareMergeThreshold: 2 * 1024,
            },
          ],
        },
      },
    },
  },
});
