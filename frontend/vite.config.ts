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
  build: { target: 'es2022', sourcemap: false },
});
