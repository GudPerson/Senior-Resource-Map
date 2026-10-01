// Local-only browser regression: start supportBrowserServer.mjs and Vite 5179 first.
// CAREAROUND_SUPPORT_FIXTURE=true node scripts/guide-actions-browser-uat.mjs
// Uses synthetic PGlite data and an injected model; never reads app credentials.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true', 'Explicit disposable fixture mode is required.');
const alternateFixture = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8792';
const isolatedRelease = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8793';
const app = `http://127.0.0.1:${isolatedRelease ? 5181 : alternateFixture ? 5180 : 5179}`;
const api = `http://127.0.0.1:${isolatedRelease ? 8793 : alternateFixture ? 8792 : 8791}`;
const output = new URL(alternateFixture ? '../output/playwright/guide-actions-oracle/' : '../output/playwright/guide-actions/', import.meta.url);
await mkdir(output, { recursive: true });
const nonce = Date.now().toString(36);
const report = { fixture: true, startedAt: new Date().toISOString(), checks: [], pageErrors: [], expectedNetworkDrops: 0, guideRequestsByOrigin: {} };
const browser = await chromium.launch({ headless: true });
const contexts = [];
async function check(name, work) {
    try { const evidence = await work(); report.checks.push({ name, passed: true, ...evidence }); console.log(`PASS ${name}`); }
    catch (error) {
        report.checks.push({ name, passed: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`);
        const page = contexts.at(-1)?.pages().at(-1);
        if (page) await page.screenshot({ path: new URL(`failure-${name.replace(/[^a-z0-9]+/gi, '-')}.png`, output).pathname }).catch(() => {});
    }
}
async function poll(test, message, timeout = 15000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) { if (await test()) return; await new Promise((resolve) => setTimeout(resolve, 75)); }
    throw new Error(message);
}
async function respectActionWindow(response) {
    // The suite deliberately reuses one fictional account across many sessions.
    // Preserve the application's per-user limit instead of resetting its store.
    const limit = Number(await response.headerValue('x-ratelimit-limit'));
    const resetAt = Number(await response.headerValue('x-ratelimit-reset')) * 1000;
    assert.equal(limit, 20);
    assert.ok(Number.isFinite(resetAt) && resetAt > 0);
    const waitMs = Math.max(0, resetAt - Date.now() + 100);
    assert.ok(waitMs <= 61000, 'Only the observed one-minute fixture action window may be awaited.');
    console.log(`INFO respecting fictional account action window: ${waitMs}ms`);
    const until = Date.now() + waitMs;
    while (Date.now() < until) await new Promise((resolve) => setTimeout(resolve, Math.min(30000, until - Date.now())));
    return { serverLimit: limit, serverResetAt: resetAt, waitMs };
}
async function session(role, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'en-SG', timezoneId: 'Asia/Singapore' });
    contexts.push(context);
    const fixtureClientIp = `198.51.100.${contexts.length}`;
    if (role) await setRole(context, role);
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort('blockedbyclient');
        // Each fictional person has an independent edge address. Real users do
        // not share the fixture's single loopback-IP request bucket.
        const guideApi = [app, api].includes(url.origin) && url.pathname.startsWith('/api/guide');
        if (guideApi) report.guideRequestsByOrigin[url.origin] = (report.guideRequestsByOrigin[url.origin] || 0) + 1;
        return route.continue(guideApi
            ? { headers: { ...route.request().headers(), 'cf-connecting-ip': fixtureClientIp } } : undefined);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => report.pageErrors.push({ role, width, message: error.message }));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${app}/help`);
    await panel(page).waitFor({ state: 'visible' });
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).waitFor();
    return { context, page };
}
async function setRole(context, role) {
    await context.addCookies([{ name: 'carearound_support_fixture', value: role, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}
const panel = (page) => page.getByRole('dialog', { name: 'CareAround Guide', exact: true });
async function ask(page, text) {
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
}
async function draft(page, name, scheduled = false) {
    await ask(page, scheduled ? 'Create a programme every Tuesday at 10am' : 'Create a programme');
    await page.getByRole('textbox', { name: 'Name (required)' }).fill(name);
    await page.getByLabel('Choose linked place', { exact: true }).selectOption('100');
}
async function state(context) { return (await context.request.get(`${api}/__fixture/guide/state`)).json(); }
async function switchLive(context, page, role) {
    await setRole(context, role);
    // Session checks have a short cooldown; wait for the actual response, not a guessed React timeout.
    await page.waitForTimeout(800);
    const changed = page.waitForResponse((response) => response.url().endsWith('/api/auth/me'));
    await page.evaluate(() => window.dispatchEvent(new Event('carearound:auth-expired')));
    assert.equal((await (await changed).json()).user.name, role === 'other' ? 'Other User' : 'Demo User');
}
async function noOverflow(page) {
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        panel: document.querySelector('#carearound-guide-assistant')?.getBoundingClientRect().width }));
    assert.ok(sizes.document <= sizes.viewport + 1, JSON.stringify(sizes));
    assert.ok(sizes.panel <= sizes.viewport + 1, JSON.stringify(sizes));
    return sizes;
}

try {
    await check('mobile public saver effects and membership navigation stay outside account reads', async () => {
        const { context, page } = await session('member', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const before = await state(context);
        for (const [question, id, text, action] of [
            ['Would linking another venue enrol the people who bookmarked my programme?', 'offering-host-versus-membership', /People who saved the listing are not enrolled by that host change/, 'Open Profile'],
            ['Show me people who bookmarked my Programme', 'provider-usage-boundary', /cannot.*identify those people/, 'Use this question in a report'],
            ['If I have joined a Place, is its listing now automatically in My Directory?', 'saved-versus-membership', /joining does not automatically save the Place/, 'Open Profile'],
            ['How can I see which centres have my membership without showing you my profile?', 'place-membership-navigation', /Scroll below the profile form to Linked places/, 'Open Profile'],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.equal(answer.topicId, id);
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            assert.doesNotMatch(JSON.stringify(answer), /Most recently saved|Havelock Demo Activity|Private fixture/);
            await panel(page).getByText(text).last().waitFor();
            if (action === 'Use this question in a report') {
                assert.deepEqual(answer.actions, [{ label: 'Draft a support report', route: '/help?tab=report' }]);
                await panel(page).getByRole('button', { name: action, exact: true }).last().waitFor();
            } else await panel(page).getByRole('link', { name: action, exact: true }).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
        }
        assert.deepEqual(await state(context), before);
        await page.screenshot({ path: new URL('membership-navigation-mobile.png', output).pathname });
        const membershipResponse = page.waitForResponse((item) => item.url().endsWith('/api/memberships/me'));
        await panel(page).getByRole('link', { name: 'Open Profile', exact: true }).last().click();
        assert.equal((await membershipResponse).status(), 200);
        await page.getByRole('heading', { name: 'Linked places', exact: true }).waitFor();
        assert.equal(new URL(page.url()).pathname, '/dashboard/profile');
        assert.deepEqual(await state(context), before);
        await context.close();
        return { reviewedProductReplies: true, noProgrammeDraft: true, resourceStateUnchanged: true,
            noAccountNamesInChat: true, ownProfileMembershipRoute: true, liveModelCalls: 0 };
    });
    await check('mobile Guide distinguishes membership QR, bookmarks and unverified provider delivery', async () => {
        const { context, page } = await session('member', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const before = await state(context);
        for (const [question, id, text, action] of [
            ['I used a membership QR. Is that the same as making a private bookmark?', 'saved-versus-membership', /it is a separate membership, not a saved resource/, 'Open Profile'],
            ['Does adding a host centre to an Offering enrol everyone who saved it?', 'offering-host-versus-membership', /People who saved the listing are not enrolled by that host change/, 'Open Profile'],
            ['Can you check whether the provider has already been told my name?', 'guide-provider-identity-check', /This chat has not contacted the provider or verified delivery/, 'Open Discover'],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.equal(answer.topicId, id);
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            assert.doesNotMatch(JSON.stringify(answer), /Most recently saved|Havelock Demo Activity|Private fixture|provider did not receive/);
            await panel(page).getByText(text).last().waitFor();
            await panel(page).getByRole('link', { name: action, exact: true }).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
        }
        assert.deepEqual(await state(context), before);
        await page.screenshot({ path: new URL('membership-provider-check-mobile.png', output).pathname });
        await context.close();
        return { noAccountListInReply: true, noProgrammeDraft: true, resourceStateUnchanged: true,
            providerDeliveryNotInferred: true, liveModelCalls: 0 };
    });
    await check('mobile save privacy and host membership have reviewed replies and leave resource state unchanged', async () => {
        const { context, page } = await session('member', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const before = await state(context);
        for (const [question, id, text, action] of [
            ['I saved a Programme. Can the provider see my name just because I hearted it?', 'saved-identity-privacy', /Save action does not send your name or profile details/, 'Open My Directory'],
            ['Is the host location of a service the same thing as a user’s Place membership?', 'offering-host-versus-membership', /these are separate relationships/, 'Open Profile'],
            ['Can you show me if the provider sees my name after I saved a Programme?', 'saved-identity-privacy', /authorised Place managers can see membership details, including names/, 'Open My Directory'],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.equal(answer.topicId, id);
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            assert.doesNotMatch(JSON.stringify(answer), /Most recently saved|Havelock Demo Activity|Private fixture/);
            await panel(page).getByText(text).last().waitFor();
            await panel(page).getByRole('link', { name: action, exact: true }).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
        }
        assert.deepEqual(await state(context), before);
        await page.screenshot({ path: new URL('saving-identity-mobile.png', output).pathname });
        await context.close();
        return { noSavedNamesInReply: true, noProgrammeDraft: true, resourceStateUnchanged: true,
            accountListNotSubstituted: true, liveModelCalls: 0 };
    });
    await check('mobile Guide separates host locations, personal membership and Place assignment scope', async () => {
        const { context, page } = await session('staff', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const before = await state(context);
        for (const [question, id, text] of [
            ['Does an Owner assignment on one Place let me manage every Place?', 'place-assignment-scope', /Being an Owner of one Place does not grant/],
            ['If I link my account to a Place, can I manage its services?', 'place-membership', /Joining a Place also does not grant editing rights/],
            ['If I change a linked Place, will the Guide change an existing Programme for me?', 'guide-existing-resource-edit-scope', /The Guide cannot edit an existing public Place or Offering/],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            await panel(page).getByText(text).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
        }
        assert.deepEqual(await state(context), before);
        await page.screenshot({ path: new URL('place-scope-mobile.png', output).pathname });
        await context.close();
        return { resourceStateUnchanged: true, noProgrammeDraft: true, liveModelCalls: 0 };
    });
    await check('mobile public hiding and Guide notification controls have distinct reviewed answers', async () => {
        const { context, page } = await session('staff', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const preferencesBefore = await context.request.get(`${api}/api/notifications/preferences`);
        assert.equal(preferencesBefore.status(), 200);
        const before = await preferencesBefore.json();
        for (const [question, id, text, action] of [
            ['Does hiding a listing remove everybody’s saved copy?', 'hidden-saved-resources', /does not automatically remove people’s saved entries/, 'Open My Directory'],
            ['If a saved Programme is hidden, will my Directory entry vanish?', 'hidden-saved-resources', /saved entry can remain and be marked unavailable/, 'Open My Directory'],
            ['Guide, can you turn on WhatsApp alerts for me?', 'guide-notification-controls', /The Guide has not changed any setting/, 'Open Updates'],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.equal(answer.topicId, id);
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            await panel(page).getByText(text).last().waitFor();
            await panel(page).getByRole('link', { name: action, exact: true }).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
        }
        const after = await context.request.get(`${api}/api/notifications/preferences`);
        assert.equal(after.status(), 200);
        assert.deepEqual(await after.json(), before);
        await page.screenshot({ path: new URL('notification-controls-mobile.png', output).pathname });
        await context.close();
        return { notificationPreferencesUnchanged: true, liveModelCalls: 0 };
    });
    await check('mobile semantic review can replace a lexical product match without widening saver access', async () => {
        const { context, page } = await session('member', 375);
        const before = await state(context);
        const question = 'Will changing the host of an Offering alter the membership of people who saved it?';
        const initial = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
        await ask(page, question);
        const lexical = await (await initial).json();
        assert.equal(lexical.topicId, 'saved-versus-managed');
        assert.equal(lexical.answerSource, 'reviewed');
        const control = await context.request.post(api + '/__fixture/guide/semantic', {
            data: { enabled: true, factIds: ['offering-host-versus-membership'] } });
        assert.equal(control.status(), 200);
        try {
            await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'simulation');
            assert.equal(answer.topicId, 'offering-host-versus-membership');
            assert.deepEqual(answer.sources.map(({ id }) => id), ['offering-host-versus-membership']);
            await panel(page).getByText(/People who saved.*not enrolled by.*host change/s).waitFor();
            await panel(page).getByRole('link', { name: 'Open Profile', exact: true }).last().waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            const sizes = await noOverflow(page);
            await page.screenshot({ path: new URL('semantic-product-review-mobile.png', output).pathname });
            const privacy = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, 'Show me the members who bookmarked our service.');
            const boundary = await (await privacy).json();
            assert.equal(boundary.topicId, 'provider-usage-boundary');
            assert.equal(boundary.answerSource, 'reviewed');
            const mode = await (await context.request.get(api + '/__fixture/guide/semantic')).json();
            assert.equal(mode.modelCalls, 2);
            assert.deepEqual(await state(context), before);
            return { injectedSelectionOnly: true, lexicalMatchReviewed: true,
                privateLookupNotInferred: true, resourceStateUnchanged: true,
                simulatedModelCalls: 2, liveModelCalls: 0, ...sizes };
        } finally {
            assert.equal((await context.request.post(api + '/__fixture/guide/semantic', { data: { enabled: false } })).status(), 200);
            await context.close();
        }
    });
    await check('mobile two-stage injected discovery answers a saved-feature question without an account list', async () => {
        const { context, page } = await session('staff', 375);
        const control = await context.request.post(`${api}/__fixture/guide/semantic`, {
            data: { enabled: true, factIds: ['saved-schedule-notifications'] } });
        assert.equal(control.status(), 200);
        try {
            await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, 'Where can I turn on notices about a saved programme moving?');
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'simulation');
            assert.equal(answer.topicId, 'saved-schedule-notifications');
            assert.deepEqual(answer.sources.map(({ id }) => id), ['saved-schedule-notifications']);
            assert.doesNotMatch(answer.message, /This account has|Most recently saved:/);
            await panel(page).getByText(/Open Inbox → Updates and enable Saved schedule changes/).waitFor();
            await panel(page).getByRole('link', { name: 'Open Updates', exact: true }).waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            const mode = await (await context.request.get(`${api}/__fixture/guide/semantic`)).json();
            assert.equal(mode.modelCalls, 2);
            const sizes = await noOverflow(page);
            await page.screenshot({ path: new URL('semantic-notices-mobile.png', output).pathname });
            return { injectedSelectionOnly: true, liveModelCalls: 0, simulatedModelCalls: mode.modelCalls, ...sizes };
        } finally {
            assert.equal((await context.request.post(`${api}/__fixture/guide/semantic`, { data: { enabled: false } })).status(), 200);
            await context.close();
        }
    });
    await check('mobile reviewed product relations answer channels, editing rights and ambiguous downloads', async () => {
        const { context, page } = await session('staff', 375);
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        for (const [question, id, text, action] of [
            ['Are in-app updates the same as WhatsApp or email alerts?', 'notification-delivery-channels', /external delivery remains disabled/, 'Open Updates'],
            ['Do I become a listing editor by saving an Offering?', 'saved-versus-managed', /Saving does not itself give you permission to edit/, 'Open Manage My Resources'],
            ['Are exported resource workbooks refreshed after the listing changes?', 'resource-export-context', /Which download do you mean/, 'Open My Directory'],
        ]) {
            const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
            await ask(page, question);
            const answer = await (await response).json();
            assert.equal(answer.answerSource, 'reviewed');
            assert.equal(answer.topicId, id);
            assert.deepEqual(answer.sources.map((source) => source.id), [id]);
            await panel(page).getByText(text).waitFor();
            await panel(page).getByRole('link', { name: action, exact: true }).waitFor();
            assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
            await noOverflow(page);
            if (id === 'notification-delivery-channels') await page.screenshot({ path: new URL('notification-channels-mobile.png', output).pathname });
        }
        await context.close();
        return { width: 375, reviewedWithoutModelSelection: true, accountGrantInferred: false, exportSurfaceClarified: true };
    });

    await check('content retrieval shows reviewed existing-session guidance with explicit simulated AI consent', async () => {
        const { context, page } = await session('staff');
        await page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ }).check();
        const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
        await ask(page, 'Where can I amend the dated sessions on an existing service?');
        const answer = await (await response).json();
        assert.equal(answer.answerSource, 'simulation');
        assert.deepEqual(answer.sources.map(({ id }) => id), ['offering-schedule-edit']);
        assert.deepEqual(answer.actions, [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }]);
        await panel(page).getByText(/In Schedule, review the dated sessions/).waitFor();
        await panel(page).getByRole('link', { name: 'Open Manage My Resources', exact: true }).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
        await page.screenshot({ path: new URL('content-retrieval.png', output).pathname });
        await context.close();
        return { contentDerivedFact: true, reviewedSource: 'offering-schedule-edit', simulatedSelectionOnly: true, existingResourceWrite: false };
    });

    await check('organisation audit summary stays scoped and out of later AI turns', async () => {
        const { context, page } = await session('orgadmin', 375);
        const consent = page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ });
        await consent.check();
        const response = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
        await ask(page, 'Show resource updates yesterday');
        const summary = await (await response).json();
        assert.equal(summary.answerSource, 'account');
        await panel(page).getByText(/Assigned Place Staff — Havelock Demo Activity/).waitFor();
        assert.equal(await panel(page).getByText(/Havelock List-only Service/).count(), 0);
        assert.doesNotMatch(JSON.stringify(summary), /fixture-audit-secret|example.test|Private fixture/);
        await page.screenshot({ path: new URL('audit-summary-orgadmin.png', output).pathname });
        const later = page.waitForRequest((item) => item.url().endsWith('/api/guide/answer'));
        await ask(page, 'How do I save resources?');
        assert.deepEqual((await later).postDataJSON().turns, []);
        await panel(page).getByText('Simulated AI selection of reviewed guidance for this local test', { exact: true }).waitFor();
        await ask(page, 'Who edited my Programme yesterday?');
        await panel(page).getByText(/cannot match an exact listing or custom date/).waitFor();
        const dimensions = await noOverflow(page);
        await context.close();
        return { fictionalOrgAdmin: true, onlyPermittedUpdateShown: true, accountTurnExcluded: true, namedListingHandoff: true, dimensions };
    });

    await check('standalone and multi-host questions do not enter Place-linked Create', async () => {
        const { context, page } = await session('staff');
        const draftRequests = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/guide/actions/programmes/draft')) draftRequests.push(request.url());
        });
        await ask(page, 'Create a service without a Place');
        await page.getByText(/supports a standalone Programme\/service/).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
        await ask(page, 'Can I create one service at several Places?');
        await page.getByText(/standard standalone Offering editor can link one Programme\/service to multiple Host Locations/).waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
        assert.deepEqual(draftRequests, []);
        await context.close();
        return { directAccountAnswer: true, reviewedMultiHostAnswer: true, placeLinkedDraftRequests: 0 };
    });

    await check('provider planner question stays separate from own My Plans', async () => {
        const { context, page } = await session('staff');
        await ask(page, 'Can I see a list of members who added my Programme to My Plans?');
        await panel(page).getByText(/The Guide cannot show a provider who added/).waitFor();
        assert.equal(await panel(page).getByText(/Staff Future Session/).count(), 0);
        await ask(page, 'What plans do I have?');
        await panel(page).getByText(/Staff Future Session/).waitFor();
        await context.close();
        return { providerNamesHidden: true, ownPlansStillAvailable: true };
    });

    await check('signed-in opt-in simulated AI keeps reviewed fallback', async () => {
        const { context, page } = await session('staff');
        const consent = page.getByRole('checkbox', { name: /Try simulated AI selection of reviewed guidance in this local test/ });
        assert.equal(await consent.isChecked(), false);
        await ask(page, 'How do I remove saved resources?');
        await page.getByText('Reviewed CareAround help', { exact: true }).waitFor();
        assert.equal(await consent.isChecked(), false);
        await consent.check();
        const request = page.waitForRequest((item) => item.url().endsWith('/api/guide/answer') && item.postDataJSON()?.useAi === true);
        await ask(page, 'How do I save resources?');
        assert.equal((await request).postDataJSON().turns.length, 1);
        await page.getByText('Simulated AI selection of reviewed guidance for this local test', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Start new Guide conversation', exact: true }).click();
        assert.equal(await consent.isChecked(), false);
        await context.close();
        const guest = await session(null);
        assert.equal(await guest.page.getByRole('checkbox', { name: /simulated AI selection/i }).count(), 0);
        await guest.context.close();
        return { model: 'injected local simulation', liveInference: false };
    });

    await check('Programme draft suggestions follow the Guide AI checkbox', async () => {
        const { context, page } = await session('staff');
        const first = page.waitForRequest((item) => item.url().endsWith('/api/guide/actions/programmes/draft'));
        await ask(page, 'Create a programme');
        assert.equal((await first).postDataJSON().useAi, false);
        const consent = page.getByRole('checkbox', { name: /Use simulated AI to suggest draft edits/ });
        await consent.waitFor();
        await consent.check();
        const optedIn = page.waitForRequest((item) => item.url().endsWith('/api/guide/actions/programmes/draft'));
        await page.getByRole('textbox', { name: 'Describe a change to the programme draft' }).fill('Name it Fixture Music Club');
        await page.getByRole('button', { name: 'Update programme draft', exact: true }).click();
        assert.equal((await optedIn).postDataJSON().useAi, true);
        await consent.uncheck();
        const optedOut = page.waitForRequest((item) => item.url().endsWith('/api/guide/actions/programmes/draft'));
        await page.getByRole('textbox', { name: 'Describe a change to the programme draft' }).fill('Keep the draft for manual editing');
        await page.getByRole('button', { name: 'Update programme draft', exact: true }).click();
        assert.equal((await optedOut).postDataJSON().useAi, false);
        await context.close();
        return { defaultOff: true, togglesWithinDraft: true };
    });

    await check('Guide saves a reviewed public resource once and keeps accounts separate', async () => {
        const { context, page } = await session('staff');
        if ((await state(context)).favorites.some((item) => item.user_id === 4 && item.resource_type === 'hard' && item.resource_id === 100)) {
            const reset = await context.request.post(`${api}/api/favorites/toggle`, {
                data: { resourceType: 'hard', resourceId: 100 },
            });
            assert.equal(reset.status(), 200);
            assert.equal((await reset.json()).saved, false);
            await page.reload();
            await panel(page).waitFor({ state: 'visible' });
        }
        await page.getByRole('button', { name: /Find and save a resource/ }).click();
        await page.getByRole('searchbox', { name: 'Resource keywords' }).fill('Havelock Demo Centre');
        await page.getByRole('button', { name: 'Search directory' }).click();
        const result = page.getByRole('article').filter({ hasText: 'Havelock Demo Centre' }).last();
        await result.getByRole('button', { name: 'Review save' }).click();
        await page.getByLabel('Review resource save').getByText('Save Havelock Demo Centre to My Directory?').waitFor();
        assert.equal((await state(context)).favorites.filter((item) => item.user_id === 4 && item.resource_id === 100).length, 0);
        const requested = page.waitForRequest((item) => item.url().endsWith('/api/guide/actions/saved-resources'));
        await page.getByRole('button', { name: 'Save to My Directory', exact: true }).click();
        assert.deepEqual((await requested).postDataJSON(), { resourceType: 'hard', resourceId: 100 });
        await page.getByText('Saved: Havelock Demo Centre.', { exact: false }).waitFor();
        assert.equal((await state(context)).favorites.filter((item) => item.user_id === 4 && item.resource_id === 100).length, 1);
        const retry = await context.request.post(`${api}/api/guide/actions/saved-resources`, {
            data: { resourceType: 'hard', resourceId: 100 },
        });
        assert.equal(retry.status(), 200);
        assert.equal((await retry.json()).alreadySaved, true);
        assert.equal((await state(context)).favorites.filter((item) => item.user_id === 4 && item.resource_id === 100).length, 1);
        const other = await session('otherstaff');
        const otherSaved = await (await other.context.request.get(`${api}/api/favorites`)).json();
        assert.equal(otherSaved.some((item) => item.resourceType === 'hard' && item.resourceId === 100), false);
        await other.context.close();
        await context.close();
        return { explicitReview: true, retrySafe: true, ownerScoped: true };
    });

    await check('desktop canonical service create and lost-response replay', async () => {
        const { context, page } = await session('admin');
        const name = `Guide browser retry ${nonce}`;
        await draft(page, name, true);
        await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('Services');
        await page.getByText('Dates & recurrence', { exact: true }).click();
        await page.getByRole('textbox', { name: 'Requested timing (optional)' }).fill('Every Tuesday at 10am');
        await page.getByLabel('Add dated sessions for Care Calendar', { exact: true }).check();
        await page.getByRole('combobox', { name: 'Session type', exact: true }).selectOption('weekly');
        await page.getByLabel('Series starts', { exact: true }).fill('2026-09-30T10:00');
        await page.getByText('Tue', { exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Review programme/service', exact: true }).isDisabled(), true);
        await page.getByLabel('Series starts', { exact: true }).fill('2026-09-29T10:00');
        await page.getByRole('button', { name: 'Review programme/service', exact: true }).click();
        await page.getByRole('heading', { name: 'Create this programme/service?', exact: true }).waitFor();
        assert.equal(await page.getByText('Every Tuesday at 10am', { exact: true }).isVisible(), true);
        assert.equal((await state(context)).resources.filter((row) => row.name === name).length, 0);
        await page.screenshot({ path: new URL('desktop-review.png', output).pathname });
        let saved;
        let firstRequest;
        await page.route('**/api/guide/actions/programmes/create', async (route) => {
            firstRequest = route.request().postDataJSON();
            const response = await route.fetch();
            assert.equal(response.status(), 201);
            saved = await response.json();
            report.expectedNetworkDrops += 1;
            await route.abort('connectionreset');
        }, { times: 1 });
        await page.getByRole('button', { name: 'Create programme/service', exact: true }).click();
        await page.getByRole('button', { name: 'Retry same request', exact: true }).waitFor();
        assert.ok(saved.resource.id);
        assert.equal(await page.getByRole('button', { name: 'Edit draft', exact: true }).isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: 'Start new Guide conversation', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).click();
        await page.locator('[data-guide-launcher]').first().click();
        const retryResponse = page.waitForResponse((response) => response.url().endsWith('/api/guide/actions/programmes/create'));
        await page.getByRole('button', { name: 'Retry same request', exact: true }).click();
        const response = await retryResponse;
        assert.equal(response.status(), 200);
        assert.deepEqual(response.request().postDataJSON(), firstRequest);
        const replayed = await response.json();
        assert.equal(replayed.resource.id, saved.resource.id);
        assert.equal(replayed.replayed, true);
        await page.getByRole('link', { name: `Open ${name}`, exact: true }).waitFor();
        const result = await state(context);
        const rows = result.resources.filter((row) => row.name === name);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].is_hidden, true);
        assert.equal(rows[0].calendar_revision, 1);
        assert.equal(result.links.filter((row) => row.soft_asset_id === rows[0].id).length, 1);
        assert.equal(result.scheduleVersions.filter((row) => row.soft_asset_id === rows[0].id).length, 1);
        const resource = await (await context.request.get(`${api}/api/soft-assets/${rows[0].id}`)).json();
        assert.equal(resource.bucket, 'Services');
        await page.getByText('My private Guide history', { exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Review questions to save', exact: true }).isDisabled(), true);
        await page.screenshot({ path: new URL('desktop-replayed.png', output).pathname });
        const actionWindow = await respectActionWindow(response);
        await context.close();
        return { resourceId: rows[0].id, savedRows: 1, scheduleRevisions: 1, exactRetry: true, actionWindow };
    });

    for (const width of [320, 390]) await check(`mobile ${width}px focus, scope, navigation`, async () => {
        const { context, page } = await session('staff', width);
        assert.equal(await panel(page).getAttribute('aria-modal'), 'true');
        assert.equal(await page.evaluate(() => document.getElementById('root').inert), true);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).focus();
        await page.keyboard.press('Escape');
        await panel(page).waitFor({ state: 'hidden' });
        await poll(() => page.evaluate(() => !document.getElementById('root').inert && document.activeElement !== document.body), 'Closing modal must restore app focus');
        await page.locator('[data-guide-launcher]').first().click();
        await draft(page, `Mobile ${width} programme ${nonce}`);
        const options = await page.getByLabel('Choose linked place', { exact: true }).locator('option').evaluateAll((items) => items.map((item) => item.value));
        assert.deepEqual(options.filter(Boolean), ['100']);
        const sizes = await noOverflow(page);
        await page.screenshot({ path: new URL(`mobile-${width}.png`, output).pathname });
        await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
        if (width === 320) {
            await page.getByText('Search the public directory', { exact: true }).click();
            await page.getByRole('searchbox', { name: 'Resource keywords' }).fill('Havelock List-only Service');
            await page.getByRole('button', { name: 'Search directory' }).click();
            await page.getByRole('article').filter({ hasText: 'Havelock List-only Service' }).last()
                .getByRole('button', { name: 'Review save' }).click();
            await page.getByLabel('Review resource save').waitFor();
            await noOverflow(page);
            await page.screenshot({ path: new URL('mobile-save-review-320.png', output).pathname });
            await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
        await ask(page, 'Find Havelock');
        await page.getByRole('link', { name: 'Havelock Demo Centre', exact: true }).first().click();
        await page.waitForURL('**/resource/hard/100');
        await panel(page).waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.getElementById('root').inert), false);
        await context.close();
        return { ...sizes, focusRestored: true, onlyAssignedPlace: true, resultOpensPage: true };
    });

    await check('late draft response cannot cross an account change', async () => {
        const { context, page } = await session('staff');
        let release;
        const released = new Promise((resolve) => { release = resolve; });
        let fetched;
        const fetchedPromise = new Promise((resolve) => { fetched = resolve; });
        let completed;
        const completedPromise = new Promise((resolve) => { completed = resolve; });
        await page.route('**/api/guide/actions/programmes/draft', async (route) => {
            const response = await route.fetch();
            fetched();
            await released;
            await route.fulfill({ response });
            completed();
        }, { times: 1 });
        await ask(page, 'Create a programme');
        await fetchedPromise;
        await switchLive(context, page, 'other');
        await poll(async () => await page.getByRole('status').filter({ hasText: 'Preparing your draft' }).count() === 0, 'Old pending draft must unmount');
        release(); await completedPromise;
        await page.waitForTimeout(250);
        assert.equal(await page.getByRole('textbox', { name: 'Name (required)' }).count(), 0);
        assert.equal(await page.getByText('Fictional draft prepared.', { exact: false }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Create a programme/service', exact: false }).count(), 0);
        await context.close();
        return { oldDraftDiscarded: true, lateResponseIgnored: true };
    });

    await check('private history stays separate and report handoff is owner scoped', async () => {
        const { context, page } = await session('member');
        const firstQuestion = `How do I save a resource? Browser QA ${nonce}`;
        await ask(page, firstQuestion);
        await page.getByRole('button', { name: 'Use this question in a report', exact: true }).waitFor();
        await page.getByText('My private Guide history', { exact: true }).click();
        async function saveHistory() {
            await page.getByRole('button', { name: 'Review questions to save', exact: true }).click();
            await page.getByLabel('Save these questions to my private account history. I have removed sensitive personal details.', { exact: true }).check();
            const saved = page.waitForResponse((response) => response.url().endsWith('/api/guide/history') && response.request().method() === 'POST');
            await page.getByRole('button', { name: 'Save questions privately', exact: true }).click();
            const response = await saved; assert.equal(response.ok(), true);
            const value = await response.json();
            await page.getByText('Questions saved privately. No report was sent to support.', { exact: true }).waitFor();
            return value.conversation;
        }
        const first = await saveHistory();
        await page.getByRole('button', { name: 'Start new Guide conversation', exact: true }).click();
        const secondQuestion = `How do I share a map? Browser QA ${nonce}`;
        await ask(page, secondQuestion);
        await page.getByRole('button', { name: 'Use this question in a report', exact: true }).waitFor();
        await page.getByText('My private Guide history', { exact: true }).click();
        const second = await saveHistory();
        assert.notEqual(first.id, second.id);
        let submitted = 0;
        page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/support/reports')) submitted += 1; });
        await page.getByRole('button', { name: 'Use this question in a report', exact: true }).click();
        await page.waitForURL('**/help?tab=report');
        await page.getByRole('textbox', { name: 'Short title', exact: true }).waitFor();
        assert.match(await page.getByRole('textbox', { name: 'What happened?', exact: true }).inputValue(), /How do I share a map/);
        assert.doesNotMatch(await page.getByRole('textbox', { name: 'What happened?', exact: true }).inputValue(), /How do I save a resource/);
        assert.equal(submitted, 0);
        const navigationState = await page.evaluate(() => JSON.stringify(history.state));
        assert.doesNotMatch(navigationState, /How do I share a map|guideReportDraft/);
        await switchLive(context, page, 'other');
        await poll(async () => await page.getByRole('textbox', { name: 'Short title', exact: true }).inputValue() === '', 'Another account must not inherit report draft');
        await context.close();
        return { separateSavedConversations: true, explicitDraftOnlyReport: true, accountIsolation: true };
    });
    await check('report page context is opt-in and preserves only the source page family', async () => {
        const { context, page } = await session('member');
        await page.goto(`${app}/resource/hard/100?contextProbe=must-not-be-copied`);
        await page.locator('[data-guide-launcher]').first().click();
        await ask(page, 'How do I save a resource?');
        await page.getByRole('button', { name: 'Use this question in a report', exact: true }).click();
        await page.waitForURL('**/help?tab=report');
        const includeContext = page.getByRole('checkbox', { name: 'Include the page where I opened Help (page name only)', exact: true });
        assert.equal(await includeContext.isChecked(), false);
        let submitted = 0;
        page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/support/reports')) submitted += 1; });
        async function previewReport() {
            const previewed = page.waitForResponse((response) => response.url().endsWith('/api/support/preview') && response.request().method() === 'POST');
            await page.getByRole('button', { name: 'Review before sending', exact: true }).click();
            const response = await previewed;
            assert.equal(response.ok(), true);
            return { request: response.request().postDataJSON(), response: await response.json() };
        }
        const excluded = await previewReport();
        assert.deepEqual(excluded.request.context, {});
        assert.equal(excluded.response.context.pathname, '/');
        await page.getByRole('button', { name: 'Edit report', exact: true }).click();
        await includeContext.check();
        const included = await previewReport();
        assert.equal(included.request.context.pathname, '/resource');
        assert.equal(included.response.context.pathname, '/resource');
        assert.doesNotMatch(JSON.stringify(included.request.context), /hard|100|contextProbe|must-not-be-copied/);
        await page.getByText('Page: /resource', { exact: true }).waitFor();
        assert.equal(submitted, 0);
        await page.screenshot({ path: new URL('report-context.png', output).pathname });
        await context.close();
        return { contextUncheckedByDefault: true, omittedWithoutConsent: true, sourceContext: '/resource', resourceIdExcluded: true, queryExcluded: true, submittedReports: 0 };
    });
    await check('Admin Region Scope answers stay with the signed-in account', async () => {
        const first = await session('regionadmin');
        await ask(first.page, 'Which Subregions am I assigned to administer?');
        const firstAnswer = await panel(first.page).getByText(/This Admin account is currently assigned 1 Subregion:/).innerText();
        assert.match(firstAnswer, /Synthetic region/);
        assert.doesNotMatch(firstAnswer, /Other synthetic region/);
        const second = await session('otherregionadmin');
        await ask(second.page, 'Which Subregions am I assigned to administer?');
        const secondAnswer = await panel(second.page).getByText(/This Admin account is currently assigned 1 Subregion:/).innerText();
        assert.match(secondAnswer, /Other synthetic region/);
        assert.doesNotMatch(secondAnswer, /1 Subregion: Synthetic region/);
        await Promise.all([first.context.close(), second.context.close()]);
        return { firstAccountScopeOnly: true, secondAccountScopeOnly: true };
    });
    assert.equal(report.pageErrors.length, 0, JSON.stringify(report.pageErrors));
} finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await browser.close();
    report.finishedAt = new Date().toISOString();
    report.passed = report.checks.every((item) => item.passed) && report.pageErrors.length === 0;
    await writeFile(new URL('browser-uat.json', output), JSON.stringify(report, null, 2));
}
if (!report.passed) process.exitCode = 1;
