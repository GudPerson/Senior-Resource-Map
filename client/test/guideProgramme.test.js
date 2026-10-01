import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupportApi } from '../src/lib/supportInbox.js';
import { guideHistoryInputs, buildGuideReportDraft } from '../src/features/support/guideHistoryState.js';
import { isProgrammeCreationRequest, programmeDraftFromApi, programmeDraftToApi, isUncertainProgrammeCreate } from '../src/features/support/guideProgrammeState.js';

test('Guide draft serializes canonical Singapore schedules without admitting extra action fields', () => {
    const initial = { name: 'Tuesday movement', bucket: 'Services', locationId: 23, visibility: 'hidden', description: 'Weekly exercise',
        ownerId: 99, privateNotes: 'must not cross', schedulePlan: { enabled: true, notes: 'Bring water', entries: [
            { key: 'first', type: 'weekly', startsAt: '2026-09-29T02:00:00.000Z', endsAt: '2026-09-29T03:00:00.000Z', weekdays: [2], repeatUntil: '2026-10-27T15:59:59.999Z', timezone: 'Asia/Singapore', status: 'active', note: '' },
        ] } };
    const form = programmeDraftFromApi(initial);
    assert.equal(form.schedulePlan.entries[0].startsAt, '2026-09-29T10:00');
    assert.equal(form.schedulePlan.entries[0].endsAt, '2026-09-29T11:00');
    const payload = programmeDraftToApi(form);
    assert.equal(payload.schedulePlan.entries[0].startsAt, initial.schedulePlan.entries[0].startsAt);
    assert.equal(payload.schedulePlan.entries[0].repeatUntil, initial.schedulePlan.entries[0].repeatUntil);
    assert.deepEqual(payload.schedulePlan.entries[0].weekdays, [2]);
    assert.equal('ownerId' in payload, false);
    assert.equal('privateNotes' in payload, false);
    assert.equal('revision' in payload.schedulePlan, false);
    assert.equal(payload.bucket, 'Services');
    assert.equal(programmeDraftToApi({}).bucket, 'Programmes');
    assert.equal(programmeDraftFromApi({ visibility: 'private' }).visibility, 'hidden');
});

test('creation intent is narrow and does not mistake resource search for a write', () => {
    assert.equal(isProgrammeCreationRequest('Create a weekly exercise programme'), true);
    assert.equal(isProgrammeCreationRequest('Set up a new service at my centre'), true);
    assert.equal(isProgrammeCreationRequest('Can you create a programme for me?'), true);
    assert.equal(isProgrammeCreationRequest('I want to create a service'), true);
    for (const question of ['Find programmes near Havelock', 'How do I save a resource?', 'Create a map', 'Delete this programme',
        'Can I create a programme?', 'Am I allowed to create a service?', 'How can I create a service?',
        'Create a service without a Place', 'Please create a standalone programme',
        'Create one service at several Places', 'Create a programme at two centres']) {
        assert.equal(isProgrammeCreationRequest(question), false);
    }
});

test('uncertain saves retain their reviewed intent while definite validation denial permits editing', () => {
    for (const status of [undefined, 408, 409, 429, 500, 503]) assert.equal(isUncertainProgrammeCreate({ status }), true);
    for (const status of [400, 401, 403, 404, 422]) assert.equal(isUncertainProgrammeCreate({ status }), false);
    assert.equal(isUncertainProgrammeCreate({ status: 409, code: 'GUIDE_REVIEW_REQUIRED' }), false);
    assert.equal(isUncertainProgrammeCreate({ status: 409, code: 'GUIDE_ACTION_CONFLICT' }), false);
});

test('Guide action API uses the session origin and carries the identical review on retry', async () => {
    const calls = [];
    const api = createSupportApi({ request: async (...args) => { calls.push(args); return {}; } });
    const controller = new AbortController();
    await api.guideProgrammePlaces('Centre & Gardens', controller.signal);
    await api.guideProgrammeDraft({ message: 'Create a programme' });
    const intent = { requestId: crypto.randomUUID(), draft: { name: 'Weekly exercise', locationId: 23, visibility: 'hidden' } };
    await api.guideProgrammeReview(intent);
    const reviewed = { ...intent, reviewToken: 'signed-token' };
    await api.guideProgrammeCreate(reviewed);
    await api.guideProgrammeCreate(reviewed);
    assert.deepEqual(calls.map(([method]) => method), ['GET', 'POST', 'POST', 'POST', 'POST']);
    assert.equal(calls[0][1], '/guide/actions/programmes/places?q=Centre+%26+Gardens');
    assert.equal(calls[0][3].signal, controller.signal);
    assert.deepEqual(calls[3][2], calls[4][2]);
    for (const [, path, , options] of calls) {
        assert.match(path, /^\/guide\/actions\/programmes\//);
        assert.equal(options.baseCandidates.length, 1);
        assert.equal(options.networkAttemptsPerBase, 1);
    }
});

test('programme action content is excluded from optional help history and report handoffs', () => {
    const action = { question: 'Create my programme with these details', input: null, draft: { name: 'Centre session' }, message: 'Draft ready' };
    assert.deepEqual(guideHistoryInputs([action]), []);
    assert.equal(buildGuideReportDraft(action), null);
});
