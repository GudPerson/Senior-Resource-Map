import { defineConfig, mergeConfig } from 'vite';
import reference from '../care-map-view-controls/vite.config.mjs';
import { fileURLToPath } from 'node:url';
import { createFictionalApi } from './fictional-api.mjs';
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
export default defineConfig(mergeConfig(reference, {
    root,
    envDir: root,
    define: {
        'import.meta.env.VITE_MAP_FIRST_EXPERIMENT_ENABLED': 'undefined',
        'import.meta.env.VITE_OWNER_MAP_WORKSPACE_ENABLED': 'undefined',
        'import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED': '"false"',
        'import.meta.env.VITE_SUPPORT_INBOX_ENABLED': '"true"',
        'import.meta.env.VITE_GOOGLE_CLIENT_ID': '"fictional-local-preview"',
        'import.meta.env.VITE_ADDRESS_SNAPSHOT_PROVIDER': JSON.stringify(process.env.SPATIAL_SNAPSHOT_PROVIDER || 'local'),
    },
    plugins: [{
        name: 'fictional-spatial-preview-api',
        configureServer(server) {
            const api = createFictionalApi();
            const productionSnapshot = process.env.SPATIAL_SNAPSHOT_PROVIDER === 'production'
                ? import('./production-snapshot.mjs').then(module => module.createProductionSnapshotFixture()) : null;
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url, 'http://127.0.0.1');
                if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/__preview/')) return next();
                // The prepared snapshot service is a separate read-only process. Never proxy other API paths.
                if (url.pathname.startsWith('/__carearound-addresses/')) return next();
                const chunks = []; for await (const chunk of req) chunks.push(chunk);
                let body; try { body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined; } catch { body = undefined; }
                const snapshotResponse = productionSnapshot ? await (await productionSnapshot).handle(req, body) : null;
                if (snapshotResponse) {
                    res.statusCode = snapshotResponse.status;
                    for (const [key, value] of snapshotResponse.headers) res.setHeader(key, value);
                    res.end(Buffer.from(await snapshotResponse.arrayBuffer())); return;
                }
                const result = api.handle(req.method, url, body);
                res.statusCode = result.status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(result.value));
            });
        },
    }],
    server: {
        host: '127.0.0.1', port: 4496, strictPort: true,
        fs: { allow: [repo] },
        proxy: { '/__carearound-addresses': { target: process.env.SPATIAL_SNAPSHOT_TARGET || 'http://127.0.0.1:8796', changeOrigin: true, rewrite: value => value.replace(/^\/__carearound-addresses/, '') } },
    },
}));
