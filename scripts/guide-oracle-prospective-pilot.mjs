// Fictional local-only collector. Preflight never makes a request; live mode requires human approval.
import assert from 'node:assert/strict';
import { readFile, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GUIDE_ORACLE_FACTS, GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';
import { GUIDE_CHAT_MODEL } from '../server/src/utils/guideChat.js';
import { GUIDE_PILOT_GATEWAY_ID } from '../server/test/fixtures/guideLiveAiClient.js';

const planUrl = new URL('../docs/evidence/guide-oracle-prospective-pilot-20261001.json', import.meta.url);
const origin = 'http://127.0.0.1:8792';
const bridgeStatusUrl = 'http://127.0.0.1:8788/__carearound-guide-ai-status';
const allowedEndpoints = new Set(['/api/guide/answer', '/api/guide/actions/programmes/draft']);

export async function loadPilotPlan({ readPlan = () => readFile(planUrl) } = {}) {
    const bytes = await readPlan();
    const plan = JSON.parse(bytes);
    assert.equal(plan.oracleVersion, GUIDE_ORACLE_VERSION, 'Re-review the frozen plan after a corpus change.');
    assert.equal(plan.factCount, GUIDE_ORACLE_FACTS.length);
    assert.equal(new Set(plan.cases.map((item) => item.id)).size, plan.cases.length);
    const ids = new Set(GUIDE_ORACLE_FACTS.map((fact) => fact.id));
    for (const item of plan.cases) {
        assert.ok(allowedEndpoints.has(item.endpoint));
        assert.ok(item.expectedFactIds.every((id) => ids.has(id)), item.id);
        assert.ok(item.reviewCriteria.length > 0);
        assert.ok([0, 1, 2].includes(item.maxModelCalls));
        assert.equal(item.body.useAi, true);
    }
    for (const expected of plan.factEvidence) {
        const current = GUIDE_ORACLE_FACTS.find((fact) => fact.id === expected.id);
        assert.deepEqual({ id: current.id, title: current.title, message: current.message, route: current.route,
            evidence: current.evidence, reviewed: current.reviewed }, expected, 'Reviewed evidence changed; re-review this plan.');
    }
    assert.equal(plan.cases.reduce((n, item) => n + item.maxModelCalls, 0), plan.maximumPhysicalCallsForCompleteSample);
    return { plan, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export function validateGatewayReadback(readback, now = Date.now()) {
    assert.equal(readback?.kind, 'authenticated-cloudflare-api-readback');
    assert.equal(readback?.status, 200); assert.equal(readback?.success, true);
    const age = now - Date.parse(readback.checkedAt);
    assert.ok(Number.isFinite(age) && age >= -60000 && age < 10 * 60 * 1000, 'Refresh authenticated Gateway read-back.');
    const gateway = readback.result;
    assert.equal(gateway?.id, GUIDE_PILOT_GATEWAY_ID);
    assert.equal(gateway.authentication, true); assert.equal(gateway.collect_logs, false);
    assert.ok(gateway.cache_ttl === 0 || gateway.cache_ttl === null);
    assert.equal(gateway.logpush, false); assert.ok(!gateway.otel || gateway.otel.length === 0);
    assert.ok(gateway.retry_max_attempts == null);
    assert.equal(gateway.workers_ai_billing_mode, 'postpaid');
    assert.equal(gateway.spend_limits?.enabled, true);
    assert.equal(gateway.spend_limits.rules.length, 1);
    const rule = gateway.spend_limits.rules[0];
    assert.equal(rule.enabled, true); assert.equal(rule.limitType, 'cost'); assert.equal(rule.limit, 0.50);
    assert.equal(rule.window, 86400); assert.equal(rule.technique, 'sliding');
    assert.ok(!rule.model && !rule.provider && (!rule.metadata || Object.keys(rule.metadata).length === 0));
}

function validateCostObservation(observation, now = Date.now()) {
    assert.equal(observation?.source, 'cloudflare-gateway-analytics');
    assert.equal(observation?.gatewayId, GUIDE_PILOT_GATEWAY_ID);
    assert.equal(observation?.model, GUIDE_CHAT_MODEL);
    assert.equal(observation?.costTrackingConfirmed, true);
    assert.ok(Number.isFinite(observation?.estimatedCostUsd) && observation.estimatedCostUsd >= 0);
    const age = now - Date.parse(observation.checkedAt);
    assert.ok(Number.isFinite(age) && age >= -60000 && age < 10 * 60 * 1000);
}

export async function collectPilotReplies({ plan, readback, costObservation, maximumCases = 1,
    fetchImpl = fetch, record = async () => {}, now = Date.now() } = {}) {
    validateGatewayReadback(readback, now);
    assert.ok(Number.isInteger(maximumCases) && maximumCases > 0 && maximumCases <= plan.cases.length);
    if (maximumCases > 1) validateCostObservation(costObservation, now);
    const get = async (url, init = {}) => {
        const response = await fetchImpl(url, { redirect: 'error', ...init });
        const raw = await response.text();
        let body; try { body = JSON.parse(raw); } catch { body = { raw }; }
        return { status: response.status, body };
    };
    const fixture = async (path, { role, method = 'GET', body } = {}) => get(`${origin}${path}`, {
        method, headers: { ...(role ? { Cookie: `carearound_support_fixture=${role}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    const status = async () => {
        const result = await get(bridgeStatusUrl);
        assert.equal(result.status, 200); assert.equal(result.body.fixture, true);
        assert.equal(result.body.approved, true); assert.equal(result.body.gatewayConfigured, true);
        assert.equal(result.body.gatewayId, GUIDE_PILOT_GATEWAY_ID); assert.equal(result.body.model, GUIDE_CHAT_MODEL);
        assert.equal(result.body.maximumCalls, 20);
        assert.ok(Number.isInteger(result.body.attemptedCalls) && result.body.attemptedCalls >= 0);
        assert.equal(typeof result.body.instanceId, 'string');
        return result.body;
    };
    const semantic = await fixture('/__fixture/guide/semantic');
    assert.equal(semantic.status, 200); assert.equal(semantic.body.fixture, true);
    assert.equal(semantic.body.enabled, true); assert.equal(semantic.body.liveAi, true);
    const topics = await fixture('/api/guide/topics');
    assert.equal(topics.status, 200); assert.equal(topics.body.chatMode, 'cloudflare');
    const start = await status();
    const planned = plan.cases.slice(0, maximumCases);
    assert.ok(start.attemptedCalls + planned.reduce((n, item) => n + item.maxModelCalls, 0) <= 20,
        'Insufficient bridge budget; do not reset/restart to conceal prior attempts.');
    const beforeState = await fixture('/__fixture/guide/state'); assert.equal(beforeState.status, 200);
    const results = []; let current = start; let stopReason = null;
    for (const item of planned) {
        const entry = { id: item.id, layer: item.layer, role: item.role || 'guest', request: item.body,
            reviewCriteria: item.reviewCriteria, expectedFactIds: item.expectedFactIds,
            bridgeBefore: current, humanReview: null };
        let revoked = false;
        const started = performance.now();
        try {
            if (item.fixtureAccess) {
                const actor = await fixture('/api/auth/me', { role: 'staff' });
                assert.deepEqual(actor.body.user?.hardAssetStaffAccess?.map((access) => access.hardAssetId), [100],
                    'Revocation case needs its original fictional Place assignment.');
                assert.deepEqual(actor.body.user?.softAssetStaffAccess?.map((access) => access.softAssetId), [203],
                    'Do not restore a Group assignment that was already missing or changed.');
                // Restore even if dispatch succeeded but its response was lost.
                revoked = true;
                const changed = await fixture('/__fixture/guide/access/revoke', { method: 'POST' });
                assert.equal(changed.status, 200);
            }
            entry.response = await fixture(item.endpoint, { role: item.role, method: 'POST', body: item.body });
            if (entry.response.body?.answerSource === 'simulation')
                entry.protocolError = 'Simulated reply cannot be labelled as actual-model evidence.';
            else if (item.layer === 'draft' ? !entry.response.body?.draft
                : typeof entry.response.body?.message !== 'string' || !entry.response.body.message.trim())
                entry.protocolError = 'A complete Guide reply was not returned.';
        } catch (error) { entry.error = error.message; }
        finally {
            if (revoked) {
                try { assert.equal((await fixture('/__fixture/guide/access/restore', { method: 'POST' })).status, 200); }
                catch (error) { entry.restoreError = error.message; }
            }
        }
        entry.latencyMs = Math.round(performance.now() - started);
        try {
            const after = await status(); entry.bridgeAfter = after;
            assert.equal(after.instanceId, start.instanceId, 'Bridge restarted: call ledger is no longer continuous.');
            assert.ok(after.attemptedCalls >= current.attemptedCalls, 'Model counter moved backwards.');
            entry.modelCalls = after.attemptedCalls - current.attemptedCalls;
            current = after;
            assert.ok(entry.modelCalls <= item.maxModelCalls, 'Unexpected model calls for this layer.');
            assert.ok(after.attemptedCalls <= 20);
        } catch (error) { entry.counterError = error.message; }
        results.push(entry); await record({ type: 'case', ...entry });
        if (entry.error || entry.restoreError || entry.counterError || entry.protocolError || entry.response?.status !== 200) {
            stopReason = 'execution_or_boundary_failure'; break;
        }
    }
    const afterState = await fixture('/__fixture/guide/state');
    if (afterState.status !== 200 || JSON.stringify(afterState.body) !== JSON.stringify(beforeState.body))
        stopReason = 'unexpected_fixture_resource_change';
    const summary = { results, stopReason: stopReason || (maximumCases === 1 ? 'review_cost_tracking_before_continuing' : 'human_complete_reply_review_required'),
        notAttemptedIds: plan.cases.filter((item) => !results.some((result) => result.id === item.id)).map((item) => item.id),
        bridgeStart: start, bridgeLastConfirmed: current, physicalCallsThisRun: results.some((item) => item.counterError) ? null : current.attemptedCalls - start.attemptedCalls,
        counterCoverageComplete: !results.some((item) => item.counterError),
        modelCostTrackingIsSeparate: true, liveAccuracyAccepted: false, humanReview: null };
    await record({ type: 'summary', ...summary, results: undefined });
    return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { plan, sha256 } = await loadPilotPlan();
    if (process.argv.includes('--preflight') || !process.argv.includes('--live')) {
        console.log(JSON.stringify({ status: 'offline_preflight', cases: plan.cases.length, maximumModelCalls: plan.maximumPhysicalCallsForCompleteSample,
            oracleVersion: plan.oracleVersion, manifestSha256: sha256, liveModelCalls: 0, humanApproval: 'pending' }, null, 2));
    } else {
        assert.ok(process.argv.includes('--live'));
        assert.equal(process.env.CAREAROUND_GUIDE_PILOT_APPROVED, 'true', 'The pending human pilot approval is required.');
        const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
        assert.ok(process.argv.includes('--gateway-readback') && process.argv.includes('--output'));
        const readback = JSON.parse(await readFile(arg('--gateway-readback'), 'utf8'));
        const costObservation = process.argv.includes('--cost-observation') ? JSON.parse(await readFile(arg('--cost-observation'), 'utf8')) : undefined;
        const maximumCases = process.argv.includes('--maximum-cases') ? Number(arg('--maximum-cases')) : 1;
        const output = await open(arg('--output'), 'wx');
        try {
            const record = async (entry) => { await output.write(JSON.stringify(entry) + '\n'); await output.sync(); };
            await record({ type: 'header', checkedAt: new Date().toISOString(), manifestSha256: sha256,
                oracleVersion: plan.oracleVersion, environment: 'fictional local fixture; actual model if gates pass', maximumCases });
            try {
                const result = await collectPilotReplies({ plan, readback, costObservation, maximumCases, record });
                console.log(JSON.stringify({ completedCases: result.results.length, modelCalls: result.physicalCallsThisRun,
                    stopReason: result.stopReason, liveAccuracyAccepted: false }));
                if (result.results.length < Math.min(maximumCases, plan.cases.length) || !result.counterCoverageComplete
                    || ['execution_or_boundary_failure', 'unexpected_fixture_resource_change'].includes(result.stopReason)) process.exitCode = 1;
            } catch (error) { await record({ type: 'failure', message: error.message }); throw error; }
        } finally { await output.close(); }
    }
}
