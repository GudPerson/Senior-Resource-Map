import { neon } from '@neondatabase/serverless';
import { NotificationError, NOTIFICATION_BATCH_SIZE, NOTIFICATION_PAGE_SIZE } from './notificationDomain.js';

// The same stable JSON is compared again at commit, preventing an opt-out or
// off/on consent change during a scan from generating a stale notification.
const PREFERENCES = `SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category,
    'enabled', enabled, 'deliveryAllowed', delivery_allowed, 'version', updated_at::text)
    ORDER BY category), '[]'::jsonb) FROM notification_preferences
    WHERE user_id = $1 AND channel = 'in_app' AND category IN ('general', 'calendar', 'resources')`;
const MASTER_ALLOWED = `NOT EXISTS (SELECT 1 FROM notification_preferences master
    WHERE master.user_id = $1 AND master.channel = 'in_app' AND master.category = 'general'
    AND (NOT master.enabled OR NOT master.delivery_allowed))`;
const NOTICE_ALLOWED = `${MASTER_ALLOWED} AND EXISTS (SELECT 1 FROM notification_preferences pref
    WHERE pref.user_id = $1 AND pref.channel = 'in_app' AND pref.enabled AND pref.delivery_allowed
    AND n.categories ? pref.category)`;
const NOTICE_JOIN = `FROM user_notifications n
    JOIN notification_resource_watches w ON w.id = n.watch_id
    JOIN user_favorites f ON f.id = w.favorite_id`;
const NOTICE_COLUMNS = `n.*, w.control_revision, w.muted, f.id AS favorite_id,
    f.resource_type, f.resource_id, f.user_id`;

export function createRuntimeNotificationRepository(env = {}) {
    const url = env.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
    if (!url) throw new NotificationError('Notifications are temporarily unavailable.', 503);
    const query = neon(url);
    return createNotificationRepository((text, params) => query(text, params));
}

export function createNotificationRepository(query) {
    const repository = {
        async preferences(userId) {
            const rows = await query(`SELECT (${PREFERENCES}) AS preferences`, [userId]);
            return rows[0].preferences;
        },
        async setPreference(userId, { category, enabled }) {
            // Idempotent retries do not reset the subscription baseline epoch.
            await query(`INSERT INTO notification_preferences
                (user_id, channel, category, enabled, delivery_allowed, updated_by_user_id)
                VALUES ($1, 'in_app', $2, $3, $3, $1)
                ON CONFLICT (user_id, channel, category) DO UPDATE SET enabled = EXCLUDED.enabled,
                    delivery_allowed = EXCLUDED.delivery_allowed, updated_by_user_id = EXCLUDED.updated_by_user_id,
                    updated_at = clock_timestamp()
                WHERE notification_preferences.enabled IS DISTINCT FROM EXCLUDED.enabled
                    OR notification_preferences.delivery_allowed IS DISTINCT FROM EXCLUDED.delivery_allowed`, [userId, category, enabled]);
            return repository.preferences(userId);
        },
        async enroll() {
            // Existing preference writes through Profile/governance are also
            // discovered; job creation is not dependent on a particular browser.
            return query(`INSERT INTO notification_resource_jobs (user_id)
                SELECT DISTINCT pref.user_id FROM notification_preferences pref
                WHERE pref.channel = 'in_app' AND pref.category IN ('calendar', 'resources')
                    AND pref.enabled AND pref.delivery_allowed
                    AND NOT EXISTS (SELECT 1 FROM notification_resource_jobs j WHERE j.user_id = pref.user_id)
                ORDER BY pref.user_id LIMIT 100 ON CONFLICT DO NOTHING RETURNING user_id`, []);
        },
        async claim() {
            const rows = await query(`WITH due AS (
                SELECT j.user_id FROM notification_resource_jobs j
                WHERE j.next_scan_at <= NOW() AND (j.lease_until IS NULL OR j.lease_until <= NOW())
                    AND EXISTS (SELECT 1 FROM notification_preferences pref WHERE pref.user_id = j.user_id
                        AND pref.channel = 'in_app' AND pref.category IN ('calendar', 'resources')
                        AND pref.enabled AND pref.delivery_allowed)
                    AND NOT EXISTS (SELECT 1 FROM notification_preferences master WHERE master.user_id = j.user_id
                        AND master.channel = 'in_app' AND master.category = 'general'
                        AND (NOT master.enabled OR NOT master.delivery_allowed))
                ORDER BY j.next_scan_at, j.user_id FOR UPDATE SKIP LOCKED LIMIT 1
            ) UPDATE notification_resource_jobs j SET lease_id = $1, lease_until = NOW() + INTERVAL '2 minutes',
                updated_at = NOW() FROM due WHERE j.user_id = due.user_id RETURNING j.*`, [crypto.randomUUID()]);
            return rows[0] || null;
        },
        async favorites(userId, cursor) {
            const rows = await query(`SELECT f.id, f.user_id, f.resource_type, f.resource_id,
                w.id AS watch_id, w.baseline, w.control_revision, COALESCE(w.muted, false) AS muted
                FROM user_favorites f LEFT JOIN notification_resource_watches w ON w.favorite_id = f.id
                WHERE f.user_id = $1 AND f.id > $2 AND f.resource_type IN ('hard', 'soft')
                ORDER BY f.id LIMIT $3`, [userId, cursor, NOTIFICATION_BATCH_SIZE + 1]);
            return rows.map((row) => ({ ...row, userId: row.user_id, resourceType: row.resource_type, resourceId: row.resource_id }));
        },
        async commitBatch(job, preferences, observations, { cursor, hasMore }) {
            if (observations.length > NOTIFICATION_BATCH_SIZE) throw new Error('Notification batch is too large.');
            const rows = await query(`WITH locked_job AS (
                SELECT user_id FROM notification_resource_jobs WHERE user_id = $1 AND lease_id = $2
                    AND favorite_cursor = $3 AND lease_until > NOW() AND (${PREFERENCES}) = $4::jsonb
                FOR UPDATE
            ), input AS (
                SELECT i.* FROM jsonb_to_recordset($5::jsonb) AS i(favorite_id integer, watch_id text,
                    control_revision integer, baseline jsonb, notification_id text, categories jsonb, changed_fields jsonb)
            ), accepted AS (
                SELECT i.*, COALESCE(w.muted, false) AS muted FROM input i
                JOIN user_favorites f ON f.id = i.favorite_id AND f.user_id = $1
                JOIN locked_job j ON j.user_id = f.user_id
                LEFT JOIN notification_resource_watches w ON w.favorite_id = f.id
                WHERE (w.id IS NULL AND i.control_revision = 0)
                    OR (w.id = i.watch_id AND w.control_revision = i.control_revision)
            ), watches AS (
                INSERT INTO notification_resource_watches (id, favorite_id, baseline, control_revision)
                SELECT watch_id, favorite_id, baseline, GREATEST(1, control_revision) FROM accepted
                ON CONFLICT (favorite_id) DO UPDATE SET baseline = EXCLUDED.baseline, updated_at = NOW()
                    WHERE notification_resource_watches.control_revision = EXCLUDED.control_revision
                RETURNING id, favorite_id
            ), notices AS (
                INSERT INTO user_notifications (id, watch_id, categories, changed_fields)
                SELECT a.notification_id, w.id, a.categories, a.changed_fields FROM accepted a
                JOIN watches w ON w.favorite_id = a.favorite_id
                WHERE NOT a.muted AND jsonb_array_length(a.categories) > 0
                ON CONFLICT (watch_id) DO UPDATE SET
                    categories = (SELECT jsonb_agg(DISTINCT value ORDER BY value)
                        FROM jsonb_array_elements(user_notifications.categories || EXCLUDED.categories)),
                    changed_fields = (SELECT jsonb_agg(DISTINCT value ORDER BY value)
                        FROM jsonb_array_elements(user_notifications.changed_fields || EXCLUDED.changed_fields)),
                    revision = user_notifications.revision + 1, dismissed_at = NULL, updated_at = NOW()
                RETURNING id
            ) UPDATE notification_resource_jobs j SET favorite_cursor = CASE WHEN $7 THEN $6::integer ELSE 0 END,
                next_scan_at = CASE WHEN $7 THEN NOW() ELSE NOW() + INTERVAL '5 minutes' END,
                lease_id = NULL, lease_until = NULL, updated_at = NOW()
                FROM locked_job g WHERE j.user_id = g.user_id
                RETURNING j.user_id, (SELECT count(*)::integer FROM watches) AS observed,
                    (SELECT count(*)::integer FROM notices) AS notified`,
            [job.user_id, job.lease_id, job.favorite_cursor, JSON.stringify(preferences), JSON.stringify(observations), cursor, hasMore]);
            return rows[0] || null;
        },
        async release(job) {
            await query(`UPDATE notification_resource_jobs SET lease_id = NULL, lease_until = NULL,
                next_scan_at = NOW() + INTERVAL '1 minute', updated_at = NOW()
                WHERE user_id = $1 AND lease_id = $2`, [job.user_id, job.lease_id]);
        },
        async list(userId, { before = null, beforeId = null } = {}) {
            return query(`SELECT ${NOTICE_COLUMNS} ${NOTICE_JOIN}
                WHERE f.user_id = $1 AND NOT w.muted AND n.dismissed_at IS NULL AND ${NOTICE_ALLOWED}
                    AND ($2::timestamptz IS NULL OR (n.updated_at, n.id) < ($2::timestamptz, $3::text))
                ORDER BY n.updated_at DESC, n.id DESC LIMIT $4`, [userId, before, beforeId, NOTIFICATION_PAGE_SIZE + 1]);
        },
        async unreadCount(userId) {
            const rows = await query(`SELECT count(*)::integer AS count ${NOTICE_JOIN}
                WHERE f.user_id = $1 AND NOT w.muted AND n.dismissed_at IS NULL
                    AND n.read_revision < n.revision AND ${NOTICE_ALLOWED}`, [userId]);
            return rows[0].count;
        },
        async setState(userId, id, { revision, action }) {
            const rows = await query(`UPDATE user_notifications n SET
                read_revision = CASE WHEN $4 = 'read' THEN n.revision WHEN $4 = 'unread' THEN 0 ELSE n.read_revision END,
                dismissed_at = CASE WHEN $4 = 'dismiss' THEN NOW() ELSE n.dismissed_at END
                FROM notification_resource_watches w JOIN user_favorites f ON f.id = w.favorite_id
                WHERE n.watch_id = w.id AND f.user_id = $1 AND n.id = $2 AND n.revision = $3 RETURNING n.id`,
            [userId, id, revision, action]);
            if (!rows[0]) {
                const owned = await query(`SELECT n.id ${NOTICE_JOIN} WHERE f.user_id = $1 AND n.id = $2`, [userId, id]);
                throw new NotificationError(owned[0] ? 'This update changed. Refresh before trying again.' : 'Update not found.', owned[0] ? 409 : 404);
            }
        },
        async setMute(userId, id, { revision, muted }) {
            const rows = await query(`UPDATE notification_resource_watches w SET muted = $4,
                control_revision = w.control_revision + CASE WHEN w.muted IS DISTINCT FROM $4 THEN 1 ELSE 0 END,
                updated_at = CASE WHEN w.muted IS DISTINCT FROM $4 THEN NOW() ELSE w.updated_at END
                FROM user_favorites f WHERE f.id = w.favorite_id AND f.user_id = $1 AND w.id = $2
                    AND w.control_revision = $3 RETURNING w.id, w.muted, w.control_revision`, [userId, id, revision, muted]);
            if (rows[0]) return rows[0];
            const owned = await query(`SELECT w.id, w.muted, w.control_revision FROM notification_resource_watches w
                JOIN user_favorites f ON f.id = w.favorite_id WHERE f.user_id = $1 AND w.id = $2`, [userId, id]);
            if (owned[0]?.muted === muted && owned[0].control_revision === revision + 1) return owned[0];
            throw new NotificationError(owned[0] ? 'This setting changed. Refresh before trying again.' : 'Update not found.', owned[0] ? 409 : 404);
        },
        async muted(userId, after = null) {
            return query(`SELECT w.id, w.control_revision, w.muted, f.id AS favorite_id,
                f.resource_type, f.resource_id, f.user_id FROM notification_resource_watches w
                JOIN user_favorites f ON f.id = w.favorite_id WHERE f.user_id = $1 AND w.muted
                    AND ($2::text IS NULL OR w.id > $2) ORDER BY w.id LIMIT $3`, [userId, after, NOTIFICATION_PAGE_SIZE + 1]);
        },
    };
    return repository;
}
