import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { getHardAssets } from '../controllers/hardAssetsController.js';
import { getSoftAssets } from '../controllers/softAssetsController.js';
import { GUIDE_TOPICS, GUIDE_KNOWLEDGE_VERSION, answerGuideQuestion, extractGuideSearchCriteria, serializeGuideResource } from '../utils/guideKnowledge.js';
import { sanitizeSupportText } from '../utils/supportDomain.js';
import { createGuideHistoryRoutes } from './guideHistory.js';

// Internal requests reuse existing visibility/eligibility-aware public controllers.
// No caller headers, identity, region, managed scope, or private profile are forwarded.
export function createGuideResourceLoader({ hard = getHardAssets, soft = getSoftAssets, pageSize = 10, keyset = false } = {}) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error('Invalid Guide page size.');
    const resources = new Hono();
    resources.use('*', async (c, next) => {
        c.set('user', { role: 'guest' });
        // This context is set only on internal scan requests, never from headers
        // or query flags accepted by the application's public resource routes.
        if (keyset) c.set('publicResourceScan', { beforeId: Number(c.req.query('scanBefore')) || null });
        await next();
    });
    resources.get('/hard', hard);
    resources.get('/soft', soft);
    return async (criteria, env) => {
        const types = (criteria.type === 'all' ? ['hard', 'soft'] : [criteria.type])
            .filter((type) => !keyset || criteria.cursor?.[type] !== null);
        const groups = await Promise.all(types.map(async (type) => {
            const params = new URLSearchParams({ q: criteria.query, scope: 'visible', page: keyset ? '1' : String(criteria.page), pageSize: String(pageSize) });
            if (keyset && criteria.cursor?.[type] !== undefined) {
                if (!Number.isSafeInteger(criteria.cursor[type]) || criteria.cursor[type] <= 0) throw new Error('Invalid scan cursor.');
                params.set('scanBefore', String(criteria.cursor[type]));
            }
            if (type === 'hard') params.set('summary', 'true');
            else params.set('assetMode', 'offerings');
            const response = await resources.fetch(new Request(`http://guide.internal/${type}?${params}`), env);
            if (!response.ok) throw new Error('Resource search unavailable');
            const payload = await response.json();
            if (!Array.isArray(payload?.data)) throw new Error('Resource search unavailable');
            const results = payload.data.map((item) => serializeGuideResource(item, type)).filter(Boolean);
            const hasMore = Number(payload.pagination?.totalPages) > (keyset ? 1 : criteria.page);
            if (keyset && (results.length !== payload.data.length || (hasMore && !results.length))) throw new Error('Invalid scan results.');
            return { type, results, hasMore };
        }));
        return { results: groups.flatMap((group) => group.results), hasMore: groups.some((group) => group.hasMore),
            page: criteria.page, scope: 'public',
            discoverRoute: `/discover?${new URLSearchParams({ q: criteria.query })}`,
            ...(keyset ? { nextCursor: { ...criteria.cursor, ...Object.fromEntries(groups.map((group) =>
                [group.type, group.hasMore ? group.results.at(-1).id : null])) } } : {}) };
    };
}

const questionSchema = z.object({ question: z.string().trim().min(1).max(600).optional(),
    topicId: z.enum(GUIDE_TOPICS.map((topic) => topic.id)).optional() }).strict()
    .refine((value) => value.question || value.topicId);
export const guideSearchSchema = z.object({ query: z.string().trim().min(2).max(120),
    type: z.enum(['all', 'hard', 'soft']).default('all'), page: z.number().int().min(1).max(100).default(1) }).strict();

export function createGuideRoutes({ authenticate = optionalAuth, search = createGuideResourceLoader(), historyRepositoryForContext } = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.SUPPORT_INBOX_ENABLED !== 'true') return c.json({ error: 'CareAround Guide is not yet available.' }, 503);
        await next();
    });
    router.use('*', createRateLimiter({ name: 'guide', limit: 60, windowMs: 60000,
        keyFn: (c) => `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}` }));
    router.route('/history', createGuideHistoryRoutes({ authenticate, repositoryForContext: historyRepositoryForContext }));
    router.get('/topics', (c) => c.json({ version: GUIDE_KNOWLEDGE_VERSION, topics: GUIDE_TOPICS.map(({ id, title }) => ({ id, title })) }));
    router.post('/answer', authenticate, async (c) => {
        const body = await c.req.json().catch(() => null);
        const parsed = questionSchema.safeParse(body);
        if (!parsed.success) return c.json({ error: 'Enter a short app question or choose a help topic.' }, 400);
        if (parsed.data.question && sanitizeSupportText(parsed.data.question) !== parsed.data.question) {
            return c.json({ ...answerGuideQuestion({ topicId: 'privacy' }, c.get('user')), input: null });
        }
        const criteria = !parsed.data.topicId && extractGuideSearchCriteria(parsed.data.question);
        if (criteria) {
            try {
                const result = await search(criteria, c.env);
                return c.json({ version: GUIDE_KNOWLEDGE_VERSION, topicId: 'resource-search', criteria, input: parsed.data,
                    message: result.results.length ? `Here are public directory matches for “${criteria.query}”. Open a result to check current details with the provider.`
                        : `I found no public directory matches for “${criteria.query}”. Try a shorter name, service, tag, or address.`,
                    resources: result.results, actions: [{ route: '/discover', label: 'Open Discover' }], hasMore: result.hasMore });
            } catch { return c.json({ error: 'Resource search is temporarily unavailable. No results have been inferred.' }, 503); }
        }
        return c.json({ ...answerGuideQuestion(parsed.data, c.get('user')), input: parsed.data });
    });
    router.post('/search', async (c) => {
        const parsed = guideSearchSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) return c.json({ error: 'Enter 2–120 characters and a valid resource filter.' }, 400);
        try { return c.json(await search(parsed.data, c.env)); }
        catch { return c.json({ error: 'Resource search is temporarily unavailable. No results have been inferred.' }, 503); }
    });
    return router;
}

export default createGuideRoutes();
