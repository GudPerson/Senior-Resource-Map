import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGuideRoutes } from '../server/src/routes/guide.js';
import { HELP_CONTENT_VERSION, GUIDE_ORACLE_FACTS } from '../server/src/generated/helpKnowledge.js';
import { helpCentreGuideCases } from '../server/test/fixtures/helpCentreGuideCases.js';

assert.ok(process.argv.includes('--offline'), 'Only explicit offline synthetic evaluation is supported.');
const root = fileURLToPath(new URL('..', import.meta.url));
let modelAttempts = 0;
const results = [];
for (const [index, item] of helpCentreGuideCases.entries()) {
    let accountReads = 0;
    const actor = { id: 70000 + index, role: 'standard' };
    const router = createGuideRoutes({ authenticate: async (c, next) => { c.set('user', actor); await next(); },
        directoryAccess: async (_c, next) => next(),
        organizationAccess: async () => { accountReads++; return { platformAdmin: false, workspaceAdmin: true, workspaceView: true }; },
        saved: async () => { accountReads++; return { totalCount: 1, placeCount: 1, offeringCount: 0, names: [{ name: 'FICTIONAL PRIVATE FIXTURE', unavailable: false }] }; },
        helpCapabilities: async () => ({ organization: { workspaceView: true }, audit: { mode: 'none' } }),
    });
    const body = { question: item.question, ...(item.pageContext ? { pageContext: item.pageContext } : {}),
        ...(item.turns ? { turns: item.turns } : {}), ...(item.id === 'missing-private-place' ? { useAi: true } : {}) };
    const response = await router.request('/answer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${index + 1}` }, body: JSON.stringify(body) }, {
        NODE_ENV: 'test', SUPPORT_INBOX_ENABLED: 'true', ...(item.id === 'missing-private-place' ? { GUIDE_CHAT_ENABLED: 'true', GUIDE_SEMANTIC_RETRIEVAL_ENABLED: 'true', AI: { run: async () => { modelAttempts++; throw Error('No model transport in offline evaluation.'); } } } : {}),
    });
    const answer = await response.json();
    const assertions = [];
    const check = (name, passes) => assertions.push({ name, passes });
    check('HTTP 200', response.status === 200);
    for (const pattern of item.required || item.requiredByIndex?.[item.index] || []) check('required ' + pattern, pattern.test(answer.message));
    for (const pattern of item.forbidden || []) check('forbidden ' + pattern, !pattern.test(answer.message));
    if (item.topic) check('expected topic ' + item.topic, answer.topicId === item.topic);
    if (item.answerSource) check('expected answer source ' + item.answerSource, answer.answerSource === item.answerSource);
    if (item.noAccountRead) check('no other-account substitution', accountReads === 0);
    if (item.id === 'missing-private-place') check('complete canonical procedure', answer.message === GUIDE_ORACLE_FACTS.find(fact => fact.id === 'personal-place-map-create').message);
    for (const source of answer.sources || []) check('reviewed section ' + source.id, /^\/help-centre\/[a-z0-9-]+#[a-z0-9-]+$/.test(source.articleRoute || '') && Boolean(source.articleId && source.sectionId));
    results.push({ caseId: item.caseId, family: item.id, question: item.question, pageContext: item.pageContext || '', turns: item.turns || [], actions: answer.actions || [], servedAnswer: answer, syntheticRole: 'standard', status: response.status, message: answer.message,
        topicId: answer.topicId, answerSource: answer.answerSource || 'reviewed', sources: answer.sources || [], assertions, passed: assertions.every(entry => entry.passes) });
}
assert.equal(modelAttempts, 0);
const assertions = results.flatMap(item => item.assertions);
const record = { mode: 'offline real-route synthetic accounts', contentVersion: HELP_CONTENT_VERSION, cases: results.length,
    passedCases: results.filter(item => item.passed).length, assertions: assertions.length, passedAssertions: assertions.filter(item => item.passes).length,
    modelAttempts, paidCalls: 0, wholeOutputHumanReview: 'pending', results };
mkdirSync(resolve(root, 'output/help-centre'), { recursive: true });
const outputJson = JSON.stringify(record, null, 2) + '\n';
writeFileSync(resolve(root, 'output/help-centre/offline-evaluation.json'), outputJson);
const outputDigest = createHash('sha256').update(outputJson).digest('hex');
let markdown = '# Served offline Guide answers for review\n\nContent: `' + HELP_CONTENT_VERSION + '`. Synthetic current accounts and local real-route execution; zero model calls or production writes.\n\n' +
    'Exact JSON output SHA-256: `' + outputDigest + '`. Semantic rubric: v1 in `docs/help-guide-review-checklist.md`; human scores remain pending.\n\n' +
    record.passedCases + '/' + record.cases + ' route cases and ' + record.passedAssertions + '/' + record.assertions + ' explicit assertions pass. These checks cover the frozen clauses and canonical preservation. They are not a live-model score or human whole-output acceptance. Each case includes its preceding turns, complete served answer and action controls.\n\n' +
    'Local reading links use http://127.0.0.1:5181 while the review server is running. Production routes are intended destinations and have not been deployed. Do not infer access or successful writes from a displayed action.\n\n';
for (const item of results) {
    markdown += '## ' + item.caseId + '\n\nQuestion: ' + item.question + '\n\nContext: ' + (item.pageContext || 'none') + '; synthetic role: standard; topic: `' + item.topicId + '`; assertion result: ' + (item.passed ? 'pass' : 'FAIL') + '.\n\n';
    markdown += item.turns.length ? 'Preceding turns (exact fixture input):\n\n```json\n' + JSON.stringify(item.turns, null, 2) + '\n```\n\n' : 'Preceding turns: none.\n\n';
    markdown += item.message + '\n\n';
    markdown += item.actions.length ? 'Served action controls (exact response values; none were executed):\n\n```json\n' + JSON.stringify(item.actions, null, 2) + '\n```\n\n' : 'Served action controls: none.\n\n';
    markdown += item.sources.length ? 'Reviewed sections for local reading: ' + item.sources.map(source => '[' + source.title + '](' + 'http://127.0.0.1:5181' + source.articleRoute + ')').join(', ') + '.\n\n' : 'No article citation is supplied for this clarification/account boundary.\n\n';
}
writeFileSync(resolve(root, 'docs/help-guide-offline-answers.md'), markdown);
console.log(JSON.stringify({ ...record, results: undefined }));
assert.equal(record.passedCases, 60);
assert.equal(record.passedAssertions, record.assertions);
