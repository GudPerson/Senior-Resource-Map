import { GUIDE_LLM_PILOT } from './guideLlmPilotPolicy.js';
export const GUIDE_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

function guideGatewayId(env = {}) {
    const id = env.GUIDE_AI_GATEWAY_ID;
    return typeof id === 'string' && id.length <= 64 && /^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(id) ? id : '';
}

export function guideAiAvailable(env = {}) {
    const requiresPilot = env.GUIDE_LLM_PILOT_ENABLED === 'true'
        || (env.NODE_ENV === 'production' && guideGatewayId(env) === GUIDE_LLM_PILOT.gateway
            && env.ORACLE_PREVIEW_LLM_ENABLED !== 'true');
    const pilotReady = !requiresPilot
        || (env.GUIDE_LLM_PILOT_ENABLED === 'true' && guideGatewayId(env) === GUIDE_LLM_PILOT.gateway
            && typeof env.GUIDE_PILOT_BUDGET?.getByName === 'function'
            && Date.now() < Date.parse(GUIDE_LLM_PILOT.expiresAt));
    return pilotReady && env.GUIDE_CHAT_ENABLED === 'true' && typeof env.AI?.run === 'function'
        && (env.NODE_ENV !== 'production' || Boolean(guideGatewayId(env)));
}

export async function runGuideAi(env, params) {
    if (!guideAiAvailable(env)) throw new Error('Guide AI is unavailable.');
    const gatewayId = guideGatewayId(env);
    const gateway = gatewayId ? { id: gatewayId, skipCache: true, collectLog: false } : undefined;
    if (env.GUIDE_LLM_PILOT_ENABLED === 'true') {
        if (params?.stream !== false || !Number.isSafeInteger(params.max_tokens)
            || params.max_tokens < 1 || params.max_tokens > 650
            || new TextEncoder().encode(JSON.stringify(params)).length > 20000)
            throw new Error('Guide inference scope rejected.');
        // Cross-Worker binding retains the preview's already-used allowance.
        // Reserve atomically BEFORE inference; outages/exhaustion fail closed.
        const budget = env.GUIDE_PILOT_BUDGET.getByName(GUIDE_LLM_PILOT.id);
        const reservation = await budget.reserve();
        if (reservation?.reserved !== true) throw new Error('Guide AI allowance exhausted.');
        gateway.retries = { maxAttempts: 1 };
    }
    return env.AI.run(GUIDE_AI_MODEL, params, gateway ? { gateway } : undefined);
}
