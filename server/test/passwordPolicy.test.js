import assert from 'node:assert/strict';
import test from 'node:test';

import {
    loginPasswordSchema,
    MIN_NEW_PASSWORD_LENGTH,
    newPasswordSchema,
    validateNewPassword,
} from '../src/utils/passwordPolicy.js';

test('new passwords require at least twelve non-blank characters', () => {
    assert.equal(MIN_NEW_PASSWORD_LENGTH, 12);
    assert.equal(newPasswordSchema.safeParse('short').success, false);
    assert.equal(newPasswordSchema.safeParse('            ').success, false);
    assert.equal(newPasswordSchema.safeParse('correct horse').success, true);
});

test('existing short passwords remain valid login inputs', () => {
    assert.equal(loginPasswordSchema.safeParse('a').success, true);
    assert.equal(loginPasswordSchema.safeParse('').success, false);
});

test('password validation returns the exact accepted password and exposes safe client errors', () => {
    assert.equal(validateNewPassword('correct horse battery'), 'correct horse battery');
    assert.throws(
        () => validateNewPassword(undefined),
        (error) => error.status === 400 && /required/i.test(error.message),
    );
    assert.throws(
        () => validateNewPassword('too short'),
        (error) => error.status === 400 && /at least 12 characters/i.test(error.message),
    );
});
