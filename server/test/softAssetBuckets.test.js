import test from 'node:test';
import assert from 'node:assert/strict';

import { inferSoftAssetBucket, normalizeSoftAssetBucket } from '../src/utils/softAssetBuckets.js';

test('normalizeSoftAssetBucket accepts supported bucket labels', () => {
    assert.equal(normalizeSoftAssetBucket('Programmes'), 'Programmes');
    assert.equal(normalizeSoftAssetBucket('services'), 'Services');
    assert.equal(normalizeSoftAssetBucket('promotion'), 'Promotions');
});

test('normalizeSoftAssetBucket returns fallback for blank values', () => {
    assert.equal(normalizeSoftAssetBucket('', 'Programmes'), 'Programmes');
    assert.equal(normalizeSoftAssetBucket(null, null), null);
});

test('normalizeSoftAssetBucket rejects unsupported values', () => {
    assert.throws(
        () => normalizeSoftAssetBucket('Health Screening'),
        /Bucket must be Programmes, Services, or Promotions/
    );
});

test('inferSoftAssetBucket classifies promotions and services from keywords', () => {
    assert.deepEqual(
        inferSoftAssetBucket({ name: 'Healthier SG benefits', tags: ['subsidies'] }),
        { bucket: 'Promotions', confidence: 'high', reason: 'promotion-keyword' }
    );

    assert.deepEqual(
        inferSoftAssetBucket({ subCategory: 'Health Screening', description: 'Free chronic care screening' }),
        { bucket: 'Services', confidence: 'high', reason: 'service-keyword' }
    );
});

test('inferSoftAssetBucket falls back to programmes when no strong signal exists', () => {
    assert.deepEqual(
        inferSoftAssetBucket({ name: 'Morning Meet-up' }),
        { bucket: 'Programmes', confidence: 'low', reason: 'default-fallback' }
    );
});
