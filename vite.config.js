import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import cspPlugin from './src/shared/security/cspPlugin';

export default defineConfig(({ mode }) => {
  // Only VITE_-prefixed variables: the same ones the client bundle can see.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    // The CSP plugin applies to the build only; see cspPlugin.js.
    plugins: [react(), cspPlugin({ supabaseUrl: env.VITE_SUPABASE_URL })],

    // The site is served from the root of its domain on Vercel. Changing this
    // without changing the host produces a blank page whose only symptom is
    // 404s on the module script and manifest; vercel.json never rewrites
    // /assets/ or dotted paths to index.html.
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
  };
});
