import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuideAuditActivityLoader, guideAuditActivityIntent, guideAuditActivityRange, answerGuideAuditActivity } from '../src/utils/guideAuditActivity.js';
import { createGuideRoutes } from '../src/routes/guide.js';
import { safeGuideChatTurns } from '../src/utils/guideChat.js';
import { createNeonPostgresFixture } from './fixtures/neonPostgresFixture.mjs';

const now = () => new Date('2026-09-30T17:30:00.000Z'); // 1 October, 1:30 AM Singapore.
const actor = { id: 1, role: 'standard' };
const intent = guideAuditActivityIntent('Show resource updates yesterday');
const entry = { actionType: 'resource_updated', resourceType: 'soft', organizationId: 50,
    actor: { id: 2, name: 'Permitted Editor', email: 'private@example.test', role: 'standard' },
    resource: { id: 91, name: 'Permitted Programme' }, target: { name: 'Private Target' },
    organization: { name: 'Private Organisation' }, metadata: { privateValue: 'private-audit-value' },
    createdAt: '2026-09-30T12:00:00.000Z' };
const payload = (logs = [entry]) => ({ scope: 'organizations', organizationIds: [50], logs, limit: 5, nextCursor: null });

test('Audit summary intent preserves exact listing and date constraints instead of widening them', () => {
    assert.deepEqual(intent, { resourceType: null, period: 'yesterday', canSummarize: true, needsTypeFilter: false });
    for (const question of ['Who edited Places yesterday?', 'Show recent resource updates',
        'List Place changes today', 'Show resource edits in the last 7 days'])
        assert.equal(guideAuditActivityIntent(question)?.canSummarize, true, question);
    assert.equal(guideAuditActivityIntent('Show Programme edits yesterday').needsTypeFilter, true);
    assert.equal(guideAuditActivityIntent('Show Programme edits yesterday').canSummarize, false);
    for (const question of ['Who edited my Programme yesterday?', 'Who updated this Place?',
        'Who changed Havelock Programme yesterday?', 'Show Programme edits last month',
        'Show resource edits by Jane yesterday', 'Show Place and Programme changes today'])
        assert.equal(guideAuditActivityIntent(question)?.canSummarize, false, question);
    for (const question of ['How do I edit a Programme?', 'Who saved my Programme?',
        'Can I open Audit Trail?', 'Show Programme permission changes today'])
        assert.equal(guideAuditActivityIntent(question), null, question);
});

test('Audit date boundaries use Singapore midnight and include the whole of yesterday', () => {
    assert.deepEqual(guideAuditActivityRange('yesterday', now()), {
        from: '2026-09-29T16:00:00.000Z', to: '2026-09-30T15:59:59.999Z',
    });
    assert.deepEqual(guideAuditActivityRange('today', now()), {
        from: '2026-09-30T16:00:00.000Z', to: '2026-09-30T17:30:00.000Z',
    });
    assert.deepEqual(guideAuditActivityRange('recent', now()), {
        from: '2026-09-23T17:30:00.000Z', to: '2026-09-30T17:30:00.000Z',
    });
    assert.throws(() => guideAuditActivityRange('last month', now()));
});

test('Audit adapter forwards only the current actor and fixed filters, then projects permitted display fields', async () => {
    const loader = createGuideAuditActivityLoader({ now, audit: (c) => {
        assert.equal(c.get('user'), actor);
        assert.deepEqual({ ...c.req.query() }, { limit: '5', actionType: 'resource_updated',
            from: '2026-09-29T16:00:00.000Z', to: '2026-09-30T15:59:59.999Z' });
        return c.json(payload());
    } });
    const activity = await loader(actor, {}, intent);
    assert.deepEqual(activity.entries, [{ editor: 'Permitted Editor', resource: 'Permitted Programme', createdAt: entry.createdAt }]);
    assert.doesNotMatch(JSON.stringify(activity), /private@example|Private Target|Private Organisation|private-audit-value|organizationId|resourceId|actorUserId/);
    const answer = answerGuideAuditActivity({ actor, intent, activity });
    assert.equal(answer.answerSource, 'account');
    assert.match(answer.message, /active organisation-admin scope.*Permitted Editor — Permitted Programme — 30 Sept 2026, 8:00 pm/s);
    assert.match(answer.message, /does not prove that no other changes occurred/);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Show resource updates yesterday', answer: answer.message }]), []);
    const fallback = await createGuideAuditActivityLoader({ now, audit: (c) => c.json(payload([
        { ...entry, actor: { name: 'private@example.test' }, resource: { name: 'Resource 91' } },
    ])) })(actor, {}, intent);
    assert.equal(fallback.entries[0].editor, 'Recorded editor');
    assert.equal(fallback.entries[0].resource, 'Recorded resource');
});

test('Audit adapter fails closed on a widened scope, date, action or resource type', async () => {
    for (const data of [
        { ...payload(), scope: 'all' },
        { ...payload(), organizationIds: [] },
        payload([{ ...entry, organizationId: 51 }]),
        payload([{ ...entry, createdAt: '2026-09-30T16:00:00.000Z' }]),
        payload([{ ...entry, actionType: 'resource_deleted' }]),
        payload([{ ...entry, resourceType: 'personal' }]),
        payload(Array(6).fill(entry)),
    ]) {
        await assert.rejects(createGuideAuditActivityLoader({ now, audit: (c) => c.json(data) })(actor, {}, intent));
    }
});

test('Exact listing handoff checks live access without loading events', async () => {
    let reads = 0;
    const exact = guideAuditActivityIntent('Who edited my Programme yesterday?');
    const loader = createGuideAuditActivityLoader({ access: async () => ({ mode: 'organizations', organizationIds: [50] }),
        audit: () => { reads++; throw new Error('Must not read an unselected listing.'); } });
    const activity = await loader(actor, {}, exact);
    assert.equal(reads, 0);
    assert.match(answerGuideAuditActivity({ actor, intent: exact, activity }).message, /cannot match an exact listing or custom date/);
    const denied = await createGuideAuditActivityLoader({ access: async () => ({ mode: 'none', organizationIds: [] }) })(actor, {}, exact);
    assert.match(answerGuideAuditActivity({ actor, intent: exact, activity: denied }).message, /not currently available/);
    const programmeOnly = guideAuditActivityIntent('Show Programme edits yesterday');
    const typeBoundary = await loader(actor, {}, programmeOnly);
    assert.match(answerGuideAuditActivity({ actor, intent: programmeOnly, activity: typeBoundary }).message, /same resource type.*Resource Groups.*No update records were loaded/s);
    assert.equal(reads, 0);
    assert.deepEqual(safeGuideChatTurns([{ question: 'Can you show me who changed my Place listing yesterday?',
        answer: 'Private editor and resource names' }]), []);
});

test('Actual Audit Trail SQL keeps organisations separate, caps records and rechecks revocation', async (t) => {
    const { pg, env, statements } = await createNeonPostgresFixture(t);
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'a', 'a@example.test', 'fixture', 'Organisation A Editor', 'standard'),
        (2, 'b', 'b@example.test', 'fixture', 'Organisation B Editor', 'standard'),
        (3, 'sa', 'sa@example.test', 'fixture', 'Fixture Super Admin', 'super_admin');
        INSERT INTO partner_organizations (id, name) VALUES (50, 'Org A'), (51, 'Org B');
        INSERT INTO organization_access_memberships (organization_id, user_id, access_role) VALUES (50, 1, 'admin'), (51, 2, 'admin');
        INSERT INTO soft_assets (id, name, bucket) VALUES (91, 'Organisation A Programme', 'programmes'), (92, 'Organisation B Programme', 'programmes');
        INSERT INTO sensitive_audit_logs (actor_user_id, action_type, resource_type, resource_id, organization_id, metadata, created_at)
        SELECT 1, 'resource_updated', 'soft', 91, 50, '{"privateValue":"not-for-chat"}', '2026-09-30 12:00:00'::timestamp - (n * INTERVAL '1 minute') FROM generate_series(1, 6) n;
        INSERT INTO sensitive_audit_logs (actor_user_id, action_type, resource_type, resource_id, organization_id, created_at) VALUES
        (2, 'resource_updated', 'soft', 92, 51, '2026-09-30 12:00:00'),
        (1, 'resource_deleted', 'soft', 91, 50, '2026-09-30 13:00:00'),
        (1, 'resource_updated', 'soft', 91, 50, '2026-09-30 16:00:00');`);
    const loader = createGuideAuditActivityLoader({ now });
    const first = await loader(actor, env, intent);
    assert.equal(first.entries.length, 5);
    assert.equal(first.hasMore, true);
    assert.ok(first.entries.every((row) => row.resource === 'Organisation A Programme'));
    assert.doesNotMatch(JSON.stringify(first), /Organisation B|not-for-chat|example.test/);
    assert.match(answerGuideAuditActivity({ actor, intent, activity: first }).message, /latest five matching records/);
    const other = await loader({ id: 2, role: 'standard' }, env, intent);
    assert.deepEqual(other.entries.map((row) => row.resource), ['Organisation B Programme']);
    const global = await loader({ id: 3, role: 'super_admin' }, env, intent);
    assert.equal(global.scope, 'all');
    assert.ok(global.entries.some((row) => row.resource === 'Organisation B Programme'));
    const empty = await loader({ id: 2, role: 'standard' }, env,
        guideAuditActivityIntent('Show Place edits yesterday'));
    assert.deepEqual(empty.entries, []);
    assert.match(answerGuideAuditActivity({ actor, intent, activity: empty }).message, /no recorded.*does not prove/s);
    await pg.exec('UPDATE organization_access_memberships SET revoked_at = NOW() WHERE user_id = 1;');
    const before = statements.length;
    const denied = await loader(actor, env, intent);
    assert.deepEqual(denied, { scope: 'none' });
    assert.equal(statements.slice(before).some((sql) => /\bFROM\s+"?sensitive_audit_logs"?/i.test(sql)), false);
});

test('Guide audit answers bypass the model, guard guests and User View, and do not invent editors on errors', async () => {
    let loads = 0;
    let modelCalls = 0;
    const env = { SUPPORT_INBOX_ENABLED: 'true', GUIDE_CHAT_ENABLED: 'true', AI: { run: () => { modelCalls++; throw new Error('Must not call AI.'); } } };
    const router = (user, activity) => createGuideRoutes({
        authenticate: async (c, next) => { c.set('user', user); await next(); },
        auditActivity: async (currentActor) => { loads++; assert.equal(currentActor, user); return activity; },
    });
    let requestId = 0;
    const post = (app, extra = {}) => app.request('/answer', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'cf-connecting-ip': `203.0.113.${++requestId}` },
        body: JSON.stringify({ question: 'Show resource updates yesterday', useAi: true, ...extra }) }, env);
    const activity = { scope: 'organizations', entries: [{ editor: 'Permitted Editor', resource: 'Permitted Programme', createdAt: entry.createdAt }], hasMore: false };
    const success = await post(router(actor, activity));
    assert.equal(success.headers.get('Cache-Control'), 'no-store');
    const body = await success.json();
    assert.equal(body.topicId, 'audit-activity');
    assert.equal(body.answerSource, 'account');
    assert.match(body.message, /Permitted Programme/);
    for (const [user, phrase] of [[null, /Sign in/], [{ ...actor, isImpersonating: true }, /Exit User View/]]) {
        const result = await (await post(router(user, activity))).json();
        assert.match(result.message, phrase);
        assert.doesNotMatch(result.message, /Permitted Programme/);
    }
    assert.equal(loads, 1);
    assert.equal(modelCalls, 0);
    assert.equal((await post(router(actor, activity), { resourceId: 92 })).status, 400);
    const failing = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
        auditActivity: async () => { throw new Error('Private failure detail'); } });
    const failed = await post(failing);
    assert.equal(failed.status, 503);
    assert.match((await failed.json()).error, /No editor has been inferred/);
});
