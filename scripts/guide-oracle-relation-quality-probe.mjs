// Prospective local wording probe, authored after .42 changes were fixed.
// Its pattern observations require complete-answer review and are not an accuracy score.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Fictional local fixture mode required');
const questions = [
    ['Does bookmarking a service give me management rights?', /does not.*permission to edit/s],
    ['Will a hidden resource be permanently deleted?', /visibility.*separate from Delete/s],
    ['Can two members see different restricted services?', /profile criteria.*membership/s],
    ['Will enabling email in Profile start sending schedule notifications?', /external delivery remains disabled/],
    ['Does my downloaded My Map Excel file stay up to date?', /snapshot/],
    ['If I tick WhatsApp in Profile, will saved-service alerts be sent there?', /external delivery remains disabled/],
    ['How can I get a text message for saved schedule updates?', /external delivery remains disabled/],
    ['Where can I turn on notices about a saved programme moving?', /Saved schedule changes.*Notification preferences/s],
    ['Why can my neighbour see a member-only service that I cannot?', /profile criteria|audience scope|eligibility/],
    ['Will hearting an activity appoint me as the manager?', /does not.*permission to edit/s],
    ['If I hide a public Place, is it just invisible or actually gone?', /visibility.*separate from Delete/s],
    ['Does a copied resource spreadsheet keep fetching new provider details?', /snapshot|Which download/],
    ['Is the downloaded workbook a live connection to the app?', /snapshot|Which download/],
    ['Do membership checks happen separately from signing up for a Programme?', /separate from.*(?:booking|registration)|does not.*register/s],
    ['Could the same restricted service be visible to one person and hidden from another?', /profile criteria|audience scope/],
    ['Are saved-resource notices sent by email if I close the app?', /external delivery remains disabled/],
    ['Does hiding a listing remove everybody’s saved copy?', /unavailable|saved|does not|cannot verify/],
    ['Is saving an Offering sufficient to let me change its published details?', /does not.*permission to edit/s],
    ['What is different about a downloaded map file and a published Shared Map?', /snapshot|refresh|published/],
    ['Can I turn on WhatsApp alerts from the Guide?', /cannot|external delivery remains disabled/],
].map(([question, expectation]) => ({ question, expectation }));
const results = [];
for (const [index, { question, expectation }] of questions.entries()) {
    const response = await fetch('http://127.0.0.1:8792/api/guide/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json',
            Cookie: 'carearound_support_fixture=staff', 'cf-connecting-ip': `198.51.100.${150 + index}` },
        body: JSON.stringify({ question, useAi: false }),
    });
    const answer = await response.json();
    results.push({ question, status: response.status, expectation: expectation.source,
        wordingPresent: response.status === 200 && expectation.test(answer.message || ''),
        answerSource: answer.answerSource, topicId: answer.topicId, message: answer.message,
        actions: answer.actions, sources: answer.sources });
}
const evidence = { oracleVersion: GUIDE_ORACLE_VERSION, checkedAt: new Date().toISOString(),
    fictionalFixtureOnly: true, liveModelRequests: 0, usedToTuneThisVersion: false,
    scope: 'Fresh wording observations after .42 changes. Pattern presence is diagnostic, not complete-answer accuracy; manual review required.', results };
await writeFile(new URL(`../docs/evidence/guide-oracle-relation-quality-${GUIDE_ORACLE_VERSION}.json`, import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ total: results.length, wordingPresent: results.filter((row) => row.wordingPresent).length,
    missing: results.filter((row) => !row.wordingPresent).map((row) => ({ question: row.question, topicId: row.topicId, message: row.message })) }));
