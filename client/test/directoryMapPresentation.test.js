import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDirectoryMapClassNames } from '../src/lib/directoryMapPresentation.js';

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
