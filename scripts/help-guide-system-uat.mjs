// Actual local routes and disposable PGlite data. No account credentials or live AI.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true');
const app = 'http://127.0.0.1:5181', api = 'http://127.0.0.1:8793';
const library = JSON.parse(await readFile(new URL('../client/src/generated/helpArticles.json', import.meta.url), 'utf8'));
const specimen = library.articles.find(a => a.id === 'HC-09');
const output = new URL('../output/help-centre/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { mode: 'local real routes and synthetic PGlite accounts', liveInference: false, checks: [], pageErrors: [] };
async function check(name, work) { const evidence = await work(); report.checks.push({ name, passed: true, ...evidence }); console.log('PASS ' + name); }
async function session(role, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    if (role) await context.addCookies([{ name: 'carearound_support_fixture', value: role, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await context.route('**/*', route => { const url = new URL(route.request().url()); return [app, api].includes(url.origin) ? route.continue() : route.abort('blockedbyclient'); });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    return { page, context };
}
try {
    await check('real Help API role scope and no-store detail/search', async () => {
        const matrix = [];
        for (const [role, expected, denied] of [
            [null, 40, 'read-audit-trail-and-understand-its-limits'],
            ['member', 40, 'read-audit-trail-and-understand-its-limits'],
            ['staff', 42, 'read-audit-trail-and-understand-its-limits'],
            ['orgadmin', 43, null],
            ['regionadmin', 45, 'read-audit-trail-and-understand-its-limits'],
            ['admin', 48, null],
            ['impersonating', 40, 'read-audit-trail-and-understand-its-limits'],
        ]) {
            const { context } = await session(role);
            const list = await context.request.get(api + '/api/help/articles');
            assert.equal(list.status(), 200); assert.equal(list.headers()['cache-control'], 'private, no-store');
            const body = await list.json(); assert.equal(body.articles.length, expected, role || 'guest');
            assert.ok(body.articles.every(a => !a.evidence && !a.review && !a.sourceRevision));
            let sectionsChecked = 0;
            for (const article of body.articles) {
                const detail = await context.request.get(api + '/api/help/articles/' + article.slug);
                assert.equal(detail.status(), 200, `${role || 'guest'}: ${article.slug}`);
                assert.equal(detail.headers()['cache-control'], 'private, no-store');
                const permitted = (await detail.json()).article;
                assert.equal(permitted.id, article.id);
                for (const section of permitted.sections) {
                    const fragment = await context.request.get(api + '/api/help/articles/' + article.slug + '?section=' + encodeURIComponent(section.id));
                    assert.equal(fragment.status(), 200, `${article.id}#${section.id}`);
                    assert.deepEqual((await fragment.json()).article.sections.map(s => s.id), [section.id]);
                    sectionsChecked++;
                }
            }
            if (denied) {
                assert.equal((await context.request.get(api + '/api/help/articles/' + denied)).status(), 404);
                const search = await (await context.request.get(api + '/api/help/articles/search?q=Audit%20Trail')).json();
                assert.ok(search.articles.every(a => a.id !== 'HC-48'));
            }
            matrix.push({ role: role || 'guest', articles: body.articles.length, sectionsChecked }); await context.close();
        }
        return { matrix };
    });
    await check('Guide serves full private-map procedure and reading source on a phone', async () => {
        const { page, context } = await session('staff', 390);
        await page.goto(app + '/help');
        const panel = page.getByRole('dialog', { name: 'CareAround Guide', exact: true }); await panel.waitFor();
        const response = page.waitForResponse(r => r.url().endsWith('/api/guide/answer'));
        await panel.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('How do I add a place that isn’t in the directory to my map?');
        await panel.getByRole('button', { name: 'Ask Guide', exact: true }).click();
        const served = await (await response).json(); assert.equal(served.topicId, 'personal-place-map-create');
        for (const clause of specimen.sections[0].steps) assert.ok(served.message.includes(clause));
        await panel.getByText(/Choose map location/).waitFor();
        const scroll = await panel.getByRole('log', { name: 'Conversation with CareAround Guide' }).evaluate(log => {
            const viewport = log.parentElement;
            const reply = log.lastElementChild.lastElementChild;
            return { replyTop: reply.getBoundingClientRect().top, viewportTop: viewport.getBoundingClientRect().top,
                scrollTop: viewport.scrollTop, viewportHeight: viewport.clientHeight, replyHeight: reply.getBoundingClientRect().height };
        });
        assert.ok(scroll.replyHeight > scroll.viewportHeight, 'Use the complete long procedure to exercise response scrolling.');
        assert.ok(scroll.replyTop >= scroll.viewportTop && scroll.replyTop <= scroll.viewportTop + 24,
            'The new long answer starts visibly at the message viewport without a manual scroll.');
        const reading = panel.getByRole('link', { name: served.sources[0].title, exact: true });
        assert.equal(await reading.getAttribute('href'), specimen.articleRoute + '#create-personal-place');
        await reading.click(); await panel.waitFor({ state: 'hidden' });
        await page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        assert.equal(await page.locator('main article ol > li').count(), 6);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
        await page.screenshot({ path: new URL('real-route-mobile-personal-place.png', output).pathname, fullPage: true });
        await page.getByRole('button', { name: 'Ask CareAround Guide', exact: true }).click();
        await panel.waitFor();
        await panel.getByText('You’re on Help Centre', { exact: true }).waitFor();
        await panel.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).waitFor();
        await context.close(); return { orderedSteps: 6, articleId: 'HC-09', width: 390,
            automaticReplyStartVisible: true, scroll, articleToGuideNavigation: true, pageContext: 'Help Centre' };
    });
    await check('existing Programme draft-review-confirm saves one hidden synthetic resource', async () => {
        const { page, context } = await session('staff'); const name = 'Help foundation disposable ' + Date.now();
        await page.goto(app + '/help');
        const panel = page.getByRole('dialog', { name: 'CareAround Guide', exact: true }); await panel.waitFor();
        await panel.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('Create a programme');
        await panel.getByRole('button', { name: 'Ask Guide', exact: true }).click();
        await panel.getByRole('textbox', { name: 'Name (required)' }).fill(name);
        await panel.getByLabel('Choose linked place', { exact: true }).selectOption('100');
        await panel.getByRole('button', { name: 'Review programme/service', exact: true }).click();
        await panel.getByRole('heading', { name: 'Create this programme/service?', exact: true }).waitFor();
        const before = await (await context.request.get(api + '/__fixture/guide/state')).json();
        assert.equal(before.resources.filter(r => r.name === name).length, 0);
        const created = page.waitForResponse(r => r.url().endsWith('/api/guide/actions/programmes/create'));
        await panel.getByRole('button', { name: 'Create programme/service', exact: true }).click();
        assert.equal((await created).status(), 201);
        await panel.getByRole('link', { name: 'Open ' + name, exact: true }).waitFor();
        const after = await (await context.request.get(api + '/__fixture/guide/state')).json();
        const rows = after.resources.filter(r => r.name === name); assert.equal(rows.length, 1); assert.equal(rows[0].is_hidden, true);
        assert.equal(after.links.filter(r => r.soft_asset_id === rows[0].id).length, 1);
        await context.close(); return { noWriteBeforeConfirmation: true, createdRows: 1, hidden: true, productionWrites: 0 };
    });
    assert.deepEqual(report.pageErrors, []);
} finally { await writeFile(new URL('system-uat.json', output), JSON.stringify(report, null, 2)); await browser.close(); }
console.log('PASS ' + report.checks.length + ' actual-route disposable checks; no live AI or production data.');
