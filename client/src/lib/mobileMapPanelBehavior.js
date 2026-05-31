export const MOBILE_MAP_PANEL_STATES = {
    EXPANDED: 'expanded',
    COLLAPSED: 'collapsed',
};

export const MOBILE_MAP_COLLAPSE_SCROLL_TOP = 32;
export const MOBILE_MAP_COLLAPSE_SCROLL_DELTA = 14;
export const MOBILE_MAP_EXPAND_SCROLL_TOP = 24;
export const MOBILE_MAP_EXPAND_SCROLL_DELTA = 14;
export const MOBILE_MAP_EXPAND_PULL_DELTA = 18;

function isMobilePanelEnabled(isMobile) {
    return Boolean(isMobile);
}

export function getMobileMapPanelActionForScroll({
    isMobile = false,
    mapPanelState = MOBILE_MAP_PANEL_STATES.EXPANDED,
    nextScrollTop = 0,
    previousScrollTop = 0,
}) {
    if (!isMobilePanelEnabled(isMobile)) {
        return 'none';
    }

    if (mapPanelState === MOBILE_MAP_PANEL_STATES.COLLAPSED) {
        const scrolledBackToTop = previousScrollTop - nextScrollTop >= MOBILE_MAP_EXPAND_SCROLL_DELTA;
        return nextScrollTop <= MOBILE_MAP_EXPAND_SCROLL_TOP && scrolledBackToTop ? 'expand' : 'none';
    }

    const scrolledIntoCards = nextScrollTop - previousScrollTop >= MOBILE_MAP_COLLAPSE_SCROLL_DELTA;
    return nextScrollTop >= MOBILE_MAP_COLLAPSE_SCROLL_TOP && scrolledIntoCards ? 'collapse' : 'none';
}

export function shouldExpandMobileMapPanelFromTopPull({
    isMobile = false,
    mapPanelState = MOBILE_MAP_PANEL_STATES.EXPANDED,
    scrollTop = 0,
    deltaY = 0,
    pullDistance = 0,
}) {
    if (!isMobilePanelEnabled(isMobile) || mapPanelState !== MOBILE_MAP_PANEL_STATES.COLLAPSED) {
        return false;
    }

    const isAtTopCard = scrollTop <= MOBILE_MAP_EXPAND_SCROLL_TOP;
    const isPullingDown = deltaY <= -MOBILE_MAP_EXPAND_PULL_DELTA
        || pullDistance >= MOBILE_MAP_EXPAND_PULL_DELTA;

    return isAtTopCard && isPullingDown;
}

export function getMobileMapPanelStateAfterBadgeActivation({
    isMobile = false,
    mapPanelState = MOBILE_MAP_PANEL_STATES.EXPANDED,
}) {
    return isMobilePanelEnabled(isMobile)
        ? MOBILE_MAP_PANEL_STATES.EXPANDED
        : mapPanelState;
}
