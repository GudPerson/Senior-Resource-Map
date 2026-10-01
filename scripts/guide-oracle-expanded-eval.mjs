// Fictional product questions only. The local bridge is capped at 20 requests per process.
// node scripts/guide-oracle-expanded-eval.mjs --preflight
// CAREAROUND_GUIDE_LIVE_EVAL=true node scripts/guide-oracle-expanded-eval.mjs
import assert from 'node:assert/strict';
import { GUIDE_PILOT_GATEWAY_ID } from '../server/test/fixtures/guideLiveAiClient.js';
import { writeFile } from 'node:fs/promises';
import { answerGuideQuestion } from '../server/src/utils/guideKnowledge.js';
import { answerGuideWithCloudflare, GUIDE_CHAT_MODEL } from '../server/src/utils/guideChat.js';
import { answerGuideOracleFact, GUIDE_ORACLE_VERSION, retrieveGuideOracleFacts } from '../server/src/utils/guideOracleKnowledge.js';

const cases = [
    { question: 'If I bookmark an activity, does that mean I have a confirmed seat?', expected: ['plans-not-bookings', 'saved-versus-managed'] },
    { question: 'Will a provider know I am attending just because it is on my calendar?', expected: ['plans-not-bookings'] },
    { question: 'Can my private planning locations appear in a spreadsheet I download?', expected: ['personal-place-sharing'] },
    { question: 'I changed a published map on my account. Will a visitor automatically see the new version?', expected: ['help-sharing'] },
    { question: 'Can someone browsing the site alter the map I published?', expected: ['shared-map-copy', 'help-sharing'] },
    { question: 'Does being linked to a community centre give me permission to edit its listing?', expected: ['place-membership', 'saved-versus-managed'] },
    { question: 'Is joining a members-only activity automatic once I link to its centre?', expected: ['place-membership', 'offering-eligibility'] },
    { question: 'Why can my friend see an activity in Discover but I cannot?', expected: ['offering-not-visible'] },
    { question: 'If a required personal detail is blank, does that prove I am ineligible?', expected: ['offering-profile-missing'] },
    { question: 'Do prices and remaining seats on a listing guarantee I can attend?', expected: ['provider-availability'] },
    { question: 'After I acknowledge a changed event, is my old calendar choice moved to the new date?', expected: ['plan-schedule-update'] },
    { question: 'Does an address saved for private planning become a public directory listing?', expected: ['my-places'] },
    { question: 'Can I share a published map with a website without exposing every owner note?', expected: ['embedded-map-notes', 'map-note-privacy'] },
    { question: 'Is a collection of directory listings the same as a coordination team?', expected: ['resource-groups'] },
    { question: 'Can a volunteer upload a spreadsheet to add all centre listings at once?', expected: ['asset-workbook-import'] },
    { question: 'Will hiding a listing delete it for everyone?', expected: ['resource-hide-delete'] },
];

const preflight = cases.map(({ question, expected }) => {
    const topicId = answerGuideQuestion({ question }).topicId;
    const directId = answerGuideOracleFact(question)?.topicId || null;
    const facts = retrieveGuideOracleFacts(question, topicId).map(({ id, title }) => ({ id, title }));
    return { question, expected, topicId, directId, facts,
        expectedRetrieved: expected.some((id) => facts.some((fact) => fact.id === id)) };
});

if (process.argv.includes('--preflight')) {
    for (const { question, expected, directId, facts, expectedRetrieved } of preflight) {
        console.log(JSON.stringify({ question, expected, directId, retrieved: facts.map(({ id }) => id), expectedRetrieved }));
    }
    process.exit(0);
}

assert.equal(process.env.CAREAROUND_GUIDE_LIVE_EVAL, 'true', 'Explicit live-evaluation mode is required.');
const bridge = 'http://127.0.0.1:8788/__carearound-guide-ai-run';
const results = [];
for (const item of preflight) {
    let rawAnswer = null;
    let bridgeStatus = null;
    let selected = null;
    if (!item.directId && item.expectedRetrieved) {
        const env = { GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT_GATEWAY_ID, AI: { run: async (model, params, options) => {
            const response = await fetch(bridge, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, params, options }) });
            bridgeStatus = response.status;
            if (!response.ok) throw new Error(`Local bridge returned ${response.status}`);
            const result = await response.json();
            rawAnswer = result?.response ?? result?.choices?.[0]?.message?.content ?? null;
            return result;
        } } };
        selected = await answerGuideWithCloudflare({ question: item.question, topicId: item.topicId, env });
    }
    results.push({ ...item, bridgeStatus, rawAnswer,
        displayedAnswer: item.directId ? answerGuideOracleFact(item.question)?.message : selected?.message ?? null,
        selectedFactIds: item.directId ? [item.directId] : selected?.sources.map(({ id }) => id) ?? [],
        outcome: item.directId ? 'reviewed_direct' : !item.expectedRetrieved ? 'retrieval_gap'
            : bridgeStatus === null ? 'no_model_call' : selected ? 'reviewed_facts_selected' : 'reviewed_fallback',
        humanReview: null });
    console.log(`${results.length}/${preflight.length} ${bridgeStatus ?? 'no call'} ${item.question}`);
}

const evidence = { fictionalQuestionsOnly: true, model: GUIDE_CHAT_MODEL,
    oracleVersion: GUIDE_ORACLE_VERSION, checkedAt: new Date().toISOString(),
    note: 'The model was called only where the normal route has no direct Oracle fact and retrieval included an expected fact. This is selection-layer evidence, not an end-to-end account or browser test. Human relevance review is required.',
    results };
await writeFile(new URL('../docs/evidence/guide-oracle-expanded-selection-20260929.json', import.meta.url),
    `${JSON.stringify(evidence, null, 2)}\n`);
