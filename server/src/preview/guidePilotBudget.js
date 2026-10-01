import { GUIDE_AI_MODEL } from '../utils/guideAiRuntime.js';

// A single coordination atom for this approved pilot. Never rename/reset it
// to reclaim allowance. The seed includes all 39 earlier physical attempts.
export { GUIDE_LLM_PILOT as GUIDE_PILOT } from '../utils/guideLlmPilotPolicy.js';
import { GUIDE_LLM_PILOT as GUIDE_PILOT } from '../utils/guideLlmPilotPolicy.js';
const key = 'physical-attempts';
function counter(value) {
    if (value === undefined) return GUIDE_PILOT.seed;
    if (!Number.isSafeInteger(value) || value < GUIDE_PILOT.seed || value > GUIDE_PILOT.limit)
        throw new Error('Invalid pilot counter.');
    return value;
}
function status(used, now) {
    const expired = !Number.isFinite(now) || now >= Date.parse(GUIDE_PILOT.expiresAt);
    return { used, limit: GUIDE_PILOT.limit, remaining: expired ? 0 : GUIDE_PILOT.limit - used,
        expiresAt: GUIDE_PILOT.expiresAt, expired };
}
export async function readGuidePilotBudget(storage, now = Date.now()) {
    return status(counter(await storage.get(key)), now);
}
export async function reserveGuidePilotCall(storage, now = Date.now()) {
    return storage.transaction(async txn => {
        const before = status(counter(await txn.get(key)), now);
        if (!before.remaining) return { ...before, reserved: false };
        const used = before.used + 1;
        await txn.put(key, used); // Commit before inference; never refund failures.
        return { ...status(used, now), reserved: true };
    });
}
export function guidePilotBindingsReady(env) {
    return env.ORACLE_PREVIEW_LLM_ENABLED === 'true'
        && env.GUIDE_CHAT_ENABLED === 'true' && env.GUIDE_SEMANTIC_RETRIEVAL_ENABLED === 'true'
        && env.GUIDE_AI_GATEWAY_ID === GUIDE_PILOT.gateway
        && env.GROUNDED_AI_ENABLED === 'false' && env.GOVERNED_PILOT_RELEASE_STAGE === 'off'
        && typeof env.AI?.run === 'function' && typeof env.GUIDE_PILOT_BUDGET?.getByName === 'function';
}
export async function guidePilotRuntime(env) {
    const disabled = { ...env, AI: undefined, GUIDE_CHAT_ENABLED: 'false', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false' };
    if (!guidePilotBindingsReady(env)) return disabled;
    const budget = env.GUIDE_PILOT_BUDGET.getByName(GUIDE_PILOT.id);
    let current;
    try { current = await budget.status(); } catch { return disabled; }
    if (!current.remaining || Date.now() >= Date.parse(GUIDE_PILOT.expiresAt)) return disabled;
    return { ...env, AI: { async run(model, params, options) {
        // No other model, direct provider, streaming, wider payload or retry path.
        if (model !== GUIDE_AI_MODEL || params?.stream !== false
            || !Number.isSafeInteger(params.max_tokens) || params.max_tokens < 1 || params.max_tokens > 650
            || new TextEncoder().encode(JSON.stringify(params)).length > 20000
            || options?.gateway?.id !== GUIDE_PILOT.gateway || options.gateway.skipCache !== true
            || options.gateway.collectLog !== false || Object.keys(options).some(k => k !== 'gateway'))
            throw new Error('Pilot inference scope rejected.');
        const reservation = await budget.reserve();
        if (!reservation.reserved) throw new Error('Pilot allowance exhausted.');
        // Exactly one native call for each committed reservation. No app retry.
        return env.AI.run(model, params, { gateway: { ...options.gateway, retries: { maxAttempts: 1 } } });
    } } };
}
