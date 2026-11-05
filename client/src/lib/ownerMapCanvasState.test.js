import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOwnerMapCanvasSaveState } from './ownerMapCanvasState.js';

const cleanStudio = { loading: false, saving: false, dirty: false, status: 'saved' };

test('an unavailable Studio snapshot cannot be announced as saved', () => {
    assert.deepEqual(resolveOwnerMapCanvasSaveState(null, 'saved', ''), {
        studio: 'loading', annotations: 'saved', combined: 'loading',
    });
    assert.equal(resolveOwnerMapCanvasSaveState({ ...cleanStudio, loading: true }, 'saved', '').combined, 'loading');
});

test('a known clean Studio and annotation document can be announced as saved', () => {
    assert.deepEqual(resolveOwnerMapCanvasSaveState(cleanStudio, 'saved', ''), {
        studio: 'saved', annotations: 'saved', combined: 'saved',
    });
});

test('either failed save wins over another owner that is loading or clean', () => {
    assert.equal(resolveOwnerMapCanvasSaveState(null, 'error', 'Annotation save failed').combined, 'failed');
    assert.equal(resolveOwnerMapCanvasSaveState({ ...cleanStudio, conflict: true }, 'saved', '').combined, 'failed');
    assert.equal(resolveOwnerMapCanvasSaveState({ ...cleanStudio, status: 'error' }, 'loading', '').combined, 'failed');
});

test('pending and saving documents remain distinct from a clean saved state', () => {
    assert.equal(resolveOwnerMapCanvasSaveState({ ...cleanStudio, dirty: true }, 'saved', '').combined, 'pending');
    assert.equal(resolveOwnerMapCanvasSaveState(cleanStudio, 'unsaved', '').combined, 'pending');
    assert.equal(resolveOwnerMapCanvasSaveState({ ...cleanStudio, dirty: true, saving: true }, 'saved', '').combined, 'saving');
    assert.equal(resolveOwnerMapCanvasSaveState(cleanStudio, 'saving', '').combined, 'saving');
    assert.equal(resolveOwnerMapCanvasSaveState(cleanStudio, 'idle', '').combined, 'loading');
});
