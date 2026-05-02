import assert from 'node:assert/strict';
import test from 'node:test';

import {
    attachTranslations,
    extractTranslatableFields,
    saveManualTranslation,
    sanitizeTranslationsForPublicPayload,
    syncResourceTranslations,
} from '../src/utils/resourceTranslations.js';

function createFakeTranslationDb(initialRows = []) {
    let nextId = 1;
    const rows = initialRows.map((row) => ({ id: nextId++, ...row }));

    return {
        rows,
        async listResourceTranslations(resourceType, resourceIds) {
            return rows.filter((row) => row.resourceType === resourceType && resourceIds.includes(row.resourceId));
        },
        async upsertResourceTranslation(payload) {
            const existing = rows.find((row) => (
                row.resourceType === payload.resourceType
                && row.resourceId === payload.resourceId
                && row.locale === payload.locale
            ));
            if (existing) {
                Object.assign(existing, payload, { updatedAt: new Date() });
                return existing;
            }
            const created = {
                id: nextId++,
                ...payload,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            rows.push(created);
            return created;
        },
    };
}

const fakeEnv = {
    GOOGLE_TRANSLATE_PROJECT_ID: 'carearound-test',
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'translation-test@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    }),
};

test('extractTranslatableFields keeps public text clean and bounded', () => {
    const fields = extractTranslatableFields('soft', {
        name: '  Group A\u0000/B  ',
        description: 'Line 1\r\nLine 2',
        contactPhone: '+65 6000 0000',
        ctaUrl: 'https://example.com/register',
    });

    assert.equal(fields.name, 'Group A/B');
    assert.equal(fields.description, 'Line 1\nLine 2');
    assert.equal(fields.contactPhone, undefined);
    assert.equal(fields.ctaUrl, undefined);
});

test('syncResourceTranslations translates missing fields once per target language', async () => {
    const db = createFakeTranslationDb();
    const calls = [];
    const translator = async (_config, locale, values) => {
        calls.push({ locale, values });
        return values.map((value) => `${locale}:${value}`);
    };

    const result = await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'hard',
        resourceId: 12,
        source: {
            name: 'Care Hub',
            subCategory: 'Active Ageing Centre',
            address: 'Singapore 680000',
            description: 'Friendly senior activities.',
        },
        translator,
    });

    assert.equal(result.status, 'ok');
    assert.equal(db.rows.length, 3);
    assert.deepEqual(calls.map((call) => call.locale), ['zh-CN', 'ms', 'ta']);
    assert.equal(db.rows.find((row) => row.locale === 'ms').fields.description, 'ms:Friendly senior activities.');
});

test('reviewed auto translations become reviewed without being treated as staff edits', async () => {
    const db = createFakeTranslationDb();
    const translator = async (_config, locale, values) => values.map((value) => `${locale}:${value}`);

    await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'hard',
        resourceId: 18,
        source: {
            name: 'Care Hub',
            description: 'Friendly senior activities.',
        },
        translator,
        targetLocales: ['zh-CN'],
    });

    await saveManualTranslation(db, {
        resourceType: 'hard',
        resourceId: 18,
        locale: 'zh-CN',
        source: {
            name: 'Care Hub',
            description: 'Friendly senior activities.',
        },
        fields: {},
        reviewedFields: ['name', 'description'],
        updatedByUserId: 1,
    });

    let zh = db.rows.find((row) => row.locale === 'zh-CN');
    assert.equal(zh.fieldMeta.name.status, 'reviewed');
    assert.equal(zh.fieldMeta.description.status, 'reviewed');
    assert.equal(zh.fields.description, 'zh-CN:Friendly senior activities.');

    await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'hard',
        resourceId: 18,
        source: {
            name: 'Care Hub',
            description: 'Updated senior activities.',
        },
        translator,
        targetLocales: ['zh-CN'],
    });

    zh = db.rows.find((row) => row.locale === 'zh-CN');
    assert.equal(zh.fields.description, 'zh-CN:Friendly senior activities.');
    assert.equal(zh.fieldMeta.description.status, 'stale');
});

test('changed reviewed translations are marked as staff edited', async () => {
    const db = createFakeTranslationDb();
    const translator = async (_config, locale, values) => values.map((value) => `${locale}:${value}`);

    await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'soft',
        resourceId: 19,
        source: {
            name: 'Line Dance',
            description: 'Beginner-friendly dance session.',
        },
        translator,
        targetLocales: ['ms'],
    });

    await saveManualTranslation(db, {
        resourceType: 'soft',
        resourceId: 19,
        locale: 'ms',
        source: {
            name: 'Line Dance',
            description: 'Beginner-friendly dance session.',
        },
        fields: {
            description: 'Staff improved Malay description',
        },
        reviewedFields: ['description'],
        updatedByUserId: 1,
    });

    const ms = db.rows.find((row) => row.locale === 'ms');
    assert.equal(ms.fields.description, 'Staff improved Malay description');
    assert.equal(ms.fieldMeta.description.status, 'human_edited');
});

test('manual translation is marked stale instead of overwritten when English changes', async () => {
    const db = createFakeTranslationDb();
    const translator = async (_config, locale, values) => values.map((value) => `${locale}:${value}`);

    await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'soft',
        resourceId: 20,
        source: {
            name: 'Line Dance',
            bucket: 'Programmes',
            subCategory: 'Dance',
            description: 'Beginner-friendly dance session.',
        },
        translator,
    });

    await saveManualTranslation(db, {
        resourceType: 'soft',
        resourceId: 20,
        locale: 'zh-CN',
        source: {
            name: 'Line Dance',
            bucket: 'Programmes',
            subCategory: 'Dance',
            description: 'Beginner-friendly dance session.',
        },
        fields: {
            description: 'Staff approved Mandarin description',
        },
        updatedByUserId: 1,
    });

    await syncResourceTranslations(db, fakeEnv, {
        resourceType: 'soft',
        resourceId: 20,
        source: {
            name: 'Line Dance',
            bucket: 'Programmes',
            subCategory: 'Dance',
            description: 'Updated dance session details.',
        },
        translator,
    });

    const zh = db.rows.find((row) => row.locale === 'zh-CN');
    const ms = db.rows.find((row) => row.locale === 'ms');

    assert.equal(zh.fields.description, 'Staff approved Mandarin description');
    assert.equal(zh.fieldMeta.description.status, 'stale');
    assert.equal(ms.fields.description, 'ms:Updated dance session details.');
    assert.equal(ms.fieldMeta.description.status, 'machine');
});

test('syncResourceTranslations saves English even when translation is not configured', async () => {
    const db = createFakeTranslationDb();
    const result = await syncResourceTranslations(db, {}, {
        resourceType: 'hard',
        resourceId: 1,
        source: { name: 'Care Hub' },
    });

    assert.equal(result.status, 'not_configured');
    assert.equal(db.rows.length, 0);
});

test('public translation attachments keep text and stale fallback without review metadata', () => {
    const publicPayload = sanitizeTranslationsForPublicPayload({
        'zh-CN': {
            fields: {
                name: '关怀中心',
                description: '旧说明',
            },
            fieldMeta: {
                name: {
                    status: 'human_edited',
                    sourceHash: 'staff-only-hash',
                    updatedByUserId: 7,
                },
                description: {
                    status: 'stale',
                    sourceHash: 'old-source-hash',
                },
            },
            reviewedAt: new Date('2026-05-01T10:00:00Z'),
            updatedAt: new Date('2026-05-01T10:00:00Z'),
        },
    });

    assert.deepEqual(publicPayload, {
        'zh-CN': {
            fields: {
                name: '关怀中心',
                description: '旧说明',
            },
            fieldMeta: {
                description: { status: 'stale' },
            },
        },
    });

    const attached = attachTranslations({ id: 12, name: 'Care Hub' }, {
        ms: {
            fields: { name: 'Pusat Jagaan' },
            fieldMeta: { name: { status: 'reviewed', sourceHash: 'reviewed-hash' } },
            reviewedAt: new Date(),
        },
    });

    assert.deepEqual(attached.translations, {
        ms: {
            fields: { name: 'Pusat Jagaan' },
        },
    });
    assert.equal(JSON.stringify(attached).includes('reviewed-hash'), false);
    assert.equal(JSON.stringify(attached).includes('reviewedAt'), false);
});
