import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHelpArticlesApi } from '../src/features/help/helpApi.js';
import { canReadAccountHelp, formatHelpReviewedDate, helpArticleRoute, helpIdentityKey, mergeHelpArticles, mergeHelpCategories, normalizeHelpQuery, safeHelpArticleRoute, searchHelpArticles } from '../src/features/help/helpLibrary.js';
import { guidePageLabel, guideReportContext } from '../src/features/support/guideAssistantContext.js';

const personalPlace = { id: 'HC-09', slug: 'add-a-personal-place-to-your-map', title: 'Add a missing location as a Personal place on your map', summary: 'Keep a private place in My Places and reuse it in My Maps.', category: 'my-maps', audiences: ['signed-in'], reviewedAt: '2026-10-02', relatedArticleIds: [], sections: [{ id: 'create-personal-place', title: 'Add the place', paragraphs: ['A Personal place stays private.'], steps: ['Sign in and open My Directory → My Maps.', 'Open your map and select + Personal place.', 'Select Choose map location, then click or tap the spot on your map.', 'Enter the place’s name and category.', 'Enter its address or postal code and select Find location.', 'Review the details and select Save.'], notes: ['For a genuine point without a postal address, select This point has no postal address.'] }] };
const resource = { id: 'HC-05', slug: 'save-a-resource', title: 'Save and unsave a resource', summary: 'Find a public resource in Discover.', category: 'find-and-save', sections: [{ id: 'save', title: 'Save privately', steps: ['Select Save.'] }] };
const articles = [resource, personalPlace];

test('help search ranks task titles and searches complete procedures deterministically', () => {
    assert.deepEqual(searchHelpArticles(articles, ''), articles);
    assert.equal(normalizeHelpQuery('x'.repeat(200)).length, 120);
    assert.equal(searchHelpArticles(articles, 'personal places')[0].id, 'HC-09');
    assert.equal(searchHelpArticles(articles, 'postal address')[0].id, 'HC-09');
    assert.equal(searchHelpArticles(articles, 'choose map location')[0].id, 'HC-09');
    assert.equal(searchHelpArticles(articles, 'save resource')[0].id, 'HC-05');
    assert.deepEqual(searchHelpArticles(articles, 'unrecognised-feature'), []);
    assert.deepEqual(articles.map((article) => article.id), ['HC-05', 'HC-09']);
    assert.deepEqual(searchHelpArticles(articles, 'save'), searchHelpArticles(articles, 'save'));
});

test('article citations allow only local help reading routes with safe section anchors', () => {
    assert.equal(helpArticleRoute(personalPlace.slug, 'create-personal-place'), '/help-centre/add-a-personal-place-to-your-map#create-personal-place');
    assert.equal(safeHelpArticleRoute('/help-centre/save-a-resource'), '/help-centre/save-a-resource');
    for (const route of ['https://evil.example/help-centre/article', '//evil.example', '/dashboard/resources', '/help-centre', '/help-centre/article?token=private', '/help-centre/article#section?private=1', '/help-centre/../dashboard', '/help-centre/article%2fnext', '/help-centre/article#', '/help-centre/article#section/other']) assert.equal(safeHelpArticleRoute(route), null, route);
    assert.equal(helpArticleRoute('article/other'), null);
    assert.equal(helpArticleRoute('article', 'section?next=admin'), null);
});

test('account help resets for identity, loading and User View without retaining restricted duplicates', () => {
    const user = { id: 14, role: 'partner' };
    assert.equal(canReadAccountHelp(null), false);
    assert.equal(canReadAccountHelp(user), true);
    assert.equal(canReadAccountHelp(user, true), false);
    assert.equal(canReadAccountHelp(user, false, true), false);
    assert.equal(canReadAccountHelp({ ...user, isImpersonating: true }), false);
    assert.notEqual(helpIdentityKey(user), helpIdentityKey({ ...user, id: 15 }));
    assert.notEqual(helpIdentityKey(user), helpIdentityKey(user, true));
    assert.notEqual(helpIdentityKey(user), helpIdentityKey(user, false, true));
    const extra = { id: 'restricted', slug: 'review-help', title: 'Permitted help', summary: 'Current permitted instructions.' };
    assert.deepEqual(mergeHelpArticles(articles, [personalPlace, extra, { ...extra, id: 'duplicate-slug' }, { ...extra, id: 'bad', slug: '../admin' }]).map((article) => article.id), ['HC-05', 'HC-09', 'restricted']);
    assert.deepEqual(mergeHelpCategories([{ id: 'my-maps', title: 'My Maps' }], [{ id: 'my-maps', title: 'Duplicate' }, { id: 'admin-support', title: 'Permitted admin help' }, { id: '../admin', title: 'Unsafe' }]), [{ id: 'my-maps', title: 'My Maps' }, { id: 'admin-support', title: 'Permitted admin help' }]);
});

test('Help API uses one session origin, supports cancellation and always bypasses the browser cache', async () => {
    const calls = [];
    const requests = [];
    const controller = new AbortController();
    const api = createHelpArticlesApi({ request: async (...args) => { calls.push(args); return {}; }, fetchImpl: async (...args) => { requests.push(args); return {}; } });
    await api.list(controller.signal); await api.search('personal place & map', controller.signal); await api.article('review-help', controller.signal, 'section-one');
    assert.deepEqual(calls.map(([method, path]) => [method, path]), [['GET', '/help/articles'], ['GET', '/help/articles/search?q=personal+place+%26+map'], ['GET', '/help/articles/review-help?section=section-one']]);
    for (const [, , body, options] of calls) {
        assert.equal(body, undefined); assert.equal(options.baseCandidates.length, 1); assert.equal(options.networkAttemptsPerBase, 1); assert.equal(options.signal, controller.signal);
        await options.fetchImpl('https://example.test/api/help/articles', { credentials: 'include', signal: controller.signal });
    }
    assert.ok(requests.every(([, options]) => options.cache === 'no-store' && options.credentials === 'include' && options.signal === controller.signal));
    assert.throws(() => api.article('../admin'), /unavailable/);
});

test('Help Centre coarse context never forwards the article slug, anchor or query', () => {
    assert.equal(guidePageLabel('/help-centre/add-a-personal-place-to-your-map'), 'Help Centre');
    assert.deepEqual(guideReportContext('/help-centre/private-article?q=question#section'), { pathname: '/help-centre' });
});

let rendered;
async function renderers() {
    if (rendered) return rendered;
    const { outputFiles } = await build({ stdin: { contents: `import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server'; import { MemoryRouter } from 'react-router-dom'; import HelpArticle from './HelpArticle.jsx'; import GuideSourceLinks from '../support/GuideSourceLinks.jsx'; import GuideActionLinks from '../support/GuideActionLinks.jsx'; export function article(value) { return renderToStaticMarkup(<MemoryRouter><HelpArticle article={value} /></MemoryRouter>); } export function sources(value) { return renderToStaticMarkup(<MemoryRouter><GuideSourceLinks sources={value} /></MemoryRouter>); } export function actions(value, signedIn) { return renderToStaticMarkup(<MemoryRouter><GuideActionLinks actions={value} signedIn={signedIn} /></MemoryRouter>); }`, resolveDir: new URL('../src/features/help', import.meta.url).pathname, loader: 'jsx' }, bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic', logLevel: 'silent' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', `${outputFiles[0].text}\n//# sourceURL=help-render-fixture.cjs`)(createRequire(import.meta.url), module, module.exports);
    rendered = module.exports;
    return rendered;
}

test('article renderer preserves all ordered steps, notes, safe anchors and literal text', async () => {
    const renderer = await renderers();
    const html = renderer.article({ ...personalPlace, sections: [{ ...personalPlace.sections[0], paragraphs: ['<script>must stay literal</script>'] }] });
    assert.match(html, /<h1[^>]*>Add a missing location/);
    assert.match(html, /id="create-personal-place"/);
    assert.match(html, /href="\/help-centre\/add-a-personal-place-to-your-map#create-personal-place"/);
    assert.match(html, /<ol /);
    assert.equal((html.match(/<li class="break-words pl-2"/g) || []).length, 6);
    for (const step of personalPlace.sections[0].steps) assert.ok(html.includes(step), step);
    assert.match(html, /This point has no postal address/);
    assert.match(html, /&lt;script&gt;must stay literal&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Reviewed <time dateTime="2026-10-02">2 October 2026<\/time>/);
    assert.equal(formatHelpReviewedDate('not-a-date'), null);
});

test('Guide source renderer opens reading evidence and never substitutes an action destination', async () => {
    const renderer = await renderers();
    const html = renderer.sources([{ id: 'personal-place', title: 'Personal place', articleRoute: helpArticleRoute(personalPlace.slug, 'create-personal-place'), route: '/dashboard/resources' }, { id: 'bad', title: 'Unlinked guidance', articleRoute: 'https://evil.example', route: '/discover' }]);
    assert.match(html, /href="\/help-centre\/add-a-personal-place-to-your-map#create-personal-place"/);
    assert.equal((html.match(/<a /g) || []).length, 1);
    assert.doesNotMatch(html, /href="\/dashboard|href="\/discover|href="https:/);
    assert.match(html, /Unlinked guidance/);
});

test('Guide message actions render safe reading links and exact signed-in Directory sections', async () => {
    const renderer = await renderers();
    const actions = [
        { label: 'Open My Maps', route: '/my-directory?section=my-maps' },
        { label: 'Open My Places', route: '/my-directory?section=my-places' },
        { label: 'Read instructions', route: helpArticleRoute(personalPlace.slug, 'create-personal-place') },
        { label: 'Browse help', route: '/help-centre' },
        { label: 'Open Discover', route: '/discover' },
    ];
    const signedIn = renderer.actions(actions, true);
    assert.equal((signedIn.match(/<a /g) || []).length, 5);
    for (const action of actions) {
        assert.ok(signedIn.includes(`href="${action.route}"`), action.route);
        assert.ok(signedIn.includes(action.label), action.label);
    }
    const guest = renderer.actions(actions, false);
    assert.equal((guest.match(/<a /g) || []).length, 3);
    assert.doesNotMatch(guest, /Open My Maps|Open My Places|my-directory/);
    assert.match(guest, /Read instructions/);
    assert.match(guest, /Browse help/);
    const rejected = ['https://evil.example/help-centre/article', '//evil.example', '/my-directory?section=my-maps&next=admin',
        '/my-directory?section=my-places#private', '/my-directory?section=other', '/my-directory?section=my%2dmaps',
        '/help-centre?token=private', '/help-centre/article?token=private', '/help-centre/article%2fnext',
        '/help-centre/article#section/other', '/dashboard/admin?tab=users', '/help?tab=report'];
    for (const route of rejected) assert.equal(renderer.actions([{ label: 'Unsafe', route }], true), '', route);
    assert.equal(renderer.actions(null, true), '');
    assert.equal(renderer.actions([null, {}], true), '');
});

test('public Help Centre imports only its generated public corpus and preserves the locked support routes', () => {
    const featureDirectory = new URL('../src/features/help/', import.meta.url);
    for (const file of readdirSync(featureDirectory).filter((name) => /\.[jt]sx?$/.test(name))) {
        const source = readFileSync(new URL(file, featureDirectory), 'utf8');
        assert.doesNotMatch(source, /from\s+['"][^'"]*(?:server\/|content\/help(?:\/|['"])|helpKnowledge)/, file);
        assert.doesNotMatch(source, /dangerouslySetInnerHTML|localStorage|sessionStorage/, file);
    }
    const page = readFileSync(new URL('../src/features/help/HelpCentrePage.jsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
    assert.match(page, /from '..\/..\/generated\/helpArticles\.json'/);
    assert.match(app, /path="\/help-centre\/:slug\?"/);
    assert.match(app, /SUPPORT_UI_ENABLED && <Route path="\/help"/);
    assert.match(app, /path="\/inbox" element=\{<Navigate to="\/help\?tab=inbox" replace \/>/);
});
