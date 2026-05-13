import assert from 'node:assert/strict';
import test from 'node:test';

import { LOCALES, translateUi } from '../src/lib/i18n.js';

test('phone-first signup acknowledgement copy exists for every supported locale', () => {
    const keys = [
        'phoneLoginSignupAccountWarning',
        'phoneLoginSignupAcknowledgement',
        'recoveryEmailTitle',
        'recoveryEmailHelp',
        'recoveryEmailPasswordRequired',
        'phoneVerificationReason_phone_recovery_required',
    ];

    for (const { code } of LOCALES) {
        for (const key of keys) {
            const value = translateUi(code, key);
            assert.notEqual(value, key, `${key} should be translated for ${code}`);
            if (code !== 'en') {
                assert.notEqual(value, translateUi('en', key), `${key} should not fall back to English for ${code}`);
            }
        }
    }
});
