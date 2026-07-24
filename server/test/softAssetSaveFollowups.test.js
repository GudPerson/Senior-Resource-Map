import test from 'node:test';
import assert from 'node:assert/strict';

import { softAssetTranslationFieldsChanged } from '../src/controllers/softAssetsController.js';

test('soft asset translation follow-up runs only for English text changes', () => {
    const existing = {
        name: 'Exercise Class',
        bucket: 'Programmes',
        subCategory: 'Fitness',
        description: 'Light exercise.',
        schedule: 'Mondays',
        ctaLabel: 'Register',
        venueNote: 'Room 1',
        availabilityUnit: 'slots',
        logoUrl: 'https://example.test/old.png',
    };

    assert.equal(softAssetTranslationFieldsChanged(existing, {
        ...existing,
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(softAssetTranslationFieldsChanged(existing, {
        logoUrl: 'https://example.test/new.png',
    }), false);

    assert.equal(softAssetTranslationFieldsChanged(existing, {
        ...existing,
        schedule: 'Mondays and Fridays',
    }), true);
});
