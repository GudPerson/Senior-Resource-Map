import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getWhatsAppUrl,
    isSafeWhatsAppUrl,
    mergePhoneVerificationChallenge,
} from '../src/lib/phoneVerificationState.js';

test('keeps the WhatsApp link when a pending poll omits the deep link', () => {
    const previousChallenge = {
        id: 'challenge-1',
        status: 'pending',
        whatsappUrl: 'https://wa.me/6587651901?text=WAP-123456',
        message: 'Send WAP-123456 to GudAuth.',
    };
    const nextChallenge = {
        id: 'challenge-1',
        status: 'pending',
    };

    const merged = mergePhoneVerificationChallenge(previousChallenge, nextChallenge, 'pending');

    assert.equal(getWhatsAppUrl(merged), previousChallenge.whatsappUrl);
    assert.equal(merged.message, previousChallenge.message);
});

test('uses a newer WhatsApp link when the provider returns one', () => {
    const previousChallenge = {
        id: 'challenge-1',
        whatsappUrl: 'https://wa.me/6587651901?text=WAP-111111',
    };
    const nextChallenge = {
        id: 'challenge-2',
        whatsappUrl: 'https://wa.me/6587651901?text=WAP-222222',
    };

    const merged = mergePhoneVerificationChallenge(previousChallenge, nextChallenge, 'pending');

    assert.equal(getWhatsAppUrl(merged), nextChallenge.whatsappUrl);
});

test('clears the WhatsApp link after a terminal status', () => {
    const previousChallenge = {
        id: 'challenge-1',
        whatsappUrl: 'https://wa.me/6587651901?text=WAP-123456',
    };
    const nextChallenge = {
        id: 'challenge-1',
        status: 'expired',
    };

    const merged = mergePhoneVerificationChallenge(previousChallenge, nextChallenge, 'expired');

    assert.equal(merged, null);
});

test('allows only WhatsApp launch URLs', () => {
    assert.equal(isSafeWhatsAppUrl('https://wa.me/6587651901?text=WAP-123456'), true);
    assert.equal(isSafeWhatsAppUrl('https://api.whatsapp.com/send?phone=6587651901'), true);
    assert.equal(isSafeWhatsAppUrl('whatsapp://send?phone=6587651901'), true);
    assert.equal(isSafeWhatsAppUrl('https://example.com/redirect'), false);
});
