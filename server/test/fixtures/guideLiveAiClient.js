// Disposable loopback-only live-pilot transport. Never import into application code.
export const GUIDE_PILOT_GATEWAY_ID = 'carearound-guide';

export function guidePilotAiOptions() {
    return { gateway: { id: GUIDE_PILOT_GATEWAY_ID, skipCache: true, collectLog: false } };
}

export function validGuidePilotAiOptions(options) {
    const gateway = options?.gateway;
    return Boolean(options && Object.keys(options).length === 1 && gateway
        && Object.keys(gateway).length === 3 && gateway.id === GUIDE_PILOT_GATEWAY_ID
        && gateway.skipCache === true && gateway.collectLog === false);
}

export function createGuideLiveAiClient({ fetchImpl = fetch } = {}) {
    return { async run(model, params, options) {
        if (!validGuidePilotAiOptions(options) || ![90, 450].includes(params?.max_tokens))
            throw new Error('The local pilot requires its named Gateway and privacy options.');
        const path = params.max_tokens === 450 ? '/__carearound-guide-ai-draft' : '/__carearound-guide-ai-run';
        const response = await fetchImpl(`http://127.0.0.1:8788${path}`, { method: 'POST',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, params, options }) });
        if (!response.ok) {
            const error = new Error('Local live AI bridge unavailable');
            error.status = response.status;
            throw error;
        }
        return response.json();
    } };
}
