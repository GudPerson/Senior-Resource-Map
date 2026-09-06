import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReviewSupportInbox, createSupportApi, isGuestSupportKey, isSupportImpersonating, newGuestSupportKey, readGuestSupportKey, rememberGuestSupportKey, safeGuideActionRoute } from '../src/lib/supportInbox.js';
import { buildGuideReportDraft, guideHistoryInputs } from '../src/features/support/guideHistoryState.js';
import { restoreSupportFocus } from '../src/features/support/supportFocus.js';

test('response focus recovers from a removed control but never steals focus from another task', () => {
    const origin = {};
    const body = {};
    let focusCount = 0;
    const destination = { focus: () => { focusCount++; } };
    assert.equal(restoreSupportFocus(destination, origin, { activeElement: origin, body }), true);
    assert.equal(restoreSupportFocus(destination, origin, { activeElement: body, body }), true);
    assert.equal(restoreSupportFocus(destination, origin, { activeElement: {}, body }), false);
    assert.equal(restoreSupportFocus(null, origin, { activeElement: body, body }), false);
    assert.equal(restoreSupportFocus(destination, null, { activeElement: body, body }), false);
    assert.equal(focusCount, 2);
});

test('report preview and edit have explicit focus destinations without initial form autofocus', () => {
    const source = readFileSync(new URL('../src/features/support/SupportReportComposer.jsx', import.meta.url), 'utf8');
    assert.match(source, /if \(preview\) heading\.current\?\.focus\(\)/);
    assert.match(source, /else if \(previousPreview\.current\) titleInput\.current\?\.focus\(\)/);
    assert.match(source, /id="report-heading" ref=\{heading\} tabIndex=\{-1\}/);
    assert.match(source, /role="alert" ref=\{errorMessage\} tabIndex=\{-1\}/);
});

test('conversation focus is gated and back navigation restores the selected report', () => {
    const source = readFileSync(new URL('../src/features/support/SupportInbox.jsx', import.meta.url), 'utf8');
    assert.match(source, /if \(detail && focusHeading\.current && heading\.current\)/);
    assert.match(source, /focusHeading\.current = false/);
    assert.match(source, /reportButtons\.current\.get\(returnToReport\.current\) \|\| heading\.current/);
    assert.match(source, /returnToReport\.current = selected; setSelected\(null\)/);
    assert.match(source, /id="support-conversation-title" ref=\{heading\} tabIndex=\{-1\}/);
});

test('fix decisions and guest view transitions retain focus without accepting stale proposal reads', () => {
    const review = readFileSync(new URL('../src/features/support/SupportFixReview.jsx', import.meta.url), 'utf8');
    const hub = readFileSync(new URL('../src/pages/SupportHubPage.jsx', import.meta.url), 'utf8');
    assert.match(review, /if \(!controller\.signal\.aborted\) setProposal\(result\)/);
    assert.match(review, /if \(proposal && focusProposal\.current && proposalHeading\.current\)/);
    assert.match(review, /role="alert" ref=\{errorMessage\} tabIndex=\{-1\}/);
    assert.match(hub, /heading\.current\?\.focus\(\); \}, \[tab, guestKey, showUpdates\]/);
    assert.match(hub, /key=\{`\$\{user\?\.id \|\| 'guest'\}:\$\{user\?\.role \|\| ''\}:\$\{supportImpersonating\}`\}/);
});

test('support client keeps review controls role-specific and only accepts safe Guide routes', () => {
    assert.equal(canReviewSupportInbox({ id: 1, role: 'super_admin' }), true);
    assert.equal(isSupportImpersonating({ id: 1, isImpersonating: true }, false), true);
    assert.equal(isSupportImpersonating({ id: 1 }, true), true);
    assert.equal(isSupportImpersonating({ id: 1 }, false), false);
    for (const user of [null, { id: 1, role: 'regional_admin' }, { id: 1, role: 'super_admin', isImpersonating: true }]) assert.equal(canReviewSupportInbox(user), false);
    assert.equal(safeGuideActionRoute('/my-directory'), null);
    assert.equal(safeGuideActionRoute('/my-directory', true), '/my-directory');
    assert.equal(safeGuideActionRoute('/resource/soft/23'), '/resource/soft/23');
    for (const path of ['https://evil.example', '//evil.example', '/dashboard/admin', '/resource/soft/23?private=secret', '/resource/hard/-2']) assert.equal(safeGuideActionRoute(path, true), null);
});

test('guest recovery is random, optional, session-scoped, and can be forgotten', () => {
    const key = newGuestSupportKey();
    assert.equal(isGuestSupportKey(key), true);
    assert.notEqual(key, newGuestSupportKey());
    const values = new Map();
    const storage = { setItem: (name, value) => values.set(name, value), getItem: (name) => values.get(name), removeItem: (name) => values.delete(name) };
    rememberGuestSupportKey(key, storage);
    assert.equal(readGuestSupportKey(storage), key);
    rememberGuestSupportKey('', storage);
    assert.equal(readGuestSupportKey(storage), '');
    assert.equal(rememberGuestSupportKey(key, { setItem() { throw new Error('Blocked'); } }), false);
});

test('private support API never falls back across origins or puts recovery codes in URLs', async () => {
    const calls = [];
    const key = newGuestSupportKey();
    const api = createSupportApi({ guestKey: key, request: async (...args) => { calls.push(args); return {}; } });
    const id = crypto.randomUUID();
    await api.detail(id);
    await api.reply(id, { body: 'Test', revision: 2, requestId: crypto.randomUUID() });
    for (const [method, path, body, options] of calls) {
        assert.ok(['GET', 'POST'].includes(method));
        assert.match(path, /^\/support\/guest\/reports\//);
        assert.equal(path.includes(key), false);
        assert.equal(JSON.stringify(body)?.includes(key) || false, false);
        assert.equal(options.headers['X-CareAround-Support-Key'], key);
        assert.equal(options.baseCandidates.length, 1);
    }
});

test('Guide history and report handoff copy only explicitly selected questions', async () => {
    const message = { question: 'How do I save?', input: { question: 'How do I save?' },
        resources: [{ name: 'Old private listing' }], message: 'An earlier answer', privateContext: 'secret' };
    const inputs = guideHistoryInputs([message, { question: 'Private question', input: null }, { input: { topicId: 'calendar' } }]);
    assert.deepEqual(inputs, [{ question: 'How do I save?' }, { topicId: 'calendar' }]);
    assert.equal(guideHistoryInputs(Array(30).fill(message)).length, 20);
    const draft = buildGuideReportDraft(message);
    assert.match(draft.description, /How do I save/);
    assert.doesNotMatch(JSON.stringify(draft), /Old private|secret|earlier answer/);
    assert.equal(buildGuideReportDraft({ question: 'password=private', input: null }), null);
    const calls = [];
    const api = createSupportApi({ request: async (...args) => { calls.push(args); return {}; } });
    const id = crypto.randomUUID();
    await api.guideHistory(); await api.guideConversation(id);
    await api.saveGuideConversation({ id, inputs, consent: true }); await api.deleteGuideConversation(id, 1);
    assert.deepEqual(calls.map(([method]) => method), ['GET', 'GET', 'POST', 'DELETE']);
    for (const [, path, , options] of calls) { assert.match(path, /^\/guide\/history/); assert.equal(options.baseCandidates.length, 1); }
});
