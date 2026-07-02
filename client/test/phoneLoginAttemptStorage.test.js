import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PHONE_LOGIN_ATTEMPT_STORAGE_KEY,
    clearStoredPhoneLoginAttempt,
    readStoredPhoneLoginAttempt,
    writeStoredPhoneLoginAttempt,
} from '../src/lib/phoneLoginAttemptStorage.js';

function installLocalStorage() {
    const values = new Map();
    globalThis.window = {
        localStorage: {
            getItem: (key) => values.has(key) ? values.get(key) : null,
            setItem: (key, value) => values.set(key, String(value)),
            removeItem: (key) => values.delete(key),
        },
    };
    return values;
}

test('phone login attempt storage clears stale signup attempts after another login succeeds', () => {
    const values = installLocalStorage();

    writeStoredPhoneLoginAttempt(123, '83682962', '/dashboard/profile', 'attempt-token');
    assert.equal(values.has(PHONE_LOGIN_ATTEMPT_STORAGE_KEY), true);
    assert.equal(readStoredPhoneLoginAttempt().attemptToken, 'attempt-token');

    clearStoredPhoneLoginAttempt();

    assert.equal(values.has(PHONE_LOGIN_ATTEMPT_STORAGE_KEY), false);
    assert.equal(readStoredPhoneLoginAttempt(), null);
});

test('phone login attempt storage ignores attempts without a verifier token', () => {
    const values = installLocalStorage();
    values.set(PHONE_LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify({
        attemptId: 456,
        phone: '83682962',
        returnTo: '/dashboard',
        expiresAt: Date.now() + 1000,
    }));

    assert.equal(readStoredPhoneLoginAttempt(), null);
    assert.equal(values.has(PHONE_LOGIN_ATTEMPT_STORAGE_KEY), false);
});

test('phone login attempt storage ignores expired attempts', () => {
    const values = installLocalStorage();
    values.set(PHONE_LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify({
        attemptId: 456,
        phone: '83682962',
        returnTo: '/dashboard',
        expiresAt: Date.now() - 1000,
    }));

    assert.equal(readStoredPhoneLoginAttempt(), null);
    assert.equal(values.has(PHONE_LOGIN_ATTEMPT_STORAGE_KEY), false);
});
