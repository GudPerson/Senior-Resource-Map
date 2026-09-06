import { Hono } from 'hono';
import { optionalAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { createGuideResourceLoader } from './guide.js';
import { NotificationError, notificationIdSchema, notificationStateSchema, requireNotificationOwner, parseNotificationInput } from '../utils/notificationDomain.js';
import { createRuntimeSavedSearchRepository } from '../utils/savedSearchRepository.js';
import { SAVED_SEARCH_LIMIT, parseSavedSearchInput, savedSearchCreateSchema, savedSearchDeleteSchema,
    savedSearchEditSchema, savedSearchSummary, savedSearchDigest } from '../utils/savedSearchDomain.js';

const masterEnabled = (row) => row.enabled !== false && row.allowed !== false;

export function createSavedSearchRoutes({ authenticate = optionalAuth,
    repositoryForContext = (c) => createRuntimeSavedSearchRepository(c.env), search = createGuideResourceLoader() } = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.SUPPORT_INBOX_ENABLED !== 'true') return c.json({ error: 'Not found.' }, 404);
        return next();
    });
    router.use('*', authenticate);
    router.use('*', createRateLimiter({ name: 'saved-search-write', limit: 40, windowMs: 600000,
        methods: ['POST', 'PUT', 'DELETE'], keyFn: (c) => c.get('user')?.id ? `user:${c.get('user').id}`
            : `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}` }));
    const handle = (action) => async (c) => {
        try {
            const owner = requireNotificationOwner(c.get('user'));
            if (c.req.param('id')) parseNotificationInput(notificationIdSchema, c.req.param('id'));
            return await action(c, repositoryForContext(c), owner);
        } catch (error) {
            if (error instanceof NotificationError) return c.json({ error: error.message }, error.status);
            if (error instanceof SyntaxError) return c.json({ error: 'Review your saved-search details.' }, 400);
            return c.json({ error: 'Saved searches are temporarily unavailable. Please try again later.' }, 503);
        }
    };
    router.get('/', handle(async (c, repository, owner) => {
        const allowed = masterEnabled(await repository.master(owner));
        const [rows, digests] = await Promise.all([repository.list(owner), repository.digests(owner)]);
        return c.json({ searches: rows.map((row) => savedSearchSummary(row, allowed)),
            digests: digests.map(savedSearchDigest), masterEnabled: allowed, limit: SAVED_SEARCH_LIMIT });
    }));
    router.get('/unread-count', handle(async (c, repository, owner) => c.json({ count: await repository.unreadCount(owner) })));
    router.post('/', handle(async (c, repository, owner) => {
        const input = parseSavedSearchInput(savedSearchCreateSchema, await c.req.json());
        const row = await repository.create(owner, input);
        return c.json(savedSearchSummary(row, masterEnabled(await repository.master(owner))), 201);
    }));
    router.put('/:id', handle(async (c, repository, owner) => {
        const input = parseSavedSearchInput(savedSearchEditSchema, await c.req.json());
        const row = await repository.edit(owner, c.req.param('id'), input);
        return c.json(savedSearchSummary(row, masterEnabled(await repository.master(owner))));
    }));
    router.delete('/:id', handle(async (c, repository, owner) => {
        const { revision } = parseSavedSearchInput(savedSearchDeleteSchema, await c.req.json());
        await repository.remove(owner, c.req.param('id'), revision);
        return c.json({ deleted: true });
    }));
    router.put('/:id/digest', handle(async (c, repository, owner) => {
        const input = parseNotificationInput(notificationStateSchema.extend({ noticeId: notificationIdSchema }).strict(), await c.req.json());
        await repository.setState(owner, c.req.param('id'), input);
        return c.json({ updated: true });
    }));
    router.get('/:id/results', handle(async (c, repository, owner) => {
        const row = await repository.owned(owner, c.req.param('id'));
        if (!row) throw new NotificationError('Saved search not found.', 404);
        const raw = c.req.query();
        if (Object.keys(raw).some((key) => key !== 'page') || (raw.page && !/^[1-9]\d{0,6}$/.test(raw.page))) {
            throw new NotificationError('Choose a valid results page.');
        }
        // The private saved criteria are never placed in URLs. Only the current
        // public catalog is searched; no owner/profile privilege is forwarded.
        const criteria = { query: row.query, type: row.resource_type, page: Number(raw.page || 1) };
        return c.json({ ...(await search(criteria, c.env)), criteria: { query: row.query, type: row.resource_type } });
    }));
    return router;
}
