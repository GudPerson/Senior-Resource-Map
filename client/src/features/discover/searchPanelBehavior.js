export const DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_TOP = 32;
export const DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_DELTA = 14;
export const DISCOVERY_SEARCH_EXPAND_SCROLL_TOP = 24;
export const DISCOVERY_SEARCH_EXPAND_SCROLL_DELTA = 14;
export const DISCOVERY_SEARCH_EXPAND_PULL_DELTA = 18;

function isDesktopBrowseMode({ desktopPaneMode = 'browse', isDesktop }) {
    return Boolean(isDesktop && desktopPaneMode === 'browse');
}

export function getSearchPanelActionForResultsScroll({
    desktopPaneMode = 'browse',
    isDesktop = false,
    isSearchPanelCollapsed = false,
    nextScrollTop = 0,
    previousScrollTop = 0,
}) {
    if (!isDesktopBrowseMode({ desktopPaneMode, isDesktop })) {
        return 'none';
    }

    if (isSearchPanelCollapsed) {
        const scrolledUp = previousScrollTop - nextScrollTop >= DISCOVERY_SEARCH_EXPAND_SCROLL_DELTA;
        return nextScrollTop <= DISCOVERY_SEARCH_EXPAND_SCROLL_TOP && scrolledUp ? 'expand' : 'none';
    }

    const scrolledDown = nextScrollTop - previousScrollTop >= DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_DELTA;
    return nextScrollTop >= DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_TOP && scrolledDown ? 'collapse' : 'none';
}

export function shouldExpandSearchPanelFromTopPull({
    desktopPaneMode = 'browse',
    isDesktop = false,
    isSearchPanelCollapsed = false,
    scrollTop = 0,
    deltaY = 0,
    pullDistance = 0,
}) {
    if (!isDesktopBrowseMode({ desktopPaneMode, isDesktop }) || !isSearchPanelCollapsed) {
        return false;
    }

    const isAtTop = scrollTop <= DISCOVERY_SEARCH_EXPAND_SCROLL_TOP;
    const isPullingDown = deltaY <= -DISCOVERY_SEARCH_EXPAND_PULL_DELTA
        || pullDistance >= DISCOVERY_SEARCH_EXPAND_PULL_DELTA;

    return isAtTop && isPullingDown;
}

export function shouldExpandSearchPanelFromCollapsedSummaryPull({
    isDesktop = false,
    isSearchPanelCollapsed = false,
    deltaY = 0,
    pullDistance = 0,
}) {
    if (!isDesktop || !isSearchPanelCollapsed) {
        return false;
    }

    return deltaY <= -DISCOVERY_SEARCH_EXPAND_PULL_DELTA
        || pullDistance >= DISCOVERY_SEARCH_EXPAND_PULL_DELTA;
}
