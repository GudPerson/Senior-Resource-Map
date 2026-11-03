import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { clientReleasePlugin } from '../scripts/client-release-plugin.mjs';

// The local address CSV is optional and never becomes a public asset or API.
// Configure this explicitly when starting Vite; production has no address proxy.
export function addressSnapshotProxy(value) {
    if (!value) return {};
    const url = new URL(value);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)
        || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) {
        throw new Error('CAREAROUND_ADDRESS_SERVICE_URL must be a plain loopback HTTP service URL.');
    }
    return { '/__carearound-addresses': { target: url.origin, changeOrigin: true,
        rewrite: path => path.replace(/^\/__carearound-addresses/, '') } };
}

export default defineConfig({
    plugins: [react(), clientReleasePlugin()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            ...addressSnapshotProxy(process.env.CAREAROUND_ADDRESS_SERVICE_URL),
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true
            },
            '/__carearound-town-maps': {
                target: 'https://maps.carearound.sg',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/__carearound-town-maps/, '')
            },
            '/__carearound-town-map-downloads': {
                target: 'http://127.0.0.1:4176',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/__carearound-town-map-downloads/, '')
            }
        }
    }
});
