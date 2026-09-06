import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { Hono } from 'hono';
import { createSupportRepository } from '../src/utils/supportRepository.js';
import { createSupportService, resolveSupportPrincipal } from '../src/utils/supportService.js';
import { createSupportRoutes } from '../src/routes/support.js';
import {
    canReviewSupport, createSupportGuestCredential, sanitizeSupportContext,
    sanitizeSupportText, validateReleaseEvidence,
} from '../src/utils/supportDomain.js';
import { verifySupportProductionRelease } from '../src/utils/supportReleaseVerification.js';
import { createReleaseFixture } from './fixtures/releaseFixture.mjs';

const member = { id: 1, role: 'standard' };
const other = { id: 2, role: 'standard' };
const admin = { id: 3, role: 'super_admin' };
const sourceRevision = 'a'.repeat(40);
const productionTest = { testedInProduction: true, productionCheck: 'Manually checked the reported map behaviour on production at zoom 15.' };
const reportInput = () => ({
    id: crypto.randomUUID(), title: 'Detailed map looks wrong',
    description: 'Zooming to 15 shows the wrong background.', expected: 'Detailed block numbers.',
    context: { pathname: '/discover?postal=160026', appVersion: '13f50a6c9' },
});
const proposalInput = (revision, overrides = {}) => ({
    id: crypto.randomUUID(), revision, sourceRevision, target: 'client',
    summary: 'Restore the correct Detailed map layer.',
    testEvidence: 'Map tier tests pass. Preview checked at zoom levels 14 and 15.', ...overrides,
});

test('support domain keeps private context and review permissions bounded', async () => {
    assert.equal(canReviewSupport(admin), true);
    for (const user of [member, other, { id: 4, role: 'regional_admin' }, { ...admin, isImpersonating: true }, {}]) {
        assert.equal(canReviewSupport(user), false);
    }
    assert.deepEqual(sanitizeSupportContext({
        pathname: '/shared/maps/private-secret?postal=160026',
        appVersion: 'oops', requestId: 'valid-request-123',
        privateNote: 'should not persist',
    }), { pathname: '/shared/maps', appVersion: '', requestId: 'valid-request-123' });
    const text = sanitizeSupportText('password=sensitive-value email@example.test S1234567D https://app.carearound.sg/shared/maps/secret');
    assert.doesNotMatch(text, /sensitive-value|email@example|S1234567D|https:/);
    assert.doesNotMatch(sanitizeSupportText('Report /shared/maps/private-token?view=1 challengeVerifier=sensitive-proof +6581234567'), /private-token|sensitive-proof|81234567/);
    await assert.rejects(resolveSupportPrincipal({ ...member, isImpersonating: true }), { status: 403 });
    await assert.rejects(resolveSupportPrincipal({}, 'wrong-key'), { status: 401 });
});

test('support release verification only accepts observed evidence for the approved revision', async () => {
    const proposal = { target: 'both', source_revision: sourceRevision, approved_by_user_id: 3, approved_at: new Date() };
    const observation = { sourceRevision, healthy: true, checkedAt: new Date().toISOString() };
    assert.throws(() => validateReleaseEvidence(proposal, { client: observation }), { status: 409 });
    assert.throws(() => validateReleaseEvidence({ ...proposal, approved_at: null }, { client: observation, server: observation }), { status: 409 });
    assert.equal(validateReleaseEvidence(proposal, { client: observation, server: observation }).client.sourceRevision, sourceRevision);
    const fixture = await createReleaseFixture();
    const evidence = await verifySupportProductionRelease('both', fixture.fetcher, fixture.runtime);
    assert.equal(evidence.server.healthy, true);
    assert.equal(validateReleaseEvidence(proposal, evidence).client.artifactSha256, fixture.manifest.htmlSha256);
    assert.equal(validateReleaseEvidence(proposal, evidence).server.verificationMethod, 'worker-runtime-version');
    await assert.rejects(verifySupportProductionRelease('https://private-host/'), { status: 400 });
    for (const response of [new Response('<html>fallback</html>'), Response.json({ sourceRevision }), Response.json({ application: 'carearound-sg', target: 'server', sourceRevision })]) {
        await assert.rejects(verifySupportProductionRelease('client', async () => response), { status: 503 });
    }
});

test('support inbox uses real PostgreSQL constraints and atomic conversation events', async (t) => {
    const pg = new PGlite();
    t.after(() => pg.close());
    const migrationNames = [
        '0000_carearound_current_schema_baseline', '0001_normalized_login_indexes',
        '0002_gudauth_challenge_verifier_columns',
    ];
    for (const name of migrationNames) {
        await pg.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
    }
    await pg.exec(`INSERT INTO users (id, username, email, password_hash, name, role) VALUES
        (1, 'fixture-one', 'one@example.test', 'not-a-real-password', 'User one', 'standard'),
        (2, 'fixture-two', 'two@example.test', 'not-a-real-password', 'User two', 'standard'),
        (3, 'fixture-admin', 'admin@example.test', 'not-a-real-password', 'Reviewer', 'super_admin');
        INSERT INTO my_maps (id, user_id, name) VALUES (1, 1, 'Existing map before support migration');`);
    await pg.exec(await readFile(new URL('../drizzle/0003_support_inbox.sql', import.meta.url), 'utf8'));
    const repository = createSupportRepository(async (text, params) => (await pg.query(text, params)).rows);
    let observedRevision = sourceRevision;
    let verifyCalls = 0;
    const observe = async () => {
        verifyCalls++;
        return { client: { sourceRevision: observedRevision, healthy: true, checkedAt: new Date().toISOString() } };
    };
    const service = createSupportService(repository, observe);
    const owner = await resolveSupportPrincipal(member);
    const stranger = await resolveSupportPrincipal(other);
    const reviewer = await resolveSupportPrincipal(admin, '', true);

    await t.test('upgrade preserves existing data and all eight support checks are enforced', async () => {
        assert.equal((await pg.query('SELECT name FROM my_maps WHERE id = 1')).rows[0].name, 'Existing map before support migration');
        const checks = (await pg.query(`SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'support_%'`)).rows;
        assert.equal(checks.length, 8);
        await assert.rejects(pg.query(`INSERT INTO support_conversations (id, title) VALUES ($1, 'No owner')`, [crypto.randomUUID()]), /support_conversations_owner_check/);
        await assert.rejects(pg.query(`INSERT INTO support_conversations (id, owner_user_id, title, status) VALUES ($1, 1, 'Bad status', 'fixed')`, [crypto.randomUUID()]), /support_conversations_status_check/);
    });

    await t.test('creation acknowledges once, persists across service instances, and never exposes owner or recovery fields', async () => {
        const input = reportInput();
        const report = await service.create(input, owner);
        assert.equal(report.revision, 2);
        await assert.rejects(service.create({ ...input, context: {} }, owner), { status: 409 });
        assert.equal(report.context.pathname, '/discover');
        assert.equal((await service.create(input, owner)).id, report.id);
        const reopenedService = createSupportService(repository, observe);
        const detail = await reopenedService.detail(report.id, owner);
        assert.equal(detail.messages.length, 2);
        assert.equal(detail.messages[1].eventType, 'report_acknowledged');
        assert.equal(detail.conversation.unreadCount, 1);
        assert.doesNotMatch(JSON.stringify(detail), /guest_token|owner_user|author_user|current_proposal/);
        await assert.rejects(service.detail(report.id, stranger), { status: 404 });
        assert.equal((await service.list(stranger)).length, 0);
    });

    await t.test('guest credentials are hashed, private, scoped to one report, and expire', async () => {
        const credential = createSupportGuestCredential();
        const guest = await resolveSupportPrincipal({}, credential);
        const report = await service.create(reportInput(), guest);
        const stored = (await pg.query('SELECT guest_token_hash FROM support_conversations WHERE id = $1', [report.id])).rows[0];
        assert.notEqual(stored.guest_token_hash, credential);
        assert.equal(stored.guest_token_hash.length, 64);
        assert.equal((await service.detail(report.id, guest)).messages.length, 2);
        assert.equal((await service.detail(report.id, await resolveSupportPrincipal(member, credential, false, true))).messages.length, 2);
        await assert.rejects(service.detail(report.id, owner), { status: 404 });
        await assert.rejects(service.detail(report.id, await resolveSupportPrincipal({}, createSupportGuestCredential())), { status: 404 });
        await pg.query('UPDATE support_conversations SET guest_expires_at = NOW() - INTERVAL \'1 second\' WHERE id = $1', [report.id]);
        await assert.rejects(service.detail(report.id, guest), { status: 404 });
        assert.equal((await service.detail(report.id, reviewer)).messages.length, 2);
    });

    await t.test('reply retries and stale simultaneous writes cannot duplicate or overwrite messages', async () => {
        const report = await service.create(reportInput(), owner);
        const reply = { requestId: crypto.randomUUID(), revision: 2, body: 'Could you confirm which map style you selected?' };
        const first = await service.reply(report.id, reviewer, reply);
        assert.equal(first.revision, 3);
        assert.equal((await service.reply(report.id, reviewer, reply)).revision, 3);
        await assert.rejects(service.reply(report.id, reviewer, { ...reply, body: 'Changed request body' }), { status: 409 });
        const outcomes = await Promise.allSettled([
            service.reply(report.id, owner, { requestId: crypto.randomUUID(), revision: 3, body: 'Default style.' }),
            service.reply(report.id, owner, { requestId: crypto.randomUUID(), revision: 3, body: 'Gray style.' }),
        ]);
        assert.equal(outcomes.filter((value) => value.status === 'fulfilled').length, 1);
        const detail = await service.detail(report.id, owner);
        assert.equal(detail.conversation.revision, 4);
        assert.deepEqual(detail.messages.map((item) => item.sequence), [1, 2, 3, 4]);
    });

    await t.test('read cursor is monotonic and does not mark later messages read', async () => {
        const report = await service.create(reportInput(), owner);
        const previousUnread = await service.unreadCount(owner);
        assert.ok(previousUnread > 0);
        await service.markRead(report.id, owner, 2);
        assert.equal(await service.unreadCount(owner), previousUnread - 1);
        await service.reply(report.id, reviewer, { requestId: crypto.randomUUID(), revision: 2, body: 'Please retry.' });
        await service.markRead(report.id, owner, 1);
        const detail = await service.detail(report.id, owner);
        assert.equal(detail.conversation.readSequence, 2);
        assert.equal(detail.conversation.unreadCount, 1);
        await assert.rejects(service.markRead(report.id, stranger, 9999), { status: 404 });
    });

    await t.test('inbox pagination retains reports with identical update times', async () => {
        const inputA = reportInput();
        const inputB = reportInput();
        await service.create(inputA, stranger);
        await service.create(inputB, stranger);
        const timestamp = '2026-09-07T01:00:00.000Z';
        await pg.query('UPDATE support_conversations SET updated_at = $1 WHERE owner_user_id = 2', [timestamp]);
        const first = await service.list(stranger, { limit: 1 });
        const second = await service.list(stranger, { limit: 1, before: first[0].updatedAt, beforeId: first[0].id });
        assert.equal(second.length, 1);
        assert.notEqual(first[0].id, second[0].id);
    });

    await t.test('human approval and matching server-observed release are both required before notifying the reporter', async () => {
        const report = await service.create(reportInput(), owner);
        const proposal = proposalInput(2);
        await service.propose(report.id, reviewer, proposal);
        const callsBefore = verifyCalls;
        await assert.rejects(service.verify(report.id, reviewer, { ...productionTest, proposalId: proposal.id, revision: 3 }), { status: 409 });
        assert.equal(verifyCalls, callsBefore);
        await assert.rejects(service.approve(report.id, owner, { proposalId: proposal.id, revision: 3 }), { status: 403 });
        await service.approve(report.id, reviewer, { proposalId: proposal.id, revision: 3 });
        observedRevision = 'b'.repeat(40);
        await assert.rejects(service.verify(report.id, reviewer, { ...productionTest, proposalId: proposal.id, revision: 4 }), { status: 409 });
        assert.equal((await service.detail(report.id, owner)).conversation.status, 'in_progress');
        observedRevision = sourceRevision;
        await assert.rejects(service.verify(report.id, reviewer, { proposalId: proposal.id, revision: 4 }), { status: 400 });
        await service.verify(report.id, reviewer, { ...productionTest, proposalId: proposal.id, revision: 4 });
        await service.verify(report.id, reviewer, { ...productionTest, proposalId: proposal.id, revision: 4 });
        const detail = await service.detail(report.id, owner);
        assert.equal(detail.conversation.status, 'fix_available');
        assert.equal(detail.messages.filter((item) => item.eventType === 'fix_available').length, 1);
        await assert.rejects(service.proposal(report.id, owner, proposal.id), { status: 403 });
        await service.changeStatus(report.id, owner, { requestId: crypto.randomUUID(), revision: 5, status: 'resolved' });
        await service.changeStatus(report.id, owner, { requestId: crypto.randomUUID(), revision: 6, status: 'open' });
        const reopened = await service.detail(report.id, owner);
        assert.equal(reopened.conversation.status, 'open');
        assert.equal(reopened.messages.length, 7);
        await assert.rejects(service.verify(report.id, reviewer, { ...productionTest, proposalId: proposal.id, revision: 7 }), { status: 409 });
    });

    await t.test('replacing a proposed fix invalidates its authority to release', async () => {
        const report = await service.create(reportInput(), owner);
        const first = proposalInput(2);
        await service.propose(report.id, reviewer, first);
        await service.approve(report.id, reviewer, { proposalId: first.id, revision: 3 });
        const second = proposalInput(4, { sourceRevision: 'b'.repeat(40) });
        await service.propose(report.id, reviewer, second);
        await assert.rejects(service.verify(report.id, reviewer, { ...productionTest, proposalId: first.id, revision: 5 }), { status: 409 });
        await assert.rejects(service.verify(report.id, reviewer, { ...productionTest, proposalId: second.id, revision: 5 }), { status: 409 });
        await assert.rejects(service.propose(report.id, reviewer, { ...second, summary: 'Silently changed summary' }), { status: 409 });
    });

    await t.test('failed artifact verification writes no fix event; valid evidence is persisted once', async () => {
        const fixture = await createReleaseFixture();
        const verifiedService = createSupportService(repository, (target) => verifySupportProductionRelease(target, fixture.fetcher, fixture.runtime));
        const report = await verifiedService.create(reportInput(), owner);
        const proposal = proposalInput(2, { target: 'both' });
        await verifiedService.propose(report.id, reviewer, proposal);
        await verifiedService.approve(report.id, reviewer, { proposalId: proposal.id, revision: 3 });
        const verification = { ...productionTest, proposalId: proposal.id, revision: 4 };
        const entry = fixture.files.get('/assets/app-123.js');
        const original = entry.body;
        entry.body = Buffer.from('incorrect deployed code');
        await assert.rejects(verifiedService.verify(report.id, reviewer, verification), { status: 503 });
        const failed = await verifiedService.detail(report.id, owner);
        assert.equal(failed.conversation.revision, 4);
        assert.equal(failed.messages.filter((m) => m.eventType === 'fix_available').length, 0);
        entry.body = original;
        await verifiedService.verify(report.id, reviewer, verification);
        await verifiedService.verify(report.id, reviewer, verification);
        assert.equal((await verifiedService.detail(report.id, owner)).messages.filter((m) => m.eventType === 'fix_available').length, 1);
        const stored = await repository.getProposal(report.id, reviewer, proposal.id);
        assert.equal(stored.release_evidence.client.artifactSha256, fixture.manifest.htmlSha256);
        assert.equal(stored.release_evidence.server.deploymentId, fixture.runtime.release.deploymentId);
        assert.equal(stored.release_evidence.humanProductionCheck.sourceRevision, sourceRevision);
    });

    await t.test('HTTP boundary rejects forged authority, evidence, invalid cursors, and unintended rollout', async () => {
        const app = new Hono();
        app.route('/api/support', createSupportRoutes({
            authenticate: async (c, next) => {
                const user = c.req.header('X-Test-User') === 'admin' ? admin : member;
                c.set('user', user);
                await next();
            },
            repositoryForContext: () => repository, verifyProduction: observe,
        }));
        const enabled = { SUPPORT_INBOX_ENABLED: 'true' };
        const request = (path, body, actor = 'member') => app.request(`/api/support${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-User': actor }, body: JSON.stringify(body),
        }, enabled);
        const response = await request('/reports', reportInput());
        assert.equal(response.status, 201);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const report = await response.json();
        assert.equal((await request(`/review/reports/${report.id}/approve`, { proposalId: crypto.randomUUID(), revision: 2 })).status, 403);
        assert.equal((await request(`/reports/${report.id}/status`, { requestId: crypto.randomUUID(), revision: 2, status: 'fix_available' })).status, 400);
        assert.equal((await request(`/review/reports/${report.id}/verify`, {
            proposalId: crypto.randomUUID(), revision: 2, evidence: { client: { healthy: true, sourceRevision } },
        }, 'admin')).status, 400);
        assert.equal((await app.request(`/api/support/reports/${report.id}?after=-1`, {}, enabled)).status, 400);
        assert.equal((await app.request('/api/support/reports', {}, {})).status, 503);
    });
});
