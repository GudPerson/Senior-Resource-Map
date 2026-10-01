import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq, ilike, inArray } from 'drizzle-orm';
import {
    authenticateToken,
    authorizeResourceOperator,
    hasDirectResourceOperatorAccess,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { getDb } from '../db/index.js';
import { hardAssets } from '../db/schema.js';
import { ensureSavedAsset } from '../controllers/favoritesController.js';
import { createSoftAsset } from '../controllers/softAssetsController.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { getActiveHardAssetStaffAccess } from '../utils/hardAssetStaff.js';
import { normalizeRole } from '../utils/roles.js';
import {
    loadHardAssetsByIds,
    ensureActorCanManageLinkedHardAssets,
    determineSoftSubregion,
    resolveAssetOwner,
} from '../utils/softAssetScope.js';
import { draftGuideProgramme, guideAiAvailable } from '../utils/guideActionDrafting.js';
import {
    GUIDE_ACTION_CONTEXT,
    guideProgrammeDraftSchema,
    guideReviewSchema,
    guideCreateSchema,
    guideActionError,
    missingGuideFields,
    createGuideReview,
    verifyGuideReview,
    buildGuideProgrammePayload,
} from '../utils/guideActionDomain.js';

const draftRequest = z
    .object({ message: z.string().trim().min(1).max(2000), draft: guideProgrammeDraftSchema.default({}),
        useAi: z.boolean().optional().default(false) })
    .strict();
const saveResourceRequest = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: z.number().int().positive().max(2147483647),
}).strict();
const placeDto = (place) => ({ id: place.id, name: place.name, address: place.address || '' });
export async function loadGuideProgrammePlaces(c, query = '') {
    const actor = c.get('user');
    const ids = getActiveHardAssetStaffAccess(actor).map((entry) => entry.hardAssetId);
    if (normalizeRole(actor.role) !== 'super_admin' && !ids.length) return { places: [], hasMore: false };
    const rows = await getDb(c.env)
        .select({ id: hardAssets.id, name: hardAssets.name, address: hardAssets.address })
        .from(hardAssets)
        .where(
            and(
                eq(hardAssets.isDeleted, false),
                normalizeRole(actor.role) !== 'super_admin' ? inArray(hardAssets.id, ids) : undefined,
                query ? ilike(hardAssets.name, `%${query.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
            ),
        )
        .orderBy(asc(hardAssets.name), asc(hardAssets.id))
        .limit(31);
    return { places: rows.slice(0, 30).map(placeDto), hasMore: rows.length > 30 };
}
export async function validateGuideProgrammePlace(c, draft) {
    const db = getDb(c.env);
    const actor = c.get('user');
    const places = await loadHardAssetsByIds(db, [draft.locationId]);
    if (places.length !== 1 || places[0].isDeleted)
        throw guideActionError('Select an existing place you can manage.', 403);
    ensureActorCanManageLinkedHardAssets(actor, places);
    const body = buildGuideProgrammePayload(draft);
    const subregion = determineSoftSubregion(actor, body, places);
    const { owner } = await resolveAssetOwner(db, actor, body, subregion);
    return {
        ...placeDto(places[0]),
        routing: {
            placeSubregionId: places[0].subregionId ?? null,
            effectiveSubregionId: subregion,
            ownerId: owner?.id ?? null,
        },
    };
}
export function createGuideActionRoutes({
    authenticate = authenticateToken,
    loadPlaces = loadGuideProgrammePlaces,
    validatePlace = validateGuideProgrammePlace,
    draftProgramme = draftGuideProgramme,
    create = createSoftAsset,
    saveResource = async (c, resourceType, resourceId) => {
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        return ensureSavedAsset(db, c.get('user'), resourceType, resourceId);
    },
} = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.GUIDE_ACTIONS_ENABLED !== 'true')
            return c.json({ error: 'Guide actions are not enabled here.' }, 503);
        await next();
    });
    router.use('*', authenticate);
    router.use('*', async (c, next) => {
        const actor = c.get('user');
        if (!actor?.id || normalizeRole(actor.role) === 'guest')
            return c.json({ error: 'Sign in to use Guide actions.' }, 401);
        if (actor.isImpersonating)
            return c.json({ error: 'Exit User View before using Guide actions.' }, 403);
        await next();
    });
    router.use(
        '*',
        createRateLimiter({
            name: 'guide-actions',
            limit: 20,
            windowMs: 60000,
            keyFn: (c) => `user:${c.get('user').id}`,
        }),
    );
    router.post('/saved-resources', async (c) => {
        const parsed = saveResourceRequest.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: 'Choose a valid Place or Programme/service to save.' }, 400);
        try {
            return c.json(await saveResource(c, parsed.data.resourceType, parsed.data.resourceId));
        } catch (error) {
            return c.json({ error: error.status ? error.message : 'The save could not be confirmed. Retry this same request.' },
                error.status || 503);
        }
    });
    router.get('/programmes/places', async (c) => {
        const canCreate = hasDirectResourceOperatorAccess(c.get('user'));
        if (!canCreate)
            return c.json({
                places: [],
                hasMore: false,
                canCreate: false,
                aiAvailable: guideAiAvailable(c.env),
            });
        const query = String(c.req.query('q') || '').trim();
        if (query.length > 100) return c.json({ error: 'Keep the place search under 100 characters.' }, 400);
        try {
            return c.json({
                ...(await loadPlaces(c, query)),
                canCreate,
                aiAvailable: guideAiAvailable(c.env),
            });
        } catch {
            return c.json({ error: 'Your manageable places could not be loaded. Try again.' }, 503);
        }
    });
    router.use('/programmes/*', authorizeResourceOperator());
    const aiDraftLimiter = createRateLimiter({ name: 'guide-draft-ai', limit: 5, windowMs: 60 * 60 * 1000,
        keyFn: (c) => `user:${c.get('user').id}` });
    router.post('/programmes/draft', async (c) => {
        const parsed = draftRequest.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success)
            return c.json({ error: 'Enter a short request and valid programme details.' }, 400);
        if (parsed.data.useAi && guideAiAvailable(c.env)) {
            let allowed = false;
            await aiDraftLimiter(c, async () => { allowed = true; });
            if (!allowed) return c.json({ draft: parsed.data.draft, aiAvailable: false,
                message: 'AI drafting is at its limit for now. Complete the editable details below, then review your programme. Nothing has been created.',
                missingFields: missingGuideFields(parsed.data.draft) });
        }
        const result = await draftProgramme(parsed.data, c.env);
        return c.json({ ...result, missingFields: missingGuideFields(result.draft) });
    });
    router.post('/programmes/review', async (c) => {
        const parsed = guideReviewSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success)
            return c.json({ error: 'Check the programme fields and schedule before reviewing.' }, 400);
        const { draft, requestId } = parsed.data;
        const missingFields = missingGuideFields(draft);
        if (missingFields.length)
            return c.json(
                {
                    error: 'Add a name, select a place, and complete any requested schedule dates before reviewing.',
                    missingFields,
                },
                400,
            );
        try {
            const { routing, ...place } = await validatePlace(c, draft);
            return c.json({
                draft,
                requestId,
                place,
                ...(await createGuideReview(c, draft, requestId, routing)),
                message:
                    draft.visibility === 'hidden'
                        ? 'Hidden from the directory; people with permitted access may still see it.'
                        : 'Visible according to existing directory and sharing access rules.',
            });
        } catch (error) {
            return c.json(
                { error: error.status ? error.message : 'The programme preview could not be prepared.' },
                error.status || 503,
            );
        }
    });
    router.post('/programmes/create', async (c) => {
        const parsed = guideCreateSchema.safeParse(await c.req.json().catch(() => null));
        if (
            !parsed.success ||
            missingGuideFields(parsed.data?.draft || { name: '', locationId: null, schedule: '' }).length
        )
            return c.json({ error: 'Review valid programme details before creating.' }, 400);
        try {
            const context = await verifyGuideReview(c, parsed.data);
            await validatePlace(c, parsed.data.draft);
            c.set(GUIDE_ACTION_CONTEXT, context);
            // Supply an allowlisted server-built body without mutating the browser request or accepting controller-only fields.
            const wrapped = new Proxy(c, {
                get(target, key) {
                    if (key === 'req')
                        return { json: async () => buildGuideProgrammePayload(parsed.data.draft) };
                    const value = Reflect.get(target, key, target);
                    return typeof value === 'function' ? value.bind(target) : value;
                },
            });
            const response = await create(wrapped);
            const result = await response.json();
            if (!response.ok)
                return c.json(
                    {
                        error: result.error || 'The programme could not be created.',
                        ...(result.code ? { code: result.code } : {}),
                    },
                    response.status,
                );
            return c.json(
                {
                    resource: {
                        id: result.id,
                        type: 'soft',
                        name: result.name,
                        route: `/resource/soft/${result.id}`,
                    },
                    replayed: Boolean(result.guideReplayed),
                },
                result.guideReplayed ? 200 : 201,
            );
        } catch (error) {
            return c.json(
                {
                    error: error.status
                        ? error.message
                        : 'The save outcome could not be confirmed. Retry the same reviewed request.',
                    ...(error.code?.startsWith?.('GUIDE_') ? { code: error.code } : {}),
                },
                error.status || 503,
            );
        }
    });
    return router;
}
