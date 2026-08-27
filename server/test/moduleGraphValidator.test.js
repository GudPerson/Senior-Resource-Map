import test from 'node:test';
import assert from 'node:assert/strict';

import { extractRelativeImports, findCycles } from '../../scripts/validate-module-graph.mjs';

test('module graph parser collects static relative imports and exports only', () => {
    const source = `
        import value from './value.js';
        import 'react';
        export { helper } from '../helper.mjs';
        const lazy = import('./lazy.jsx');
    `;
    assert.deepEqual(extractRelativeImports(source), ['./value.js', '../helper.mjs', './lazy.jsx']);
});

test('module graph cycle detector distinguishes acyclic and circular graphs', () => {
    const acyclic = new Map([
        ['a', ['b']],
        ['b', ['c']],
        ['c', []],
    ]);
    assert.deepEqual(findCycles(acyclic), []);

    const circular = new Map([
        ['a', ['b']],
        ['b', ['c']],
        ['c', ['a']],
    ]);
    assert.deepEqual(findCycles(circular), [['a', 'b', 'c', 'a']]);
});
