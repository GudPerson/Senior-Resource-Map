// Local-only real-model smoke. Start the disposable fixture in live-AI mode and its loopback Wrangler bridge first.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

assert.equal(process.env.CAREAROUND_SUPPORT_FIXTURE_LIVE_AI, 'true', 'Explicit live fixture mode is required.');
const alternateFixture = process.env.CAREAROUND_SUPPORT_FIXTURE_PORT === '8792';
const browser = await chromium.launch({ headless: true });
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    await page.goto(`http://127.0.0.1:${alternateFixture ? 5180 : 5179}/help`);
    await page.getByRole('checkbox', { name: /Use Cloudflare AI:/ }).check();
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('Can I make a map?');
    const answered = page.waitForResponse((response) => response.url().endsWith('/api/guide/answer'));
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
    const response = await answered;
    assert.equal(response.status(), 200);
    const answer = await response.json();
    assert.equal(answer.answerSource, 'ai');
    assert.match(answer.message, /My Directory/i);
    assert.deepEqual(answer.sources.map(({ id }) => id), ['help-maps']);
    assert.deepEqual(answer.input, { question: 'Can I make a map?' });
    await page.getByText('Cloudflare AI answer based on reviewed CareAround guidance; check the related topics below', { exact: true }).waitFor();
    for (const [question, topicId, expected] of [
        ['what can i do with carearound SG', 'overview', /Discover.*My Directory.*My Maps/is],
        ['How do I add a resource?', 'add-resource', /existing resource.*Programme\/service/is],
    ]) {
        await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill(question);
        const nextAnswer = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
        await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
        const result = await (await nextAnswer).json();
        assert.equal(result.topicId, topicId);
        assert.match(result.message, expected);
        assert.doesNotMatch(result.message, /I don't have a verified answer|suggest checking the Help topics/i);
    }
    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('What personal places have I created?');
    const personalResponse = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer'));
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
    const personal = await (await personalResponse).json();
    assert.equal(personal.answerSource, 'account');
    assert.match(personal.message, /Staff Planning Pin/);
    assert.doesNotMatch(personal.message, /Other Private Pin|Private fixture staff address/);

    await page.getByRole('textbox', { name: 'Ask CareAround Guide', exact: true }).fill('Can I make a map?');
    const nextAiRequest = page.waitForRequest((item) => item.url().endsWith('/api/guide/answer')
        && item.postDataJSON()?.question === 'Can I make a map?');
    const nextAiResponse = page.waitForResponse((item) => item.url().endsWith('/api/guide/answer')
        && item.request().postDataJSON()?.question === 'Can I make a map?');
    await page.getByRole('button', { name: 'Ask Guide', exact: true }).last().click();
    const modelRequest = (await nextAiRequest).postDataJSON();
    assert.doesNotMatch(JSON.stringify(modelRequest.turns), /Staff Planning Pin|What personal places have I created/);
    assert.equal((await (await nextAiResponse).json()).answerSource, 'ai');
    assert.deepEqual(errors, []);
    console.log('PASS live Cloudflare Guide browser smoke: opt-in answers rendered for fictional staff and common questions.');
    await context.close();
} finally {
    await browser.close();
}
