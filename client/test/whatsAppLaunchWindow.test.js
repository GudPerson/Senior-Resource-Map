import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    launchPreparedWhatsAppWindow,
    prepareWhatsAppLaunchWindow,
} from '../src/lib/whatsAppLaunchWindow.js';

function createPreparedWindow() {
    const writes = [];
    return {
        closed: false,
        closeCalls: 0,
        document: {
            open() {},
            write(value) { writes.push(value); },
            close() {},
        },
        close() { this.closeCalls += 1; },
        writes,
    };
}

async function withWindow(windowLike, callback) {
    const previous = globalThis.window;
    globalThis.window = windowLike;
    try {
        return await callback();
    } finally {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    }
}

test('prepared WhatsApp window escapes user-facing launch text', async () => {
    const prepared = createPreparedWindow();
    await withWindow({ open: () => prepared }, () => {
        assert.equal(prepareWhatsAppLaunchWindow('<Opening>', 'Wait & continue'), prepared);
    });
    assert.match(prepared.writes.join(''), /&lt;Opening&gt;/);
    assert.match(prepared.writes.join(''), /Wait &amp; continue/);
    assert.doesNotMatch(prepared.writes.join(''), /<Opening>/);
});

test('invalid WhatsApp redirects close the prepared window and fail closed', async () => {
    const prepared = createPreparedWindow();
    const result = await withWindow({ open: () => ({}) }, () => (
        launchPreparedWhatsAppWindow(prepared, 'https://example.com/not-whatsapp')
    ));
    assert.equal(result, false);
    assert.equal(prepared.closeCalls, 1);
});

test('prepared and fallback launch paths share one safe redirect implementation', async () => {
    const prepared = createPreparedWindow();
    const preparedResult = await withWindow({ open: () => ({}) }, () => (
        launchPreparedWhatsAppWindow(prepared, 'https://wa.me/6587651901?text=WAP-123456', {
            title: 'Continue safely',
            body: 'Opening WhatsApp',
            action: 'Open WhatsApp',
        })
    ));
    assert.equal(preparedResult, true);
    assert.match(prepared.writes.join(''), /Continue safely/);
    assert.match(prepared.writes.join(''), /wa\.me\/6587651901/);

    const openCalls = [];
    const fallbackResult = await withWindow({
        open(...args) {
            openCalls.push(args);
            return {};
        },
    }, () => launchPreparedWhatsAppWindow(null, 'https://wa.me/6587651901'));
    assert.equal(fallbackResult, true);
    assert.deepEqual(openCalls[0].slice(1), ['_blank', 'noopener,noreferrer']);
});

test('phone panels import the WhatsApp launch-preview helpers they render with', () => {
    for (const panelPath of [
        '../src/components/PhoneLoginPanel.jsx',
        '../src/components/PhoneVerificationPanel.jsx',
    ]) {
        const source = readFileSync(new URL(panelPath, import.meta.url), 'utf8');
        const stateImport = source.match(
            /import\s*\{([\s\S]*?)\}\s*from '\.\.\/lib\/phoneVerificationState\.js';/,
        );
        assert.ok(stateImport, `${panelPath} should import phone verification state`);
        assert.match(stateImport[1], /\bgetPreferredWhatsAppLaunchUrl\b/);
        assert.match(stateImport[1], /\bisLikelyMobileDevice\b/);
    }
});
