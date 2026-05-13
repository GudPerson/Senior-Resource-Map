import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getPreferredWhatsAppLaunchUrl,
    getWhatsAppUrl,
    isLikelyMobileDevice,
    isSafeWhatsAppUrl,
    isGudAuthPhoneLinkReturn,
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

test('prefers native WhatsApp app links on mobile while keeping web links as desktop fallback', () => {
    assert.equal(
        getPreferredWhatsAppLaunchUrl('https://wa.me/6587651901?text=WAP-123456', { preferNative: true }),
        'whatsapp://send?phone=6587651901&text=WAP-123456',
    );
    assert.equal(
        getPreferredWhatsAppLaunchUrl('https://api.whatsapp.com/send?phone=6587651901&text=WAP-123456', { preferNative: true }),
        'whatsapp://send?phone=6587651901&text=WAP-123456',
    );
    assert.equal(
        getPreferredWhatsAppLaunchUrl('https://wa.me/6587651901?text=WAP-123456'),
        'https://wa.me/6587651901?text=WAP-123456',
    );
});

test('detects Android, iPhone, and iPad-style touch devices for native WhatsApp launch', () => {
    assert.equal(isLikelyMobileDevice('Mozilla/5.0 (Linux; Android 14; SM-S918B)'), true);
    assert.equal(isLikelyMobileDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), true);
    assert.equal(isLikelyMobileDevice('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)'), true);
    assert.equal(isLikelyMobileDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
    }), true);
    assert.equal(isLikelyMobileDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
    }), false);
});

test('detects GudAuth phone-link returns from the Profile query string', () => {
    assert.equal(isGudAuthPhoneLinkReturn('?gudauth=phone_link'), true);
    assert.equal(isGudAuthPhoneLinkReturn('gudauth=phone_link'), true);
    assert.equal(isGudAuthPhoneLinkReturn('?gudauth=phone_login'), false);
    assert.equal(isGudAuthPhoneLinkReturn('?other=phone_link'), false);
});
