import { neon } from '@neondatabase/serverless';
import { z } from 'zod';
import { normalizeRole } from './roles.js';
import { SupportError, sanitizeSupportText, supportIdSchema } from './supportDomain.js';
import { GUIDE_TOPICS, GUIDE_KNOWLEDGE_VERSION, answerGuideQuestion, extractGuideSearchCriteria } from './guideKnowledge.js';

export const guideHistoryInputSchema = z.object({
    question: z.string().trim().min(1).max(600)
        .refine((text) => sanitizeSupportText(text) === text, 'Remove private details before saving this question.').optional(),
    topicId: z.enum(GUIDE_TOPICS.map((topic) => topic.id)).optional(),
}).strict().refine((input) => Boolean(input.question) !== Boolean(input.topicId));
export const guideHistorySaveSchema = z.object({
    id: supportIdSchema, requestId: supportIdSchema,
    revision: z.number().int().min(0), consent: z.literal(true),
    inputs: z.array(guideHistoryInputSchema).min(1).max(20),
}).strict();

export function requireGuideHistoryOwner(user) {
    if (user?.isImpersonating) throw new SupportError('Exit User View to use private Guide history.', 403);
    const id = Number(user?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || normalizeRole(user?.role) === 'guest') {
        throw new SupportError('Sign in to use private Guide history.', 401);
    }
    return id;
}

const titleFor = (input) => (input.question || GUIDE_TOPICS.find((topic) => topic.id === input.topicId)?.title || 'Guide conversation').slice(0, 120);
const summaryFor = (row) => ({ id: row.id, title: row.title, revision: row.revision, updatedAt: row.updated_at });

// Only questions/topic references persist. No old resource facts, arbitrary
// model answers, action URLs, or support access are stored with the snapshot.
export function restoreGuideHistory(row, user) {
    return { conversation: summaryFor(row), version: GUIDE_KNOWLEDGE_VERSION,
        messages: row.inputs.map((stored, index) => {
            const parsed = guideHistoryInputSchema.safeParse(stored);
            const input = parsed.success ? parsed.data : null;
            const criteria = input?.question && extractGuideSearchCriteria(input.question);
            const answer = criteria ? {
                version: GUIDE_KNOWLEDGE_VERSION, topicId: 'resource-search', criteria,
                message: 'This was a directory search. Run these keywords again to see currently available public resources.',
                actions: [],
            } : answerGuideQuestion(input || {}, user);
            return { ...answer, id: `${row.id}:${index}`, question: input ? input.question || titleFor(input) : 'Earlier help topic', input };
        }) };
}

export function createRuntimeGuideHistoryRepository(env = {}) {
    const url = env.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
    if (!url) throw new SupportError('Guide history is temporarily unavailable.', 503);
    const query = neon(url);
    return createGuideHistoryRepository((text, params) => query(text, params));
}

export function createGuideHistoryRepository(query) {
    const repository = {
        async list(ownerId) {
            const rows = await query(`SELECT id, title, revision, updated_at FROM guide_conversations
                WHERE owner_user_id = $1 ORDER BY updated_at DESC, id DESC LIMIT 20`, [ownerId]);
            return rows.map(summaryFor);
        },
        async get(id, ownerId) {
            const rows = await query('SELECT * FROM guide_conversations WHERE id = $1 AND owner_user_id = $2', [id, ownerId]);
            if (!rows[0]) throw new SupportError('Saved Guide conversation not found.', 404);
            return rows[0];
        },
        async save(input, ownerId) {
            const { id, inputs, revision, requestId } = input;
            const title = titleFor(inputs[0]);
            const params = [id, ownerId, title, JSON.stringify(inputs), requestId];
            const rows = revision === 0 ? await query(`INSERT INTO guide_conversations
                (id, owner_user_id, title, inputs, last_request_id, slot)
                SELECT $1, $2, $3, $4::jsonb, $5, slots.slot
                FROM generate_series(0, 19) AS slots(slot)
                WHERE NOT EXISTS (SELECT 1 FROM guide_conversations c WHERE c.owner_user_id = $2 AND c.slot = slots.slot)
                ORDER BY slots.slot LIMIT 1 ON CONFLICT DO NOTHING RETURNING *`, params)
                : await query(`UPDATE guide_conversations SET title = $3, inputs = $4::jsonb,
                    last_request_id = $5, revision = revision + 1, updated_at = NOW()
                    WHERE id = $1 AND owner_user_id = $2 AND revision = $6 AND last_request_id != $5 RETURNING *`, [...params, revision]);
            if (rows[0]) return rows[0];
            const retry = await query(`SELECT * FROM guide_conversations WHERE id = $1 AND owner_user_id = $2
                AND title = $3 AND inputs = $4::jsonb AND last_request_id = $5`, params);
            if (retry[0]) return retry[0];
            throw new SupportError(revision === 0 ? 'Could not save this conversation. Refresh history; keep at most 20 saved conversations.'
                : 'This saved conversation changed. Reload it before saving again.', 409);
        },
        async remove(id, ownerId, revision) {
            const rows = await query(`DELETE FROM guide_conversations WHERE id = $1 AND owner_user_id = $2
                AND revision = $3 RETURNING id`, [id, ownerId, revision]);
            if (rows[0]) return;
            const remaining = await query('SELECT id FROM guide_conversations WHERE id = $1 AND owner_user_id = $2', [id, ownerId]);
            if (remaining[0]) throw new SupportError('This saved conversation changed. Reload it before deleting.', 409);
        },
    };
    return repository;
}
