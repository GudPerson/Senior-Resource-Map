import { Hono } from 'hono';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';
import { SupportError, parseSupportInput, supportIdSchema, supportRevisionSchema, supportReportSchema, supportVerificationSchema } from '../utils/supportDomain.js';
import { createRuntimeSupportRepository } from '../utils/supportRepository.js';
import { createSupportService, resolveSupportPrincipal } from '../utils/supportService.js';
import { verifySupportProductionRelease } from '../utils/supportReleaseVerification.js';
import { currentWorkerRelease } from '../utils/workerRelease.js';

const decisionSchema = z.object({ proposalId: supportIdSchema, revision: supportRevisionSchema }).strict();
const readSchema = z.object({ sequence: z.number().int().nonnegative() }).strict();

export function createSupportRoutes({
    authenticate = optionalAuth,
    repositoryForContext = (c) => createRuntimeSupportRepository(c.env),
    verifyProduction = verifySupportProductionRelease,
} = {}) {
    const router = new Hono();
    router.use('*', async (c, next) => {
        c.header('Cache-Control', 'no-store');
        if (c.env?.SUPPORT_INBOX_ENABLED !== 'true') return c.json({ error: 'Support inbox is not yet available.' }, 503);
        await next();
    });
    router.use('*', authenticate);
    router.use('*', createRateLimiter({
        name: 'support-write', limit: 30, windowMs: 10 * 60 * 1000,
        methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
        keyFn: (c) => c.get('user')?.id ? `user:${c.get('user').id}`
            : `ip:${c.req.header('cf-connecting-ip') || 'anonymous'}`,
    }));

    function handler(callback, reviewer = false, guestMode = false) {
        return async (c) => {
            try {
                const principal = await resolveSupportPrincipal(c.get('user'), c.req.header('X-CareAround-Support-Key') || '', reviewer, guestMode);
                const id = c.req.param('id');
                if (id) parseSupportInput(supportIdSchema, id);
                const service = createSupportService(repositoryForContext(c), (target) => verifyProduction(target, fetch, {
                    requestUrl: c.req.url, release: currentWorkerRelease(c.env),
                }));
                return await callback(c, service, principal);
            } catch (error) {
                if (error instanceof SupportError) return c.json({ error: error.message }, error.status);
                if (error instanceof SyntaxError) return c.json({ error: 'Enter valid report details.' }, 400);
                return c.json({ error: 'Support is temporarily unavailable. Please try again later.' }, 503);
            }
        };
    }

    function pagination(c) {
        const after = Number(c.req.query('after') || 0);
        if (!Number.isSafeInteger(after) || after < 0) throw new SupportError('Invalid message position.');
        return after;
    }

    function listOptions(c) {
        const before = c.req.query('before') || null;
        const beforeId = c.req.query('beforeId') || null;
        if (before && (!/^\d{4}-\d{2}-\d{2}T/.test(before) || !Number.isFinite(Date.parse(before)))) {
            throw new SupportError('Invalid inbox position.');
        }
        if (Boolean(before) !== Boolean(beforeId)) throw new SupportError('Invalid inbox position.');
        if (beforeId) parseSupportInput(supportIdSchema, beforeId);
        return { before, beforeId, limit: 31 };
    }

    router.post('/preview', async (c) => {
        const parsed = supportReportSchema.safeParse(await c.req.json().catch(() => null));
        return parsed.success ? c.json(parsed.data) : c.json({ error: 'Check your report title, description, and expected behaviour.' }, 400);
    });
    router.post('/reports', handler(async (c, service, principal) => c.json(await service.create(await c.req.json(), principal), 201)));
    router.post('/guest/reports', handler(async (c, service, principal) => c.json(await service.create(await c.req.json(), principal), 201), false, true));
    for (const [prefix, reviewer, guestMode = false] of [['/reports', false], ['/guest/reports', false, true], ['/review/reports', true]]) {
        router.get(`${prefix}/unread`, handler(async (c, service, principal) => c.json({ count: await service.unreadCount(principal) }), reviewer, guestMode));
        router.get(prefix, handler(async (c, service, principal) => {
            const rows = await service.list(principal, listOptions(c));
            const conversations = rows.slice(0, 30);
            const last = conversations.at(-1);
            return c.json({ conversations, hasMore: rows.length > 30,
                next: rows.length > 30 ? { before: last.updatedAt, beforeId: last.id } : null });
        }, reviewer, guestMode));
        router.get(`${prefix}/:id`, handler(async (c, service, principal) => c.json(await service.detail(c.req.param('id'), principal, pagination(c))), reviewer, guestMode));
        router.post(`${prefix}/:id/replies`, handler(async (c, service, principal) => c.json(await service.reply(c.req.param('id'), principal, await c.req.json())), reviewer, guestMode));
        router.post(`${prefix}/:id/status`, handler(async (c, service, principal) => c.json(await service.changeStatus(c.req.param('id'), principal, await c.req.json())), reviewer, guestMode));
        router.post(`${prefix}/:id/read`, handler(async (c, service, principal) => {
            const { sequence } = parseSupportInput(readSchema, await c.req.json());
            return c.json(await service.markRead(c.req.param('id'), principal, sequence));
        }, reviewer, guestMode));
    }
    router.post('/review/reports/:id/proposals', handler(async (c, service, principal) => c.json(await service.propose(c.req.param('id'), principal, await c.req.json())), true));
    router.get('/review/reports/:id/proposals/:proposalId', handler(async (c, service, principal) => c.json(await service.proposal(c.req.param('id'), principal, c.req.param('proposalId'))), true));
    router.post('/review/reports/:id/approve', handler(async (c, service, principal) => c.json(await service.approve(c.req.param('id'), principal, parseSupportInput(decisionSchema, await c.req.json()))), true));
    router.post('/review/reports/:id/verify', handler(async (c, service, principal) => c.json(await service.verify(c.req.param('id'), principal, parseSupportInput(supportVerificationSchema, await c.req.json()))), true));
    return router;
}

export default createSupportRoutes();
