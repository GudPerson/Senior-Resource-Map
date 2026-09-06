import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { parseSupportInput, SupportError, supportIdSchema } from '../utils/supportDomain.js';
import { createRuntimeGuideHistoryRepository, guideHistorySaveSchema, requireGuideHistoryOwner, restoreGuideHistory } from '../utils/guideHistory.js';

export function createGuideHistoryRoutes({ authenticate = optionalAuth,
    repositoryForContext = (c) => createRuntimeGuideHistoryRepository(c.env) } = {}) {
    const router = new Hono();
    router.use('*', authenticate);
    router.use('*', createRateLimiter({ name: 'guide-history-write', limit: 30, windowMs: 600000,
        methods: ['POST', 'DELETE'], keyFn: (c) => c.get('user')?.id ? `user:${c.get('user').id}`
            : `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}` }));
    const handle = (action) => async (c) => {
        c.header('Cache-Control', 'no-store');
        try {
            const ownerId = requireGuideHistoryOwner(c.get('user'));
            if (c.req.param('id')) parseSupportInput(supportIdSchema, c.req.param('id'));
            return await action(c, repositoryForContext(c), ownerId);
        } catch (error) {
            if (error instanceof SupportError) return c.json({ error: error.message }, error.status);
            if (error instanceof SyntaxError) return c.json({ error: 'Check your saved conversation details.' }, 400);
            return c.json({ error: 'Guide history is temporarily unavailable. Please try again later.' }, 503);
        }
    };
    router.get('/', handle(async (c, repository, ownerId) => c.json({ conversations: await repository.list(ownerId) })));
    router.get('/:id', handle(async (c, repository, ownerId) => c.json(restoreGuideHistory(await repository.get(c.req.param('id'), ownerId), c.get('user')))));
    router.post('/', handle(async (c, repository, ownerId) => {
        const input = parseSupportInput(guideHistorySaveSchema, await c.req.json());
        return c.json(restoreGuideHistory(await repository.save(input, ownerId), c.get('user')));
    }));
    router.delete('/:id', handle(async (c, repository, ownerId) => {
        const { revision } = parseSupportInput(z.object({ revision: z.number().int().positive() }).strict(), await c.req.json());
        await repository.remove(c.req.param('id'), ownerId, revision);
        return c.json({ deleted: true });
    }));
    return router;
}
