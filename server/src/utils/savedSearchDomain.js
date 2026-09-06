import { z } from 'zod';
import { NotificationError } from './notificationDomain.js';
import { sanitizeSupportText } from './supportDomain.js';

export const SAVED_SEARCH_LIMIT = 10;
export const SAVED_SEARCH_PAGE_SIZE = 50;
const revision = z.number().int().positive().max(2147483647);
const criteria = {
    query: z.string().trim().min(2).max(120).transform((value) => value.replace(/\s+/g, ' ').toLowerCase())
        .refine((value) => sanitizeSupportText(value) === value, 'Use public resource keywords, not private details.'),
    type: z.enum(['all', 'hard', 'soft']), enabled: z.boolean(), reviewed: z.literal(true),
};
export const savedSearchCreateSchema = z.object({ id: z.string().uuid(), ...criteria }).strict();
export const savedSearchEditSchema = z.object({ revision, ...criteria }).strict();
export const savedSearchDeleteSchema = z.object({ revision }).strict();

export async function savedSearchMatchKeys(results, epoch) {
    if (!Array.isArray(results) || results.length > SAVED_SEARCH_PAGE_SIZE * 2) throw new Error('Invalid search batch.');
    return [...new Set(await Promise.all(results.map(async (item) => {
        if (!['hard', 'soft'].includes(item.type) || !Number.isSafeInteger(item.id) || item.id <= 0) throw new Error('Invalid match.');
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([epoch, item.type, item.id])));
        return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    })))];
}

export function savedSearchSummary(row, masterEnabled) {
    return { id: row.id, query: row.query, type: row.resource_type, enabled: row.enabled,
        active: row.enabled && masterEnabled, revision: row.revision,
        preparing: row.enabled && !row.baseline_ready,
        lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null };
}

export function savedSearchDigest(row) {
    return { id: row.id, noticeId: row.notice_id, revision: row.notice_revision, unread: row.read_revision < row.notice_revision,
        query: row.query, type: row.resource_type, updatedAt: new Date(row.notice_updated_at).toISOString(),
        message: 'This search found new public matches. Results can change; open the search to see what is available now.' };
}

export function parseSavedSearchInput(schema, input) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new NotificationError('Review the search keywords, resource type and alert choice. Do not include private details.');
    return parsed.data;
}
