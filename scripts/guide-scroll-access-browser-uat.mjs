// Local-only Guide UX regression. Requires the disposable fixture and client.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    await context.addCookies([{ name: 'carearound_support_fixture', value: 'staff',
        domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return url.protocol.startsWith('http') && !['127.0.0.1', 'localhost'].includes(url.hostname)
            ? route.abort('blockedbyclient') : route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5179/help');
    const questions = [
        'How do I save resources?',
        'How do I unsave resources?',
        'How do I create a map?',
        'How do I share a map?',
        'How do I use Care Calendar?',
    ];
    for (const [index, question] of questions.entries()) {
        await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill(question);
        const answered = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
        await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
        assert.equal((await answered).status(), 200);
        await page.waitForFunction((count) => document.querySelectorAll('[role="log"] article').length === count, index + 1);
    }
    const position = await page.getByRole('log', { name: 'Conversation with CareAround Guide' }).evaluate((log) => {
        const viewport = log.parentElement.getBoundingClientRect();
        const newest = log.lastElementChild.getBoundingClientRect();
        return { viewportTop: viewport.top, viewportBottom: viewport.bottom,
            newestTop: newest.top, newestBottom: newest.bottom,
            newestHeight: newest.height, viewportHeight: viewport.height };
    });
    assert.ok(position.newestHeight < position.viewportHeight, JSON.stringify(position));
    assert.ok(position.newestTop >= position.viewportTop - 2, JSON.stringify(position));
    assert.ok(position.newestBottom <= position.viewportBottom - 8, JSON.stringify(position));

    await page.getByRole('checkbox', { name: /Use Cloudflare AI:/ }).check();
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('Am I allowed to create a Place?');
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
    const permission = await (await answered).json();
    assert.equal(permission.topicId, 'resource-access');
    assert.equal(permission.answerSource, 'reviewed');
    assert.match(permission.message, /cannot create a new Place/i);

    const followUp = 'Where do I find My Maps?';
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill(followUp);
    const request = page.waitForRequest((item) => item.url().endsWith('/api/guide/answer')
        && item.postDataJSON()?.question === followUp);
    const followUpAnswer = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
    const body = (await request).postDataJSON();
    assert.equal(body.useAi, true);
    assert.ok(body.turns.length > 0);
    assert.equal(body.turns.some((turn) => /allowed to create a Place|cannot create a new Place/i.test(`${turn.question} ${turn.answer}`)), false);
    assert.equal((await followUpAnswer).status(), 200);
    assert.deepEqual(errors, []);
    console.log('PASS Guide latest answer visible and current account access answered without a model loop.');
    await context.close();
} finally {
    await browser.close();
}
