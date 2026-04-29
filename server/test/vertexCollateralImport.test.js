import test from 'node:test';
import assert from 'node:assert/strict';

import {
    consolidateCollateralDraftRows,
    extractCollateralDraftRows,
    resolveAiImportProviderConfig,
} from '../src/utils/vertexCollateralImport.js';

const serviceAccountJson = JSON.stringify({
    client_email: 'vertex@example.iam.gserviceaccount.com',
    private_key: [
        '-----BEGIN PRIVATE KEY-----',
        'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
        '-----END PRIVATE KEY-----',
    ].join('\n'),
});

test('consolidateCollateralDraftRows groups repeated programme rows into one exact session list', () => {
    const { draftRows, warnings } = consolidateCollateralDraftRows([
        {
            bucket: 'Programmes',
            name: 'HPB Exercise',
            subCategorySuggestion: 'Exercise',
            schedule: '4 May 2026 (Monday), 9am-10am',
            newTags: ['exercise'],
            confidence: 0.9,
        },
        {
            bucket: 'Programmes',
            name: 'HPB Exercise',
            subCategorySuggestion: 'Exercise',
            schedule: '11 May 2026 (Monday), 9am-10am',
            newTags: ['Exercise', 'fitness'],
            confidence: 0.8,
        },
        {
            bucket: 'Programmes',
            name: 'HPB Exercise',
            subCategorySuggestion: 'Exercise',
            schedule: '18 May 2026 (Monday), 9am-10am',
            newTags: ['fitness'],
            confidence: 0.7,
        },
    ]);

    assert.equal(draftRows.length, 1);
    assert.equal(draftRows[0].name, 'HPB Exercise');
    assert.equal(draftRows[0].sessionCount, 3);
    assert.equal(draftRows[0].groupedFromCount, 3);
    assert.equal(draftRows[0].schedule, [
        '4 May 2026 (Monday), 9am-10am',
        '11 May 2026 (Monday), 9am-10am',
        '18 May 2026 (Monday), 9am-10am',
    ].join('\n'));
    assert.deepEqual(draftRows[0].newTags, ['exercise', 'fitness']);
    assert.ok(warnings.some((warning) => warning.includes('Grouped 3 "HPB Exercise" entries')));
});

test('consolidateCollateralDraftRows keeps same-name sessions with different times under one offering', () => {
    const { draftRows } = consolidateCollateralDraftRows([
        {
            bucket: 'Programmes',
            name: 'Rummy-O',
            scheduleSessions: [
                '7 May 2026 (Thursday), 2pm-5pm',
                '14 May 2026 (Thursday), 2pm-5pm',
            ],
        },
        {
            bucket: 'Programmes',
            name: 'Rummy-O',
            scheduleSessions: ['21 May 2026 (Thursday), 2pm-5pm'],
        },
        {
            bucket: 'Programmes',
            name: 'Rummy-O',
            scheduleSessions: ['26 May 2026 (Tuesday), 2pm-5pm'],
        },
    ]);

    assert.equal(draftRows.length, 1);
    assert.deepEqual(draftRows[0].scheduleSessions, [
        '7 May 2026 (Thursday), 2pm-5pm',
        '14 May 2026 (Thursday), 2pm-5pm',
        '21 May 2026 (Thursday), 2pm-5pm',
        '26 May 2026 (Tuesday), 2pm-5pm',
    ]);
    assert.equal(draftRows[0].sessionCount, 4);
});

test('consolidateCollateralDraftRows marks full programmes as hidden drafts', () => {
    const { draftRows } = consolidateCollateralDraftRows([
        {
            bucket: 'Programmes',
            name: 'Board Games with ITE students',
            schedule: '5 May 2026 (Tuesday), 1:30pm-3pm',
            venueNote: 'Printed in red on the source calendar.',
        },
    ]);

    assert.equal(draftRows.length, 1);
    assert.equal(draftRows[0].availabilityStatus, 'full');
    assert.equal(draftRows[0].isHidden, true);
    assert.equal(draftRows[0].visibilityAction, 'hide');
    assert.match(draftRows[0].venueNote, /Marked full on source material/);
});

test('consolidateCollateralDraftRows excludes closure and venue notices from offering drafts', () => {
    const { draftRows, warnings } = consolidateCollateralDraftRows([
        {
            bucket: 'Programmes',
            name: 'Centre Close',
            schedule: '1 May 2026 (Friday)',
        },
        {
            bucket: 'Programmes',
            name: 'Please join our WhatsApp community chat',
        },
        {
            bucket: 'Programmes',
            name: 'Zumba Gold',
            schedule: '15 May 2026 (Friday), 10am-11am',
        },
    ]);

    assert.equal(draftRows.length, 1);
    assert.equal(draftRows[0].name, 'Zumba Gold');
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every((warning) => warning.includes('looks like a notice')));
});

test('resolveAiImportProviderConfig prefers Vertex when both providers are configured', () => {
    const config = resolveAiImportProviderConfig({
        VERTEX_AI_PROJECT_ID: 'carearound-test',
        VERTEX_AI_SERVICE_ACCOUNT_JSON: serviceAccountJson,
        GEMINI_API_KEY: 'gemini-test-key',
    });

    assert.equal(config.provider, 'vertex');
    assert.equal(config.projectId, 'carearound-test');
    assert.equal(config.model, 'gemini-2.5-flash');
});

test('resolveAiImportProviderConfig uses Gemini when Vertex is absent', () => {
    const config = resolveAiImportProviderConfig({
        GEMINI_API_KEY: 'gemini-test-key',
        GEMINI_API_MODEL: 'gemini-test-model',
    });

    assert.equal(config.provider, 'gemini');
    assert.equal(config.apiKey, 'gemini-test-key');
    assert.equal(config.model, 'gemini-test-model');
});

test('resolveAiImportProviderConfig reports friendly setup error when no provider is configured', () => {
    assert.throws(
        () => resolveAiImportProviderConfig({}),
        /AI import is not set up for this environment yet/,
    );
});

test('extractCollateralDraftRows calls Gemini fallback and consolidates returned draft rows', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    let capturedBody = null;

    globalThis.fetch = async (url, options) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            async json() {
                return {
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify({
                                            warnings: ['Programmes in red are full.'],
                                            draftRows: [
                                                {
                                                    bucket: 'Programmes',
                                                    name: 'Square Dance',
                                                    schedule: '12 May 2026 (Tuesday), 10am-11am',
                                                    confidence: 0.9,
                                                },
                                                {
                                                    bucket: 'Programmes',
                                                    name: 'Square Dance',
                                                    schedule: '19 May 2026 (Tuesday), 10am-11am',
                                                    confidence: 0.8,
                                                },
                                            ],
                                        }),
                                    },
                                ],
                            },
                        },
                    ],
                };
            },
        };
    };

    try {
        const extraction = await extractCollateralDraftRows({
            env: {
                GEMINI_API_KEY: 'gemini-test-key',
                GEMINI_API_MODEL: 'gemini-test-model',
            },
            hostAsset: {
                name: 'Precious Active Ageing Centre',
                address: 'Blk 488B Choa Chu Kang Avenue 5',
            },
            files: [
                {
                    type: 'image/jpeg',
                    size: 12,
                    async arrayBuffer() {
                        return new TextEncoder().encode('fake image').buffer;
                    },
                },
            ],
            softSubCategoryNames: ['Exercise'],
            knownTagNames: ['dance'],
        });

        assert.match(capturedUrl, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test-model:generateContent\?key=/);
        assert.equal(capturedBody.generationConfig.responseMimeType, 'application/json');
        assert.ok(capturedBody.generationConfig.responseSchema.properties.draftRows);
        assert.equal(capturedBody.contents[0].parts[1].inlineData.mimeType, 'image/jpeg');
        assert.equal(extraction.draftRows.length, 1);
        assert.equal(extraction.draftRows[0].name, 'Square Dance');
        assert.equal(extraction.draftRows[0].sessionCount, 2);
        assert.equal(extraction.draftRows[0].schedule, [
            '12 May 2026 (Tuesday), 10am-11am',
            '19 May 2026 (Tuesday), 10am-11am',
        ].join('\n'));
        assert.ok(extraction.warnings.some((warning) => warning.includes('Grouped 2 "Square Dance" entries')));
    } finally {
        globalThis.fetch = originalFetch;
    }
});
