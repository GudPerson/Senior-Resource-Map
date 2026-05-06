import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureBoundarySchema, resetBoundarySchemaBootstrapForTests } from '../src/utils/boundarySchema.js';

function normalizeSql(value) {
    const text = Array.isArray(value?.queryChunks)
        ? value.queryChunks
            .map((chunk) => Array.isArray(chunk?.value) ? chunk.value.join('') : String(chunk || ''))
            .join('')
        : String(value || '');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('runtime schema bootstrap includes phone identity table and active-only uniqueness', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    const fakeDb = {
        execute(statement) {
            statements.push(normalizeSql(statement));
            return Promise.resolve();
        },
    };

    await ensureBoundarySchema(fakeDb, { NODE_ENV: 'development' });

    assert.ok(
        statements.some((statement) => statement.includes('create table if not exists user_phone_identities')),
        'expected user_phone_identities table bootstrap SQL',
    );
    const activePhoneIndex = statements.find((statement) => (
        statement.includes('create unique index if not exists user_phone_identities_active_phone_unique')
    ));
    const activeUserIndex = statements.find((statement) => (
        statement.includes('create unique index if not exists user_phone_identities_active_user_unique')
    ));

    assert.ok(activePhoneIndex, 'expected active phone_e164 uniqueness SQL');
    assert.ok(activePhoneIndex.includes('on user_phone_identities (phone_e164)'));
    assert.ok(
        activePhoneIndex.includes('where revoked_at is null'),
        'revoked historical phone rows must not block a new active owner',
    );

    assert.ok(activeUserIndex, 'expected one active phone identity per user SQL');
    assert.ok(activeUserIndex.includes('on user_phone_identities (user_id)'));
    assert.ok(
        activeUserIndex.includes('where revoked_at is null'),
        'revoked historical user rows must not block a new active phone identity',
    );
});
