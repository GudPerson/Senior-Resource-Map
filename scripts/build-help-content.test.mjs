import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compileHelpContent, generateHelpContent } from './build-help-content.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const review = { date: '2026-10-02', sourceRevision: 'b8345be4d2f7a097e81cb03eef64b473abd0cec9', method: 'source-review', owner: 'Product', evidence: ['client/src/example.jsx:1-10'] };
const fact = (id, message = 'Reviewed body') => ({ id, title: 'Reviewed fact', keywords: ['help'], message, route: '/help', evidence: 'Source span', reviewed: '2026-10-02' });
const article = (id = 'HC-01', overrides = {}) => ({ id, slug: 'article-' + id.toLowerCase(), title: 'Reviewed title', summary: 'Reviewed summary', category: 'getting-started', audiences: ['Everyone'], visibility: 'public', status: 'approved', review, sections: [{ id: 'overview', title: 'Overview', facts: [fact('help-overview')] }], relatedArticleIds: [], ...overrides });
function fixture(t, articles = [article()], manifest = {}) {
    const temp = mkdtempSync(resolve(tmpdir(), 'carearound-help-content-'));
    t.after(() => rmSync(temp, { recursive: true, force: true }));
    mkdirSync(resolve(temp, 'content/help/articles'), { recursive: true });
    writeFileSync(resolve(temp, 'content/help/manifest.json'), JSON.stringify({ version: 'test.1', categories: [{ id: 'getting-started', title: 'Getting started' }], topics: [{ id: 'overview', label: 'Read help' }], guideFactOrder: ['help-overview'], ...manifest }));
    articles.forEach((entry, index) => writeFileSync(resolve(temp, 'content/help/articles', index + '.json'), JSON.stringify(entry)));
    return temp;
}

test('public artifact excludes every restricted article and all internal fact/review fields', t => {
    const privateArticle = article('HC-02', { visibility: 'admin', title: 'RESTRICTED TITLE', summary: 'RESTRICTED SUMMARY', sections: [{ id: 'overview', title: 'RESTRICTED SECTION', facts: [fact('admin-only', 'RESTRICTED BODY')] }] });
    const compiled = compileHelpContent({ root: fixture(t, [article(), privateArticle]) });
    assert.equal(compiled.articles.length, 2);
    assert.equal(compiled.publicData.articles.length, 1);
    const publicJSON = JSON.stringify(compiled.publicData);
    for (const forbidden of ['RESTRICTED', 'sourceRevision', 'evidence', 'visibility', 'keywords', 'reviewed"', 'facts"']) assert.ok(!publicJSON.includes(forbidden), forbidden);
    assert.equal(compiled.publicData.articles[0].sections[0].paragraphs[0], 'Reviewed body');
    assert.equal(compiled.facts[0].articleRoute, '/help-centre/article-hc-01#overview');
});

test('procedural Guide answer derives all ordered steps and privacy notes from its reader section', t => {
    const entry = article();
    entry.sections[0] = { id: 'steps', title: 'Create', paragraphs: ['Start here.'], steps: ['Choose a point.', 'Review and Save.'], notes: ['It stays private.'], facts: [{ ...fact('help-overview'), message: undefined, answerKind: 'procedure' }] };
    const compiled = compileHelpContent({ root: fixture(t, [entry]) });
    assert.equal(compiled.facts[0].message, 'Start here.\n\n1. Choose a point.\n\n2. Review and Save.\n\nIt stays private.');
    assert.deepEqual(compiled.publicData.articles[0].sections[0].steps, ['Choose a point.', 'Review and Save.']);
});

test('draft and retired content is never delivered', t => {
    const draft = article('HC-02', { status: 'draft', review: undefined, sections: [{ id: 'draft', title: 'Draft', facts: [fact('draft-fact', 'UNREVIEWED')] }] });
    const retired = article('HC-03', { status: 'retired', review: undefined, sections: [{ id: 'retired', title: 'Retired', facts: [fact('retired-fact', 'RETIRED')] }] });
    const compiled = compileHelpContent({ root: fixture(t, [article(), draft, retired]) });
    assert.equal(compiled.articles.length, 1);
    assert.equal(compiled.facts.length, 1);
});

test('invalid identities, missing evidence and unknown visibility fail closed', t => {
    for (const [name, mutate, pattern] of [
        ['duplicate slug', entries => entries.push(article('HC-02', { slug: entries[0].slug })), /identity/],
        ['duplicate fact', entries => entries.push(article('HC-02')), /fact/],
        ['duplicate section', entries => entries[0].sections.push(entries[0].sections[0]), /section/],
        ['missing review', entries => delete entries[0].review, /review evidence/],
        ['unknown visibility', entries => entries[0].visibility = 'staff', /visibility/],
        ['unsupported section policy', entries => entries[0].sections[0].visibility = 'audit', /section visibility/],
        ['unsupported fact policy', entries => entries[0].sections[0].facts[0].visibility = 'audit', /fact visibility/],
        ['remote route', entries => entries[0].sections[0].facts[0].route = '//external.example', /fact/],
        ['empty procedure', entries => entries[0].sections[0].facts[0].answerKind = 'procedure', /fact body|ordered steps/],
    ]) {
        const entries = [article()]; mutate(entries);
        assert.throws(() => compileHelpContent({ root: fixture(t, entries) }), pattern, name);
    }
});

test('broken links and public links to restricted articles are rejected', t => {
    const first = article('HC-01', { relatedArticleIds: ['HC-02'] });
    assert.throws(() => compileHelpContent({ root: fixture(t, [first]) }), /broken related/);
    const second = article('HC-02', { visibility: 'admin', sections: [{ id: 'overview', title: 'Overview', facts: [fact('private-fact')] }] });
    assert.throws(() => compileHelpContent({ root: fixture(t, [first, second]) }), /restricted title/);
});

test('all existing fact IDs must be mapped and topic identity must remain unique', t => {
    assert.throws(() => compileHelpContent({ root: fixture(t, [article()], { guideFactOrder: ['help-overview', 'legacy-missing'] }) }), /unmapped existing Guide fact legacy-missing/);
    assert.throws(() => compileHelpContent({ root: fixture(t, [article()], { topics: [{ id: 'overview', label: 'One' }, { id: 'overview', label: 'Two' }] }) }), /duplicate topics/);
});

test('generation is deterministic and freshness check catches stale outputs', t => {
    const temp = fixture(t);
    const initial = generateHelpContent({ root: temp });
    const again = generateHelpContent({ root: temp, check: true });
    assert.deepEqual(again, initial);
    writeFileSync(resolve(temp, 'client/src/generated/helpArticles.json'), '{}');
    assert.throws(() => generateHelpContent({ root: temp, check: true }), /stale/);
    assert.deepEqual(generateHelpContent({ root: temp }), initial);
});

test('published corpus preserves original identities and bodies except five documented source-reviewed corrections', () => {
    const baseline = JSON.parse(readFileSync(resolve(root, 'server/test/fixtures/helpMigrationBaseline.json'), 'utf8'));
    const compiled = compileHelpContent({ root });
    const topics = new Map(compiled.topics.map(topic => [topic.id, topic]));
    const facts = new Map(compiled.facts.map(({ articleId, sectionId, articleRoute, visibility, ...original }) => [original.id, original]));
    assert.equal(baseline.topics.length, 12);
    assert.equal(baseline.facts.length, 105);
    for (const entry of baseline.topics) assert.equal(digest(topics.get(entry.id)), entry.digest, entry.id);
    const corrections = new Map((baseline.editorialCorrections || []).map((entry) => [entry.id, entry]));
    assert.deepEqual([...corrections.keys()].sort(), ['directory-export-boundary', 'governance-region-group', 'my-map-exports', 'private-map-export-sharing', 'resource-export-context']);
    for (const correction of corrections.values()) {
        assert.equal(correction.reviewedAt, '2026-10-02');
        assert.ok(correction.reviewer && correction.reason && correction.evidence.length);
        assert.match(correction.expectedDigest, /^[a-f0-9]{64}$/);
    }
    for (const entry of baseline.facts) {
        const correction = corrections.get(entry.id);
        if (correction) assert.notEqual(correction.expectedDigest, entry.digest, 'Original migration digest remains preserved.');
        assert.equal(digest(facts.get(entry.id)), correction?.expectedDigest || entry.digest, entry.id);
    }
});

test('published Personal place procedure has full verified steps and boundaries', () => {
    const compiled = compileHelpContent({ root });
    const procedure = compiled.facts.find(entry => entry.id === 'personal-place-map-create');
    assert.ok(procedure);
    assert.equal(procedure.answerKind, 'procedure');
    const article = compiled.articles.find(entry => entry.id === procedure.articleId);
    const section = article.sections.find(entry => entry.id === procedure.sectionId);
    assert.match(section.paragraphs.join(' '), /signed in.*map you own/i);
    const orderedClauses = [/My Directory.*My Maps/, /\+ Personal place/, /Choose map location.*click or tap/,
        /name and category/, /address or postal code.*Find location/, /Review.*Save/];
    assert.equal(section.steps.length, orderedClauses.length);
    section.steps.forEach((step, index) => assert.match(step, orderedClauses[index], 'Ordered step ' + (index + 1)));
    for (const text of ['Personal place', 'Choose map location', 'Find location', 'This point has no postal address', 'Save', 'My Places', 'Discover', 'Shared Maps', 'print']) assert.ok(procedure.message.includes(text), text);
    assert.match(procedure.articleRoute, /^\/help-centre\/[^#]+#[a-z-]+$/);
});

test('Personal place location verification is complete when read independently or used by Guide', () => {
    const compiled = compileHelpContent({ root });
    const article = compiled.publicData.articles.find(entry => entry.id === 'HC-10');
    const section = article.sections.find(entry => entry.id === 'verify-location');
    const procedure = compiled.facts.find(entry => entry.id === 'personal-place-location-verification');
    assert.equal(procedure.articleRoute, article.articleRoute + '#verify-location');
    assert.equal(procedure.message, [
        ...section.paragraphs,
        ...section.steps.map((step, index) => `${index + 1}. ${step}`),
        ...section.notes,
    ].join('\n\n'));
    assert.match(procedure.message, /Sign in.*your own Personal places/);
    assert.match(procedure.message, /My Directory → My Places.*place you own/);
    assert.match(procedure.message, /My Map you own/);
    assert.match(procedure.message, /Guests.*cannot save Personal places/);
    assert.match(section.steps[1], /Find location.*review/);
    assert.match(section.steps[2], /change the address, postal code or coordinates.*verify.*again/);
    assert.match(section.steps[3], /no postal address.*genuine coordinate-only/);
    assert.match(section.steps.at(-1), /Select Save.*saving succeeds.*editor closes.*shows the saved location/);
    assert.match(procedure.message, /verification is incomplete.*temporarily unavailable.*retry later/);
    assert.match(procedure.message, /does not add them to Discover or public Shared Maps/);
    assert.match(procedure.message, /owner map exports can include.*review downloaded files before sharing/);
});

test('every approved reader section has a Guide evidence record with the same reading anchor and policy', () => {
    const compiled = compileHelpContent({ root });
    for (const article of compiled.articles) for (const section of article.sections) {
        const evidence = compiled.facts.filter(fact => fact.articleId === article.id && fact.sectionId === section.id);
        assert.ok(evidence.length, article.id + '#' + section.id);
        for (const fact of evidence) {
            assert.equal(fact.articleRoute, article.articleRoute + '#' + section.id);
            assert.equal(fact.visibility, article.visibility);
        }
    }
});
