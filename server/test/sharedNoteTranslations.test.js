import assert from 'node:assert/strict';
import test from 'node:test';

import {
    collectSharedNoteTranslationItems,
    translateSharedMapNotes,
} from '../src/utils/sharedNoteTranslations.js';

const fakeEnv = {
    GOOGLE_TRANSLATE_PROJECT_ID: 'carearound-test',
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        client_email: 'translation-test@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    }),
};

test('collectSharedNoteTranslationItems collects visible shared notes once per resource', () => {
    const directory = {
        assets: [
            {
                assetKey: 'hard-10',
                notes: {
                    items: [
                        { text: 'Use the side gate', isShared: true },
                        { text: 'Private draft', isShared: false },
                    ],
                },
            },
        ],
        places: [
            {
                rows: [
                    {
                        assetKey: 'hard-10',
                        notes: {
                            items: [
                                { text: 'Use the side gate', isShared: true },
                            ],
                        },
                    },
                    {
                        resourceType: 'soft',
                        resourceId: 22,
                        notes: {
                            items: [
                                { text: 'Bring referral letter' },
                            ],
                        },
                    },
                ],
            },
        ],
    };

    assert.deepEqual(collectSharedNoteTranslationItems(directory), [
        {
            assetKey: 'hard-10',
            noteIndex: 0,
            text: 'Use the side gate',
        },
        {
            assetKey: 'soft-22',
            noteIndex: 0,
            text: 'Bring referral letter',
        },
    ]);
});

test('translateSharedMapNotes translates one requested locale only', async () => {
    const calls = [];
    const result = await translateSharedMapNotes(fakeEnv, {
        assets: [
            {
                assetKey: 'soft-20',
                notes: {
                    items: [
                        { text: 'Bring referral letter', isShared: true },
                    ],
                },
            },
        ],
    }, 'ms', {
        translator: async (_config, locale, values) => {
            calls.push({ locale, values });
            return values.map((value) => `${locale}:${value}`);
        },
    });

    assert.equal(result.status, 'ok');
    assert.deepEqual(calls, [
        {
            locale: 'ms',
            values: ['Bring referral letter'],
        },
    ]);
    assert.deepEqual(result.translations, {
        'soft-20': {
            0: 'ms:Bring referral letter',
        },
    });
});

test('translateSharedMapNotes falls back cleanly when translation is not configured', async () => {
    const result = await translateSharedMapNotes({}, {
        assets: [
            {
                assetKey: 'soft-20',
                notes: {
                    items: [
                        { text: 'Bring referral letter', isShared: true },
                    ],
                },
            },
        ],
    }, 'ta');

    assert.deepEqual(result, {
        locale: 'ta',
        status: 'not_configured',
        translations: {},
    });
});
