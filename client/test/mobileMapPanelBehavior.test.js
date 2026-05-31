import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MOBILE_MAP_PANEL_STATES,
    getMobileMapPanelActionForScroll,
    getMobileMapPanelStateAfterBadgeActivation,
    shouldExpandMobileMapPanelFromTopPull,
} from '../src/lib/mobileMapPanelBehavior.js';

test('mobile map panel collapses when cards scroll upward', () => {
    assert.equal(getMobileMapPanelActionForScroll({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.EXPANDED,
        nextScrollTop: 64,
        previousScrollTop: 24,
    }), 'collapse');
});

test('mobile map panel ignores small top-card jitter', () => {
    assert.equal(getMobileMapPanelActionForScroll({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.EXPANDED,
        nextScrollTop: 14,
        previousScrollTop: 10,
    }), 'none');
});

test('mobile map panel collapses when slow scrolling crosses the card threshold', () => {
    assert.equal(getMobileMapPanelActionForScroll({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.EXPANDED,
        nextScrollTop: 36,
        previousScrollTop: 30,
    }), 'collapse');
});

test('collapsed mobile map panel ignores scroll anchoring after the map height shrinks', () => {
    assert.equal(getMobileMapPanelActionForScroll({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.COLLAPSED,
        nextScrollTop: 0,
        previousScrollTop: 96,
    }), 'none');
});

test('collapsed mobile map panel expands when pulling down at the top card', () => {
    assert.equal(shouldExpandMobileMapPanelFromTopPull({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.COLLAPSED,
        scrollTop: 0,
        pullDistance: 24,
    }), true);
});

test('collapsed mobile map panel does not expand from a mid-list pull', () => {
    assert.equal(shouldExpandMobileMapPanelFromTopPull({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.COLLAPSED,
        scrollTop: 180,
        pullDistance: 32,
    }), false);
});

test('number badge activation expands the mobile map panel before focusing the pin', () => {
    assert.equal(getMobileMapPanelStateAfterBadgeActivation({
        isMobile: true,
        mapPanelState: MOBILE_MAP_PANEL_STATES.COLLAPSED,
    }), MOBILE_MAP_PANEL_STATES.EXPANDED);
});

test('number badge activation leaves desktop map panel state untouched', () => {
    assert.equal(getMobileMapPanelStateAfterBadgeActivation({
        isMobile: false,
        mapPanelState: MOBILE_MAP_PANEL_STATES.COLLAPSED,
    }), MOBILE_MAP_PANEL_STATES.COLLAPSED);
});
