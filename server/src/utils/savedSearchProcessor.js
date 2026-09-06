import { createGuideResourceLoader } from '../routes/guide.js';
import { hydrateRequestUserFromDb } from '../middleware/auth.js';
import { getDb } from '../db/index.js';
import { requireNotificationOwner } from './notificationDomain.js';
import { createRuntimeSavedSearchRepository } from './savedSearchRepository.js';
import { SAVED_SEARCH_PAGE_SIZE, savedSearchMatchKeys } from './savedSearchDomain.js';

const samePreference = (a, b) => a !== null && a.enabled === b.enabled && a.allowed === b.allowed && a.version === b.version;

export async function runSavedSearchBatch(env = {}, dependencies = {}) {
    if (env.SUPPORT_INBOX_ENABLED !== 'true') return { enabled: false, processed: 0, notified: 0, failed: 0 };
    const repository = dependencies.repository || createRuntimeSavedSearchRepository(env);
    const search = dependencies.search || createGuideResourceLoader({ pageSize: SAVED_SEARCH_PAGE_SIZE, keyset: true });
    const loadUser = dependencies.loadUser || ((id) => hydrateRequestUserFromDb({ id }, { db: getDb(env) }));
    const result = { enabled: true, processed: 0, notified: 0, failed: 0 };
    for (let index = 0; index < 2; index += 1) {
        let job = await repository.claim();
        if (!job) break;
        try {
            requireNotificationOwner(await loadUser(job.user_id));
            const preference = await repository.master(job.user_id);
            if (!samePreference(job.baseline_preference, preference)) {
                const reset = await repository.rebaseline(job, preference);
                if (!reset) throw new Error('Search consent changed.');
                job = reset;
            }
            const page = await search({ query: job.query, type: job.resource_type, page: job.scan_page, cursor: job.scan_cursor }, env);
            if (page.scope !== 'public' || page.page !== job.scan_page || typeof page.hasMore !== 'boolean') throw new Error('Invalid search response.');
            const keys = await savedSearchMatchKeys(page.results, [job.revision, preference.enabled ?? null, preference.allowed ?? null, preference.version ?? null]);
            const committed = await repository.commitPage(job, preference, keys, page.hasMore, page.nextCursor);
            if (!committed) throw new Error('Search changed before commit.');
            result.processed += 1;
            result.notified += committed.notified;
        } catch {
            result.failed += 1;
            await repository.release(job);
        }
    }
    return result;
}
