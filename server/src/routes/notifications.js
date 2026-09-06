import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { getDb } from '../db/index.js';
import { loadSavedAssetChangeSources } from '../utils/savedAssets.js';
import { createRuntimeNotificationRepository } from '../utils/notificationRepository.js';
import { NOTIFICATION_PAGE_SIZE, NotificationError, notificationIdSchema, notificationMuteSchema,
    notificationPreferenceSchema, notificationStateSchema, parseNotificationInput,
    publicNotificationSettings, renderNotification, requireNotificationOwner } from '../utils/notificationDomain.js';

const cursorSchema = z.object({ before: z.string().datetime({ offset: true }).optional(), beforeId: notificationIdSchema.optional() })
    .strict().refine((input) => Boolean(input.before) === Boolean(input.beforeId));
const toFavorite = (row) => ({ id: row.favorite_id, userId: row.user_id, resourceType: row.resource_type, resourceId: row.resource_id });

export function createNotificationRoutes({ authenticate = optionalAuth,
    repositoryForContext = (c) => createRuntimeNotificationRepository(c.env),
    sourcesForContext = (c, favorites) => loadSavedAssetChangeSources(getDb(c.env), c.get('user'), favorites) } = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.SUPPORT_INBOX_ENABLED !== 'true') return c.json({ error: 'Not found.' }, 404);
        return next();
    });
    router.use('*', authenticate);
    router.use('*', createRateLimiter({ name: 'notification-write', limit: 60, windowMs: 600000,
        methods: ['PUT', 'POST'], keyFn: (c) => c.get('user')?.id ? `user:${c.get('user').id}`
            : `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}` }));
    const handle = (action) => async (c) => {
        try {
            const userId = requireNotificationOwner(c.get('user'));
            if (c.req.param('id')) parseNotificationInput(notificationIdSchema, c.req.param('id'));
            return await action(c, repositoryForContext(c), userId);
        } catch (error) {
            if (error instanceof NotificationError) return c.json({ error: error.message }, error.status);
            if (error instanceof SyntaxError) return c.json({ error: 'Check your notification details.' }, 400);
            return c.json({ error: 'Notifications are temporarily unavailable. Please try again later.' }, 503);
        }
    };
    router.get('/preferences', handle(async (c, repository, userId) =>
        c.json(publicNotificationSettings(await repository.preferences(userId)))));
    router.put('/preferences', handle(async (c, repository, userId) => {
        const input = parseNotificationInput(notificationPreferenceSchema, await c.req.json());
        return c.json(publicNotificationSettings(await repository.setPreference(userId, input)));
    }));
    router.get('/unread-count', handle(async (c, repository, userId) => c.json({ count: await repository.unreadCount(userId) })));
    router.get('/muted', handle(async (c, repository, userId) => {
        const { after } = parseNotificationInput(z.object({ after: notificationIdSchema.optional() }).strict(), c.req.query());
        const rows = await repository.muted(userId, after);
        const page = rows.slice(0, NOTIFICATION_PAGE_SIZE);
        const sources = new Map((await sourcesForContext(c, page.map(toFavorite))).map((source) => [source.favoriteId, source]));
        return c.json({ muted: page.map((row) => ({ id: row.id, revision: row.control_revision,
            title: sources.get(row.favorite_id)?.available ? sources.get(row.favorite_id).summary.name : 'Unavailable saved resource' })),
        nextCursor: rows.length > NOTIFICATION_PAGE_SIZE ? page.at(-1).id : null });
    }));
    router.put('/watches/:id', handle(async (c, repository, userId) => {
        const input = parseNotificationInput(notificationMuteSchema, await c.req.json());
        const row = await repository.setMute(userId, c.req.param('id'), input);
        return c.json({ id: row.id, revision: row.control_revision, muted: row.muted });
    }));
    router.put('/:id', handle(async (c, repository, userId) => {
        const input = parseNotificationInput(notificationStateSchema, await c.req.json());
        await repository.setState(userId, c.req.param('id'), input);
        return c.json({ updated: true });
    }));
    router.get('/', handle(async (c, repository, userId) => {
        const cursor = parseNotificationInput(cursorSchema, c.req.query());
        const preferences = await repository.preferences(userId);
        const rows = await repository.list(userId, cursor);
        const page = rows.slice(0, NOTIFICATION_PAGE_SIZE);
        const sources = new Map((await sourcesForContext(c, page.map(toFavorite))).map((source) => [source.favoriteId, source]));
        return c.json({ notifications: page.map((row) => renderNotification(row, sources.get(row.favorite_id), preferences))
            .filter((notice) => notice.categories.length),
        nextCursor: rows.length > NOTIFICATION_PAGE_SIZE ? { before: new Date(page.at(-1).updated_at).toISOString(), beforeId: page.at(-1).id } : null });
    }));
    return router;
}
