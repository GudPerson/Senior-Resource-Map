import app from './app.js';
import { runResourceNotificationBatch } from './utils/notificationProcessor.js';
import { runSavedSearchBatch } from './utils/savedSearchProcessor.js';

export default {
    fetch(request, env, ctx) { return app.fetch(request, env, ctx); },
    async scheduled(_controller, env) {
        const results = await Promise.allSettled([runResourceNotificationBatch(env), runSavedSearchBatch(env)]);
        const failedBatches = results.reduce((sum, result) => sum + (result.status === 'fulfilled' ? result.value.failed : 1), 0);
        if (failedBatches) {
            console.error(JSON.stringify({ event: 'notification_scan_retry', failedBatches }));
            throw new Error('Notification scan will retry from persisted progress.');
        }
    },
};
