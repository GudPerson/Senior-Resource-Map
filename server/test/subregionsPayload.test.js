import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildSubregionPostalPayload,
    buildSubregionResponseRow,
} from '../src/controllers/subregionsController.js';

test('subregion summary payload omits full postal code list while preserving count', () => {
    const payload = buildSubregionPostalPayload(['018895', '018906', '018907'], { includePostalCodes: false });

    assert.deepEqual(payload, {
        postalCodesList: [],
        postalCodesPreview: [],
        postalCodeCount: 3,
    });
});

test('subregion full payload includes postal code list and preview', () => {
    const payload = buildSubregionPostalPayload(['018895', '018906', '018907'], { includePostalCodes: true });

    assert.deepEqual(payload, {
        postalCodesList: ['018895', '018906', '018907'],
        postalCodesPreview: ['018895', '018906', '018907'],
        postalCodeCount: 3,
    });
});

test('subregion summary response strips heavy postal pattern text', () => {
    const row = buildSubregionResponseRow(
        { id: 186, name: 'Singapore', subregionCode: 'SIN', postalPatterns: '018895,018906,018907' },
        ['018895', '018906', '018907'],
        { includePostalCodes: false },
    );

    assert.equal(row.postalPatterns, '');
    assert.equal(row.postalCodeCount, 3);
});
