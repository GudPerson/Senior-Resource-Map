import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDirectoryMapClassNames,
    getDirectoryMarkerZIndexOffset,
} from '../src/lib/directoryMapPresentation.js';

test('directory map keeps dynamic height on the React-owned frame', () => {
    const classes = buildDirectoryMapClassNames({
        mapHeightClassName: 'h-[128px] min-h-[128px] max-h-[128px] transition-[height]',
        className: 'custom-shell',
        interactive: true,
    });

    assert.match(classes.frameClassName, /h-\[128px\]/);
    assert.match(classes.frameClassName, /custom-shell/);
    assert.match(classes.containerClassName, /\bh-full\b/);
    assert.doesNotMatch(classes.containerClassName, /h-\[128px\]/);
});

test('active directory markers rise above overlapping peers like Discovery pins', () => {
    assert.equal(getDirectoryMarkerZIndexOffset({
        markerMode: 'category-icon',
        isMatched: false,
    }), 0);
    assert.equal(getDirectoryMarkerZIndexOffset({
        markerMode: 'category-icon',
        isMatched: true,
    }), 100000);

    const ordinaryHighestNumberedPin = getDirectoryMarkerZIndexOffset({
        markerMode: 'print-badge',
        number: 37,
    });
    const activeNumberedPin = getDirectoryMarkerZIndexOffset({
        markerMode: 'print-badge',
        isMatched: true,
        number: 1,
    });

    assert.equal(ordinaryHighestNumberedPin, 137000);
    assert.equal(activeNumberedPin, 1000001);
    assert.ok(activeNumberedPin > ordinaryHighestNumberedPin);
});
