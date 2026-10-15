import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'node:url';
import tailwindConfig from '../../../client/tailwind.config.js';
const root = fileURLToPath(new URL('.', import.meta.url));
const client = fileURLToPath(new URL('../../../client/', import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  envDir: root,
  logLevel: 'error',
  define: {
    'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': JSON.stringify(
      process.argv.includes('--production-controls') || process.argv.includes('--layout-controls-only') ? 'true' : 'false'
    ),
    'import.meta.env.VITE_API_URL': '"/api"'
  },
  css: {
    postcss: {
      plugins: [tailwindcss({
        ...tailwindConfig,
        content: [client + 'src/**/*.{js,jsx}']
      }), autoprefixer()]
    }
  },
  server: {
    host: '127.0.0.1',
    port: 4192,
    strictPort: true,
    fs: {
      allow: [root, client]
    }
  }
});
