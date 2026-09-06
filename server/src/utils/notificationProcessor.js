import { getDb } from '../db/index.js';
import { hydrateRequestUserFromDb } from '../middleware/auth.js';
import { loadSavedAssetChangeSources } from './savedAssets.js';
import { createRuntimeNotificationRepository } from './notificationRepository.js';
import { NOTIFICATION_BATCH_SIZE, notificationSettings, observeSavedResource, requireNotificationOwner } from './notificationDomain.js';

export async function runResourceNotificationBatch(env = {}, dependencies = {}) {
    // No database connection or work is created while the rollout is disabled.
    if (env.SUPPORT_INBOX_ENABLED !== 'true') return { enabled: false, processed: 0, notified: 0, failed: 0 };
    const repository = dependencies.repository || createRuntimeNotificationRepository(env);
    const db = dependencies.db || getDb(env);
    const loadUser = dependencies.loadUser || ((id) => hydrateRequestUserFromDb({ id }, { db }));
    const loadSources = dependencies.loadSources || ((user, favorites) => loadSavedAssetChangeSources(db, user, favorites));
    const result = { enabled: true, processed: 0, notified: 0, failed: 0 };
    await repository.enroll();
    // Each tick performs at most two 25-item batches; all progress and retry
    // state live in PostgreSQL, never in an isolate or the user's browser.
    for (let index = 0; index < 2; index += 1) {
        const job = await repository.claim();
        if (!job) break;
        try {
            const user = await loadUser(job.user_id);
            requireNotificationOwner(user);
            const preferences = await repository.preferences(job.user_id);
            const settings = notificationSettings(preferences);
            const rows = await repository.favorites(job.user_id, job.favorite_cursor);
            const favorites = rows.slice(0, NOTIFICATION_BATCH_SIZE);
            const sources = new Map((await loadSources(user, favorites)).map((source) => [source.favoriteId, source]));
            const observations = await Promise.all(favorites.map((favorite) => observeSavedResource(favorite, sources.get(favorite.id), settings)));
            const committed = await repository.commitBatch(job, preferences, observations, {
                cursor: favorites.at(-1)?.id || job.favorite_cursor, hasMore: rows.length > NOTIFICATION_BATCH_SIZE,
            });
            if (!committed) throw new Error('Notification scan changed before commit.');
            result.processed += committed.observed;
            result.notified += committed.notified;
        } catch {
            // Do not log user/resource data or database error text. A retry
            // resumes the last committed cursor after a delay or lease expiry.
            result.failed += 1;
            await repository.release(job);
        }
    }
    return result;
}
