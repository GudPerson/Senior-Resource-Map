import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getActiveModeAfterTemporaryClear,
    resolveInitialActiveMode,
} from '../src/hooks/useDirectoryDistanceAnchor.js';

test('directory distance anchor keeps home as the default for existing shared callers', () => {
    assert.equal(resolveInitialActiveMode({ hasHome: true }), 'home');
    assert.equal(resolveInitialActiveMode({ hasHome: false }), null);
});

test('directory distance anchor can opt out of defaulting to home', () => {
    assert.equal(resolveInitialActiveMode({
        hasHome: true,
        defaultActiveMode: null,
    }), null);
});

test('stored directory distance mode still wins over the no-default setting', () => {
    assert.equal(resolveInitialActiveMode({
        storedMode: 'home',
        hasHome: true,
        defaultActiveMode: null,
    }), 'home');
    assert.equal(resolveInitialActiveMode({
        storedMode: 'none',
        hasHome: true,
        defaultActiveMode: 'home',
    }), null);
});

test('clearing a temporary My Map location returns to no active location when requested', () => {
    assert.equal(getActiveModeAfterTemporaryClear({
        normalizedPostalCode: '680153',
        defaultActiveMode: null,
    }), null);
    assert.equal(getActiveModeAfterTemporaryClear({
        normalizedPostalCode: '680153',
        defaultActiveMode: 'home',
    }), 'home');
});
