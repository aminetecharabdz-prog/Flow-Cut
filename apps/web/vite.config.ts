import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from GitHub Pages at /Flow-Cut/.
export default defineConfig({
  base: '/Flow-Cut/',
  plugins: [react()],
  build: { target: 'es2020', sourcemap: false },
});
