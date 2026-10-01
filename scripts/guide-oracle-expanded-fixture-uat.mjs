// Read-only questions against the disposable, fictional CareAround fixture only.
// CAREAROUND_SUPPORT_FIXTURE=true node scripts/guide-oracle-expanded-fixture-uat.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit disposable fixture mode is required.');
const selected = JSON.parse(await readFile(new URL('../docs/evidence/guide-oracle-expanded-selection-20260929.json', import.meta.url)));
assert.equal(selected.fictionalQuestionsOnly, true);
const origin = 'http://127.0.0.1:8792';
const results = [];
for (const [index, item] of selected.results.entries()) {
    const response = await fetch(`${origin}/api/guide/answer`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.19',
            Cookie: 'carearound_support_fixture=staff' },
        body: JSON.stringify({ question: item.question, pageContext: 'CareAround', useAi: true }) });
    const answer = await response.json();
    const factIds = answer.sources?.map(({ id }) => id) || [];
    const expectedFact = item.expected.some((id) => factIds.includes(id) || answer.topicId === id);
    const record = { question: item.question, status: response.status, answerSource: answer.answerSource,
        topicId: answer.topicId, factIds, expectedFact, message: answer.message || null };
    results.push(record);
    assert.equal(response.status, 200, item.question);
    assert.equal(expectedFact, true, item.question);
    assert.ok(record.message, item.question);
    assert.notEqual(answer.aiStatus, 'limited', item.question);
    console.log(`PASS ${index + 1}/${selected.results.length} ${item.question}`);
}
const versionTag = GUIDE_ORACLE_VERSION.replace(/[^a-z0-9]+/gi, '-');
await writeFile(new URL(`../docs/evidence/guide-oracle-expanded-fixture-${versionTag}.json`, import.meta.url),
    `${JSON.stringify({ fictionalFixtureOnly: true, oracleVersion: GUIDE_ORACLE_VERSION,
        referenceSelectionVersion: selected.oracleVersion, checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
