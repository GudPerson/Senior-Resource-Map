import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDiscoveryIndicatorContext,
    buildDiscoveryLocationIndicators,
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
