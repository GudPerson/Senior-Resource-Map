import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getGudAuthPhoneLoginAttemptId,
    getPreferredWhatsAppLaunchUrl,
    getWhatsAppUrl,
    isSafeWhatsAppUrl,
    isGudAuthPhoneLinkReturn,
    shouldUsePreparedWhatsAppWindow,
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

test('prefers native WhatsApp app links on mobile while keeping web links as fallback', () => {
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

test('uses the prepared blank window only for desktop WhatsApp launching', () => {
    assert.equal(
        shouldUsePreparedWhatsAppWindow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36'),
        true,
    );
    assert.equal(
        shouldUsePreparedWhatsAppWindow('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36'),
        false,
    );
    assert.equal(
        shouldUsePreparedWhatsAppWindow('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'),
        false,
    );
});

test('treats touch tablets with desktop-style user agents as mobile launch surfaces', () => {
    const ipadDesktopUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

    assert.equal(
        shouldUsePreparedWhatsAppWindow(ipadDesktopUserAgent, { maxTouchPoints: 5 }),
        false,
    );
    assert.equal(
        shouldUsePreparedWhatsAppWindow(ipadDesktopUserAgent, { coarsePointer: true }),
        false,
    );
    assert.equal(
        shouldUsePreparedWhatsAppWindow(ipadDesktopUserAgent, { maxTouchPoints: 0, coarsePointer: false }),
        true,
    );
});

test('detects GudAuth phone-link returns from the Profile query string', () => {
    assert.equal(isGudAuthPhoneLinkReturn('?gudauth=phone_link'), true);
    assert.equal(isGudAuthPhoneLinkReturn('gudauth=phone_link'), true);
    assert.equal(isGudAuthPhoneLinkReturn('?gudauth=phone_login'), false);
    assert.equal(isGudAuthPhoneLinkReturn('?other=phone_link'), false);
});

test('reads the phone-login attempt id from GudAuth return links', () => {
    assert.equal(getGudAuthPhoneLoginAttemptId('?gudauth=phone_login&attempt=123'), 123);
    assert.equal(getGudAuthPhoneLoginAttemptId('gudauth=phone_login&attempt=45'), 45);
    assert.equal(getGudAuthPhoneLoginAttemptId('?gudauth=phone_link&attempt=123'), null);
    assert.equal(getGudAuthPhoneLoginAttemptId('?gudauth=phone_login&attempt=abc'), null);
    assert.equal(getGudAuthPhoneLoginAttemptId('?gudauth=phone_login&attempt=0'), null);
});
