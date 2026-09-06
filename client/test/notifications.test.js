import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationApi } from '../src/lib/notifications.js';
import { mergeNotificationPages, notificationInboxPath } from '../src/features/support/notificationState.js';

test('notification API uses the private session origin and bounded explicit state writes', async () => {
    const calls = [];
    const api = createNotificationApi({ request: async (...args) => { calls.push(args); return {}; } });
    const id = crypto.randomUUID();
    await api.preferences(); await api.setPreference('calendar', true); await api.list(); await api.unread();
    await api.setState(id, 3, 'read'); await api.setMute(id, 1, true); await api.muted(id);
    assert.deepEqual(calls.map(([method]) => method), ['GET', 'PUT', 'GET', 'GET', 'PUT', 'PUT', 'GET']);
    assert.deepEqual(calls[4][2], { revision: 3, action: 'read' });
    assert.deepEqual(calls[5][2], { revision: 1, muted: true });
    for (const [, path, body, options] of calls) {
        assert.match(path, /^\/notifications(?:\/|$|\?)/);
        assert.equal(options.baseCandidates.length, 1);
        assert.equal(options.networkAttemptsPerBase, 1);
        assert.equal(body?.userId, undefined);
        assert.equal(options.headers?.['X-CareAround-Support-Key'], undefined);
    }
    assert.throws(() => api.setState('../calendar', 1, 'read'));
    assert.throws(() => api.setMute(`${id}?owner=2`, 1, true));
    assert.equal(calls[2][1], '/notifications', 'mounted Hono list route must not get an extra trailing slash');
});

test('notification pagination preserves the newer revision and deduplicates moving groups', () => {
    const rows = mergeNotificationPages([{ id: 'a', revision: 3 }, { id: 'b', revision: 1 }],
        [{ id: 'a', revision: 2 }, { id: 'b', revision: 2 }, { id: 'c', revision: 1 }]);
    assert.deepEqual(rows, [{ id: 'a', revision: 3 }, { id: 'b', revision: 2 }, { id: 'c', revision: 1 }]);
});

test('the unified inbox indicator opens updates when only product updates are unread', () => {
    assert.equal(notificationInboxPath(0, 0), '/help');
    assert.equal(notificationInboxPath(2, 0), '/help?tab=inbox');
    assert.equal(notificationInboxPath(0, 2), '/help?tab=inbox&view=updates');
    assert.equal(notificationInboxPath(2, 2), '/help?tab=inbox');
});
