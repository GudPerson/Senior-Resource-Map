import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSingaporePhoneIdentity } from '../src/utils/phoneIdentity.js';

test('normalizes a local Singapore mobile number to E.164', () => {
    assert.equal(normalizeSingaporePhoneIdentity('83682962'), '+6583682962');
});

test('normalizes a formatted Singapore number with country code to E.164', () => {
    assert.equal(normalizeSingaporePhoneIdentity('+65 8368 2962'), '+6583682962');
});

test('normalizes Singapore digits with country code prefix to E.164', () => {
    assert.equal(normalizeSingaporePhoneIdentity('6583682962'), '+6583682962');
});

test('handles blank or invalid account phone values safely', () => {
    assert.equal(normalizeSingaporePhoneIdentity(''), null);
    assert.equal(normalizeSingaporePhoneIdentity('   '), null);
    assert.equal(normalizeSingaporePhoneIdentity(null), null);
    assert.equal(normalizeSingaporePhoneIdentity('12345'), null);
    assert.equal(normalizeSingaporePhoneIdentity('hello phone'), null);
    assert.equal(normalizeSingaporePhoneIdentity('+1 312 555 0000'), null);
});
