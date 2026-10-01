// Prospective wording sample authored after .44 was fixed. No model request.
// Never overwrite a prior sample or count reused wording as fresh validation.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit fictional fixture mode is required.');
const origin = 'http://127.0.0.1:8792';
const fixture = await (await fetch(`${origin}/__fixture/guide/semantic`)).json();
assert.equal(fixture.fixture, true);
assert.equal(fixture.enabled, false, 'Keep this prospective AI-off sample separate from injected selections.');
const cases = [
    ['staff', 'If a provider temporarily takes a Place off the app, do my favourites still keep it?'],
    ['staff', 'When an Offering becomes visible again, do I have to heart it a second time?'],
    ['staff', 'Is an unavailable saved item proof that the provider deleted the listing?'],
    ['staff', 'If a listing is hidden from ordinary users, can an administrator still see the saved item?'],
    ['staff', 'Can you switch off saved-service notices for me?'],
    ['staff', 'Have you actually enabled email alerts, or are you just giving me the steps?'],
    ['staff', 'Do I need to save a Programme before it can be put into My Plans?'],
    ['member', 'Does an Owner assignment on one Place let me manage every Place?'],
    ['guest', 'Could my favourites be shown on a public map without publishing anything?'],
    ['member', 'I saved a Programme. Can the provider see my name just because I hearted it?'],
    ['staff', 'If I change a linked Place, will the Guide change an existing Programme for me?'],
    ['staff', 'Is deleting a file I downloaded the same as removing a resource from CareAround?'],
    ['staff', 'What is the difference between a saved list, a private map and a published Shared Map?'],
    ['staff', 'Are disabled notification categories still checked after I close CareAround?'],
    ['staff', 'Can you find a resource for me and save it without my review?'],
];
const before = await (await fetch(`${origin}/__fixture/guide/state`)).json();
const observations = [];
for (const [index, [role, question]] of cases.entries()) {
    const response = await fetch(`${origin}/api/guide/answer`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${210 + index}`,
        ...(role !== 'guest' ? { Cookie: `carearound_support_fixture=${role}` } : {}),
    }, body: JSON.stringify({ question, useAi: false, pageContext: 'CareAround' }) });
    assert.equal(response.status, 200, question);
    const answer = await response.json();
    assert.ok(!['ai', 'simulation'].includes(answer.answerSource), question);
    observations.push({ role, question, answer });
}
assert.deepEqual(await (await fetch(`${origin}/__fixture/guide/state`)).json(), before,
    'These Guide questions must not write resources or saved entries.');
const evidence = { checkedAt: new Date().toISOString(), oracleVersion: GUIDE_ORACLE_VERSION,
    fictionalFixtureOnly: true, aiRequested: false, liveModelRequests: 0, syntheticResourceStateUnchanged: true,
    scope: 'Prospective AI-off complete-reply sample, not actual semantic selection or a whole-product accuracy score. No pattern-based pass percentage is computed. Preserve this snapshot if examples later become development cases.',
    observations };
const path = new URL(`../docs/evidence/guide-oracle-lifecycle-quality-${GUIDE_ORACLE_VERSION}.json`, import.meta.url);
await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ version: GUIDE_ORACLE_VERSION, questions: observations.length,
    liveModelRequests: 0, syntheticResourceStateUnchanged: true, evidence: path.pathname }));
