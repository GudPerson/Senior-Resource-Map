import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryIndicatorContext,
    buildDiscoveryLocationIndicators,
    loadDiscoveryIndicatorResourceMetadata,
    normalizeDiscoveryIndicatorResources,
} from '../src/utils/discoveryLocationIndicators.js';

test('normalizeDiscoveryIndicatorResources keeps resource refs compact and deduped', () => {
    const resources = normalizeDiscoveryIndicatorResources([
        { type: 'hard', id: 5 },
        { type: 'hard', id: '5' },
        { resourceType: 'soft', resourceId: 7 },
        { type: 'template', id: 9 },
        { type: 'soft', id: 'bad' },
    ]);

    assert.deepEqual(resources, [
        { type: 'hard', id: 5 },
        { type: 'soft', id: 7 },
    ]);
});

test('buildDiscoveryLocationIndicators returns only display booleans for audience and region matches', () => {
    const indicators = buildDiscoveryLocationIndicators([
        {
            type: 'soft',
            id: 20,
            audienceMode: 'audience_zones',
            audienceZoneIds: [101, 202],
            matchingRegionIds: [4, 8],
        },
        {
            type: 'hard',
            id: 10,
            audienceMode: 'public',
            audienceZoneIds: [202],
            matchingRegionIds: [8],
        },
        {
            type: 'hard',
            id: 11,
            audienceMode: 'audience_zones',
            audienceZoneIds: [202],
            matchingRegionIds: [8],
        },
        {
            type: 'soft',
            id: 21,
            audienceMode: 'public',
            audienceZoneIds: [202],
            matchingRegionIds: [9],
        },
    ], {
        audienceZoneIds: [202],
        contextRegionIds: [8],
        homeRegionIds: [4],
    });

    assert.deepEqual(indicators, {
        'soft:20': {
            withinAudienceZone: true,
            withinHomeRegion: true,
            withinContextRegion: true,
        },
        'hard:10': {
            withinAudienceZone: false,
            withinHomeRegion: false,
            withinContextRegion: true,
        },
        'hard:11': {
            withinAudienceZone: true,
            withinHomeRegion: false,
            withinContextRegion: true,
        },
        'soft:21': {
            withinAudienceZone: false,
            withinHomeRegion: false,
            withinContextRegion: false,
        },
    });

    const payload = JSON.stringify(indicators);
    assert.equal(payload.includes('202'), false);
    assert.equal(payload.includes('subregion'), false);
    assert.equal(payload.includes('boundary'), false);
});

test('buildDiscoveryIndicatorContext includes audience zones and regions from searched postal context', async () => {
    const fakeDb = {
        select(selection) {
            const selectedKey = Object.keys(selection)[0];
            return {
                from() {
                    return {
                        async where() {
                            if (selectedKey === 'audienceZoneId') {
                                return [{ audienceZoneId: 3 }];
                            }
                            if (selectedKey === 'subregionId') {
                                return [{ subregionId: 12 }];
                            }
                            return [];
                        },
                    };
                },
            };
        },
    };

    const context = await buildDiscoveryIndicatorContext(fakeDb, null, {
        contextPostalCode: '681808',
    });

    assert.deepEqual(context.audienceZoneIds, [3]);
    assert.deepEqual(context.contextRegionIds, [12]);
    assert.deepEqual(context.homeRegionIds, []);
});

test('buildDiscoveryIndicatorContext can derive context from a temporary Locate Me coordinate', async () => {
    const fakeDb = {
        select(selection) {
            const selectedKey = Object.keys(selection)[0];
            return {
                from() {
                    return {
                        async where() {
                            if (selectedKey === 'audienceZoneId') {
                                return [{ audienceZoneId: 3 }];
                            }
                            if (selectedKey === 'subregionId') {
                                return [{ subregionId: 12 }];
                            }
                            return [];
                        },
                    };
                },
            };
        },
    };

    const context = await buildDiscoveryIndicatorContext(fakeDb, null, {
        contextLocation: { lat: 1.3791, lng: 103.7449 },
        env: { GOOGLE_MAPS_API_KEY: 'test-key' },
        cacheTtlMs: 0,
        fetchImpl: async () => ({
            ok: true,
            async json() {
                return {
                    status: 'OK',
                    results: [{
                        address_components: [
                            { long_name: 'Singapore', short_name: 'SG', types: ['country'] },
                            { long_name: '681809', types: ['postal_code'] },
                        ],
                    }],
                };
            },
        }),
    });

    assert.deepEqual(context.audienceZoneIds, [3]);
    assert.deepEqual(context.contextRegionIds, [12]);
    assert.deepEqual(context.homeRegionIds, []);
});

test('buildDiscoveryIndicatorContext ignores the national Singapore region for badge relevance', async () => {
    const fakeDb = {
        select(selection) {
            const selectedKeys = Object.keys(selection);
            const selectedKey = selectedKeys[0];
            return {
                from() {
                    return {
                        async where() {
                            if (selectedKey === 'audienceZoneId') {
                                return [];
                            }
                            if (selectedKeys.includes('subregionCode')) {
                                return [{
                                    id: 99,
                                    subregionCode: 'SIN',
                                    name: 'Singapore',
                                    description: 'National fallback',
                                }];
                            }
                            if (selectedKey === 'subregionId') {
                                return [
                                    { subregionId: 12 },
                                    { subregionId: 99 },
                                ];
                            }
                            return [];
                        },
                    };
                },
            };
        },
    };

    const context = await buildDiscoveryIndicatorContext(fakeDb, {
        subregionIds: [99, 24],
    }, {
        contextPostalCode: '681809',
    });

    assert.deepEqual(context.homeRegionIds, [24]);
    assert.deepEqual(context.contextRegionIds, [12]);

    const indicators = buildDiscoveryLocationIndicators([
        {
            type: 'hard',
            id: 1,
            audienceMode: 'public',
            matchingRegionIds: [99],
        },
        {
            type: 'hard',
            id: 2,
            audienceMode: 'public',
            matchingRegionIds: [12, 99],
        },
        {
            type: 'hard',
            id: 3,
            audienceMode: 'public',
            matchingRegionIds: [24, 99],
        },
    ], context);

    assert.deepEqual(indicators, {
        'hard:1': {
            withinAudienceZone: false,
            withinHomeRegion: false,
            withinContextRegion: false,
        },
        'hard:2': {
            withinAudienceZone: false,
            withinHomeRegion: false,
            withinContextRegion: true,
        },
        'hard:3': {
            withinAudienceZone: false,
            withinHomeRegion: true,
            withinContextRegion: false,
        },
    });
});

test('loadDiscoveryIndicatorResourceMetadata inherits host hard asset audience zones for tied soft assets', async () => {
    const fakeDb = {
        query: {
            hardAssets: {
                async findMany() {
                    return [];
                },
            },
            softAssets: {
                async findMany() {
                    return [{
                        id: 20,
                        audienceMode: 'public',
                        audienceZones: [],
                        hostHardAsset: { id: 10, postalCode: '681809' },
                        locations: [
                            { hardAsset: { id: 11, postalCode: '681810' } },
                        ],
                        regionCoverages: [],
                    }];
                },
            },
        },
        select(selection) {
            const selectedKeys = Object.keys(selection);
            return {
                from() {
                    return {
                        async where() {
                            if (selectedKeys.includes('subregionCode')) return [];
                            if (selectedKeys.includes('postalCode')) return [];
                            if (selectedKeys.includes('hardAssetId') && selectedKeys.includes('audienceZoneId')) {
                                return [
                                    { hardAssetId: 10, audienceZoneId: 202 },
                                    { hardAssetId: 11, audienceZoneId: 303 },
                                ];
                            }
                            return [];
                        },
                    };
                },
            };
        },
    };

    const metadata = await loadDiscoveryIndicatorResourceMetadata(fakeDb, [
        { type: 'soft', id: 20 },
    ]);

    assert.deepEqual(metadata, [{
        type: 'soft',
        id: 20,
        audienceMode: 'audience_zones',
        audienceZoneIds: [202, 303],
        matchingRegionIds: [],
    }]);

    const indicators = buildDiscoveryLocationIndicators(metadata, {
        audienceZoneIds: [202],
        contextRegionIds: [],
        homeRegionIds: [],
    });

    assert.equal(indicators['soft:20'].withinAudienceZone, true);
});
