import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeCareMapTerminology } from '../shared/careMapTerminology.js';
import { cmsReadingArticle } from '../shared/helpContentCms.js';
import { compileHelpContent } from './build-help-content.mjs';

test('compiled Help and legacy Guide answers share display names without changing private boundaries or source', t => {
    const root = mkdtempSync(join(tmpdir(), 'care-map-terminology-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const folder = join(root, 'content/help/articles');
    mkdirSync(folder, { recursive: true });
    const review = { date: '2026-10-07', sourceRevision: 'a'.repeat(40), method: 'source-review', owner: 'Product', evidence: ['Original My Map review'] };
    const fact = { id: 'help-my-maps', title: 'Open My Maps', keywords: ['my maps'], message: 'My Map notes stay private.', route: '/my-directory?section=my-maps', actionLabel: 'Open My Maps', evidence: 'Reviewed My Map source', reviewed: '2026-10-07' };
    const article = { id: 'HC-01', slug: 'my-map', title: 'Create a My Map', summary: 'Manage My Maps.', category: 'my-maps', audiences: ['Everyone'], visibility: 'public', status: 'approved', review, relatedArticleIds: [], sections: [{ id: 'my-map', title: 'My Map instructions', paragraphs: ['Open My Maps.'], steps: ['Choose your My Map.'], notes: ['My Map notes stay private.'], facts: [fact] }] };
    const restricted = { ...article, id: 'HC-02', slug: 'private-my-map', visibility: 'admin', title: 'Restricted My Maps', sections: [{ ...article.sections[0], facts: [{ ...fact, id: 'private-my-map' }] }] };
    const manifest = { version: 'test.1', categories: [{ id: 'my-maps', title: 'My Maps' }], topics: [{ id: 'my-maps', label: 'Open My Maps', signedIn: true }], guideFactOrder: ['help-my-maps'] };
    const source = JSON.stringify(article);
    writeFileSync(join(root, 'content/help/manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(folder, 'public.json'), source);
    writeFileSync(join(folder, 'restricted.json'), JSON.stringify(restricted));

    const compiled = compileHelpContent({ root });
    const priorCompiled = compileHelpContent({ root, normalizeTerminology: false });
    const publicArticle = compiled.publicData.articles[0];
    const guide = compiled.facts.find(entry => entry.id === fact.id);
    assert.equal(priorCompiled.publicData.articles[0].title, 'Create a My Map');
    assert.equal(priorCompiled.facts.find(entry => entry.id === fact.id).message, 'My Map notes stay private.');
    assert.deepEqual(priorCompiled.facts.find(entry => entry.id === fact.id).keywords, ['my maps']);
    assert.equal(priorCompiled.topics[0].label, 'Open My Maps');
    assert.deepEqual(compiled, normalizeCareMapTerminology(priorCompiled));
    assert.equal(compiled.articles.length, 2);
    assert.equal(compiled.publicData.articles.length, 1);
    assert.equal(publicArticle.title, 'Create a Care Map');
    assert.equal(publicArticle.summary, 'Manage Care Maps.');
    assert.deepEqual(publicArticle.sections[0].paragraphs, ['Open Care Maps.']);
    assert.deepEqual(publicArticle.sections[0].steps, ['Choose your Care Map.']);
    assert.deepEqual(publicArticle.sections[0].notes, ['Care Map notes stay private.']);
    assert.equal(guide.message, 'Care Map notes stay private.');
    assert.equal(guide.title, 'Open Care Maps');
    assert.equal(guide.actionLabel, 'Open Care Maps');
    assert.equal(compiled.topics[0].label, 'Open Care Maps');
    assert.equal(compiled.categories[0].title, 'Care Maps');
    assert.equal(compiled.publicData.categories[0].title, 'Care Maps');
    assert.equal(publicArticle.slug, article.slug);
    assert.equal(publicArticle.category, article.category);
    assert.equal(publicArticle.sections[0].id, 'my-map');
    assert.equal(guide.route, fact.route);
    assert.equal(guide.articleRoute, '/help-centre/my-map#my-map');
    assert.equal(compiled.topics[0].id, 'my-maps');
    assert.equal(compiled.topics[0].signedIn, true);
    assert.equal(compiled.articles.find(entry => entry.id === 'HC-02').visibility, 'admin');
    assert.deepEqual(compiled.articles.find(entry => entry.id === 'HC-01').review, review);
    assert.equal(guide.evidence, fact.evidence);
    assert.ok(!JSON.stringify(compiled.publicData).includes('Restricted'));
    assert.ok(!JSON.stringify(compiled.publicData).includes('sourceRevision'));
    assert.equal(readFileSync(join(folder, 'public.json'), 'utf8'), source);
});

test('Guide retrieval retains former phrases and gains deduplicated Care Map aliases', () => {
    const input = { keywords: ['my map', 'My Maps', 'map', 'my map'], queryRequiresAny: ['not used in my maps', 'remove'], route: '/my-directory?section=my-maps' };
    const normalized = normalizeCareMapTerminology(input);
    assert.deepEqual(normalized.keywords, ['my map', 'My Maps', 'map', 'care map', 'Care Maps']);
    assert.deepEqual(normalized.queryRequiresAny, ['not used in my maps', 'remove', 'not used in care maps']);
    for (const phrase of ['my map', 'care map']) assert.ok(normalized.keywords.includes(phrase));
    for (const phrase of ['not used in my maps', 'not used in care maps']) assert.ok(normalized.queryRequiresAny.includes(phrase));
    assert.deepEqual(normalizeCareMapTerminology(normalized), normalized);
    assert.deepEqual(input.keywords, ['my map', 'My Maps', 'map', 'my map']);
    assert.equal(normalized.route, input.route);
});

test('only bounded supported casing changes and review evidence and identity fields remain literal', () => {
    const input = { message: 'My Map; My Maps; my map; my maps; My Mapping; my mapsomething; MY MAP; My map.', id: 'My Map', slug: 'My Map', intent: 'My Map', visibility: 'My Map', answerKind: 'procedure', status: 'approved', reviewed: '2026-10-07', evidence: 'My Map evidence', review: { title: 'My Map source title', owner: 'My Map', evidence: ['My Maps'], sourceRevision: 'a'.repeat(40) } };
    const output = normalizeCareMapTerminology(input);
    assert.equal(output.message, 'Care Map; Care Maps; care map; care maps; My Mapping; my mapsomething; MY MAP; My map.');
    const { message: originalMessage, ...originalProtected } = input;
    const { message: outputMessage, ...outputProtected } = output;
    assert.deepEqual(outputProtected, originalProtected);
    assert.equal(input.message, originalMessage);
});

test('nested action labels and accessible media text receive the same terminology', () => {
    const input = { actions: [{ label: 'Open My Maps', route: '/my-directory?section=my-maps' }], media: [{ id: 'my-map-image', caption: 'My Map example', alt: 'My Map preview', transcript: 'Choose My Maps.' }], guideMessage: 'My Map notes remain private.' };
    const output = normalizeCareMapTerminology(input);
    assert.deepEqual(output.actions, [{ label: 'Open Care Maps', route: '/my-directory?section=my-maps' }]);
    assert.deepEqual(output.media, [{ id: 'my-map-image', caption: 'Care Map example', alt: 'Care Map preview', transcript: 'Choose Care Maps.' }]);
    assert.equal(output.guideMessage, 'Care Map notes remain private.');
    assert.deepEqual(normalizeCareMapTerminology(output), output);
});

test('CMS reading preview changes its copy while leaving editable article and fact metadata intact', () => {
    const article = { id: 'HC-07', slug: 'create-a-my-map', title: 'Create a My Map', review: { date: '2026-10-07', evidence: ['My Map source review'] }, sections: [{ id: 'create', title: 'My Map', paragraphs: ['Open My Maps.'], steps: ['Create your My Map.'], notes: ['My Map notes stay private.'], facts: [{ id: 'help-my-maps', title: 'My Map help', route: '/my-directory?section=my-maps', message: 'Open My Maps.' }] }] };
    const original = structuredClone(article);
    const reading = cmsReadingArticle(article);
    assert.equal(reading.title, 'Create a Care Map');
    assert.equal(reading.sections[0].facts[0].title, 'Care Map help');
    assert.equal(reading.sections[0].guideMessage, 'Open Care Maps.\n\n1. Create your Care Map.\n\nCare Map notes stay private.');
    assert.equal(reading.articleRoute, '/help-centre/create-a-my-map');
    assert.deepEqual(reading.review, article.review);
    assert.deepEqual(article, original);
});
