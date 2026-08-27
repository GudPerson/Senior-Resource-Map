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
import personalPlacesRoutes from './routes/personalPlaces.js';
import sharedMapsRoutes from './routes/sharedMaps.js';
import adminRoutes from './routes/admin.js';
import publicRoutes from './routes/public.js';
import subregionRoutes from './routes/subregions.js';
import partnerRoutes from './routes/partners.js';
import partnerOrganizationRoutes from './routes/partnerOrganizations.js';
import audienceZoneRoutes from './routes/audienceZones.js';
import membershipsRoutes from './routes/memberships.js';
import privateResourceContentRoutes from './routes/privateResourceContent.js';
import resourceTranslationsRoutes from './routes/resourceTranslations.js';
import phoneIdentitiesRoutes from './routes/phoneIdentities.js';
import governanceRoutes from './routes/governance.js';
import discoveryRoutes from './routes/discovery.js';
import calendarRoutes from './routes/calendar.js';
import {
    aiRateLimit,
    authPollingRateLimit,
    authRateLimit,
    cookieSessionCsrfGuard,
    discoveryIndicatorRateLimit,
    requestBodyGuard,
    securityHeaders,
    translationRateLimit,
    uploadRateLimit,
} from './middleware/security.js';
import { resolveAllowedRequestOrigin } from './utils/requestOrigins.js';
import { requestObservability } from './middleware/requestObservability.js';

function resolveCorsOrigin(origin, c) {
    if (!origin) return '*';
    return resolveAllowedRequestOrigin(origin, c?.env);
}

const app = new Hono();

app.use('*', requestObservability);
app.use('*', securityHeaders);
app.use('*', cors({
    origin: resolveCorsOrigin,
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Session-Token', 'X-Phone-Login-Token'],
    exposeHeaders: ['X-Request-ID', 'Server-Timing', 'X-CareAround-Cache', 'X-CareAround-Cache-Age', 'X-CareAround-Cache-Stale'],
}));
app.use('*', cookieSessionCsrfGuard);
app.use('*', requestBodyGuard);

app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/google', authRateLimit);
app.use('/api/auth/google/*', authRateLimit);
app.use('/api/auth/phone/*', authPollingRateLimit);
app.use('/api/auth/phone/*', authRateLimit);
app.use('/api/phone-identities/link/start', authRateLimit);
app.use('/api/upload', uploadRateLimit);
app.use('/api/upload/*', uploadRateLimit);
app.use('/api/private-resource-content/*', uploadRateLimit);
app.use('/api/private-resource-content/*/files', uploadRateLimit);
app.use('/api/private-resource-content/*/files/*', uploadRateLimit);
app.use('/api/hard-assets/import/*', aiRateLimit);
app.use('/api/soft-assets/import/*', aiRateLimit);
app.use('/api/resource-translations/*', translationRateLimit);
app.use('/api/discovery/location-indicators', discoveryIndicatorRateLimit);

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
app.route('/api/personal-places', personalPlacesRoutes);
app.route('/api/shared-maps', sharedMapsRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/subregions', subregionRoutes);
app.route('/api/partners', partnerRoutes);
app.route('/api/partner-organizations', partnerOrganizationRoutes);
app.route('/api/audience-zones', audienceZoneRoutes);
app.route('/api/memberships', membershipsRoutes);
app.route('/api/private-resource-content', privateResourceContentRoutes);
app.route('/api/resource-translations', resourceTranslationsRoutes);
app.route('/api/phone-identities', phoneIdentitiesRoutes);
app.route('/api/governance', governanceRoutes);
app.route('/api/discovery', discoveryRoutes);
app.route('/api/calendar', calendarRoutes);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
