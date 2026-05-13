import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPhoneFirstRecoveryProfileUpdates } from '../src/controllers/userController.js';

const PHONE_ONLY_USER = {
    id: 7,
    email: 'phone+6583682962.12@phone.carearound.invalid',
};

test('phone-first profile recovery stores a real email and chosen password', async () => {
    const updates = await buildPhoneFirstRecoveryProfileUpdates({
        currentUser: PHONE_ONLY_USER,
        body: {
            email: '  Joshua.Recovery@Gmail.com ',
            password: 'new-password',
        },
        findUserByEmail: async () => null,
        hashPassword: async (password) => `hashed:${password}`,
    });

    assert.deepEqual(updates, {
        email: 'joshua.recovery@gmail.com',
        passwordHash: 'hashed:new-password',
    });
});

test('phone-first recovery email requires a password and cannot reuse another account email', async () => {
    await assert.rejects(
        () => buildPhoneFirstRecoveryProfileUpdates({
            currentUser: PHONE_ONLY_USER,
            body: { email: 'person@example.com' },
            findUserByEmail: async () => null,
            hashPassword: async () => 'hash',
        }),
        (err) => err.status === 400 && /password/i.test(err.message),
    );

    await assert.rejects(
        () => buildPhoneFirstRecoveryProfileUpdates({
            currentUser: PHONE_ONLY_USER,
            body: { email: 'person@example.com', password: 'new-password' },
            findUserByEmail: async () => ({ id: 99, email: 'person@example.com' }),
            hashPassword: async () => 'hash',
        }),
        (err) => err.status === 409 && /already registered/i.test(err.message),
    );
});

test('existing real-email accounts cannot change email through profile recovery', async () => {
    await assert.rejects(
        () => buildPhoneFirstRecoveryProfileUpdates({
            currentUser: { id: 8, email: 'jane@example.com' },
            body: { email: 'other@example.com', password: 'new-password' },
            findUserByEmail: async () => null,
            hashPassword: async () => 'hash',
        }),
        (err) => err.status === 400 && /cannot be changed/i.test(err.message),
    );
});
