import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildWhatsAppContactHref,
    formatWhatsAppContactLabel,
} from '../src/lib/whatsappContact.js';

test('buildWhatsAppContactHref accepts Singapore numbers and WhatsApp URLs', () => {
    assert.equal(buildWhatsAppContactHref('8765 4321'), 'https://wa.me/6587654321');
    assert.equal(buildWhatsAppContactHref('+65 8765 4321'), 'https://wa.me/6587654321');
    assert.equal(buildWhatsAppContactHref('https://api.whatsapp.com/send?phone=6587654321'), 'https://wa.me/6587654321');
    assert.equal(buildWhatsAppContactHref('https://wa.me/6587654321?text=Hello'), 'https://wa.me/6587654321');
});

test('formatWhatsAppContactLabel keeps a readable label separate from the launch URL', () => {
    assert.equal(formatWhatsAppContactLabel('87654321'), '+65 8765 4321');
    assert.equal(formatWhatsAppContactLabel('https://wa.me/6587654321'), '+65 8765 4321');
    assert.equal(formatWhatsAppContactLabel('not a phone'), 'not a phone');
});
