import app from './app.js';
import { runResourceNotificationBatch } from './utils/notificationProcessor.js';
import { runSavedSearchBatch } from './utils/savedSearchProcessor.js';
import { getDb } from './db/index.js';
import { archiveDueGovernedMaps } from './utils/governedMaps.js';
import { isGovernedMapLifecycleEnabled } from './utils/governedPilotRelease.js';

export async function runGovernedMapArchiveSweep(env) {
    if (!isGovernedMapLifecycleEnabled(env)) return { enabled: false, scanned: 0, archived: 0, failed: 0 };
    const databaseUrl = env?.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
    if (!databaseUrl) return { enabled: false, scanned: 0, archived: 0, failed: 0 };
    return { enabled: true, ...await archiveDueGovernedMaps(getDb(env)) };
}

export default {
    fetch(request, env, ctx) { return app.fetch(request, env, ctx); },
    async scheduled(_controller, env) {
        const results = await Promise.allSettled([
            runResourceNotificationBatch(env),
            runSavedSearchBatch(env),
            runGovernedMapArchiveSweep(env),
        ]);
        const failedBatches = results.reduce((sum, result) => sum + (result.status === 'fulfilled' ? result.value.failed : 1), 0);
        if (failedBatches) {
            console.error(JSON.stringify({ event: 'notification_scan_retry', failedBatches }));
            throw new Error('Notification scan will retry from persisted progress.');
        }
    },
};
