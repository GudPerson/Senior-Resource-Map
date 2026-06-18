import assert from 'node:assert/strict';
import test from 'node:test';

import { hasSharedMapUpdates } from './shareMapStatus.js';

test('hasSharedMapUpdates flags shared maps edited after their last share update', () => {
    assert.equal(
        hasSharedMapUpdates({
            updatedAt: '2026-06-19T09:15:00.000Z',
            share: {
                isShared: true,
                shareUpdatedAt: '2026-06-19T09:00:00.000Z',
            },
        }),
        true,
    );
});

test('hasSharedMapUpdates stays false for private, current, or timestamp-incomplete maps', () => {
    assert.equal(
        hasSharedMapUpdates({
            updatedAt: '2026-06-19T09:15:00.000Z',
            share: {
                isShared: false,
                shareUpdatedAt: '2026-06-19T09:00:00.000Z',
            },
        }),
        false,
    );

    assert.equal(
        hasSharedMapUpdates({
            updatedAt: '2026-06-19T09:00:00.000Z',
            share: {
                isShared: true,
                shareUpdatedAt: '2026-06-19T09:00:00.000Z',
            },
        }),
        false,
    );

    assert.equal(
        hasSharedMapUpdates({
            updatedAt: null,
            share: {
                isShared: true,
                shareUpdatedAt: '2026-06-19T09:00:00.000Z',
            },
        }),
        false,
    );
});
