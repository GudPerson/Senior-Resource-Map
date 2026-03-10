import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './routes/auth.js';
import hardAssetsRoutes from './routes/hardAssets.js';
import softAssetsRoutes from './routes/softAssets.js';
import tagsRoutes from './routes/tags.js';
import subCategoriesRoutes from './routes/subCategories.js';
import uploadRoutes from './routes/upload.js';
import userRoutes from './routes/users.js';
import favoritesRoutes from './routes/favorites.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import subregionRoutes from './routes/subregions.js';
import partnerRoutes from './routes/partners.js';

const app = new Hono();

app.use('*', cors({
    origin: (origin) => {
        if (!origin) return '*';

        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174'
        ];

        try {
            const originHost = new URL(origin).hostname;
            if (allowedOrigins.includes(origin) || originHost.endsWith('.pages.dev') || originHost.endsWith('.netlify.app')) {
                return origin;
            }
        } catch (e) {
            // ignore
        }

        return null;
    },
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Session-Token'],
}));

app.route('/api/auth', authRoutes);
app.route('/api/hard-assets', hardAssetsRoutes);
app.route('/api/soft-assets', softAssetsRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/sub-categories', subCategoriesRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/users', userRoutes);
app.route('/api/favorites', favoritesRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/subregions', subregionRoutes);
app.route('/api/partners', partnerRoutes);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

const isNode = typeof globalThis.process !== 'undefined' && globalThis.process.release?.name === 'node';

if (isNode && globalThis.process.env?.NODE_ENV !== 'production') {
    const startNodeServer = async () => {
        try {
            const { serve } = await import('@hono/node-server');
            const port = globalThis.process.env?.PORT || 4000;
            serve({
                fetch: app.fetch,
                port
            }, (info) => {
                console.log(`🏥 SeniorCare Connect API running on http://localhost:${info.port}`);
            });
        } catch (err) {
            // Ignore in environments where node-server is not needed
        }
    };
    startNodeServer();
}

export default app;
