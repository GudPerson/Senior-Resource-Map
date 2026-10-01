// Fictional local-only quality probe for optional Cloudflare Programme draft suggestions.
import assert from 'node:assert/strict';
import { GUIDE_PILOT_GATEWAY_ID } from '../server/test/fixtures/guideLiveAiClient.js';
import { draftGuideProgramme } from '../server/src/utils/guideActionDrafting.js';
import { guideProgrammeDraftSchema } from '../server/src/utils/guideActionDomain.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE_LIVE_AI, 'true', 'Explicit fictional live-AI probe mode is required.');
const bridge = 'http://127.0.0.1:8788/__carearound-guide-ai-draft';
const env = { GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT_GATEWAY_ID, AI: { run: async (model, params, options) => {
    const response = await fetch(bridge, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, params, options }) });
    if (!response.ok) throw new Error(`Local Cloudflare bridge returned ${response.status}.`);
    return response.json();
} } };
const cases = [
    { request: 'Create a programme called Havelock Harmony. It is a music club for older adults every Wednesday at 10am.',
        draft: {}, expectedName: /Havelock Harmony/i, expectedSchedule: /Wednesday.*10/i },
    { request: 'Create a service called Transport Buddy to help older adults get to community activities.',
        draft: {}, expectedName: /Transport Buddy/i, expectedDescription: /transport|community activit/i,
        expectedSchedule: /^$/ },
    { request: 'Create a service called Open Door that welcomes every older adult.',
        draft: {}, expectedName: /Open Door/i, expectedDescription: /welcome|older adult/i,
        expectedSchedule: /^$/ },
    { request: 'Move it to Thursdays at 2pm.',
        draft: { name: 'Fictional Mobility Hour', description: 'Gentle movement at a demo centre.', schedule: 'Tuesdays at 10am' },
        expectedName: /Fictional Mobility Hour/i, expectedSchedule: /Thursday.*2/i },
    { request: 'Make the description say that this fictional class welcomes first-time visitors.',
        draft: { name: 'Fictional Art Class', description: 'A creative class.', schedule: '' },
        expectedName: /Fictional Art Class/i, expectedDescription: /first-time visitors/i },
];
const results = [];
for (const item of cases) {
    const result = await draftGuideProgramme({ message: item.request,
        draft: guideProgrammeDraftSchema.parse(item.draft), useAi: true }, env);
    const fields = { name: result.draft.name, description: result.draft.description, schedule: result.draft.schedule };
    const passed = result.aiAvailable && item.expectedName.test(fields.name)
        && (!item.expectedDescription || item.expectedDescription.test(fields.description))
        && (!item.expectedSchedule || item.expectedSchedule.test(fields.schedule));
    results.push({ request: item.request, passed, aiAvailable: result.aiAvailable, fields });
    console.log(`${passed ? 'PASS' : 'FAIL'} ${item.request}`);
}
console.log(JSON.stringify({ model: 'Cloudflare Workers AI via disposable loopback bridge', passed: results.filter((item) => item.passed).length,
    total: results.length, results }, null, 2));
if (results.some((item) => !item.passed)) process.exitCode = 1;
