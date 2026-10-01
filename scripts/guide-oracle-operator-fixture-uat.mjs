// Read-only operator-guidance acceptance against the disposable, fictional fixture.
// CAREAROUND_SUPPORT_FIXTURE=true node scripts/guide-oracle-operator-fixture-uat.mjs
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit disposable fixture mode is required.');
const origin = 'http://127.0.0.1:8792';
const cases = [
    ['staff', 'How do I change the phone number on a programme I manage?', 'reviewed', 'offering-contact-edit', /Profile.*Public contact.*permission/s],
    ['staff', 'How do I update the contact email on a Place I manage?', 'reviewed', 'place-contact-edit', /Location.*Contact email.*Guide cannot change/s],
    ['staff', 'If I switch off an Offering schedule, what happens to upcoming sessions?', 'reviewed', 'offering-schedule-edit', /confirmation.*upcoming sessions.*Care Calendar/s],
    ['staff', 'Can the Guide edit the schedule of my existing Programme?', 'reviewed', 'offering-schedule-edit', /Guide cannot edit the existing Offering/],
    ['staff', 'Do I need Super Admin approval to publish a Place in Discover?', 'reviewed', 'listing-publication-boundary', /separate governed-pilot workflow.*not the general create step/s],
    ['staff', 'Is Resource Claims publication approval needed for every directory listing?', 'reviewed', 'listing-publication-boundary', /not the general create step for every Discover listing/],
    ['staff', 'Can a Resource Group include another organisation’s public Place?', 'reviewed', 'group-other-provider-members', /another provider.*does not transfer its ownership/s],
    ['staff', 'Can I add another organisation’s public Place to my Resource Group?', 'account', 'group-access', /another provider.*does not give you editing rights.*exact managed Group/s],
    ['member', 'Can I add another organisation’s public Place to my Resource Group?', 'account', 'group-access', /another provider.*does not give you editing rights.*does not currently have Manage My Resources access/s],
    ['staff', 'Does adding another provider’s Place to my Group let me edit it?', 'reviewed', 'group-other-provider-members', /does not transfer its ownership.*permission to edit/s],
    ['staff', 'Can I target my Resource Group to certain Regions?', 'reviewed', 'group-target-regions', /Target region\/s.*selected Region boundary/s],
    ['staff', 'Can providers see how many people saved their listing?', 'reviewed', 'provider-usage-boundary', /cannot look up a provider report.*cannot verify a provider-facing usage report/s],
    ['staff', 'Can a provider see who viewed its listing?', 'reviewed', 'provider-usage-boundary', /cannot.*identify those people/s],
    ['staff', 'How do I contact a service provider?', 'reviewed', 'provider-contact', /open its details.*phone number, email, WhatsApp/s],
];

const results = [];
for (const [index, [role, question, answerSource, topicId, messagePattern]] of cases.entries()) {
    const response = await fetch(`${origin}/api/guide/answer`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${30 + index}`,
        Cookie: `carearound_support_fixture=${role}`,
    }, body: JSON.stringify({ question, pageContext: 'Manage resources', useAi: true }) });
    const answer = await response.json();
    assert.equal(response.status, 200, question);
    assert.equal(answer.answerSource, answerSource, question);
    assert.equal(answer.topicId, topicId, question);
    assert.match(answer.message, messagePattern, question);
    results.push({ role, question, answerSource: answer.answerSource, topicId: answer.topicId,
        factIds: answer.sources?.map(({ id }) => id) || [], message: answer.message });
    console.log(`PASS ${index + 1}/${cases.length} ${question}`);
}
await writeFile(new URL('../docs/evidence/guide-oracle-operator-fixture-20260929.json', import.meta.url),
    `${JSON.stringify({ fictionalFixtureOnly: true, oracleVersion: GUIDE_ORACLE_VERSION,
        checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
