import { neon } from '@neondatabase/serverless';
import { NotificationError } from './notificationDomain.js';
import { SAVED_SEARCH_LIMIT } from './savedSearchDomain.js';

// Compare the exact master preference version at scan commit. Off/on changes
// require a fresh baseline, even if a worker never observed the disabled state.
const MASTER = `SELECT COALESCE((SELECT jsonb_build_object('enabled', enabled, 'allowed', delivery_allowed,
    'version', updated_at::text) FROM notification_preferences WHERE user_id = $1
    AND channel = 'in_app' AND category = 'general'), '{}'::jsonb)`;
const ALLOWED = `NOT EXISTS (SELECT 1 FROM notification_preferences p WHERE p.user_id = s.user_id
    AND p.channel = 'in_app' AND p.category = 'general' AND (NOT p.enabled OR NOT p.delivery_allowed))`;

export function createRuntimeSavedSearchRepository(env = {}) {
    const url = env.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
    if (!url) throw new NotificationError('Saved searches are temporarily unavailable.', 503);
    const query = neon(url);
    return createSavedSearchRepository((text, params) => query(text, params));
}

export function createSavedSearchRepository(query) {
    const repo = {
        async master(userId) {
            const [row] = await query(`SELECT (${MASTER}) AS preference`, [userId]);
            return row.preference;
        },
        async list(userId) {
            return query('SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2', [userId, SAVED_SEARCH_LIMIT]);
        },
        async owned(userId, id) {
            const [row] = await query('SELECT * FROM saved_searches WHERE user_id = $1 AND id = $2', [userId, id]);
            return row || null;
        },
        async create(userId, input) {
            const same = await repo.owned(userId, input.id);
            if (same && same.query === input.query && same.resource_type === input.type && same.enabled === input.enabled) return same;
            if (same) throw new NotificationError('This saved search has changed. Refresh before trying again.', 409);
            const [row] = await query(`WITH owner AS (SELECT id FROM users WHERE id = $1 FOR UPDATE), slot AS (
                SELECT number FROM generate_series(1, $6::integer) number JOIN owner ON true
                WHERE NOT EXISTS (SELECT 1 FROM saved_searches s WHERE s.user_id = $1 AND s.slot = number)
                ORDER BY number LIMIT 1
            ) INSERT INTO saved_searches (id, user_id, slot, query, resource_type, enabled)
                SELECT $2, $1, number, $3, $4, $5 FROM slot ON CONFLICT DO NOTHING RETURNING *`,
            [userId, input.id, input.query, input.type, input.enabled, SAVED_SEARCH_LIMIT]);
            if (row) return row;
            const retry = await repo.owned(userId, input.id);
            if (retry && retry.query === input.query && retry.resource_type === input.type && retry.enabled === input.enabled) return retry;
            throw new NotificationError('This search is already saved, or all 10 saved-search slots are used. Refresh and manage your searches.', 409);
        },
        async edit(userId, id, input) {
            // Editing or pausing invalidates outstanding workers and removes only
            // this subscription's match keys/digest. Resource saves are untouched.
            const [row] = await query(`WITH changed AS (
                UPDATE saved_searches SET query = $4, resource_type = $5, enabled = $6, revision = revision + 1,
                    baseline_ready = false, baseline_preference = NULL, scan_page = 1, scan_cursor = '{}', lease_id = NULL, lease_until = NULL,
                    next_scan_at = NOW(), updated_at = NOW(), last_checked_at = NULL
                WHERE user_id = $1 AND id = $2 AND revision = $3 RETURNING *
            ), removed_keys AS (DELETE FROM saved_search_matches WHERE search_id IN (SELECT id FROM changed)),
            removed_digest AS (DELETE FROM saved_search_digests WHERE search_id IN (SELECT id FROM changed))
            SELECT * FROM changed`, [userId, id, input.revision, input.query, input.type, input.enabled]).catch((error) => {
                if (error.code === '23505') throw new NotificationError('You already saved these search criteria.', 409);
                throw error;
            });
            if (row) return row;
            const owned = await repo.owned(userId, id);
            if (owned?.revision === input.revision + 1 && owned.query === input.query
                && owned.resource_type === input.type && owned.enabled === input.enabled) return owned;
            throw new NotificationError(owned ? 'This search changed. Refresh before editing.' : 'Saved search not found.', owned ? 409 : 404);
        },
        async remove(userId, id, revision) {
            const rows = await query('DELETE FROM saved_searches WHERE user_id = $1 AND id = $2 AND revision = $3 RETURNING id', [userId, id, revision]);
            if (rows.length) return;
            const owned = await repo.owned(userId, id);
            if (owned) throw new NotificationError('This search changed. Refresh before deleting.', 409);
            // Missing and other-owner IDs are indistinguishable, including retries.
        },
        async claim() {
            const [row] = await query(`WITH due AS (SELECT s.id FROM saved_searches s WHERE s.enabled AND ${ALLOWED}
                AND s.next_scan_at <= NOW() AND (s.lease_until IS NULL OR s.lease_until <= NOW())
                ORDER BY s.next_scan_at, s.id FOR UPDATE SKIP LOCKED LIMIT 1)
            UPDATE saved_searches s SET lease_id = $1, lease_until = NOW() + INTERVAL '2 minutes'
                FROM due WHERE s.id = due.id RETURNING s.*`, [crypto.randomUUID()]);
            return row || null;
        },
        async rebaseline(job, preference) {
            const [row] = await query(`WITH reset AS (UPDATE saved_searches s SET scan_page = 1, scan_cursor = '{}', baseline_ready = false,
                baseline_preference = $5::jsonb, last_checked_at = NULL
                WHERE s.user_id = $1 AND s.id = $2 AND s.lease_id = $3 AND s.revision = $4
                    AND s.lease_until > NOW() AND s.enabled AND ${ALLOWED} AND (${MASTER}) = $5::jsonb RETURNING s.*),
                removed_keys AS (DELETE FROM saved_search_matches WHERE search_id IN (SELECT id FROM reset)),
                removed_digest AS (DELETE FROM saved_search_digests WHERE search_id IN (SELECT id FROM reset))
                SELECT * FROM reset`, [job.user_id, job.id, job.lease_id, job.revision, JSON.stringify(preference)]);
            return row || null;
        },
        async commitPage(job, preference, keys, hasMore, cursor = {}) {
            if (keys.length > 100 || typeof hasMore !== 'boolean') throw new Error('Invalid search page.');
            const [row] = await query(`WITH locked AS (SELECT s.* FROM saved_searches s
                WHERE s.user_id = $1 AND s.id = $2 AND s.lease_id = $3 AND s.revision = $4 AND s.scan_page = $5
                    AND s.lease_until > NOW() AND s.enabled AND ${ALLOWED}
                    AND s.baseline_preference = $6::jsonb AND (${MASTER}) = $6::jsonb FOR UPDATE),
                new_keys AS (INSERT INTO saved_search_matches (search_id, match_key)
                    SELECT s.id, key FROM locked s CROSS JOIN jsonb_array_elements_text($7::jsonb) key
                    ON CONFLICT DO NOTHING RETURNING search_id),
                digest AS (INSERT INTO saved_search_digests (search_id, notice_id, search_revision, baseline_preference)
                    SELECT id, $10, revision, baseline_preference FROM locked WHERE baseline_ready AND EXISTS (SELECT 1 FROM new_keys)
                    ON CONFLICT (search_id) DO UPDATE SET revision = saved_search_digests.revision + 1,
                        notice_id = CASE WHEN saved_search_digests.search_revision = EXCLUDED.search_revision
                            AND saved_search_digests.baseline_preference = EXCLUDED.baseline_preference
                            THEN saved_search_digests.notice_id ELSE EXCLUDED.notice_id END,
                        search_revision = EXCLUDED.search_revision, baseline_preference = EXCLUDED.baseline_preference,
                        dismissed_at = NULL, updated_at = NOW() RETURNING search_id)
            UPDATE saved_searches s SET scan_page = CASE WHEN $8 THEN s.scan_page + 1 ELSE 1 END,
                scan_cursor = CASE WHEN $8 THEN $9::jsonb ELSE '{}'::jsonb END,
                baseline_ready = s.baseline_ready OR NOT $8,
                last_checked_at = CASE WHEN $8 THEN s.last_checked_at ELSE NOW() END,
                next_scan_at = CASE WHEN $8 THEN NOW() ELSE NOW() + INTERVAL '15 minutes' END,
                lease_id = NULL, lease_until = NULL FROM locked l WHERE s.id = l.id
                RETURNING s.id, (SELECT count(*)::integer FROM new_keys) AS observed,
                    (SELECT count(*)::integer FROM digest) AS notified`,
            [job.user_id, job.id, job.lease_id, job.revision, job.scan_page, JSON.stringify(preference), JSON.stringify(keys), hasMore, JSON.stringify(cursor), crypto.randomUUID()]);
            return row || null;
        },
        async release(job) {
            await query(`UPDATE saved_searches SET lease_id = NULL, lease_until = NULL, next_scan_at = NOW() + INTERVAL '1 minute'
                WHERE id = $1 AND user_id = $2 AND lease_id = $3`, [job.id, job.user_id, job.lease_id]);
        },
        async digests(userId) {
            return query(`SELECT s.*, d.notice_id, d.revision AS notice_revision, d.read_revision, d.updated_at AS notice_updated_at
                FROM saved_search_digests d JOIN saved_searches s ON s.id = d.search_id
                WHERE s.user_id = $1 AND s.enabled AND ${ALLOWED} AND d.dismissed_at IS NULL
                    AND d.search_revision = s.revision AND d.baseline_preference = s.baseline_preference
                    AND d.baseline_preference = (${MASTER})
                ORDER BY d.updated_at DESC, s.id DESC LIMIT $2`, [userId, SAVED_SEARCH_LIMIT]);
        },
        async unreadCount(userId) {
            const [row] = await query(`SELECT count(*)::integer AS count FROM saved_search_digests d
                JOIN saved_searches s ON s.id = d.search_id WHERE s.user_id = $1 AND s.enabled AND ${ALLOWED}
                    AND d.dismissed_at IS NULL AND d.read_revision < d.revision
                    AND d.search_revision = s.revision AND d.baseline_preference = s.baseline_preference
                    AND d.baseline_preference = (${MASTER})`, [userId]);
            return row.count;
        },
        async setState(userId, id, { revision, action, noticeId }) {
            const rows = await query(`UPDATE saved_search_digests d SET
                read_revision = CASE WHEN $4 = 'read' THEN d.revision WHEN $4 = 'unread' THEN 0 ELSE d.read_revision END,
                dismissed_at = CASE WHEN $4 = 'dismiss' THEN NOW() ELSE d.dismissed_at END
                FROM saved_searches s WHERE s.id = d.search_id AND s.user_id = $1 AND s.id = $2 AND d.revision = $3
                    AND d.search_revision = s.revision AND d.baseline_preference = s.baseline_preference
                    AND d.baseline_preference = (${MASTER}) AND d.notice_id = $5 RETURNING d.search_id`,
            [userId, id, revision, action, noticeId]);
            if (!rows.length) throw new NotificationError('This search update is unavailable or changed. Refresh before trying again.', 409);
        },
    };
    return repo;
}
