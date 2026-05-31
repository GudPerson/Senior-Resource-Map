import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDesktopUnmappedLayout } from '../src/lib/directoryPresentation.js';

function group(number, rowCount = 1) {
    return {
        placeKey: `place-${number}`,
        number,
        rows: Array.from({ length: rowCount }, (_, index) => ({ rowKey: `place-${number}-row-${index}` })),
    };
}

function row(name) {
    return { rowKey: `unmapped-${name}`, name };
}

test('desktop list-only rows distribute into side lanes when mapped resources are sparse', () => {
    const layout = buildDesktopUnmappedLayout({
        mappedGroups: [group(1), group(2), group(3), group(4)],
        leftGroups: [group(1), group(2)],
        rightGroups: [group(3), group(4)],
        unmappedRows: [row('A'), row('B'), row('C')],
    });

    assert.equal(layout.placement, 'side-lanes');
    assert.deepEqual(layout.leftUnmappedRows.map((item) => item.name), ['A', 'C']);
    assert.deepEqual(layout.rightUnmappedRows.map((item) => item.name), ['B']);
    assert.deepEqual(layout.dockedUnmappedRows, []);
});

test('desktop list-only rows dock under map notes when mapped resources are dense', () => {
    const mappedGroups = Array.from({ length: 7 }, (_, index) => group(index + 1));
    const layout = buildDesktopUnmappedLayout({
        mappedGroups,
        leftGroups: mappedGroups.slice(0, 4),
        rightGroups: mappedGroups.slice(4),
        unmappedRows: [row('A'), row('B')],
    });

    assert.equal(layout.placement, 'map-column');
    assert.deepEqual(layout.leftUnmappedRows, []);
    assert.deepEqual(layout.rightUnmappedRows, []);
    assert.deepEqual(layout.dockedUnmappedRows.map((item) => item.name), ['A', 'B']);
});

test('desktop list-only rows dock when mapped cards have many visible rows', () => {
    const mappedGroups = [group(1, 5), group(2, 4)];
    const layout = buildDesktopUnmappedLayout({
        mappedGroups,
        leftGroups: [mappedGroups[0]],
        rightGroups: [mappedGroups[1]],
        unmappedRows: [row('A')],
    });

    assert.equal(layout.placement, 'map-column');
    assert.deepEqual(layout.dockedUnmappedRows.map((item) => item.name), ['A']);
});
