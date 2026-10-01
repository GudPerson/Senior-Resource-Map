import app from '../app.js';
import { gateGuideAccountAcceptance } from './guideAcceptanceGate.js';
import { GUIDE_PILOT, guidePilotRuntime } from './guidePilotBudget.js';

export default {
    async fetch(request, env, ctx) {
        const stopped = gateGuideAccountAcceptance(request, env);
        if (stopped) return stopped;
        const path = new URL(request.url).pathname;
        if (path === '/api/guide/pilot' && request.method === 'GET') {
            try {
                const status = await env.GUIDE_PILOT_BUDGET.getByName(GUIDE_PILOT.id).status();
                return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
            } catch { return Response.json({ error: 'Pilot usage is unavailable.' }, { status: 503 }); }
        }
        if (path === '/api' || path.startsWith('/api/')) {
            const runtime = path.startsWith('/api/guide/') ? await guidePilotRuntime(env)
                : { ...env, AI: undefined, GUIDE_CHAT_ENABLED: 'false', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'false' };
            return app.fetch(request, runtime, ctx);
        }
        return env.ASSETS.fetch(request);
    },
};
