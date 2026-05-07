import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildPhoneIdentityDuplicateAudit,
    maskPhoneIdentity,
} from '../src/utils/phoneIdentityAudit.js';

test('phone identity audit detects duplicate normalized user phones without exposing full numbers', () => {
    const rows = [
        { id: 1, username: 'alice', email: 'alice@example.test', name: 'Alice', role: 'standard', phone: '83682962' },
        { id: 2, username: 'bob', email: 'bob@example.test', name: 'Bob', role: 'standard', phone: '+65 8368 2962' },
        { id: 3, username: 'carol', email: 'carol@example.test', name: 'Carol', role: 'partner', phone: '91234567' },
        { id: 4, username: 'dan', email: 'dan@example.test', name: 'Dan', role: 'standard', phone: 'not a phone' },
        { id: 5, username: 'eve', email: 'eve@example.test', name: 'Eve', role: 'standard', phone: '' },
    ];

    const audit = buildPhoneIdentityDuplicateAudit(rows);

    assert.equal(audit.totalRows, 5);
    assert.equal(audit.validPhoneRows, 3);
    assert.equal(audit.invalidOrBlankRows, 2);
    assert.equal(audit.duplicateGroupCount, 1);
    assert.equal(audit.duplicateAccountCount, 2);
    assert.equal(audit.groups[0].phone, '+65****2962');
    assert.equal(audit.groups[0].normalizedPhone, undefined);
    assert.deepEqual(audit.groups[0].users.map((user) => user.id), [1, 2]);
});

test('phone identity audit can include full normalized phones only when explicitly requested', () => {
    const audit = buildPhoneIdentityDuplicateAudit([
        { id: 1, phone: '6583682962' },
        { id: 2, phone: '+65 8368 2962' },
    ], { maskPhones: false });

    assert.equal(audit.groups[0].phone, '+6583682962');
    assert.equal(audit.groups[0].normalizedPhone, '+6583682962');
});

test('maskPhoneIdentity preserves only a safe suffix', () => {
    assert.equal(maskPhoneIdentity('+6583682962'), '+65****2962');
    assert.equal(maskPhoneIdentity(null), '');
});
