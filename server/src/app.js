import { Hono } from 'hono';
import { cors } from 'hono/cors';

import authRoutes from './routes/auth.js';
import hardAssetsRoutes from './routes/hardAssets.js';
import softAssetsRoutes from './routes/softAssets.js';
import softAssetParentsRoutes from './routes/softAssetParents.js';
import tagsRoutes from './routes/tags.js';
import subCategoriesRoutes from './routes/subCategories.js';
import uploadRoutes from './routes/upload.js';
import userRoutes from './routes/users.js';
import favoritesRoutes from './routes/favorites.js';
import myMapsRoutes from './routes/myMaps.js';
import sharedMapsRoutes from './routes/sharedMaps.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import subregionRoutes from './routes/subregions.js';
import partnerRoutes from './routes/partners.js';
import audienceZoneRoutes from './routes/audienceZones.js';
import membershipsRoutes from './routes/memberships.js';
import privateResourceContentRoutes from './routes/privateResourceContent.js';
import resourceTranslationsRoutes from './routes/resourceTranslations.js';
import {
    aiRateLimit,
    authRateLimit,
    requestBodyGuard,
    securityHeaders,
    translationRateLimit,
    uploadRateLimit,
} from './middleware/security.js';

function readConfiguredOrigins(runtimeEnv = {}) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    return String(runtimeEnv.ALLOWED_ORIGINS || processEnv.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function isCareAroundPagesPreview(originHost) {
    return originHost === 'senior-resource-map.pages.dev' || originHost.endsWith('.senior-resource-map.pages.dev');
}

function resolveCorsOrigin(origin, c) {
    if (!origin) return '*';

    try {
        const parsedOrigin = new URL(origin);
        const originHost = parsedOrigin.hostname;
        const isLocalDevOrigin = originHost === 'localhost' || originHost === '127.0.0.1';
        const isCareAroundOrigin = originHost === 'app.carearound.sg';

        if (isLocalDevOrigin || isCareAroundPagesPreview(originHost) || isCareAroundOrigin) {
            return origin;
        }

        if (readConfiguredOrigins(c?.env).includes(origin)) {
            return origin;
        }
    } catch {
        // Ignore malformed origins and reject below.
    }

    return null;
}

const app = new Hono();

app.use('*', securityHeaders);
app.use('*', cors({
    origin: resolveCorsOrigin,
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Session-Token'],
}));
app.use('*', requestBodyGuard);

app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/google', authRateLimit);
app.use('/api/upload', uploadRateLimit);
app.use('/api/upload/*', uploadRateLimit);
app.use('/api/private-resource-content/*', uploadRateLimit);
app.use('/api/private-resource-content/*/files', uploadRateLimit);
app.use('/api/private-resource-content/*/files/*', uploadRateLimit);
app.use('/api/hard-assets/import/*', aiRateLimit);
app.use('/api/soft-assets/import/*', aiRateLimit);
app.use('/api/resource-translations/*', translationRateLimit);

app.route('/api/auth', authRoutes);
app.route('/api/hard-assets', hardAssetsRoutes);
app.route('/api/soft-assets', softAssetsRoutes);
app.route('/api/soft-asset-parents', softAssetParentsRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/sub-categories', subCategoriesRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/users', userRoutes);
app.route('/api/favorites', favoritesRoutes);
app.route('/api/my-maps', myMapsRoutes);
app.route('/api/shared-maps', sharedMapsRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/subregions', subregionRoutes);
app.route('/api/partners', partnerRoutes);
app.route('/api/audience-zones', audienceZoneRoutes);
app.route('/api/memberships', membershipsRoutes);
app.route('/api/private-resource-content', privateResourceContentRoutes);
app.route('/api/resource-translations', resourceTranslationsRoutes);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
