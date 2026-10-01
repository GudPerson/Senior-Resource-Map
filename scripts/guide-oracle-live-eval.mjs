// Fictional product questions only. Run explicitly against the disposable loopback Workers AI bridge.
// CAREAROUND_GUIDE_LIVE_EVAL=true node scripts/guide-oracle-live-eval.mjs
import assert from 'node:assert/strict';
import { GUIDE_PILOT_GATEWAY_ID } from '../server/test/fixtures/guideLiveAiClient.js';
import { writeFile } from 'node:fs/promises';
import { answerGuideQuestion } from '../server/src/utils/guideKnowledge.js';
import { answerGuideWithCloudflare, GUIDE_CHAT_MODEL } from '../server/src/utils/guideChat.js';
import { answerGuideOracleFact, GUIDE_ORACLE_VERSION, retrieveGuideOracleFacts } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_GUIDE_LIVE_EVAL, 'true', 'Explicit live-evaluation mode is required.');
const bridge = 'http://127.0.0.1:8788/__carearound-guide-ai-run';
const questions = [
    'Can I make a map?',
    'Do I have to update my Shared Map after editing my private map?',
    'What does Detailed map show at zoom 15?',
    'How do I follow up after filing a support report?',
    'Can I download a resource list from my map?',
    'What happens if I remove a saved Offering from Care Calendar?',
    'If I change a Studio view, does the embedded map update?',
    'Where can I see my planning locations?',
    'Will a published map link let visitors change my map?',
    'Does saving an Offering add its schedule to Care Calendar?',
    'What is the difference between saving a resource and adding it to a map?',
    'Why is my saved resource no longer available?',
    'Can I get support if I cannot sign in?',
];

const results = [];
for (const question of questions) {
    const topicId = answerGuideQuestion({ question }).topicId;
    const directId = answerGuideOracleFact(question)?.topicId || null;
    const facts = retrieveGuideOracleFacts(question, topicId).map(({ id, title }) => ({ id, title }));
    let rawAnswer = null;
    let bridgeStatus = null;
    const env = { GUIDE_CHAT_ENABLED: 'true', GUIDE_AI_GATEWAY_ID: GUIDE_PILOT_GATEWAY_ID, AI: { run: async (model, params, options) => {
        const response = await fetch(bridge, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, params, options }) });
        bridgeStatus = response.status;
        if (!response.ok) throw new Error(`Local bridge returned ${response.status}`);
        const result = await response.json();
        rawAnswer = result?.response ?? result?.choices?.[0]?.message?.content ?? null;
        return result;
    } } };
    const selected = await answerGuideWithCloudflare({ question, topicId, pageContext: 'CareAround', env });
    results.push({ question, topicId, directId, facts, bridgeStatus, rawAnswer,
        displayedAnswer: selected?.message ?? null, selectedFactIds: selected?.sources.map(({ id }) => id) ?? [],
        outcome: bridgeStatus === null ? 'no_model_call' : selected ? 'reviewed_facts_selected' : 'reviewed_fallback',
        humanReview: null });
    console.log(`${results.length}/${questions.length} ${bridgeStatus ?? 'no call'} ${question}`);
}

const evidence = { fictionalQuestionsOnly: true, model: GUIDE_CHAT_MODEL,
    oracleVersion: GUIDE_ORACLE_VERSION, checkedAt: new Date().toISOString(),
    note: 'Raw model output contains only fact IDs; displayed text comes from reviewed server-owned facts. Direct-ID questions bypass AI in the normal route. Human relevance review is required.',
    results };
await writeFile(new URL('../docs/evidence/guide-oracle-live-selection-20260929.json', import.meta.url),
    `${JSON.stringify(evidence, null, 2)}\n`);
