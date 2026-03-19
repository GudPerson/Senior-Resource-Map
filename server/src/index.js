import { fileURLToPath } from 'node:url';
import app from './app.js';

const isNode = typeof globalThis.process !== 'undefined' && globalThis.process.release?.name === 'node';

function isDirectExecution() {
    if (!isNode || !globalThis.process.argv?.[1]) return false;

    try {
        return fileURLToPath(import.meta.url) === globalThis.process.argv[1];
    } catch {
        return false;
    }
}

export async function startNodeServer() {
    const { serve } = await import('@hono/node-server');
    const port = globalThis.process.env?.PORT || 4000;
    serve({
        fetch: app.fetch,
        port
    }, (info) => {
        console.log(`🏥 SeniorCare Connect API running on http://localhost:${info.port}`);
    });
}

if (isDirectExecution()) {
    startNodeServer().catch(() => {
        // Ignore in environments where node-server is not needed.
    });
}

export default app;
