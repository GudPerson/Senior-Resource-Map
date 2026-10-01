// Offline context-retrieval evidence only: no browser, database or model call.
import { readFile, writeFile } from 'node:fs/promises';
import { GUIDE_ORACLE_VERSION, retrieveGuideOracleFacts } from '../server/src/utils/guideOracleKnowledge.js';

const baseline = JSON.parse(await readFile(new URL('../docs/evidence/guide-oracle-retrieval-baseline-20260930.json', import.meta.url), 'utf8'));
// This was separate validation at .41. Later reviewed relation corrections
// promote the reused questions to development evidence, never fresh validation.
const holdout = [
    ['What keeps the owner map safe when a visitor uses Copy to My Maps?', ['shared-map-copy']],
    ['Which parts of a generated place version survive template propagation?', ['offering-template-propagation']],
    ['Where can I add a dated note without changing a provider session?', ['calendar-personal-entry']],
    ['Are exported resource workbooks refreshed after the listing changes?', ['my-map-exports']],
    ['Do I become a listing editor by saving an Offering?', ['saved-versus-managed']],
    ['Can a website embed reveal all of my resource notes?', ['embedded-map-notes']],
    ['Does a private planning pin become a public centre listing?', ['my-places']],
    ['Who should confirm my registration for an activity?', ['provider-contact', 'plans-not-bookings']],
    ['Should I trust the listed fee and remaining capacity as a confirmed booking?', ['provider-availability']],
    ['Can I switch the app interface to Tamil?', ['language-choice']],
    ['How are Organisation Staff and Admin roles different?', ['organization-workspace']],
    ['Where do I amend a weekly series on an existing Offering?', ['offering-schedule-edit']],
    ['Does a blank mandatory profile field establish that I cannot participate?', ['offering-profile-missing']],
    ['Can one service use several Host Locations within one service area?', ['offering-multi-host']],
    ['Can this app forecast tomorrow’s rainfall?', []],
    ['Where can I buy train tickets to Kuala Lumpur?', []],
    ['Could it rebalance a stock portfolio for me?', []],
    ['How can I fix my computer graphics driver?', []],
    ['Can I translate a restaurant menu into French?', []],
    ['Will CareAround insure my house against flooding?', []],
].map(([question, expected]) => ({ question, expected }));

const check = ({ question, expected }) => {
    const retrieved = retrieveGuideOracleFacts(question).map(({ id }) => id);
    return { question, expected, retrieved, contextHit: expected.length
        ? expected.some((id) => retrieved.includes(id)) : retrieved.length === 0 };
};
const summarize = (rows) => ({ total: rows.length, contextHits: rows.filter((row) => row.contextHit).length,
    supportedHits: rows.filter((row) => row.expected.length && row.contextHit).length,
    supportedQuestions: rows.filter((row) => row.expected.length).length,
    unrelatedRejected: rows.filter((row) => !row.expected.length && row.contextHit).length,
    unrelatedQuestions: rows.filter((row) => !row.expected.length).length });
const development = baseline.results.map(check);
const validation = holdout.map(check);
const evidence = { oracleVersion: GUIDE_ORACLE_VERSION, checkedAt: new Date().toISOString(),
    reusedValidationIsDevelopment: GUIDE_ORACLE_VERSION !== '2026-09-30.41',
    historicalExpectedIdsRetained: true,
    comparisonNote: 'Original expected IDs are retained. A newly reviewed replacement or clarification can be useful while failing this historical context-ID comparison; review the complete reply separately.',
    liveModelRequests: 0, scope: 'Offline retrieval of relevant context within four reviewed facts. This is not model selection, displayed-answer relevance, account UAT or whole-product accuracy.',
    baseline: { version: baseline.oracleVersion, summary: summarize(baseline.results) },
    development: { summary: summarize(development), results: development },
    holdout: { summary: summarize(validation), results: validation },
    baselineRegressions: development.filter((row, index) => baseline.results[index].contextHit && !row.contextHit),
};
const versionSuffix = GUIDE_ORACLE_VERSION === '2026-09-30.41' ? '' : `-${GUIDE_ORACLE_VERSION}`;
await writeFile(new URL(`../docs/evidence/guide-oracle-content-retrieval-20260930${versionSuffix}.json`, import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ version: evidence.oracleVersion, baseline: evidence.baseline.summary,
    development: evidence.development.summary, holdout: evidence.holdout.summary,
    baselineRegressions: evidence.baselineRegressions.length,
    remaining: [...development, ...validation].filter((row) => !row.contextHit) }));
