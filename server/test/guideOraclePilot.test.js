import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPilotReplies, loadPilotPlan as loadFrozenPilotPlan } from '../../scripts/guide-oracle-prospective-pilot.mjs';
import { GUIDE_CHAT_MODEL } from '../src/utils/guideChat.js';
import { GUIDE_ORACLE_FACTS, GUIDE_ORACLE_VERSION } from '../src/utils/guideOracleKnowledge.js';
import { readFile } from 'node:fs/promises';

// Collector contracts use a current, fictional in-memory plan. Never replace
// the historical approved sample or silently make it valid for live traffic.
async function loadPilotPlan() {
    const historicalBytes = await readFile(new URL('../../docs/evidence/guide-oracle-prospective-pilot-20261001.json', import.meta.url));
    const plan = { ...JSON.parse(historicalBytes), oracleVersion: GUIDE_ORACLE_VERSION, factCount: GUIDE_ORACLE_FACTS.length };
    return loadFrozenPilotPlan({ readPlan: async () => Buffer.from(JSON.stringify(plan)) });
}

test('default frozen live plan rejects the changed corpus while current mock input retains every validation', async () => {
    await assert.rejects(loadFrozenPilotPlan(), /Re-review the frozen plan after a corpus change/);
    const { plan } = await loadPilotPlan();
    assert.equal(plan.oracleVersion, GUIDE_ORACLE_VERSION);
    assert.equal(plan.factCount, GUIDE_ORACLE_FACTS.length);
    await assert.rejects(loadFrozenPilotPlan({ readPlan: async () => Buffer.from(JSON.stringify({ ...plan, factCount: 0 })) }));
    const changedEvidence = { ...plan, factEvidence: plan.factEvidence.map((fact, index) => index ? fact : { ...fact, message: 'Unreviewed changed evidence' }) };
    await assert.rejects(loadFrozenPilotPlan({ readPlan: async () => Buffer.from(JSON.stringify(changedEvidence)) }), /Reviewed evidence changed/);
});

function readback() {
    return { kind: 'authenticated-cloudflare-api-readback', status: 200, success: true, checkedAt: new Date().toISOString(),
        result: { id: 'carearound-guide', authentication: true, collect_logs: false, cache_ttl: 0, logpush: false,
            retry_max_attempts: null, workers_ai_billing_mode: 'postpaid',
            spend_limits: { enabled: true, rules: [{ enabled: true, limitType: 'cost', limit: 0.50, window: 86400, technique: 'sliding' }] } } };
}
function costObservation() {
    return { source: 'cloudflare-gateway-analytics', gatewayId: 'carearound-guide', model: GUIDE_CHAT_MODEL,
        checkedAt: new Date().toISOString(), estimatedCostUsd: 0.001, costTrackingConfirmed: true };
}
function mockTransport(plan, { simulation = false, reset = false, missingAfter = false, badCounter = false, missingGroup = false, simulatedReply = false, lostRevocation = false } = {}) {
    const requests = []; let attempts = 0;
    const fetchImpl = async (url, init = {}) => {
        requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
        if (url.endsWith('/__carearound-guide-ai-status')) {
            if (missingAfter && attempts > 0) throw new Error('Fictional status outage');
            return Response.json({ fixture: true, instanceId: reset && attempts ? 'new-worker' : 'same-worker',
                attemptedCalls: attempts, maximumCalls: 20, approved: true, gatewayConfigured: true,
                gatewayId: 'carearound-guide', model: GUIDE_CHAT_MODEL });
        }
        if (url.endsWith('/__fixture/guide/semantic')) return Response.json({ fixture: true, enabled: true, liveAi: !simulation });
        if (url.endsWith('/api/guide/topics')) return Response.json({ chatMode: simulation ? 'simulation' : 'cloudflare' });
        if (url.endsWith('/__fixture/guide/state')) return Response.json({ resources: [], favorites: [] });
        if (url.endsWith('/api/auth/me')) return Response.json({ user: { hardAssetStaffAccess: [{ hardAssetId: 100 }],
            softAssetStaffAccess: missingGroup ? [] : [{ softAssetId: 203 }] } });
        if (url.endsWith('/__fixture/guide/access/revoke') && lostRevocation) throw new Error('Fictional lost revocation response');
        if (url.includes('/__fixture/guide/access/')) return Response.json({ fixture: true });
        const body = JSON.parse(init.body);
        const item = plan.cases.find((c) => c.body.question === body.question && c.body.message === body.message);
        assert.ok(item, 'Collector must send the frozen case, not a substituted question.');
        attempts += badCounter && item.layer === 'account' ? 1 : item.maxModelCalls;
        return Response.json({ message: 'A complete fictional reply.\nIts second paragraph may be irrelevant and still needs human review.',
            answerSource: simulatedReply ? 'simulation' : item.layer === 'account' ? 'account' : 'ai',
            sources: [{ id: 'deliberately-unexpected-source', route: '/help', reviewed: '2026-10-01' }],
            actions: [{ label: 'Fictional action', route: '/help' }], draft: item.layer === 'draft' ? { name: 'Fictional draft' } : undefined });
    };
    return { fetchImpl, requests, attemptedCalls: () => attempts };
}

test('frozen preflight covers all three layers without traffic and fixes a maximum of 18 model calls', async () => {
    const { plan, sha256 } = await loadPilotPlan();
    assert.equal(plan.cases.filter((c) => c.layer === 'product').length, 8);
    assert.equal(plan.cases.filter((c) => c.layer === 'account').length, 6);
    assert.equal(plan.cases.filter((c) => c.layer === 'draft').length, 2);
    assert.equal(plan.factEvidence.length, 9); assert.match(sha256, /^[a-f0-9]{64}$/);
    assert.equal(plan.maximumPhysicalCallsForCompleteSample, 18);
    assert.equal(plan.humanApproval, 'pending');
});

test('missing, stale or unsafe Gateway evidence rejects before any network request', async (t) => {
    const { plan } = await loadPilotPlan();
    for (const [name, mutate] of [
        ['stale', (r) => { r.checkedAt = '2026-01-01T00:00:00Z'; }],
        ['payload logging', (r) => { r.result.collect_logs = true; }],
        ['partitioned budget', (r) => { r.result.spend_limits.rules[0].provider = { mode: 'filter', values: ['example'] }; }],
        ['wrong day units', (r) => { r.result.spend_limits.rules[0].window = 24; }],
        ['unapproved higher spend', (r) => { r.result.spend_limits.rules[0].limit = 1; }],
    ]) await t.test(name, async () => {
        const gateway = readback(); mutate(gateway); let sent = 0;
        await assert.rejects(collectPilotReplies({ plan, readback: gateway, fetchImpl: async () => { sent++; } }));
        assert.equal(sent, 0);
    });
});

test('a simulated fixture cannot be labelled as a live evaluation', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { simulation: true });
    await assert.rejects(collectPilotReplies({ plan, readback: readback(), fetchImpl: mock.fetchImpl }));
    assert.equal(mock.requests.filter((r) => r.method === 'POST').length, 0);
    assert.equal(mock.attemptedCalls(), 0);
});

test('continuing beyond the first probe requires observed cost evidence before requests', async () => {
    const { plan } = await loadPilotPlan(); let sent = 0;
    await assert.rejects(collectPilotReplies({ plan, readback: readback(), maximumCases: 2,
        fetchImpl: async () => { sent++; } }));
    assert.equal(sent, 0);
});

test('first probe preserves the complete reply, wrong sources, actions and cost-review stop without claiming accuracy', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan); const events = [];
    const result = await collectPilotReplies({ plan, readback: readback(), fetchImpl: mock.fetchImpl,
        record: async (entry) => { events.push(entry); } });
    assert.equal(result.results.length, 1); assert.equal(result.physicalCallsThisRun, 2);
    assert.equal(result.notAttemptedIds.length, 15);
    assert.match(result.results[0].response.body.message, /second paragraph/);
    assert.equal(result.results[0].response.body.sources[0].id, 'deliberately-unexpected-source');
    assert.equal(result.results[0].response.body.actions[0].route, '/help');
    assert.equal(result.stopReason, 'review_cost_tracking_before_continuing');
    assert.equal(result.humanReview, null); assert.equal(result.liveAccuracyAccepted, false);
    assert.equal(events[0].type, 'case'); assert.equal(events[1].type, 'summary');
});

test('all frozen cases are collected; account checks use no model and revocation is restored', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan);
    const result = await collectPilotReplies({ plan, readback: readback(), costObservation: costObservation(),
        maximumCases: 16, fetchImpl: mock.fetchImpl });
    assert.equal(result.results.length, 16); assert.equal(result.physicalCallsThisRun, 18);
    assert.equal(result.notAttemptedIds.length, 0); assert.equal(result.counterCoverageComplete, true);
    assert.ok(result.results.filter((item) => item.layer === 'account').every((item) => item.modelCalls === 0));
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/__fixture/guide/access/revoke')).length, 1);
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/__fixture/guide/access/restore')).length, 1);
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/api/guide/actions/programmes/draft')).length, 2);
    assert.equal(result.liveAccuracyAccepted, false);
});

test('a bridge restart stops the sample and records unknown call coverage without retrying the question', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { reset: true });
    const result = await collectPilotReplies({ plan, readback: readback(), fetchImpl: mock.fetchImpl });
    assert.equal(result.results.length, 1); assert.equal(result.physicalCallsThisRun, null);
    assert.equal(result.counterCoverageComplete, false);
    assert.match(result.results[0].counterError, /restarted/);
    assert.equal(result.stopReason, 'execution_or_boundary_failure');
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/api/guide/answer')).length, 1);
});

test('a status outage preserves the completed response and marks model-call coverage unknown', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { missingAfter: true });
    const result = await collectPilotReplies({ plan, readback: readback(), fetchImpl: mock.fetchImpl });
    assert.equal(result.physicalCallsThisRun, null); assert.equal(result.counterCoverageComplete, false);
    assert.ok(result.results[0].response.body.message); assert.match(result.results[0].counterError, /status outage/);
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/api/guide/answer')).length, 1);
});

test('unexpected inference on an account question is preserved as a boundary failure', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { badCounter: true });
    const result = await collectPilotReplies({ plan, readback: readback(), costObservation: costObservation(),
        maximumCases: 16, fetchImpl: mock.fetchImpl });
    assert.equal(result.results.length, 9); assert.equal(result.results.at(-1).layer, 'account');
    assert.equal(result.results.at(-1).modelCalls, 1);
    assert.match(result.results.at(-1).counterError, /Unexpected model calls/);
    assert.equal(result.physicalCallsThisRun, null); assert.equal(result.stopReason, 'execution_or_boundary_failure');
    assert.equal(result.notAttemptedIds.length, 7);
});


test('a preexisting missing Group assignment is never restored or granted by the revocation probe', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { missingGroup: true });
    const result = await collectPilotReplies({ plan, readback: readback(), costObservation: costObservation(), maximumCases: 16, fetchImpl: mock.fetchImpl });
    assert.equal(result.results.at(-1).id, 'a06'); assert.match(result.results.at(-1).error, /already missing/);
    assert.equal(mock.requests.filter((r) => r.url.includes('/__fixture/guide/access/')).length, 0);
    assert.equal(result.stopReason, 'execution_or_boundary_failure');
});

test('an uncertain revocation dispatch is followed by restoration and a preserved failure', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { lostRevocation: true });
    const result = await collectPilotReplies({ plan, readback: readback(), costObservation: costObservation(), maximumCases: 16, fetchImpl: mock.fetchImpl });
    assert.equal(result.results.at(-1).id, 'a06'); assert.match(result.results.at(-1).error, /lost revocation/);
    assert.equal(mock.requests.filter((r) => r.url.endsWith('/__fixture/guide/access/restore')).length, 1);
    assert.equal(result.stopReason, 'execution_or_boundary_failure');
});

test('a simulated response is preserved as a protocol failure even when preflight reports live mode', async () => {
    const { plan } = await loadPilotPlan(); const mock = mockTransport(plan, { simulatedReply: true });
    const result = await collectPilotReplies({ plan, readback: readback(), fetchImpl: mock.fetchImpl });
    assert.equal(result.results[0].response.body.answerSource, 'simulation');
    assert.match(result.results[0].protocolError, /Simulated reply/);
    assert.equal(result.stopReason, 'execution_or_boundary_failure'); assert.equal(result.liveAccuracyAccepted, false);
});
