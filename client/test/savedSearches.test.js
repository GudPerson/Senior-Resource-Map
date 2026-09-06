import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedSearchApi } from '../src/lib/savedSearches.js';

test('saved-search API stays owner/session scoped and keeps private criteria out of URLs', async () => {
    const calls = [], id = crypto.randomUUID();
    const api = createSavedSearchApi({ request: async (...args) => { calls.push(args); return {}; } });
    const input = { id, query: 'public keywords', type: 'all', enabled: true, reviewed: true };
    await api.list(); await api.unread(); await api.create(input); await api.edit(id, { ...input, id: undefined, revision: 1 });
    await api.remove(id, 2); await api.setState(id, id, 1, 'read'); await api.results(id, 2);
    assert.equal(calls[0][1], '/saved-searches');
    assert.deepEqual(calls[4].slice(0, 3), ['DELETE', `/saved-searches/${id}`, { revision: 2 }]);
    assert.equal(calls[6][1], `/saved-searches/${id}/results?page=2`);
    assert.deepEqual(calls[5][2], { noticeId: id, revision: 1, action: 'read' });
    for (const [, path, body, options] of calls) {
        assert.doesNotMatch(path, /public|keywords/);
        assert.equal(options.baseCandidates.length, 1);
        assert.equal(options.networkAttemptsPerBase, 1);
        assert.equal(options.headers?.['X-CareAround-Support-Key'], undefined);
        assert.equal(body?.userId, undefined);
    }
    assert.throws(() => api.edit('../other', input));
    assert.throws(() => api.results(id, 0));
    assert.throws(() => api.results(id, '1&scope=managed'));
});
