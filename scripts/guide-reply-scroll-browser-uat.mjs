// Local UI geometry checks: fictional accounts, injected selections, no live AI.
import assert from 'node:assert/strict';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE, 'true');
const alternate = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8792';
const isolatedRelease = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8793';
const app = 'http://127.0.0.1:' + (isolatedRelease ? 5181 : alternate ? 5180 : 5179);
const api = 'http://127.0.0.1:' + (isolatedRelease ? 8793 : alternate ? 8792 : 8791);
const phase = process.env.CAREAROUND_GUIDE_SCROLL_PHASE || 'latest';
assert.ok(['before', 'after', 'final', 'latest'].includes(phase));
const output = new URL('../output/playwright/guide-actions-oracle/', import.meta.url);
const reportPath = phase === 'latest' ? new URL('reply-scroll-latest.json', output)
    : new URL('../docs/evidence/guide-oracle-reply-scroll-' + phase + '-20261001.json', import.meta.url);
if (phase !== 'latest') await assert.rejects(access(reportPath), { code: 'ENOENT' },
    'Preserved geometry phases cannot be overwritten.');
await mkdir(output, { recursive: true });
const report = { fictionalFixtureOnly: true, phase, startedAt: new Date().toISOString(),
    liveModelCalls: 0, scope: 'Local UI geometry and focus behavior; injected IDs are not model-quality proof.',
    checks: [], pageErrors: [] };
const browser = await chromium.launch({ headless: true });
const question = 'Will changing the host of an Offering alter the membership of people who saved it?';

async function check(name, work) {
    try { report.checks.push({ name, passed: true, ...await work() }); console.log('PASS ' + name); }
    catch (error) { report.checks.push({ name, passed: false, error: error.stack }); console.error('FAIL ' + name + ': ' + error.message); }
}
async function ask(page, text) {
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
}
async function geometry(log) {
    return log.evaluate((element) => {
        const viewport = element.parentElement.getBoundingClientRect();
        const article = element.lastElementChild.getBoundingClientRect();
        const reply = element.lastElementChild.lastElementChild.getBoundingClientRect();
        return { viewportTop: viewport.top, viewportBottom: viewport.bottom, viewportHeight: viewport.height,
            articleTop: article.top, articleBottom: article.bottom, articleHeight: article.height,
            replyTop: reply.top, replyBottom: reply.bottom, replyHeight: reply.height,
            scrollTop: element.parentElement.scrollTop, backgroundScroll: window.scrollY };
    });
}
try {
    for (const [width, height] of [[375, 1000], [320, 700], [960, 1000]]) {
        const context = await browser.newContext({ viewport: { width, height } });
        await context.addCookies([{ name: 'carearound_support_fixture', value: 'member',
            domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
        await context.route('**/*', (route) => {
            const url = new URL(route.request().url());
            return url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname)
                ? route.abort('blockedbyclient') : route.continue();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', (error) => report.pageErrors.push(error.message));
        const before = await (await context.request.get(api + '/__fixture/guide/state')).json();
        assert.equal((await context.request.post(api + '/__fixture/guide/semantic', {
            data: { enabled: true, factIds: ['offering-host-versus-membership'] } })).status(), 200);
        try {
            await check('reply positioning at ' + width + 'x' + height, async () => {
                await page.goto(app + '/help');
                await page.getByRole('checkbox', { name: /Try simulated AI selection/ }).check();
                const answered = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
                await ask(page, question);
                const answer = await (await answered).json();
                assert.equal(answer.topicId, 'offering-host-versus-membership');
                assert.equal(answer.answerSource, 'simulation');
                const log = page.getByRole('log', { name: 'Conversation with CareAround Guide' });
                await log.getByRole('link', { name: 'Open Profile', exact: true }).waitFor();
                const position = await geometry(log);
                await page.screenshot({ path: new URL('reply-scroll-' + phase + '-' + width + '.png', output).pathname });
                assert.equal(position.backgroundScroll, 0);
                if (position.articleHeight <= position.viewportHeight - 24) {
                    assert.ok(position.articleTop >= position.viewportTop, JSON.stringify(position));
                    assert.ok(position.articleBottom <= position.viewportBottom - 8, JSON.stringify(position));
                } else {
                    assert.ok(Math.abs(position.replyTop - position.viewportTop - 12) <= 2, JSON.stringify(position));
                    if (position.replyHeight <= position.viewportHeight - 24)
                        assert.ok(position.replyBottom <= position.viewportBottom - 8, JSON.stringify(position));
                    else {
                        await log.evaluate((element) => { element.parentElement.scrollTop = element.parentElement.scrollHeight; });
                        await log.getByRole('link', { name: 'Open Profile', exact: true }).scrollIntoViewIfNeeded();
                        const scrolled = await geometry(log);
                        assert.ok(scrolled.replyBottom <= scrolled.viewportBottom, JSON.stringify(scrolled));
                    }
                }
                const mode = await (await context.request.get(api + '/__fixture/guide/semantic')).json();
                assert.equal(mode.modelCalls, 2);
                assert.deepEqual(await (await context.request.get(api + '/__fixture/guide/state')).json(), before);
                return { ...position, simulatedModelCalls: 2, resourceStateUnchanged: true };
            });
            if (width === 375) await check('late reply preserves reader focus and scroll', async () => {
                await page.getByRole('checkbox', { name: /Try simulated AI selection/ }).uncheck();
                let release, markHeld;
                const paused = new Promise((resolve) => { release = resolve; });
                const held = new Promise((resolve) => { markHeld = resolve; });
                await page.route('**/api/guide/answer', async (route) => { markHeld(); await paused; await route.continue(); });
                const answered = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
                await ask(page, 'How do I create a map?');
                await held;
                const log = page.getByRole('log', { name: 'Conversation with CareAround Guide' });
                const readerLink = log.locator('article').first().getByRole('link', { name: 'Open Profile', exact: true });
                await readerLink.focus();
                await log.evaluate((element) => { element.parentElement.scrollTop = 0; });
                const prior = await geometry(log);
                release();
                assert.equal((await answered).status(), 200);
                await page.waitForFunction(() => document.querySelectorAll('[role="log"] article').length === 2);
                assert.equal(await readerLink.evaluate((element) => document.activeElement === element), true);
                const after = await geometry(log);
                assert.ok(Math.abs(after.scrollTop - prior.scrollTop) <= 2, JSON.stringify({ prior, after }));
                await page.unroute('**/api/guide/answer');
                return { readerFocusPreserved: true, scrollBefore: prior.scrollTop, scrollAfter: after.scrollTop };
            });
        } finally {
            assert.equal((await context.request.post(api + '/__fixture/guide/semantic', { data: { enabled: false } })).status(), 200);
            await context.close();
        }
    }
} finally {
    await browser.close();
}
report.finishedAt = new Date().toISOString();
report.passed = report.checks.every((item) => item.passed) && report.pageErrors.length === 0;
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: phase === 'latest' ? 'w' : 'wx' });
if (!report.passed) process.exitCode = 1;
