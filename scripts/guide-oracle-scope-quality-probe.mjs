// Prospective wording sample authored after .45 code was fixed. No model call.
// Preserve raw replies; future reuse is development evidence, not a fresh test.
// Identity profile authored after .46 Guide code was fixed; earlier scope data stays unchanged.
// Membership profile authored after .47 runtime changes and full regression checks.
// Routing profile authored after .48 runtime changes and full regression checks.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION } from '../server/src/utils/guideOracleKnowledge.js';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit fictional fixture mode is required.');
const origin = 'http://127.0.0.1:8792';
const control = await (await fetch(`${origin}/__fixture/guide/semantic`)).json();
assert.equal(control.fixture, true);
assert.equal(control.enabled, false, 'Do not combine fresh wording with injected model selections.');
const profile = process.env.CAREAROUND_GUIDE_QUALITY_PROFILE || 'scope';
assert.ok(['scope', 'identity', 'membership', 'routing'].includes(profile), 'Only the named fictional question profiles may run.');
const authoredAfterOracleVersion = ({ scope: '2026-10-01.45', identity: '2026-10-01.46',
    membership: '2026-10-01.47', routing: '2026-10-01.48' })[profile];
const prospective = GUIDE_ORACLE_VERSION === authoredAfterOracleVersion;
const questions = profile === 'identity' ? [
    'If I bookmark a service, does its owner receive my personal information?',
    'Is my name sent to the centre when I heart one of its programmes?',
    'I used a membership QR. Is that the same as making a private bookmark?',
    'Does adding a host centre to an Offering enrol everyone who saved it?',
    'Is a Programme’s host link the same as my membership link to that Place?',
    'Can the organisation running a listing recognise me from my favourite?',
    'Can you check whether the provider has already been told my name?',
    'If I join a Place after saving its service, will the staff see my name in the membership preview?',
] : profile === 'membership' ? [
    'Does the organisation learn who I am when I mark its class as a favourite?',
    'What is the difference between a bookmarked centre and joining through its QR?',
    'If I have joined a Place, is its listing now automatically in My Directory?',
    'Would linking another venue enrol the people who bookmarked my programme?',
    'Can you verify whether the centre already received my personal details?',
    'Can a Place manager identify me because I saved a listing?',
    'Will someone who saved our Offering be enrolled when its host centre changes?',
    'How can I see which centres have my membership without showing you my profile?',
] : profile === 'routing' ? [
    'Will changing the host of an Offering alter the membership of people who saved it?',
    'Show me the members who bookmarked our service.',
    'Does joining via QR put the centre into my saved list as well?',
    'Where do I find the Places connected to my account by membership?',
    'If I favourite an activity, does the organiser find out who I am?',
    'How do I check a friend’s Place memberships in their Profile?',
    'Can the provider already see my details, or are you only explaining what saving does?',
    'Does bookmarking a Place give me access to edit every service linked to it?',
] : [
    'Once I’m an Owner at one centre, can I edit a different Place?',
    'If a Staff assignment is revoked, do the old rights let me edit that Place?',
    'Can an Org Admin edit a Place without any direct assignment?',
    'Is the host location of a service the same thing as a user’s Place membership?',
    'If I connect my account to a centre, may I edit its listing?',
    'If I relink a Programme to a different centre, will chat perform the edit?',
    'Where should I amend the host of an Offering that already exists?',
    'Does adding a colleague as Staff transfer the Place to their organisation?',
];
const before = await (await fetch(`${origin}/__fixture/guide/state`)).json();
const observations = [];
for (const [index, question] of questions.entries()) {
    const response = await fetch(`${origin}/api/guide/answer`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'cf-connecting-ip': `198.51.100.${230 + index}`,
        Cookie: 'carearound_support_fixture=staff',
    }, body: JSON.stringify({ question, useAi: false, pageContext: 'CareAround' }) });
    assert.equal(response.status, 200, question);
    const answer = await response.json();
    assert.ok(!['ai', 'simulation'].includes(answer.answerSource), question);
    observations.push({ question, answer });
}
assert.deepEqual(await (await fetch(`${origin}/__fixture/guide/state`)).json(), before);
const evidence = { checkedAt: new Date().toISOString(), oracleVersion: GUIDE_ORACLE_VERSION, profile,
    authoredAfterOracleVersion, prospective,
    fictionalFixtureOnly: true, aiRequested: false, liveModelRequests: 0, syntheticResourceStateUnchanged: true,
    scope: (prospective ? 'Prospective AI-off complete-reply sample.' : 'Development replay of an earlier question set.')
        + ' No actual semantic-selection or whole-product accuracy claim. No pattern-based pass percentage. Preserve this snapshot when questions become development cases.',
    observations };
const path = new URL(`../docs/evidence/guide-oracle-${profile}-quality-${GUIDE_ORACLE_VERSION}.json`, import.meta.url);
await writeFile(path, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ version: GUIDE_ORACLE_VERSION, questions: observations.length,
    liveModelRequests: 0, syntheticResourceStateUnchanged: true, evidence: path.pathname }));
