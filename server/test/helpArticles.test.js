import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelpArticleRoutes } from '../src/routes/helpArticles.js';
import { canReadHelpContent, loadHelpArticleCapabilities, publicGuideFacts } from '../src/utils/helpArticleAccess.js';

const article = (id, visibility = 'public', sections = [{ id: 'steps', title: 'Steps', paragraphs: ['Reviewed instructions'], steps: ['Open help'], notes: [] }]) => ({
    id, slug: id, title: `${id} title`, summary: `${id} summary`, category: 'maps', audiences: ['everyone'], visibility,
    reviewedAt: '2026-10-02', articleRoute: `/help-centre/${id}`, relatedArticleIds: ['secret'], sections,
    evidence: 'internal evidence', sourceRevision: 'internal revision', reviewer: 'internal reviewer',
});
const articles = [article('public'), article('secret', 'audit'), article('unknown', 'invented'),
    article('mixed', 'public', [{ id: 'public-section', title: 'Public', paragraphs: ['ordinary instructions'], steps: [], notes: [] },
        { id: 'secret-section', title: 'Secret section', paragraphs: ['hidden-search-needle'], steps: [], notes: [], visibility: 'audit' }])];
const router = (actor, capabilities = {}) => createHelpArticleRoutes({ articles: articles.map((item) => item.id === 'secret' ? { ...item, category: 'restricted' } : item), version: 'fixture',
    categories: [{ id: 'maps', title: 'Maps' }, { id: 'restricted', title: 'Restricted category' }],
    authenticate: async (c, next) => { c.set('user', actor); await next(); }, capabilities: async () => capabilities });

for (const actor of [{ role: 'guest' }, { id: 4, role: 'standard' }, { id: 5, role: 'super_admin', isImpersonating: true }]) {
    test(`Public article reading and search hide restricted titles/sections for ${JSON.stringify(actor)}`, async () => {
        const app = router(actor);
        const list = await app.request('/');
        assert.equal(list.headers.get('Cache-Control'), 'private, no-store');
        const payload = await list.json();
        assert.deepEqual(payload.articles.map((item) => item.id), ['public', 'mixed']);
        assert.deepEqual(payload.categories, [{ id: 'maps', title: 'Maps' }]);
        assert.doesNotMatch(JSON.stringify(payload), /secret|unknown|evidence|revision|reviewer/);
        const result = await (await app.request('/search?q=hidden-search-needle')).json();
        assert.deepEqual(result.articles, []);
        const detail = await (await app.request('/mixed')).json();
        assert.equal(detail.article.sections.length, 1);
        assert.deepEqual(detail.article.relatedArticleIds, []);
        assert.deepEqual(detail.article.relatedArticles, []);
        assert.doesNotMatch(JSON.stringify(detail), /secret-section|hidden-search-needle|evidence|revision|reviewer/);
        const denied = await app.request('/secret');
        const absent = await app.request('/absent');
        assert.equal(denied.status, 404);
        assert.equal(denied.headers.get('Cache-Control'), 'private, no-store');
        assert.deepEqual(await denied.json(), await absent.json());
        assert.equal((await app.request('/mixed?section=secret-section')).status, 404);
        const section = await (await app.request('/mixed?section=public-section')).json();
        assert.deepEqual(section.article.sections.map((item) => item.id), ['public-section']);
    });
}

test('Active scoped audit capabilities permit restricted reading; unknown policy remains denied', async () => {
    const app = router({ id: 4, role: 'standard' }, { audit: { mode: 'organizations', organizationIds: [8] } });
    assert.equal((await app.request('/secret')).status, 200);
    assert.equal((await app.request('/unknown')).status, 404);
    const detail = await (await app.request('/public')).json();
    assert.deepEqual(detail.article.relatedArticleIds, ['secret']);
    assert.deepEqual(detail.article.relatedArticles.map((item) => item.id), ['secret']);
    assert.equal(detail.article.relatedArticles[0].title, 'secret title');
    assert.doesNotMatch(JSON.stringify(detail.article.relatedArticles), /sections|evidence|revision|reviewer|visibility/);
    const list = await (await app.request('/')).json();
    assert.deepEqual(list.articles.map((item) => item.id), ['public', 'secret', 'mixed']);
    assert.deepEqual(list.categories.map((item) => item.id), ['maps', 'restricted']);
    const result = await (await app.request('/search?q=hidden-search-needle')).json();
    assert.deepEqual(result.articles.map((item) => item.id), ['mixed']);
});

test('Visibility reuses current role and capabilities instead of audience labels', () => {
    const standard = { id: 1, role: 'standard' };
    assert.equal(canReadHelpContent({ audiences: ['admin'], visibility: 'public' }, standard), true);
    assert.equal(canReadHelpContent({ visibility: 'admin' }, standard), false);
    assert.equal(canReadHelpContent({ visibility: 'admin' }, { id: 2, role: 'regional_admin' }), true);
    assert.equal(canReadHelpContent({ visibility: 'resource-manager' }, standard), false);
    assert.equal(canReadHelpContent({ visibility: 'organization' }, standard, { organization: { workspaceView: true } }), true);
    assert.equal(canReadHelpContent({ visibility: 'organization' }, { id: 3, role: 'super_admin' },
        { organization: { workspaceView: false, platformAdmin: true } }), true);
    assert.equal(canReadHelpContent({ visibility: 'organization' }, { id: 3, role: 'super_admin' }, {}), false);
    assert.equal(canReadHelpContent({ visibility: 'audit' }, standard, { organization: { workspaceView: true } }), false);
    assert.equal(canReadHelpContent({ visibility: 'support-review' }, { id: 3, role: 'super_admin' }), true);
    assert.equal(canReadHelpContent({ visibility: 'support-review' }, { id: 3, role: 'super_admin', isImpersonating: true }), false);
    assert.equal(canReadHelpContent({ visibility: 'invented' }, { id: 3, role: 'super_admin' }), false);
    assert.deepEqual(publicGuideFacts([{ id: 'a' }, { id: 'b', visibility: 'audit' }]).map((item) => item.id), ['a']);
});

test('Capability lookup failure denies restricted content without removing public reading', async () => {
    const capabilities = await loadHelpArticleCapabilities({ id: 4, role: 'standard' }, {}, articles, {
        audit: async () => { throw new Error('Unavailable'); } });
    assert.equal(canReadHelpContent({ visibility: 'audit' }, { id: 4, role: 'standard' }, capabilities), false);
    assert.equal(canReadHelpContent({ visibility: 'public' }, { id: 4, role: 'standard' }, capabilities), true);
});

test('Search validation and unavailable errors retain private no-store responses', async () => {
    const app = router({ role: 'guest' });
    for (const path of ['/search', '/search?q=' + 'a'.repeat(121)]) {
        const response = await app.request(path);
        assert.equal(response.status, 400);
        assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
    const unavailable = createHelpArticleRoutes({ articles, authenticate: async (c, next) => { await next(); },
        capabilities: async () => { throw new Error('Unavailable'); } });
    const response = await unavailable.request('/');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
