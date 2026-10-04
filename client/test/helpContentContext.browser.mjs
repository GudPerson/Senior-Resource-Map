// Actual Help Centre routes, disposable fictional API responses only.
// CAREAROUND_CMS_CONTEXT_FIXTURE=true CAREAROUND_CMS_CONTEXT_URL=http://127.0.0.1:5201 node client/test/helpContentContext.browser.mjs
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { cmsSeedWorkspace, validateCmsWorkspace } from '../../shared/helpContentCms.js';
import { HELP_CMS_SEED } from '../../server/src/generated/helpCmsSeed.js';

assert.equal(process.env.CAREAROUND_CMS_CONTEXT_FIXTURE, 'true', 'Explicit fictional fixture mode is required.');
const app = process.env.CAREAROUND_CMS_CONTEXT_URL || 'http://127.0.0.1:5201';
const origin = new URL(app).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(app).hostname), 'This check may run only against a local client.');
const publicLibrary = JSON.parse(await readFile(new URL('../src/generated/helpArticles.json', import.meta.url), 'utf8'));
const seedWorkspace = cmsSeedWorkspace(HELP_CMS_SEED);
const specimen = seedWorkspace.articles.find((article) => article.id === 'HC-09');
const companion = seedWorkspace.articles.find((article) => article.id === 'HC-07');
assert.ok(specimen && companion, 'Reviewed map articles must be available.');
const clone = (value) => structuredClone(value);
const owner = { id: 9001, name: 'Fictional content owner', email: 'owner@example.test', role: 'super_admin', hardAssetStaffAccess: [], softAssetStaffAccess: [], platformDirectoryAccess: true };
const output = new URL('../../output/playwright/help-cms-context/', import.meta.url);
await mkdir(output, { recursive: true });
const report = { fixture: 'Fictional intercepted API only; external network blocked; no database, R2, AI or publication writes.', startedAt: new Date().toISOString(), checks: [], pageErrors: [], unexpectedWrites: [], blockedExternal: [] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cK1UAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true });
const sessions = [];

function envelope(state) {
    return { workspace: clone(state.workspace), etag: state.etag, configured: true, publishingAvailable: false, baseDrift: false, activeReleaseId: null };
}
async function fixture(width = 1440, options = {}) {
    const state = { actor: clone(owner), capability: true, workspace: clone(seedWorkspace), etag: 'fixture-etag-1', saves: [], revisions: [], calls: [], saveConflict: false, mediaUploads: 0, ...options };
    const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 1000 }, locale: 'en-SG', timezoneId: 'Asia/Singapore', serviceWorkers: 'block', hasTouch: width < 640 });
    await context.route('**/*', async (route) => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname;
        const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
        if (path.startsWith('/api/')) {
            if (path === '/api/auth/me') return respond({ user: clone(state.actor) });
            if (path.startsWith('/api/help/cms')) {
                state.calls.push({ path, method: request.method() });
                const authorised = state.capability && state.actor?.id === owner.id && state.actor.role === 'super_admin' && !state.actor.isImpersonating;
                if (!authorised) return respond({ error: 'Help Content is not available to this account.' }, 403);
                const suffix = path.slice('/api/help/cms'.length);
                if (suffix === '/capability') return respond({ canEdit: true });
                if (!suffix && request.method() === 'GET') return respond(envelope(state));
                if (!suffix && request.method() === 'PUT') {
                    const body = request.postDataJSON();
                    state.saves.push(clone(body));
                    if (state.saveConflict || body.etag !== state.etag) return respond({ error: 'A newer draft was saved elsewhere.' }, 409);
                    validateCmsWorkspace(body.workspace, HELP_CMS_SEED);
                    state.workspace = clone(body.workspace); state.etag = `fixture-etag-${state.saves.length + 1}`;
                    state.revisions.unshift({ revisionId: `fictional-revision-${state.saves.length}`, savedAt: new Date().toISOString(), articleCount: state.workspace.articles.length, workspace: clone(state.workspace) });
                    return respond(envelope(state));
                }
                if (suffix === '/history') return respond({ revisions: state.revisions.map(({ workspace, ...metadata }) => metadata) });
                if (suffix === '/releases') return respond({ releases: [] });
                if (suffix === '/restore' && request.method() === 'POST') {
                    const body = request.postDataJSON(), revision = state.revisions.find((value) => value.revisionId === body.revisionId);
                    if (!revision || body.etag !== state.etag) return respond({ error: 'This draft changed.' }, 409);
                    state.workspace = clone(revision.workspace); state.etag = `fixture-restored-${state.saves.length}`;
                    return respond(envelope(state));
                }
                if (suffix === '/media' && request.method() === 'POST') {
                    state.mediaUploads++;
                    if (state.uploadDelay) await new Promise((resolve) => setTimeout(resolve, state.uploadDelay));
                    return respond({ assetId: String(state.mediaUploads % 10).repeat(64) });
                }
                if (/^\/media\/[a-f0-9]{64}$/.test(suffix) && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: png });
                report.unexpectedWrites.push({ path, method: request.method() });
                return respond({ error: 'No publication or additional changes are permitted in this fixture.' }, 403);
            }
            if (path === '/api/help/articles') return respond({ version: publicLibrary.version, categories: publicLibrary.categories, articles: publicLibrary.articles });
            if (path === '/api/help/articles/search') return respond({ version: publicLibrary.version, categories: publicLibrary.categories, articles: publicLibrary.articles.filter((article) => `${article.title} ${article.summary}`.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase())) });
            if (path.startsWith('/api/help/articles/')) {
                const article = publicLibrary.articles.find((value) => value.slug === path.split('/').at(-1));
                return respond(article ? { version: publicLibrary.version, article } : { error: 'Article unavailable.' }, article ? 200 : 404);
            }
            if (request.method() !== 'GET') { report.unexpectedWrites.push({ path, method: request.method() }); return respond({ error: 'Unexpected fixture write.' }, 403); }
            if (/platform-access/.test(path)) return respond({ publicDirectoryMode: 'open', publicLoginMode: 'open', publicRegistrationMode: 'open', governedPilotEnabled: false, canAccess: true, directoryAccess: true });
            if (/unread|unread-count|notifications\/count/.test(path)) return respond({ count: 0 });
            if (/\/support\/.*reports$/.test(path)) return respond({ conversations: [], hasMore: false });
            if (/\/guide\/history$/.test(path)) return respond({ conversations: [] });
            if (/\/guide\/topics$/.test(path)) return respond({ topics: [], chatMode: 'guide' });
            if (/\/notifications/.test(path)) return respond({ notifications: [], hasMore: false });
            return respond([]);
        }
        if (url.origin === origin) return route.continue();
        report.blockedExternal.push({ origin: url.origin, path });
        return route.abort('blockedbyclient');
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => report.pageErrors.push({ width, message: error.message }));
    const value = { page, context, state, width }; sessions.push(value); return value;
}
async function check(name, work) {
    try { report.checks.push({ name, passed: true, ...(await work()) }); console.log(`PASS ${name}`); }
    catch (error) {
        const last = sessions.at(-1);
        const page = last ? { url: last.page.url(), mainText: await last.page.locator('main').innerText().catch(() => ''), width: last.width } : undefined;
        report.checks.push({ name, passed: false, error: error.message, page }); console.error(`FAIL ${name}: ${error.message}`);
    }
}
async function noOverflow(page) {
    const value = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(value.document <= value.viewport + 1, JSON.stringify(value)); return value;
}
async function refreshIdentity(session, actor) {
    session.state.actor = actor;
    await session.page.waitForTimeout(850); // Existing AuthContext session-check cooldown.
    const checked = session.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/me');
    await session.page.evaluate(() => window.dispatchEvent(new Event('carearound:auth-expired')));
    await checked;
}
async function enterArticle(session, target = specimen) {
    await session.page.goto(`${app}/help-centre/${target.slug}`);
    await session.page.getByRole('button', { name: 'Edit this article', exact: true }).waitFor();
    await session.page.getByRole('button', { name: 'Edit this article', exact: true }).click();
    await session.page.getByRole('button', { name: 'Edit article title', exact: true }).waitFor();
}
async function changeBlock(page, editName, fieldName, value, action = 'Done') {
    await page.getByRole('button', { name: editName, exact: true }).click();
    const input = page.getByRole('textbox', { name: fieldName, exact: true });
    await input.fill(value);
    await page.getByRole('button', { name: action, exact: true }).click();
}
async function ownerTool(page, name) {
    const tools = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^More owner tools$/ }) });
    if (!await tools.evaluate((element) => element.open)) await tools.locator('summary').click();
    await tools.getByRole('button', { name, exact: true }).click();
}

try {
    await check('guest reading stays public and exposes no content editing controls', async () => {
        const guest = await fixture(390, { actor: null, capability: false });
        await guest.page.goto(`${app}/help-centre/${specimen.slug}`);
        await guest.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        assert.equal(await guest.page.getByRole('button', { name: 'Edit this article', exact: true }).count(), 0);
        assert.equal(guest.state.calls.length, 0, 'Guest reading must not request the private CMS.');
        const instructions = await guest.page.locator('main article ol > li').allTextContents();
        assert.deepEqual(instructions, specimen.sections[0].steps);
        return { publicSteps: instructions.length, ...(await noOverflow(guest.page)) };
    });
    await check('super admin without configured owner capability cannot edit', async () => {
        const denied = await fixture(1440, { capability: false });
        const probe = denied.page.waitForResponse((response) => new URL(response.url()).pathname === '/api/help/cms/capability');
        await denied.page.goto(`${app}/help-centre/${specimen.slug}`); await probe;
        await denied.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        assert.equal(await denied.page.getByRole('button', { name: 'Edit this article', exact: true }).count(), 0);
        assert.equal(denied.state.calls.some((call) => call.path === '/api/help/cms'), false, 'A denied capability must not load the private library.');
        return { privateLibraryLoads: 0 };
    });
    await check('User View never exposes or requests a private content workspace', async () => {
        const viewed = await fixture(390, { actor: { ...owner, isImpersonating: true } });
        await viewed.page.goto(`${app}/help-centre/${specimen.slug}`);
        await viewed.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        assert.equal(await viewed.page.getByRole('button', { name: 'Edit this article', exact: true }).count(), 0);
        assert.equal(viewed.state.calls.length, 0);
        return { cmsRequestsInUserView: 0, ...(await noOverflow(viewed.page)) };
    });
    const desktop = await fixture();
    const editedTitle = 'Fictional review: add a Personal place';
    const editedSummary = 'Fictional second article summary retained in the same library draft.';
    const originalTopic = seedWorkspace.manifest.categories.find((topic) => topic.id === specimen.category).title;
    const editedTopic = 'Fictional map topic';
    await check('same-page editing keeps block changes explicit and private until Done and Save', async () => {
        await enterArticle(desktop);
        await changeBlock(desktop.page, 'Edit article title', 'Article title', 'Fictional cancelled title', 'Cancel');
        await desktop.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
        assert.equal(await desktop.page.getByText('Fictional cancelled title', { exact: true }).count(), 0);
        await desktop.page.getByRole('button', { name: 'Edit article title', exact: true }).click();
        await desktop.page.getByRole('textbox', { name: 'Article title', exact: true }).fill(editedTitle);
        assert.equal(await desktop.page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), false, 'Save must not silently apply an unfinished text edit.');
        assert.equal(await desktop.page.getByRole('button', { name: 'Preview draft', exact: true }).isEnabled(), false);
        await desktop.page.getByRole('button', { name: 'Done', exact: true }).click();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        assert.equal(desktop.state.saves.length, 0, 'Done updates only the unsaved library draft.');
        assert.ok((await desktop.page.locator('main').innerText()).includes('Unsaved changes'));
        assert.equal(await desktop.page.getByText(/^Reviewed \d/).count(), 0, 'Draft reading must not inherit a published review stamp.');
        await desktop.page.screenshot({ path: new URL('desktop-inline-edit.png', output).pathname, fullPage: false });
        return { explicitDoneAndSave: true, ...(await noOverflow(desktop.page)) };
    });
    await check('topic and article navigation including browser Back keep one whole-library draft', async () => {
        const crumbs = desktop.page.getByRole('navigation', { name: 'Help content breadcrumbs' });
        await crumbs.getByRole('button', { name: originalTopic, exact: true }).click();
        await desktop.page.getByRole('heading', { name: originalTopic, exact: true, level: 1 }).waitFor();
        await desktop.page.getByRole('button', { name: 'Edit topic title', exact: true }).click();
        await desktop.page.getByRole('textbox', { name: 'Topic title', exact: true }).fill(editedTopic);
        await desktop.page.getByRole('button', { name: 'Done', exact: true }).click();
        await desktop.page.getByRole('button').filter({ hasText: companion.title }).first().click();
        await desktop.page.getByRole('heading', { name: companion.title, exact: true, level: 1 }).waitFor();
        await changeBlock(desktop.page, 'Edit article summary', 'Article summary', editedSummary);
        await desktop.page.goBack();
        await desktop.page.getByRole('heading', { name: editedTopic, exact: true, level: 1 }).waitFor();
        await desktop.page.getByRole('button').filter({ hasText: editedTitle }).first().click();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        await desktop.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        await desktop.page.getByRole('button', { name: 'Guide text', exact: true }).click();
        assert.ok((await desktop.page.locator('main').innerText()).includes(specimen.sections[0].steps[0]));
        await desktop.page.getByRole('button', { name: 'Continue editing', exact: true }).click();
        await desktop.page.getByRole('button', { name: 'Exit editing', exact: true }).click();
        await desktop.page.getByRole('button', { name: 'Edit this article', exact: true }).waitFor();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        await desktop.page.getByRole('button', { name: 'Edit this article', exact: true }).click();
        assert.equal(desktop.state.calls.filter((call) => call.path === '/api/help/cms' && call.method === 'GET').length, 1, 'Reading-route navigation must not reload or fork the workspace.');
        assert.equal(desktop.state.saves.length, 0);
        return { onePrivateLibraryLoad: true, browserBackRetainedDraft: true };
    });
    await check('Save stores the whole library with ETag and history restore recovers the saved snapshot', async () => {
        await desktop.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await desktop.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        const firstSave = desktop.state.saves[0];
        assert.equal(firstSave.etag, 'fixture-etag-1');
        assert.equal(firstSave.workspace.articles.length, seedWorkspace.articles.length);
        assert.equal(firstSave.workspace.articles.find((value) => value.id === specimen.id).title, editedTitle);
        assert.equal(firstSave.workspace.articles.find((value) => value.id === companion.id).summary, editedSummary);
        assert.equal(firstSave.workspace.manifest.categories.find((value) => value.id === specimen.category).title, editedTopic);
        assert.deepEqual(firstSave.workspace.articles.find((value) => value.id === specimen.id).sections[0].facts, specimen.sections[0].facts);
        await changeBlock(desktop.page, 'Edit article title', 'Article title', 'Fictional later saved title');
        await desktop.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await desktop.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        assert.equal(desktop.state.saves[1].etag, 'fixture-etag-2');
        await ownerTool(desktop.page, 'Saved history');
        await desktop.page.getByRole('heading', { name: 'Saved history', exact: true }).waitFor();
        await desktop.page.getByRole('button', { name: 'Restore revision', exact: true }).last().click();
        const dialog = desktop.page.getByRole('dialog', { name: 'Restore saved revision?', exact: true });
        await dialog.getByRole('button', { name: 'Restore revision', exact: true }).click();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        assert.equal(desktop.state.workspace.articles.find((value) => value.id === companion.id).summary, editedSummary);
        assert.equal(desktop.state.workspace.manifest.categories.find((value) => value.id === specimen.category).title, editedTopic);
        await desktop.page.reload();
        await desktop.page.getByRole('button', { name: 'Edit this article', exact: true }).waitFor();
        await desktop.page.getByRole('button', { name: 'Edit this article', exact: true }).click();
        await desktop.page.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
        await ownerTool(desktop.page, 'Review & publish');
        await desktop.page.getByRole('heading', { name: 'Publish saved content', exact: true }).waitFor();
        assert.equal(await desktop.page.getByRole('button', { name: 'Review & publish', exact: true }).last().isEnabled(), false);
        assert.ok((await desktop.page.locator('main').innerText()).includes('Publishing is not available yet'));
        return { savedArticleCount: firstSave.workspace.articles.length, etagConcurrency: true, wholeLibraryRestore: true, publicationUnavailable: true };
    });
    await check('stale Save retains edited content and does not overwrite the saved library', async () => {
        const stale = await fixture(1440, { saveConflict: true });
        await enterArticle(stale);
        await changeBlock(stale.page, 'Edit article title', 'Article title', 'Fictional unsaved conflict title');
        await stale.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await stale.page.getByRole('alert').filter({ hasText: 'A newer draft was saved elsewhere.' }).waitFor();
        await stale.page.getByRole('heading', { name: 'Fictional unsaved conflict title', exact: true, level: 1 }).waitFor();
        assert.equal(stale.state.workspace.articles.find((value) => value.id === specimen.id).title, specimen.title);
        assert.equal(await stale.page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), false);
        return { editsRetained: true, savedSnapshotUnchanged: true };
    });
    await check('same-account role change and User View clear private unsaved content', async () => {
        for (const actor of [{ ...owner, role: 'standard_user' }, { ...owner, isImpersonating: true }]) {
            const identity = await fixture(390);
            await enterArticle(identity);
            await changeBlock(identity.page, 'Edit article title', 'Article title', 'Fictional private unsaved title');
            await refreshIdentity(identity, actor);
            await identity.page.getByRole('heading', { name: specimen.title, exact: true, level: 1 }).waitFor();
            assert.equal(await identity.page.getByRole('heading', { name: 'Fictional private unsaved title', exact: true }).count(), 0);
            assert.equal(await identity.page.getByRole('button', { name: 'Edit this article', exact: true }).count(), 0);
            assert.equal(await identity.page.getByRole('button', { name: 'Save draft', exact: true }).count(), 0);
            await noOverflow(identity.page);
        }
        return { roleChangeClearedDraft: true, userViewClearedDraft: true };
    });
    await check('phone per-instruction mixed media and note removal retain the intended owners after reorder', async () => {
        const mobile = await fixture(390);
        await enterArticle(mobile);
        const attachedStepId = specimen.sections[0].stepIds[1];
        const instruction = mobile.page.locator(`[data-step-id="${attachedStepId}"]`);
        await instruction.getByLabel('Upload images after this instruction', { exact: true }).setInputFiles([
            { name: 'fictional-one.png', mimeType: 'image/png', buffer: png },
            { name: 'fictional-two.png', mimeType: 'image/png', buffer: png },
        ]);
        await instruction.locator('details.cms-context-attachment').nth(1).waitFor();
        assert.equal(mobile.state.mediaUploads, 2, 'Both selected images must use the fictional upload contract.');
        for (let index = 0; index < 2; index++) {
            const attachment = instruction.locator('details.cms-context-attachment').nth(index);
            await attachment.locator('summary').click();
            await attachment.getByRole('textbox', { name: 'Caption', exact: true }).fill(`Fictional image ${index + 1}`);
            await attachment.getByRole('textbox', { name: /^Accessible description/ }).fill(`A fictional one-pixel example image ${index + 1}.`);
            await attachment.locator('summary').click();
        }
        await instruction.getByRole('button', { name: 'Add video link', exact: true }).click();
        const video = instruction.locator('details.cms-context-attachment').nth(2);
        await video.locator('summary').click();
        await video.getByRole('textbox', { name: 'Caption', exact: true }).fill('Fictional video instructions');
        await video.getByRole('textbox', { name: /^Video link/ }).fill('https://youtu.be/AbcDef12345');
        await video.getByRole('textbox', { name: 'Written transcript', exact: true }).fill('Fictional written equivalent: choose the map point and review it.');
        await video.getByRole('checkbox', { name: 'I checked that this transcript agrees with the written instructions.', exact: true }).check();
        await video.locator('summary').click();
        await changeBlock(mobile.page, 'Edit note 2', 'Note 2', 'Fictional retained second note.');
        await mobile.page.getByRole('button', { name: 'Note 1 options', exact: true }).click();
        await mobile.page.getByRole('button', { name: 'Remove note 1', exact: true }).click();
        await mobile.page.getByRole('button', { name: 'Add note', exact: true }).click();
        const addedNoteNumber = specimen.sections[0].notes.length;
        await changeBlock(mobile.page, `Edit note ${addedNoteNumber}`, `Note ${addedNoteNumber}`, 'Fictional additional note.');
        const handle = instruction.getByRole('button', { name: 'Reorder instruction 2 in section 1', exact: true });
        await handle.focus(); await handle.press('Space'); await handle.press('ArrowUp'); await handle.press('Space');
        await mobile.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await mobile.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        const savedSection = mobile.state.saves.at(-1).workspace.articles.find((value) => value.id === specimen.id).sections[0];
        assert.equal(savedSection.stepIds[0], attachedStepId);
        assert.equal(savedSection.steps[0], specimen.sections[0].steps[1]);
        assert.equal(savedSection.media.length, 3);
        assert.equal(savedSection.media.every((item) => item.afterStepId === attachedStepId), true);
        assert.deepEqual(savedSection.media.map((item) => item.type), ['image', 'image', 'video']);
        assert.equal(savedSection.media.at(-1).transcriptReviewed, true);
        assert.equal(savedSection.notes[0], 'Fictional retained second note.');
        assert.equal(savedSection.notes.at(-1), 'Fictional additional note.');
        assert.equal(savedSection.notes.includes(specimen.sections[0].notes[0]), false);
        await mobile.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
        const videoLink = mobile.page.getByRole('link', { name: /^Watch this video on YouTube/ });
        await videoLink.waitFor();
        assert.equal(await videoLink.getAttribute('href'), 'https://youtu.be/AbcDef12345');
        await mobile.page.getByText('Fictional video instructions', { exact: true }).waitFor();
        await mobile.page.getByText('Read the video instructions', { exact: true }).click();
        await mobile.page.getByText('Fictional written equivalent: choose the map point and review it.', { exact: true }).waitFor();
        assert.equal(await mobile.page.locator('iframe').count(), 0, 'A video link must not autoplay or load an external frame.');
        await mobile.page.screenshot({ path: new URL('phone-step-media-preview.png', output).pathname, fullPage: false });
        return { images: 2, videoLinks: 1, stableMediaPlacement: true, notesRetainedByContent: true, ...(await noOverflow(mobile.page)) };
    });
    await check('owner topic ordering has vertical rows, deliberate pointer drops and keyboard cancellation', async () => {
        for (const width of [390, 1440]) {
            const sorted = await fixture(width);
            await sorted.page.goto(`${app}/help-centre?manage=1`);
            await sorted.page.getByRole('button', { name: 'Manage topics', exact: true }).click();
            const list = sorted.page.locator('[data-sort-list="Help topics"]');
            const ids = () => list.locator(':scope > [data-sort-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sortId));
            const original = await ids(), first = list.locator(`[data-sort-id="${original[0]}"]`), second = list.locator(`[data-sort-id="${original[1]}"]`);
            const handle = first.getByRole('button', { name: /^Reorder topic / });
            const firstBox = await first.boundingBox(), secondBox = await second.boundingBox();
            assert.ok(secondBox.y >= firstBox.y + firstBox.height, 'Topics must follow a vertical reading order.');
            await handle.focus(); await handle.press('Space'); await handle.press('ArrowDown');
            assert.equal(await sorted.page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), false);
            await handle.press('Escape'); assert.deepEqual(await ids(), original);
            assert.equal(await handle.evaluate((node) => node === document.activeElement), true);
            await handle.press('Space'); await handle.press('ArrowDown'); await handle.press('Tab');
            await sorted.page.waitForTimeout(50);
            assert.deepEqual(await ids(), original);
            assert.equal(await handle.evaluate((node) => node === document.activeElement), false, 'Tab cancellation must keep native focus traversal.');
            await handle.evaluate((node) => node.scrollIntoView({ block: 'center' }));
            await sorted.page.waitForTimeout(50);
            const start = await handle.boundingBox(), target = await second.boundingBox();
            await sorted.page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await sorted.page.mouse.down(); await sorted.page.waitForTimeout(200);
            await sorted.page.mouse.move(4, 10, { steps: 5 }); await sorted.page.mouse.up();
            assert.deepEqual(await ids(), original, 'Dropping outside the list must cancel.');
            await handle.evaluate((node) => node.scrollIntoView({ block: 'center' }));
            await sorted.page.waitForTimeout(50);
            const grab = await handle.boundingBox(), destination = await second.boundingBox();
            await sorted.page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2); await sorted.page.mouse.down(); await sorted.page.waitForTimeout(200);
            assert.equal(await handle.getAttribute('aria-pressed'), 'true', `Pointer hold must activate at ${width}px before a secondary release. Grab=${JSON.stringify(grab)} destination=${JSON.stringify(destination)}`);
            await handle.dispatchEvent('pointerup', { pointerId: 999, isPrimary: false, clientX: destination.x + 10, clientY: destination.y + 10 });
            assert.equal(await handle.getAttribute('aria-pressed'), 'true', 'An unrelated pointer must not commit the drag.');
            await sorted.page.mouse.move(grab.x + grab.width / 2, destination.y + destination.height / 2, { steps: 8 }); await sorted.page.mouse.up();
            const moved = [...original]; [moved[0], moved[1]] = [moved[1], moved[0]];
            assert.deepEqual(await ids(), moved); assert.equal(sorted.state.saves.length, 0);
            assert.deepEqual(sorted.state.workspace.manifest.categories.map((value) => value.id), original, 'Drag must not save by itself.');
            await sorted.page.getByRole('button', { name: 'Save draft', exact: true }).click();
            await sorted.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
            assert.deepEqual(sorted.state.workspace.manifest.categories.map((value) => value.id), moved);
            await noOverflow(sorted.page);
            await sorted.page.screenshot({ path: new URL(`topics-${width}.png`, output).pathname, fullPage: false });
        }
        return { pointerDropSavedOnlyOnSave: true, outsideAndOtherPointerCancel: true, keyboardCancelAndTab: true };
    });
    await check('touch hold reorders instructions and touch cancellation leaves the draft unchanged', async () => {
        const touch = await fixture(390); await enterArticle(touch);
        const list = touch.page.locator('[data-sort-list="Instructions in section 1"]');
        const ids = () => list.locator(':scope > [data-step-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.stepId));
        const original = await ids(), first = list.locator(`[data-step-id="${original[0]}"]`), second = list.locator(`[data-step-id="${original[1]}"]`);
        const handle = first.getByRole('button', { name: 'Reorder instruction 1 in section 1', exact: true });
        await handle.scrollIntoViewIfNeeded();
        const session = await touch.context.newCDPSession(touch.page);
        async function gesture(cancel) {
            const start = await handle.boundingBox(), end = await second.boundingBox(), x = start.x + start.width / 2, y = start.y + start.height / 2;
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
            await touch.page.waitForTimeout(300);
            assert.equal(await handle.getAttribute('aria-pressed'), 'true');
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: end.y + 20, id: 1 }] });
            await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        }
        await gesture(true); assert.deepEqual(await ids(), original); assert.equal(touch.state.saves.length, 0);
        await gesture(false);
        const moved = [...original]; [moved[0], moved[1]] = [moved[1], moved[0]];
        assert.deepEqual(await ids(), moved); assert.equal(touch.state.saves.length, 0);
        await touch.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await touch.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        const saved = touch.state.workspace.articles.find((value) => value.id === specimen.id).sections[0];
        assert.deepEqual(saved.stepIds, moved); assert.equal(saved.steps[1], specimen.sections[0].steps[0]);
        return { touchHoldDrop: true, pointerCancel: true, stableStepText: true, ...(await noOverflow(touch.page)) };
    });
    await check('handle order menu works without drag and restores focus on Escape', async () => {
        const menu = await fixture(390); await enterArticle(menu);
        const handle = menu.page.getByRole('button', { name: 'Reorder instruction 2 in section 1', exact: true });
        await handle.click();
        const earlier = menu.page.getByRole('button', { name: 'Move earlier', exact: true }); await earlier.waitFor();
        await earlier.focus(); await earlier.press('Escape');
        assert.equal(await earlier.count(), 0); assert.equal(await handle.evaluate((node) => node === document.activeElement), true);
        await handle.click(); await menu.page.getByRole('button', { name: 'Move earlier', exact: true }).click();
        assert.equal(await menu.page.locator('[data-sort-list="Instructions in section 1"] > li').first().getAttribute('data-step-id'), specimen.sections[0].stepIds[1]);
        assert.equal(menu.state.saves.length, 0);
        await menu.page.getByRole('button', { name: 'Edit instruction 1 text', exact: true }).click();
        assert.equal(await menu.page.getByRole('button', { name: 'Reorder instruction 1 in section 1', exact: true }).isEnabled(), false, 'Pending text must block ordering.');
        await menu.page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await menu.page.screenshot({ path: new URL('phone-aligned-instructions.png', output).pathname, fullPage: false });
        return { accessibleOrderMenu: true, escapeReturnsFocus: true, pendingTextLocksOrdering: true };
    });
    await check('secondary catalogue ordering preserves hidden topic and filtered article slots', async () => {
        const altered = clone(seedWorkspace), hiddenTopic = altered.manifest.categories[1]; hiddenTopic.archived = true;
        for (const value of altered.articles) if (value.category === hiddenTopic.id) value.status = 'retired';
        const visibleTopic = altered.manifest.categories.find((topic) => !topic.archived && altered.articles.filter((value) => value.category === topic.id).length >= 3), peerIds = altered.manifest.articleOrder.filter((id) => altered.articles.find((value) => value.id === id).category === visibleTopic.id);
        assert.ok(peerIds.length >= 3);
        const first = altered.articles.find((value) => value.id === peerIds[0]), hidden = altered.articles.find((value) => value.id === peerIds[1]), last = altered.articles.find((value) => value.id === peerIds[2]);
        first.title = 'Fictional ordering match A'; hidden.title = 'Fictional hidden article'; last.title = 'Fictional ordering match B';
        validateCmsWorkspace(altered, HELP_CMS_SEED);
        const catalogue = await fixture(1440, { workspace: altered });
        await catalogue.page.goto(`${app}/help-centre?manage=1`); await ownerTool(catalogue.page, 'Manage content');
        await catalogue.page.getByRole('searchbox', { name: 'Find an article', exact: true }).fill('Fictional ordering match');
        const firstArticle = catalogue.page.getByRole('button', { name: `Reorder article ${first.title.toLowerCase()}`, exact: true });
        await firstArticle.focus(); await firstArticle.press('Space'); await firstArticle.press('ArrowDown');
        assert.equal(await catalogue.page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), false);
        assert.equal(await catalogue.page.getByRole('searchbox', { name: 'Find an article', exact: true }).isEnabled(), false);
        await firstArticle.press('Space');
        const topicHandle = catalogue.page.getByRole('button', { name: `Reorder topic ${visibleTopic.title.toLowerCase()}`, exact: true });
        await topicHandle.click(); await catalogue.page.getByRole('button', { name: 'Move later', exact: true }).click();
        assert.equal(catalogue.state.saves.length, 0);
        await catalogue.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await catalogue.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        const expected = [...altered.manifest.articleOrder], a = expected.indexOf(first.id), b = expected.indexOf(last.id); [expected[a], expected[b]] = [expected[b], expected[a]];
        assert.deepEqual(catalogue.state.workspace.manifest.articleOrder, expected);
        assert.equal(catalogue.state.workspace.manifest.categories[1].id, hiddenTopic.id);
        assert.equal(catalogue.state.workspace.manifest.articleOrder.indexOf(hidden.id), altered.manifest.articleOrder.indexOf(hidden.id));
        return { hiddenTopicSlotPreserved: true, filteredArticleSlotsPreserved: true, catalogueDragLock: true, ...(await noOverflow(catalogue.page)) };
    });
    await check('section keyboard ordering preserves the whole section and leaves normal content touch scrolling available', async () => {
        const altered = clone(seedWorkspace), alteredArticle = altered.articles.find((value) => value.id === specimen.id);
        alteredArticle.sections.push({ id: 'fictional-supplement', title: 'Fictional supplementary section', paragraphs: ['Fictional additional explanation.'], steps: [], stepIds: [], notes: [], media: [], facts: [] });
        const sections = await fixture(390, { workspace: altered }); await enterArticle(sections);
        const handle = sections.page.getByRole('button', { name: 'Reorder section 2', exact: true });
        await handle.focus(); await handle.press('Space'); await handle.press('ArrowUp'); await handle.press('Enter');
        assert.equal(await sections.page.locator('[data-sort-list="Article sections"] > section').first().getAttribute('id'), 'fictional-supplement');
        assert.equal(sections.state.saves.length, 0);
        await sections.page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await sections.page.getByText('Draft saved. Published articles and Guide answers change after publication completes.', { exact: true }).waitFor();
        const savedArticle = sections.state.workspace.articles.find((value) => value.id === specimen.id);
        assert.equal(savedArticle.sections[1].id, specimen.sections[0].id); assert.deepEqual(savedArticle.sections[1].facts, specimen.sections[0].facts);
        assert.equal(await sections.page.locator('.cms-context-text').first().evaluate((node) => getComputedStyle(node).touchAction), 'auto');
        assert.equal(await sections.page.getByRole('button', { name: 'Reorder section 1', exact: true }).evaluate((node) => getComputedStyle(node).touchAction), 'none');
        return { stableSectionAndFacts: true, contentTouchScrollAvailable: true, ...(await noOverflow(sections.page)) };
    });
    await check('browser Back keeps an unfinished inline edit available for explicit completion', async () => {
        const pending = await fixture(390);
        await enterArticle(pending);
        await pending.page.getByRole('navigation', { name: 'Help content breadcrumbs' }).getByRole('button', { name: originalTopic, exact: true }).click();
        await pending.page.getByRole('button').filter({ hasText: companion.title }).first().click();
        await pending.page.getByRole('button', { name: 'Edit article title', exact: true }).click();
        await pending.page.getByRole('textbox', { name: 'Article title', exact: true }).fill('Fictional pending title kept across Back');
        await pending.page.goBack();
        const retained = pending.page.getByRole('region', { name: 'Pending text edit', exact: true });
        await retained.waitFor();
        assert.equal(await retained.getByRole('textbox', { name: 'Article title', exact: true }).inputValue(), 'Fictional pending title kept across Back');
        assert.equal(await pending.page.getByRole('button', { name: 'Save draft', exact: true }).isEnabled(), false);
        await retained.getByRole('button', { name: 'Done', exact: true }).click();
        await pending.page.getByRole('button').filter({ hasText: 'Fictional pending title kept across Back' }).first().click();
        await pending.page.getByRole('heading', { name: 'Fictional pending title kept across Back', exact: true, level: 1 }).waitFor();
        assert.equal(pending.state.saves.length, 0);
        return { unfinishedTextRetained: true, noImplicitSave: true, ...(await noOverflow(pending.page)) };
    });
    await check('existing dashboard content entry opens secondary management within Help Centre', async () => {
        const legacy = await fixture(1440);
        await legacy.page.goto(`${app}/dashboard/help-content`);
        await legacy.page.getByRole('heading', { name: 'How can we help?', exact: true, level: 1 }).waitFor();
        const current = new URL(legacy.page.url());
        assert.equal(current.pathname, '/help-centre');
        assert.equal(current.searchParams.get('manage'), '1');
        await ownerTool(legacy.page, 'Manage content');
        await legacy.page.getByRole('heading', { name: 'Manage content', exact: true, level: 1 }).waitFor();
        await legacy.page.getByRole('button', { name: 'Back to Help Centre', exact: true }).click();
        await legacy.page.getByRole('heading', { name: 'How can we help?', exact: true, level: 1 }).waitFor();
        assert.equal(legacy.state.calls.filter((call) => call.path === '/api/help/cms' && call.method === 'GET').length, 1);
        return { legacyEntryPreserved: true, sharedManagementDraft: true, ...(await noOverflow(legacy.page)) };
    });
    await check('a pristine draft cannot navigate away while its first image upload is in flight', async () => {
        const uploading = await fixture(390, { uploadDelay: 1200 });
        await enterArticle(uploading);
        const target = uploading.page.locator(`[data-step-id="${specimen.sections[0].stepIds[0]}"]`);
        const sent = uploading.page.waitForRequest((request) => new URL(request.url()).pathname === '/api/help/cms/media' && request.method() === 'POST');
        await target.getByLabel('Upload images after this instruction', { exact: true }).setInputFiles({ name: 'fictional-upload-in-flight.png', mimeType: 'image/png', buffer: png });
        await sent;
        await uploading.page.getByRole('link', { name: 'CareAround Help Centre', exact: true }).click();
        await uploading.page.getByRole('alert').filter({ hasText: 'Wait for your images to finish uploading before navigating.' }).waitFor();
        assert.equal(new URL(uploading.page.url()).pathname, `/help-centre/${specimen.slug}`);
        assert.equal(uploading.state.saves.length, 0);
        await target.locator('details.cms-context-attachment').waitFor();
        await uploading.page.getByText('Images added. Enter a caption and accessible description for each image, then save the draft.', { exact: true }).waitFor();
        assert.equal(await uploading.page.getByRole('button', { name: 'Edit article title', exact: true }).isEnabled(), true);
        return { navigationBlockedDuringFirstUpload: true, uploadCompletedInOriginalInstruction: true, ...(await noOverflow(uploading.page)) };
    });
    await check('history and publication Preview, Continue and Exit return to the current article without losing edits', async () => {
        const exercised = [];
        for (const width of [390, 1440]) {
            const secondary = await fixture(width);
            await enterArticle(secondary);
            const title = `Fictional secondary panel draft at ${width}px`;
            await changeBlock(secondary.page, 'Edit article title', 'Article title', title);
            const articleUrl = secondary.page.url();
            for (const panel of [{ tool: 'Saved history', heading: 'Saved history' }, { tool: 'Review & publish', heading: 'Publish saved content' }]) {
                if (await secondary.page.getByRole('button', { name: 'Edit this article', exact: true }).isVisible()) await secondary.page.getByRole('button', { name: 'Edit this article', exact: true }).click();
                await ownerTool(secondary.page, panel.tool);
                await secondary.page.getByRole('heading', { name: panel.heading, exact: true }).waitFor();
                await secondary.page.getByRole('button', { name: 'Preview draft', exact: true }).click();
                await secondary.page.getByRole('button', { name: 'Help article', exact: true }).waitFor();
                await secondary.page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
                assert.equal(await secondary.page.getByRole('heading', { name: panel.heading, exact: true }).count(), 0, 'Preview must replace the secondary panel with the article preview.');
                assert.equal(secondary.page.url(), articleUrl);
                await noOverflow(secondary.page);
                await secondary.page.getByRole('button', { name: 'Continue editing', exact: true }).click();
                await secondary.page.getByRole('button', { name: 'Edit article title', exact: true }).waitFor();
                await secondary.page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
                assert.equal(secondary.page.url(), articleUrl);
                await ownerTool(secondary.page, panel.tool);
                await secondary.page.getByRole('heading', { name: panel.heading, exact: true }).waitFor();
                await secondary.page.getByRole('button', { name: 'Exit editing', exact: true }).click();
                await secondary.page.getByRole('button', { name: 'Edit this article', exact: true }).waitFor();
                await secondary.page.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
                assert.equal(await secondary.page.getByRole('heading', { name: panel.heading, exact: true }).count(), 0, 'Exit must replace the secondary panel with the reading article.');
                assert.equal(await secondary.page.getByRole('button', { name: 'Edit article title', exact: true }).count(), 0);
                assert.equal(secondary.page.url(), articleUrl);
                assert.equal(secondary.state.saves.length, 0, 'View changes must never save or publish implicitly.');
                assert.equal(secondary.state.calls.filter((call) => call.path === '/api/help/cms' && call.method === 'GET').length, 1);
                exercised.push({ width, panel: panel.tool });
            }
            await secondary.page.screenshot({ path: new URL(`${width < 640 ? 'phone' : 'desktop'}-secondary-exit-reading.png`, output).pathname, fullPage: false });
        }
        return { combinations: exercised, draftRetained: true, routeUnchanged: true, noImplicitSave: true };
    });
} finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(new URL('report.json', output), JSON.stringify(report, null, 2));
    await writeFile(new URL(`report-${report.startedAt.replace(/[:.]/g, '-')}.json`, output), JSON.stringify(report, null, 2));
    await browser.close();
}
assert.ok(report.checks.length > 0 && report.checks.every((item) => item.passed), 'Contextual Help CMS browser checks failed; inspect output/playwright/help-cms-context/report.json.');
assert.deepEqual(report.pageErrors, [], 'No browser runtime errors are permitted.');
assert.deepEqual(report.unexpectedWrites, [], 'No requests outside the fictional write contract are permitted.');
console.log(`PASS ${report.checks.length}/${report.checks.length} fictional contextual CMS browser checks.`);
