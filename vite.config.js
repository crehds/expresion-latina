import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],

  // The site is served from the root of its domain on Vercel. Changing this
  // without changing the host produces a blank page whose only symptom is
  // "Unexpected token '<'", because the host answers the missing asset with
  // index.html and the browser parses it as JavaScript.
  base: '/',

  build: {
    outDir: 'build',
    // Kept from the previous toolchain so nothing downstream has to be told
    // about a new directory name.
    emptyOutDir: true,
  },

  server: {
    port: 3000,
    open: false,
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    // The importer runs on node --test through npm run test:data; it has no
    // DOM and no bundler, and must stay independent of this config.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    css: false,
  },
});
