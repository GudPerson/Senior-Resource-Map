// Disposable loopback-only bridge for fictional local Guide UAT; never deploy.
import { GUIDE_CHAT_MODEL } from '../../src/utils/guideChat.js';
import { GUIDE_PILOT_GATEWAY_ID, guidePilotAiOptions, validGuidePilotAiOptions } from './guideLiveAiClient.js';

async function readBoundedBody(request) {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 20000) { await reader.cancel(); return null; }
            chunks.push(value);
        }
        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        return new TextDecoder().decode(body);
    } finally { reader.releaseLock(); }
}

export function createGuideWorkersAiBridge() {
    // Counts attempted physical calls, including failures. Restarting the Worker resets
    // this local counter; it is not the account budget or the pilot's total-call ledger.
    let requests = 0;
    let instanceId;
    return { async fetch(request, env) {
        // Workers permits random generation only during a request, not module initialization.
        instanceId ||= crypto.randomUUID();
        const path = new URL(request.url).pathname;
        if (path === '/__carearound-guide-ai-status' && request.method === 'GET')
            return Response.json({ fixture: true, instanceId, attemptedCalls: requests, maximumCalls: 20,
                approved: env.GUIDE_LIVE_PILOT_APPROVED === 'true',
                gatewayConfigured: env.GUIDE_AI_GATEWAY_ID === GUIDE_PILOT_GATEWAY_ID,
                gatewayId: GUIDE_PILOT_GATEWAY_ID, model: GUIDE_CHAT_MODEL },
                { headers: { 'Cache-Control': 'no-store' } });
        const answerPath = path === '/__carearound-guide-ai-run';
        const draftPath = path === '/__carearound-guide-ai-draft';
        if ((!answerPath && !draftPath) || request.method !== 'POST')
            return new Response('Not found', { status: 404 });
        if (env.GUIDE_LIVE_PILOT_APPROVED !== 'true' || env.GUIDE_AI_GATEWAY_ID !== GUIDE_PILOT_GATEWAY_ID
            || typeof env.AI?.run !== 'function') return new Response('Live pilot is not configured and approved', { status: 503 });
        const text = await readBoundedBody(request);
        if (text === null) return new Response('Payload too long', { status: 413 });
        let payload;
        try { payload = JSON.parse(text); } catch { return new Response('Invalid JSON', { status: 400 }); }
        if (payload?.model !== GUIDE_CHAT_MODEL || !Array.isArray(payload?.params?.messages)
            || payload.params.messages.length === 0 || payload.params.messages.length > (draftPath ? 2 : 6)
            || payload.params.messages.some((message) => !['system', 'user', 'assistant'].includes(message?.role)
                || typeof message.content !== 'string')
            || payload.params.max_tokens !== (draftPath ? 450 : 90) || payload.params.stream !== false
            || !validGuidePilotAiOptions(payload.options)) return new Response('Invalid Guide request', { status: 400 });
        if (requests >= 20) return new Response('Local test limit reached', { status: 429 });
        requests++;
        try { return Response.json(await env.AI.run(GUIDE_CHAT_MODEL, payload.params, guidePilotAiOptions())); }
        catch (error) {
            const status = [error?.status, error?.statusCode, error?.httpStatusCode].includes(429) ? 429 : 503;
            return new Response(status === 429 ? 'Cloudflare AI limit reached' : 'Cloudflare AI unavailable', { status });
        }
    } };
}

export default createGuideWorkersAiBridge();
