import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildEmbedCategoryOptions,
    buildEmbeddedMapPresentation,
    findEmbedPreviewGroup,
    getEmbedListOnlyResourceCount,
} from '../src/lib/embedMapPresentation.js';

function createDirectory() {
    return {
        categoryOrder: ['senior care centre', 'active ageing centre'],
        places: [
            {
                placeKey: 'mapped-1',
                name: 'Mapped care centre',
                address: '1 Example Street Singapore 600001',
                hasCoordinates: true,
                lat: 1.33,
                lng: 103.74,
                rows: [{
                    rowKey: 'hard-1',
                    resourceType: 'hard',
                    resourceId: 1,
                    name: 'Mapped care centre',
                    subCategory: 'Active Ageing Centre',
                    categoryColor: '#2563eb',
                    detailPath: '/resource/hard/1',
                }],
            },
            {
                placeKey: 'mapped-2',
                name: 'Rehabilitation centre',
                address: '2 Example Street Singapore 600002',
                hasCoordinates: true,
                lat: 1.34,
                lng: 103.75,
                rows: [{
                    rowKey: 'hard-2',
                    resourceType: 'hard',
                    resourceId: 2,
                    name: 'Rehabilitation centre',
                    subCategory: 'Senior Care Centre',
                    categoryColor: '#0f766e',
                    detailPath: '/resource/hard/2',
                }],
            },
            {
                placeKey: 'unmapped-3',
                name: 'Telephone support',
                hasCoordinates: false,
                lat: null,
                lng: null,
                rows: [{
                    rowKey: 'soft-3',
                    resourceType: 'soft',
                    resourceId: 3,
                    name: 'Telephone support',
                    subCategory: 'Support service',
                    detailPath: '/resource/soft/3',
                }],
            },
        ],
    };
}

test('embed category options respect the owner category sequence', () => {
    assert.deepEqual(
        buildEmbedCategoryOptions(createDirectory()).map((option) => option.label),
        ['Senior Care Centre', 'Active Ageing Centre', 'Support service'],
    );
});

test('embedded map presentation filters pins by category and text query', () => {
    const presentation = buildEmbeddedMapPresentation(createDirectory(), {
        selectedCategoryKeys: ['active ageing centre'],
        query: 'mapped',
    });

    assert.equal(presentation.pins.length, 1);
    assert.equal(presentation.pins[0].placeKey, 'mapped-1');
    assert.equal(findEmbedPreviewGroup(presentation, 'mapped-1')?.rows[0]?.resourceId, 1);
});

test('map-only presentation reports resources without coordinates separately', () => {
    assert.equal(getEmbedListOnlyResourceCount(createDirectory()), 1);
});
