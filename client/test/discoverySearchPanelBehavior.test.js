import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getSearchPanelActionForResultsScroll,
    shouldExpandSearchPanelFromCollapsedSummaryPull,
    shouldExpandSearchPanelFromTopPull,
} from '../src/features/discover/searchPanelBehavior.js';

test('desktop browse results scroll still collapses the expanded search panel', () => {
    assert.equal(getSearchPanelActionForResultsScroll({
        desktopPaneMode: 'browse',
        isDesktop: true,
        isSearchPanelCollapsed: false,
        nextScrollTop: 48,
        previousScrollTop: 20,
    }), 'collapse');
});

test('collapsed desktop search expands when the user scrolls back to the top card', () => {
    assert.equal(getSearchPanelActionForResultsScroll({
        desktopPaneMode: 'browse',
        isDesktop: true,
        isSearchPanelCollapsed: true,
        nextScrollTop: 0,
        previousScrollTop: 22,
    }), 'expand');
});

test('collapsed desktop search treats the sticky header offset as the top card', () => {
    assert.equal(getSearchPanelActionForResultsScroll({
        desktopPaneMode: 'browse',
        isDesktop: true,
        isSearchPanelCollapsed: true,
        nextScrollTop: 16,
        previousScrollTop: 96,
    }), 'expand');
});

test('collapsed desktop search expands when pulling down from the top of results', () => {
    assert.equal(shouldExpandSearchPanelFromTopPull({
        desktopPaneMode: 'browse',
        isDesktop: true,
        isSearchPanelCollapsed: true,
        scrollTop: 0,
        deltaY: -22,
    }), true);
});

test('collapsed desktop search does not expand from a mid-list pull', () => {
    assert.equal(shouldExpandSearchPanelFromTopPull({
        desktopPaneMode: 'browse',
        isDesktop: true,
        isSearchPanelCollapsed: true,
        scrollTop: 120,
        deltaY: -30,
    }), false);
});

test('collapsed desktop search expands when pulling down on the collapsed summary', () => {
    assert.equal(shouldExpandSearchPanelFromCollapsedSummaryPull({
        isDesktop: true,
        isSearchPanelCollapsed: true,
        pullDistance: 24,
    }), true);
});

test('collapsed summary ignores ordinary downward list scrolling gestures', () => {
    assert.equal(shouldExpandSearchPanelFromCollapsedSummaryPull({
        isDesktop: true,
        isSearchPanelCollapsed: true,
        deltaY: 24,
    }), false);
});
