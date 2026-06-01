import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildResourceLoadFailureMessage,
    getManagedResourceListStatus,
} from '../src/lib/resourceLoadState.js';

test('managed resource list shows a load-error state when the first fetch fails with no visible rows', () => {
    assert.equal(getManagedResourceListStatus({
        loading: false,
        loadError: { title: 'Unable to load resources' },
        visibleItemCount: 0,
        hasCompletedResourceLoad: false,
    }), 'load-error');
});

test('managed resource list still shows empty only after a successful zero-result fetch', () => {
    assert.equal(getManagedResourceListStatus({
        loading: false,
        loadError: null,
        visibleItemCount: 0,
        hasCompletedResourceLoad: true,
    }), 'empty');
});

test('managed resource list keeps previously visible rows when a refresh fails', () => {
    assert.equal(getManagedResourceListStatus({
        loading: false,
        loadError: { title: 'Unable to load resources' },
        visibleItemCount: 3,
        hasCompletedResourceLoad: true,
    }), 'ready');
});

test('managed resource list does not show an empty state after a failed refresh with zero visible rows', () => {
    assert.equal(getManagedResourceListStatus({
        loading: false,
        loadError: { title: 'Unable to load resources' },
        visibleItemCount: 0,
        hasCompletedResourceLoad: true,
    }), 'load-error');
});

test('resource load failure message only blames connection when browser is offline', () => {
    assert.deepEqual(buildResourceLoadFailureMessage({ isOffline: true }), {
        title: 'You seem to be offline',
        description: 'Reconnect to the internet, then try loading your resources again.',
        notice: 'You seem to be offline. Reconnect and try again.',
    });

    assert.deepEqual(buildResourceLoadFailureMessage({
        isOffline: false,
        errorMessage: 'Failed to fetch',
    }), {
        title: 'We could not load your resources just now',
        description: 'This can happen when the connection or server is briefly slow. Try again in a moment.',
        notice: 'We could not load your resources just now. Check your connection or try again.',
    });
});
