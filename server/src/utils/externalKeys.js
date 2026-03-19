import { eq } from 'drizzle-orm';

export const EXTERNAL_KEY_MAX_LENGTH = 160;

function slugify(value, fallback = 'item') {
    const normalized = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');

    return normalized || fallback;
}

export function normalizeExternalKey(value) {
    const normalized = slugify(value);
    if (!normalized) {
        throw new Error('External key is required.');
    }
    return normalized.slice(0, EXTERNAL_KEY_MAX_LENGTH).replace(/-+$/g, '');
}

function hashValue(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

export function buildDeterministicExternalKey(...parts) {
    const cleaned = parts.map((part) => slugify(part)).filter(Boolean);
    const joined = cleaned.join('-');

    if (!joined) return 'item';
    if (joined.length <= EXTERNAL_KEY_MAX_LENGTH) return joined;

    const suffix = hashValue(joined);
    const truncated = joined.slice(0, EXTERNAL_KEY_MAX_LENGTH - suffix.length - 1).replace(/-+$/g, '');
    return `${truncated}-${suffix}`;
}

export function buildChildExternalKey(parentExternalKey, hostExternalKey) {
    return buildDeterministicExternalKey('rollout', parentExternalKey, hostExternalKey);
}

export async function ensureUniqueExternalKey(db, table, column, proposedKey, ignoreId = null) {
    const base = normalizeExternalKey(proposedKey);
    let candidate = base;
    let attempt = 1;

    while (true) {
        const existing = await db.select().from(table).where(eq(column, candidate)).limit(1);
        if (!existing.length || (ignoreId !== null && existing[0]?.id === ignoreId)) {
            return candidate;
        }

        attempt += 1;
        const suffix = String(attempt);
        const truncated = base.slice(0, EXTERNAL_KEY_MAX_LENGTH - suffix.length - 1).replace(/-+$/g, '');
        candidate = `${truncated}-${suffix}`;
    }
}

export async function resolveOrCreateExternalKey(db, table, column, {
    requestedKey,
    prefix,
    name,
    ignoreId = null,
}) {
    const proposed = requestedKey
        ? normalizeExternalKey(requestedKey)
        : buildDeterministicExternalKey(prefix, name);

    return ensureUniqueExternalKey(db, table, column, proposed, ignoreId);
}
