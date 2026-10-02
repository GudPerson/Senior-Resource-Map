// Local browser proof against the compiled candidate with fictional API replies.
// CAREAROUND_HELP_FIXTURE=true node client/test/helpCentre.browser.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

assert.equal(process.env.CAREAROUND_HELP_FIXTURE, 'true', 'Explicit local fictional fixture mode is required.');
const app = process.env.CAREAROUND_HELP_PREVIEW_URL || 'http://127.0.0.1:5186';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(app).hostname), 'Only a local preview is allowed.');
const library = JSON.parse(await readFile(new URL('../src/generated/helpArticles.json', import.meta.url), 'utf8'));
const specimen = library.articles.find((article) => article.id === 'HC-09');
const output = new URL('../../output/playwright/help-centre-ui/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { fixture: 'fictional API only; all external network blocked', startedAt: new Date().toISOString(), checks: [], pageErrors: [], unexpectedWrites: [] };
const restricted = { id: 'FICTIONAL-RESTRICTED', slug: 'fictional-permitted-article', title: 'Fictional permitted article', summary: 'Fictional restricted summary for a local access check.', category: 'fictional-permitted-category', audiences: ['admin'], reviewedAt: '2026-10-02', articleRoute: '/help-centre/fictional-permitted-article', relatedArticleIds: [], sections: [{ id: 'fictional-section', title: 'Fictional restricted section', paragraphs: ['FICTIONAL RESTRICTED BODY'], steps: ['Fictional first step.'], notes: [] }] };
const summary = ({ sections, relatedArticleIds, ...article }) => article;
const relatedRestricted = { ...restricted, id: 'FICTIONAL-RELATED', slug: 'fictional-related-article', title: 'Fictional restricted related article' };
const browser = await chromium.launch({ headless: true });
const sessions = [];
async function session(width, actor = null, locale = 'en') {
    const state = { actor, permitted: Boolean(actor), delay: 0, helpRequests: [], guideAnswers: 0 };
    const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 1000 }, locale: 'en-SG', timezoneId: 'Asia/Singapore', serviceWorkers: 'block' });
    await context.addInitScript((locale) => { localStorage.setItem('carearound_locale', locale); }, locale);
    await context.route('**/*', async (route) => {
        const request = route.request(); const url = new URL(request.url());
        if (url.pathname.startsWith('/api/')) {
            const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
            if (url.pathname === '/api/auth/me') return respond({ user: state.actor });
            if (url.pathname.startsWith('/api/help/articles')) {
                state.helpRequests.push({ method: request.method(), path: url.pathname + url.search });
                const current = state.permitted && state.actor && !state.actor.isImpersonating;
                // Snapshot before delaying: an old permitted response must not
                // restore content after the mounted account identity has changed.
                if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
                if (url.pathname === '/api/help/articles') return respond({ version: library.version, categories: [...library.categories, ...(current ? [{ id: 'fictional-permitted-category', title: 'Fictional permitted category' }] : [])], articles: [...library.articles.map(summary), ...(current ? [summary(restricted)] : [])] });
                if (url.pathname === '/api/help/articles/search') return respond({ version: library.version, categories: [...library.categories, ...(current ? [{ id: 'fictional-permitted-category', title: 'Fictional permitted category' }] : [])], query: url.searchParams.get('q'), articles: current && /fictional/i.test(url.searchParams.get('q')) ? [summary(restricted)] : [] });
                if (url.pathname.endsWith(`/${restricted.slug}`) && current) return respond({ version: library.version, article: { ...restricted, relatedArticleIds: [relatedRestricted.id], relatedArticles: [summary(relatedRestricted)] } });
                return respond({ error: 'This help article is unavailable.' }, 404);
            }
            if (url.pathname === '/api/guide/topics') return respond({ topics: [{ id: 'maps', title: 'Make a map' }], chatMode: 'guide' });
            if (url.pathname === '/api/guide/actions/programmes/places') return respond({ canCreate: false, places: [] });
            if (url.pathname === '/api/guide/answer') {
                state.guideAnswers++;
                const body = request.postDataJSON();
                assert.equal(body.useAi, undefined, 'No paid model request is allowed.');
                assert.equal(body.pageContext, 'Help Centre');
                return respond({ message: specimen.sections[0].paragraphs.join('\n') + '\n' + specimen.sections[0].steps.map((step, index) => `${index + 1}. ${step}`).join('\n'), topicId: 'personal-places', answerSource: 'reviewed', input: { question: body.question }, sources: [{ id: 'fictional-personal-place', title: specimen.title, articleRoute: `${specimen.articleRoute}#create-personal-place`, route: '/dashboard/resources' }], actions: [] });
            }
            if (request.method() !== 'GET') { report.unexpectedWrites.push(url.pathname); return respond({ error: 'No writes in this fixture.' }, 403); }
            if (/unread|unread-count/.test(url.pathname)) return respond({ count: 0 });
            if (/\/support\/.*reports$/.test(url.pathname)) return respond({ conversations: [], hasMore: false });
            if (/\/guide\/history$/.test(url.pathname)) return respond({ conversations: [] });
            if (/\/platform-access/.test(url.pathname)) return respond({ publicDirectoryMode: 'open', publicLoginMode: 'open', publicRegistrationMode: 'open', governedPilotEnabled: false });
            if (/\/notifications/.test(url.pathname)) return respond({ notifications: [], hasMore: false });
            return respond([]);
        }
        if (url.origin === app) return route.continue();
        return route.abort('blockedbyclient');
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => report.pageErrors.push({ width, message: error.message }));
    sessions.push({ context, page, state });
    return sessions.at(-1);
}
async function check(name, work) {
    try { report.checks.push({ name, passed: true, ...(await work()) }); console.log(`PASS ${name}`); }
    catch (error) { report.checks.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
async function noOverflow(page) {
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport, JSON.stringify(dimensions));
    return dimensions;
}
try {
    const mobile = await session(390);
    await check('guest mobile index and public bundle', async () => {
        await mobile.page.goto(`${app}/help-centre`);
        await mobile.page.getByRole('heading', { name: 'CareAround Help Centre', exact: true }).waitFor();
        await mobile.page.getByRole('button', { name: 'Ask Guide', exact: true }).waitFor();
        assert.equal(await mobile.page.locator('main section ul > li').count(), library.articles.length);
        assert.equal(mobile.state.helpRequests.length, 0);
        await mobile.page.screenshot({ path: new URL('guest-mobile-index.png', output).pathname, fullPage: false });
        return { publicArticles: library.articles.length, ...(await noOverflow(mobile.page)) };
    });
    await check('mobile text search and article steps', async () => {
        await mobile.page.getByRole('searchbox', { name: 'Search help articles' }).fill('Personal place');
        await mobile.page.getByRole('button', { name: 'Search', exact: true }).click();
        await mobile.page.getByRole('heading', { name: 'Results for “Personal place”' }).waitFor();
        await mobile.page.getByRole('link').filter({ has: mobile.page.getByRole('heading', { name: specimen.title, exact: true }) }).click();
        await mobile.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        const actualSteps = await mobile.page.locator('main article ol > li').allTextContents();
        assert.deepEqual(actualSteps, specimen.sections[0].steps);
        assert.ok((await mobile.page.locator('main article').innerText()).includes('This point has no postal address'));
        await mobile.page.screenshot({ path: new URL('guest-mobile-personal-place.png', output).pathname, fullPage: true });
        return { orderedSteps: actualSteps.length, ...(await noOverflow(mobile.page)) };
    });
    await check('article back link restores search and deep anchor survives reload', async () => {
        await mobile.page.getByRole('link', { name: 'All help articles', exact: true }).click();
        await mobile.page.getByRole('heading', { name: 'Results for “Personal place”' }).waitFor();
        assert.equal(await mobile.page.getByRole('searchbox').inputValue(), 'Personal place');
        await mobile.page.goto(`${app}${specimen.articleRoute}#create-personal-place`);
        await mobile.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        await mobile.page.waitForFunction(() => document.activeElement?.id === 'create-personal-place');
        await mobile.page.reload();
        await mobile.page.waitForFunction(() => document.activeElement?.id === 'create-personal-place');
        assert.ok(mobile.page.url().endsWith('#create-personal-place'));
        return { activeSection: 'create-personal-place', ...(await noOverflow(mobile.page)) };
    });
    await check('Guide reading citation opens section without an action destination', async () => {
        await mobile.page.getByRole('button', { name: 'Ask CareAround Guide', exact: true }).click();
        const panel = mobile.page.getByRole('dialog', { name: 'CareAround Guide', exact: true });
        await panel.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('How do I add a missing place?');
        await panel.getByRole('button', { name: 'Ask Guide', exact: true }).click();
        await panel.getByRole('link', { name: specimen.title, exact: true }).waitFor();
        assert.equal(await panel.getByRole('link', { name: specimen.title, exact: true }).getAttribute('href'), `${specimen.articleRoute}#create-personal-place`);
        await panel.getByRole('link', { name: specimen.title, exact: true }).click();
        await panel.waitFor({ state: 'hidden' });
        await mobile.page.waitForFunction(() => document.activeElement?.id === 'create-personal-place');
        assert.equal(mobile.state.guideAnswers, 1);
        return { mockedReviewedAnswers: mobile.state.guideAnswers, ...(await noOverflow(mobile.page)) };
    });
    await check('guest unknown article and legacy inbox navigation', async () => {
        await mobile.page.goto(`${app}/help-centre/fictional-permitted-article`);
        await mobile.page.getByRole('heading', { name: 'This article is unavailable' }).waitFor();
        assert.equal(await mobile.page.getByText(restricted.title, { exact: true }).count(), 0);
        await mobile.page.goto(`${app}/inbox`);
        await mobile.page.getByRole('heading', { name: 'CareAround Guide & inbox' }).waitFor();
        assert.ok(mobile.page.url().endsWith('/help?tab=inbox'));
        await mobile.page.getByRole('link', { name: 'Browse help articles', exact: true }).click();
        await mobile.page.getByRole('heading', { name: 'CareAround Help Centre', exact: true }).waitFor();
        return { legacyInboxDestination: '/help?tab=inbox', ...(await noOverflow(mobile.page)) };
    });
    const desktop = await session(1440, null, 'zh-CN');
    await check('desktop article and English fallback', async () => {
        await desktop.page.goto(`${app}${specimen.articleRoute}`);
        await desktop.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        await desktop.page.getByText('Help Centre articles are currently in English.', { exact: false }).waitFor();
        assert.equal(await desktop.page.locator('main').getAttribute('lang'), 'en');
        assert.equal(await desktop.page.locator('html').getAttribute('lang'), 'zh-CN');
        await desktop.page.screenshot({ path: new URL('desktop-english-fallback-article.png', output).pathname, fullPage: true });
        return { locale: 'zh-CN', articleLanguage: 'en', ...(await noOverflow(desktop.page)) };
    });
    const account = await session(1440, { id: 9001, name: 'Fictional reviewer', role: 'super_admin' });
    await check('permitted restricted article detail rechecks access revocation', async () => {
        await account.page.goto(`${app}/help-centre`);
        await account.page.getByRole('heading', { name: restricted.title, exact: true }).waitFor();
        await account.page.getByRole('button', { name: /Fictional permitted category/ }).click();
        await account.page.getByRole('heading', { name: 'Fictional permitted category', exact: true, level: 2 }).waitFor();
        await account.page.getByRole('link').filter({ has: account.page.getByRole('heading', { name: restricted.title, exact: true }) }).click();
        await account.page.getByText('FICTIONAL RESTRICTED BODY', { exact: true }).waitFor();
        await account.page.getByRole('link', { name: relatedRestricted.title, exact: true }).waitFor();
        assert.equal(await account.page.getByRole('link', { name: relatedRestricted.title, exact: true }).getAttribute('href'), relatedRestricted.articleRoute.replace(restricted.slug, relatedRestricted.slug));
        account.state.permitted = false; account.state.delay = 250;
        await account.page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await account.page.getByText('FICTIONAL RESTRICTED BODY', { exact: true }).waitFor({ state: 'hidden' });
        await account.page.getByRole('heading', { name: 'This article is unavailable' }).waitFor();
        assert.equal(await account.page.getByText(restricted.title, { exact: true }).count(), 0);
        assert.equal(await account.page.getByText(relatedRestricted.title, { exact: true }).count(), 0);
        return { permittedRelatedLink: true, noRetainedRestrictedRelatedTitle: true, noRetainedRestrictedBody: true, ...(await noOverflow(account.page)) };
    });
    await check('account switch and User View clear additional article data', async () => {
        account.state.permitted = true; account.state.delay = 0;
        await account.page.goto(`${app}/help-centre`);
        await account.page.getByRole('heading', { name: restricted.title, exact: true }).waitFor();
        account.state.actor = { id: 9002, name: 'Other fictional reviewer', role: 'super_admin' }; account.state.permitted = false;
        await account.page.waitForTimeout(800);
        const response = account.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/me');
        await account.page.evaluate(() => window.dispatchEvent(new Event('carearound:auth-expired')));
        await response;
        await account.page.getByRole('heading', { name: restricted.title, exact: true }).waitFor({ state: 'hidden' });
        await account.page.locator('#help-centre-title').evaluate((element) => { element.dataset.fixtureIdentity = 'before-user-view'; });
        account.state.actor = { ...account.state.actor, isImpersonating: true }; account.state.permitted = true;
        await account.page.waitForTimeout(800);
        const changed = account.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/me');
        await account.page.evaluate(() => window.dispatchEvent(new Event('carearound:auth-expired'))); await changed;
        await account.page.waitForFunction(() => !document.querySelector('#help-centre-title[data-fixture-identity]'));
        const calls = account.state.helpRequests.length;
        await account.page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await account.page.waitForTimeout(300);
        assert.equal(account.state.helpRequests.length, calls);
        assert.equal(await account.page.getByRole('heading', { name: restricted.title, exact: true }).count(), 0);
        return { noAccountDataInUserView: true, ...(await noOverflow(account.page)) };
    });
    await check('a delayed permitted response cannot restore restricted content after logout', async () => {
        const pending = await session(1440, { id: 9003, name: 'Pending fictional reviewer', role: 'super_admin' });
        await pending.page.goto(`${app}/help-centre`);
        await pending.page.getByRole('heading', { name: restricted.title, exact: true }).waitFor();
        await pending.page.waitForTimeout(850);
        pending.state.delay = 1000;
        const requested = pending.page.waitForRequest(request => new URL(request.url()).pathname.endsWith(`/${restricted.slug}`));
        await pending.page.getByRole('link').filter({ has: pending.page.getByRole('heading', { name: restricted.title, exact: true }) }).click();
        await requested;
        pending.state.actor = null; pending.state.permitted = false;
        const loggedOut = pending.page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/me');
        await pending.page.evaluate(() => window.dispatchEvent(new Event('carearound:auth-expired')));
        await loggedOut;
        await pending.page.getByRole('heading', { name: 'This article is unavailable' }).waitFor();
        await pending.page.waitForTimeout(1200);
        assert.equal(await pending.page.getByText('FICTIONAL RESTRICTED BODY', { exact: true }).count(), 0);
        assert.equal(await pending.page.getByText(restricted.title, { exact: true }).count(), 0);
        return { oldPermittedResponseRetained: false, ...(await noOverflow(pending.page)) };
    });
    await check('keyboard search, no-result recovery and article anchor navigation', async () => {
        await mobile.page.goto(`${app}/help-centre`);
        const search = mobile.page.getByRole('searchbox', { name: 'Search help articles' });
        await search.fill('zzzznomatchingarticlezzzz'); await search.press('Enter');
        await mobile.page.getByRole('heading', { name: 'No matching articles' }).waitFor();
        await mobile.page.getByRole('button', { name: 'Show all help articles' }).click();
        await mobile.page.getByRole('heading', { name: 'All help articles', exact: true }).waitFor();
        await mobile.page.goto(`${app}${specimen.articleRoute}`);
        const link = mobile.page.locator('nav[aria-label="In this article"]:visible').getByRole('link', { name: specimen.sections[0].title, exact: true });
        await link.focus(); await mobile.page.keyboard.press('Enter');
        await mobile.page.waitForFunction(() => document.activeElement?.id === 'create-personal-place');
        return { keyboardAnchor: 'create-personal-place', ...(await noOverflow(mobile.page)) };
    });
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.unexpectedWrites, []);
} finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
    await browser.close();
}
assert.ok(report.checks.every((check) => check.passed), 'Browser checks failed; inspect output/playwright/help-centre-ui/report.json.');
console.log(`PASS ${report.checks.length}/${report.checks.length} fictional browser checks; zero page errors and zero account writes.`);
