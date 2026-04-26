import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, Layers3, X } from 'lucide-react';
import { Drawer } from 'vaul';

import { api } from '../lib/api.js';
import { getDistance } from '../lib/geo.js';
import { stripMarkdownLite } from '../lib/markdownLite.js';
import { normalizePostalCode } from '../lib/postalBoundaries.js';
import { canAccessAdmin, normalizeRole } from '../lib/roles.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
import { useA11y } from '../contexts/A11yContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useSplitPaneResize } from '../hooks/useSplitPaneResize.js';
import MobileBottomSheet from '../components/mobile/MobileBottomSheet.jsx';
import DiscoveryFilterPanel from '../features/discover/DiscoveryFilterPanel.jsx';
import DesktopSavedPlaceDetailPanel from '../features/discover/DesktopSavedPlaceDetailPanel.jsx';
import DiscoveryMap from '../features/discover/DiscoveryMap.jsx';
import { DiscoveryResultsList } from '../features/discover/DiscoveryResultsList.jsx';
import SavedMapEmptyState from '../features/discover/SavedMapEmptyState.jsx';
import {
    buildPostalGroupedSavedPlacePins,
    buildRenderedPostalGroupedSavedPins,
    buildSavedPlacePins,
    getAssetLocations,
    getBestLocation,
    hasValidCoordinates,
    resolveSavedPlaceKey,
} from '../features/discover/discoverUtils.js';
import { useDiscoveryLocation } from '../features/discover/useDiscoveryLocation.js';

function withTimeout(promise, fallback, timeoutMs = 8000) {
    return Promise.race([
        promise,
        new Promise((resolve) => {
            window.setTimeout(() => resolve(fallback), timeoutMs);
        }),
    ]);
}

function normalizePaginatedResponse(response, defaultPageSize = 500) {
    if (Array.isArray(response)) {
        return {
            data: response,
            pagination: {
                page: 1,
                pageSize: response.length || defaultPageSize,
                totalCount: response.length,
                totalPages: 1,
            },
        };
    }

    return {
        data: Array.isArray(response?.data) ? response.data : [],
        pagination: {
            page: Number(response?.pagination?.page || 1),
            pageSize: Number(response?.pagination?.pageSize || defaultPageSize),
            totalCount: Number(response?.pagination?.totalCount || 0),
            totalPages: Number(response?.pagination?.totalPages || 1),
        },
    };
}

async function fetchAllPaginatedResults(fetchPage, params = {}, pageSize = 500) {
    const fallback = {
        data: [],
        pagination: {
            page: 1,
            pageSize,
            totalCount: 0,
            totalPages: 1,
        },
    };

    const firstResponse = normalizePaginatedResponse(
        await withTimeout(fetchPage({ ...params, page: 1, pageSize }).catch(() => fallback), fallback),
        pageSize,
    );

    const totalPages = Math.max(1, firstResponse.pagination.totalPages || 1);
    if (totalPages === 1) {
        return firstResponse.data;
    }

    const remainingResponses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) => (
            withTimeout(
                fetchPage({ ...params, page: index + 2, pageSize }).catch(() => fallback),
                fallback,
            )
        ))
    );

    return [
        ...firstResponse.data,
        ...remainingResponses.flatMap((response) => normalizePaginatedResponse(response, pageSize).data),
    ];
}

function createFocusRequestIdGenerator() {
    let current = 0;
    return () => {
        current += 1;
        return current;
    };
}

const nextFocusRequestId = createFocusRequestIdGenerator();
const SAVED_PIN_FOCUS_ZOOM = 18;
const DISCOVERY_DESKTOP_BASE_PANE_WIDTH = 430;
const DISCOVERY_DESKTOP_MAX_ACCESSIBLE_PANE_WIDTH = 620;
const DISCOVERY_DESKTOP_MAX_ACCESSIBLE_FONT_SCALE = 1.5;
const DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_TOP = 32;
const DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_DELTA = 14;
const TOUCH_DESKTOP_PANE_PRESET_WIDTHS = [450, 676, 992];

function normalizeSubCategoryLookupKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
}

function parseDiscoverySearchGroups(value) {
    const groupSeen = new Set();
    const groups = [];

    for (const rawGroup of String(value || '').split('/')) {
        const phraseSeen = new Set();
        const phrases = rawGroup
            .split(',')
            .map((phrase) => normalizeSearchText(phrase))
            .filter((phrase) => {
                if (!phrase || phraseSeen.has(phrase)) return false;
                phraseSeen.add(phrase);
                return true;
            });

        if (phrases.length === 0) continue;

        const groupKey = phrases.join(' && ');
        if (groupSeen.has(groupKey)) continue;
        groupSeen.add(groupKey);
        groups.push(phrases);
    }

    return groups;
}

function computeDiscoverySearchMatch(text, nameText, groups = []) {
    if (!text || groups.length === 0) {
        return {
            matches: true,
            bestGroupPhraseCount: 0,
            matchedGroupCount: 0,
            matchedPhraseCount: 0,
            nameMatchCount: 0,
        };
    }

    let matchedGroupCount = 0;
    let bestGroupPhraseCount = 0;
    const matchedPhrases = new Set();
    const matchedNamePhrases = new Set();

    for (const phrases of groups) {
        const groupMatches = phrases.every((phrase) => text.includes(phrase));
        if (!groupMatches) continue;

        matchedGroupCount += 1;
        bestGroupPhraseCount = Math.max(bestGroupPhraseCount, phrases.length);

        for (const phrase of phrases) {
            matchedPhrases.add(phrase);
            if (nameText?.includes(phrase)) {
                matchedNamePhrases.add(phrase);
            }
        }
    }

    return {
        matches: matchedGroupCount > 0,
        bestGroupPhraseCount,
        matchedGroupCount,
        matchedPhraseCount: matchedPhrases.size,
        nameMatchCount: matchedNamePhrases.size,
    };
}

function isSingaporeWideSubregion(subregion) {
    const normalizedCode = normalizeSearchText(subregion?.subregionCode || subregion?.subregionId);
    const normalizedName = normalizeSearchText(subregion?.name);
    return normalizedCode === 'sg' || normalizedCode === 'sin' || normalizedName === 'singapore';
}

function getDiscoverySubregionLabel(subregion) {
    if (!subregion) return '';
    if (isSingaporeWideSubregion(subregion)) return 'SG';
    return subregion.subregionCode || subregion.name || '';
}

function hasPostalCodeInBoundary(postalCode, postalCodeSet) {
    if (!(postalCodeSet instanceof Set) || postalCodeSet.size === 0) return false;
    const normalizedPostalCode = normalizePostalCode(postalCode);
    return normalizedPostalCode ? postalCodeSet.has(normalizedPostalCode) : false;
}

function normalizeTagNames(tags = []) {
    return (Array.isArray(tags) ? tags : [])
        .map((tag) => {
            if (typeof tag === 'string') return tag;
            return tag?.name || tag?.label || tag?.tag?.name || '';
        })
        .filter(Boolean);
}

function buildDiscoverySearchHaystack(resource) {
    const directTerms = [
        resource.name,
        stripMarkdownLite(resource.description),
        resource.address,
        resource.subCategory,
        resource.postalCode,
        ...(Array.isArray(resource.locations)
            ? resource.locations.flatMap((location) => [
                location?.name,
                location?.address,
                location?.postalCode,
            ])
            : []),
        ...normalizeTagNames(resource.tags),
    ];

    const relatedOfferingTerms = resource._type === 'hard' && Array.isArray(resource.softAssets)
        ? resource.softAssets.flatMap((offering) => [
            offering?.name,
            stripMarkdownLite(offering?.description),
            offering?.subCategory,
            ...normalizeTagNames(offering?.tags),
            ...(Array.isArray(offering?.locations)
                ? offering.locations.flatMap((location) => [
                    location?.name,
                    location?.address,
                    location?.postalCode,
                ])
                : []),
        ])
        : [];

    return [...directTerms, ...relatedOfferingTerms]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function DiscoverPostalGroupListPanel({
    anchorLayout = null,
    group,
    highlightedPinKey = null,
    hoverPreview = false,
    isDesktop = false,
    onHoverPin,
    onHoverPanelEnter,
    onHoverPanelLeave,
    onClose,
    onSelectPin,
}) {
    if (!group?.isPostalGroup) return null;

    const horizontalMargin = isDesktop ? 20 : 12;
    const fallbackWidth = isDesktop ? 420 : null;
    const trackedWidth = anchorLayout?.width ?? null;
    const panelWidth = trackedWidth
        ? Math.min(isDesktop ? 420 : Math.max(280, trackedWidth - (horizontalMargin * 2)), trackedWidth - (horizontalMargin * 2))
        : fallbackWidth;
    const memberCount = Math.max(1, Number(group?.memberPins?.length || 0));
    const minVisibleHeight = isDesktop ? 190 : 170;
    const preferredMaxHeight = isDesktop ? 520 : 420;
    const bottomPadding = isDesktop ? 24 : 16;
    const topPadding = isDesktop ? 12 : 16;
    const hoverPreviewPinClearance = hoverPreview && isDesktop ? 88 : 0;
    const verticalGap = hoverPreview && isDesktop ? 16 : 8;
    const belowGap = hoverPreview && isDesktop ? 20 : verticalGap;
    const estimatedPanelHeight = Math.min(preferredMaxHeight, Math.max(minVisibleHeight, 112 + (memberCount * 76)));
    const desiredTop = anchorLayout ? anchorLayout.y + belowGap : null;
    const clampedLeft = (anchorLayout && panelWidth)
        ? Math.max(horizontalMargin, Math.min(anchorLayout.x - (panelWidth / 2), anchorLayout.width - horizontalMargin - panelWidth))
        : null;
    const availableAbove = anchorLayout
        ? Math.max(140, anchorLayout.y - topPadding - hoverPreviewPinClearance - verticalGap)
        : preferredMaxHeight;
    const availableBelow = anchorLayout
        ? Math.max(140, anchorLayout.height - anchorLayout.y - bottomPadding - belowGap)
        : preferredMaxHeight;
    const placement = hoverPreview && isDesktop && anchorLayout
        ? (
            availableAbove >= estimatedPanelHeight
                ? 'above'
                : availableBelow >= estimatedPanelHeight
                    ? 'below'
                    : availableAbove >= availableBelow
                        ? 'above'
                        : 'below'
        )
        : 'below';
    const panelMaxHeight = Math.min(
        preferredMaxHeight,
        placement === 'above' ? availableAbove : availableBelow,
        estimatedPanelHeight,
    );
    const clampedTop = anchorLayout
        ? (
            placement === 'above'
                ? Math.max(topPadding, anchorLayout.y - hoverPreviewPinClearance - verticalGap - panelMaxHeight)
                : Math.min(
                    desiredTop,
                    Math.max(topPadding, anchorLayout.height - bottomPadding - panelMaxHeight),
                )
        )
        : null;
    const panelStyle = anchorLayout && panelWidth && clampedLeft !== null && clampedTop !== null
        ? {
            left: `${clampedLeft}px`,
            top: `${clampedTop}px`,
            width: `${panelWidth}px`,
            maxHeight: `${panelMaxHeight}px`,
        }
        : undefined;
    const scrollAreaStyle = {
        maxHeight: `${Math.max(92, panelMaxHeight - 88)}px`,
    };

    return (
        <div
            className={`pointer-events-auto absolute z-[600] ${panelStyle ? '' : (isDesktop ? 'left-1/2 top-1/2 w-[420px] max-w-[calc(100%-3rem)] -translate-x-1/2' : 'inset-x-3 bottom-5')}`}
            style={panelStyle}
            onMouseEnter={() => onHoverPanelEnter?.(group)}
            onMouseLeave={() => onHoverPanelLeave?.(group)}
        >
            <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white/96 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">
                            <Layers3 size={14} />
                            Shared postal code
                        </div>
                        <p className="mt-1 text-base font-bold leading-tight text-slate-900">
                            {group.hardAssetCount} {group.hardAssetCount === 1 ? 'asset' : 'assets'} at the same location
                        </p>
                        {group.postalCode ? (
                            <p className="mt-1 text-sm text-slate-500">Postal code {group.postalCode}</p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        aria-label="Close grouped location list"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto overscroll-contain px-3 py-3" style={scrollAreaStyle}>
                    <div className="space-y-2">
                        {(group.memberPins || []).map((pin) => {
                            const isHighlighted = highlightedPinKey === pin.pinKey;
                            const offeringsLabel = `${pin.totalOfferingsCount || 0} ${(pin.totalOfferingsCount || 0) === 1 ? 'offering' : 'offerings'}`;
                            const previewImageUrl = pin.placeAsset?.logoUrl || pin.primarySavedAsset?.liveAsset?.logoUrl || pin.categoryIconUrl || null;

                            return (
                                <button
                                    key={pin.pinKey}
                                    type="button"
                                    onMouseEnter={() => onHoverPin?.(pin, group)}
                                    onClick={() => onSelectPin?.(pin, group)}
                                    className={`flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                                        isHighlighted
                                            ? 'border-brand-300 bg-brand-50/70 shadow-sm'
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                                        {previewImageUrl ? (
                                            <img
                                                src={previewImageUrl}
                                                alt=""
                                                className="h-7 w-7 object-contain"
                                                draggable="false"
                                            />
                                        ) : (
                                            <Heart size={18} className="fill-[#f35f68] text-[#f35f68]" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-bold leading-tight text-slate-900">
                                            {pin.title}
                                        </span>
                                        {pin.address ? (
                                            <span className="mt-1 block text-[12px] leading-5 text-slate-500">
                                                {pin.address}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="inline-flex flex-shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                                        {offeringsLabel}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DiscoverPage() {
    const [subCatColors, setSubCatColors] = useState({});
    const [subCategoryMetaByKey, setSubCategoryMetaByKey] = useState({});
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState(() => searchParams.get('q') || '');
    const [activeTab, setActiveTab] = useState('all');
    const [discoverySubregions, setDiscoverySubregions] = useState([]);
    const [selectedDiscoverySubregionId, setSelectedDiscoverySubregionId] = useState('');
    const [favoritesActionNotice, setFavoritesActionNotice] = useState('');
    const [saveAllPendingAction, setSaveAllPendingAction] = useState(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [desktopPaneMode, setDesktopPaneMode] = useState('browse');
    const [selectedPlacePinKey, setSelectedPlacePinKey] = useState(null);
    const [expandedPostalGroupKey, setExpandedPostalGroupKey] = useState(null);
    const [trackedPostalGroupLayout, setTrackedPostalGroupLayout] = useState(null);
    const [hoveredPinKeys, setHoveredPinKeys] = useState([]);
    const [hoveredPrimaryPinKey, setHoveredPrimaryPinKey] = useState(null);
    const [hoveredMapPinKey, setHoveredMapPinKey] = useState(null);
    const [hoveredPostalGroupKey, setHoveredPostalGroupKey] = useState(null);
    const [lockedPinKeys, setLockedPinKeys] = useState([]);
    const [lockedPrimaryPinKey, setLockedPrimaryPinKey] = useState(null);
    const [lockedAssetKey, setLockedAssetKey] = useState(null);
    const [transientPlacePins, setTransientPlacePins] = useState([]);
    const [transientPrimaryPinKey, setTransientPrimaryPinKey] = useState(null);
    const [transientFocusAssetKey, setTransientFocusAssetKey] = useState(null);
    const [mapFocusRequest, setMapFocusRequest] = useState(null);
    const [mobileMode, setMobileMode] = useState('browse');
    const [mobileCardDensity, setMobileCardDensity] = useState('compact');
    const [mobileBrowseDrawerOpen, setMobileBrowseDrawerOpen] = useState(false);
    const [isSearchPanelCollapsed, setIsSearchPanelCollapsed] = useState(false);

    const resultsListRef = useRef(null);
    const lastBrowseScrollTopRef = useRef(0);
    const autoCollapseScrollTopRef = useRef(0);
    const postalGroupHoverCloseTimeoutRef = useRef(null);
    const previousSearchPanelCollapsedRef = useRef(false);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const isTouchDesktop = useMediaQuery('(min-width: 1024px) and (pointer: coarse)');
    const { zoomLevel } = useA11y();
    const discoveryPaneMinWidth = useMemo(() => {
        if (!isDesktop) return DISCOVERY_DESKTOP_BASE_PANE_WIDTH;

        const normalizedZoomLevel = Math.min(
            DISCOVERY_DESKTOP_MAX_ACCESSIBLE_FONT_SCALE,
            Math.max(1, Number(zoomLevel) || 1),
        );
        const zoomProgress = (
            (normalizedZoomLevel - 1)
            / (DISCOVERY_DESKTOP_MAX_ACCESSIBLE_FONT_SCALE - 1)
        );

        return Math.round(
            DISCOVERY_DESKTOP_BASE_PANE_WIDTH
            + (
                DISCOVERY_DESKTOP_MAX_ACCESSIBLE_PANE_WIDTH
                - DISCOVERY_DESKTOP_BASE_PANE_WIDTH
            ) * zoomProgress,
        );
    }, [isDesktop, zoomLevel]);
    const discoveryPaneInitialWidth = Math.max(450, discoveryPaneMinWidth);
    const { isDragging, listWidth, maxPaneWidth, setPaneWidth, startDragging } = useSplitPaneResize(
        discoveryPaneInitialWidth,
        { minWidth: discoveryPaneMinWidth },
    );
    const { user, isAuth } = useAuth();
    const normalizedUserRole = normalizeRole(user?.role);
    const canUseDiscoverySubregions = isAuth && canAccessAdmin(normalizedUserRole);
    const {
        bulkPending: isBulkFavoritesPending,
        bulkRemoveSavedAssets,
        bulkSaveSavedAssets,
        savedAssetKeys,
        savedAssets,
        savedAssetsLoading,
    } = useSavedAssets();
    const {
        clearLocationSearch,
        effectiveOrigin,
        effectiveUserLocation,
        flyTarget,
        handleHomeAnchor,
        handleLocateMe,
        handlePostalSearch,
        hasHomePostalCode,
        isGeocoding,
        locationNotice,
        postalInput,
        searchOrigin,
        searchRadius,
        setPostalInput,
        setFlyTarget,
        setSearchRadius,
    } = useDiscoveryLocation(hardAssets, user?.postalCode);
    const listPageSize = 20;
    const [visibleCount, setVisibleCount] = useState(listPageSize);
    const hasLocationAnchor = Boolean(searchOrigin);
    const hasUserSelectedLocationFilter = Boolean(searchOrigin && searchOrigin.source !== 'home');
    const searchGroups = useMemo(() => parseDiscoverySearchGroups(search), [search]);

    // Sync state to URL
    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams);
        
        if (search.trim()) {
            nextParams.set('q', search.trim());
        } else {
            nextParams.delete('q');
        }

        const postal = searchOrigin?.source === 'postal' ? searchOrigin.postalCode : null;
        if (postal) {
            nextParams.set('postal', postal);
        } else {
            nextParams.delete('postal');
        }

        if (nextParams.toString() !== searchParams.toString()) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [search, searchOrigin, setSearchParams, searchParams]);

    useEffect(() => {
        let isActive = true;

        async function loadDirectory() {
            setLoading(true);

            try {
                const [hardData, softData, subcategories] = await Promise.all([
                    fetchAllPaginatedResults(api.getHardAssets),
                    fetchAllPaginatedResults(api.getSoftAssets),
                    withTimeout(api.getSubCategories().catch(() => []), []),
                ]);

                if (!isActive) return;

                const colors = {};
                const metaByKey = {};
                subcategories.forEach((subcategory) => {
                    colors[subcategory.name] = subcategory.color || '#94a3b8';
                    const key = normalizeSubCategoryLookupKey(subcategory.name);
                    if (key) {
                        metaByKey[key] = {
                            name: subcategory.name,
                            color: subcategory.color || '#94a3b8',
                            iconUrl: subcategory.iconUrl || null,
                            type: subcategory.type || null,
                        };
                    }
                });

                setSubCatColors(colors);
                setSubCategoryMetaByKey(metaByKey);
                setHardAssets(hardData);
                setSoftAssets(softData);
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        }

        loadDirectory();

        return () => {
            isActive = false;
        };
    }, []);

    useEffect(() => {
        let isActive = true;

        async function loadDiscoverySubregions() {
            if (!canUseDiscoverySubregions) {
                if (isActive) {
                    setDiscoverySubregions([]);
                    setSelectedDiscoverySubregionId('');
                }
                return;
            }

            try {
                const fetchedSubregions = await withTimeout(api.getSubregions().catch(() => []), []);
                if (!isActive) return;

                setDiscoverySubregions(Array.isArray(fetchedSubregions) ? fetchedSubregions : []);
            } catch (err) {
                console.error(err);
                if (isActive) {
                    setDiscoverySubregions([]);
                    setSelectedDiscoverySubregionId('');
                }
            }
        }

        loadDiscoverySubregions();

        return () => {
            isActive = false;
        };
    }, [canUseDiscoverySubregions]);

    const discoverySubregionOptions = useMemo(() => {
        if (!canUseDiscoverySubregions) return [];

        const boundedSubregions = discoverySubregions
            .filter((subregion) => Number(subregion?.postalCodeCount || 0) > 0)
            .map((subregion) => ({
                ...subregion,
                discoveryLabel: getDiscoverySubregionLabel(subregion),
                postalCodeSet: new Set(
                    (Array.isArray(subregion?.postalCodesList) ? subregion.postalCodesList : [])
                        .map((postalCode) => normalizePostalCode(postalCode))
                        .filter(Boolean)
                ),
            }));

        const singaporeWideSubregion = boundedSubregions.find((subregion) => isSingaporeWideSubregion(subregion));
        if (!singaporeWideSubregion) return [];

        const otherSubregions = boundedSubregions
            .filter((subregion) => Number(subregion.id) !== Number(singaporeWideSubregion.id))
            .sort((left, right) => left.discoveryLabel.localeCompare(right.discoveryLabel));

        return [singaporeWideSubregion, ...otherSubregions];
    }, [canUseDiscoverySubregions, discoverySubregions]);

    useEffect(() => {
        if (discoverySubregionOptions.length === 0) {
            setSelectedDiscoverySubregionId('');
            return;
        }

        const hasCurrentSelection = discoverySubregionOptions.some((subregion) => String(subregion.id) === String(selectedDiscoverySubregionId));
        if (hasCurrentSelection) return;

        setSelectedDiscoverySubregionId(String(discoverySubregionOptions[0].id));
    }, [discoverySubregionOptions, selectedDiscoverySubregionId]);

    const activeDiscoverySubregion = useMemo(() => (
        discoverySubregionOptions.find((subregion) => String(subregion.id) === String(selectedDiscoverySubregionId)) || null
    ), [discoverySubregionOptions, selectedDiscoverySubregionId]);
    const hasScopedDiscoverySubregion = Boolean(activeDiscoverySubregion && !isSingaporeWideSubregion(activeDiscoverySubregion));

    // Reset visible batch when filters change
    useEffect(() => {
        setVisibleCount(listPageSize);
    }, [activeDiscoverySubregion, activeTab, listPageSize, search, searchOrigin, searchRadius, showFavoritesOnly]);

    const clearHoveredCardState = useCallback(() => {
        setHoveredPinKeys([]);
        setHoveredPrimaryPinKey(null);
    }, []);

    const clearLockedCardState = useCallback(() => {
        setLockedAssetKey(null);
        setLockedPinKeys([]);
        setLockedPrimaryPinKey(null);
    }, []);

    const clearTransientFocusState = useCallback(() => {
        setTransientPlacePins([]);
        setTransientPrimaryPinKey(null);
        setTransientFocusAssetKey(null);
    }, []);
    const cancelPostalGroupHoverClose = useCallback(() => {
        if (postalGroupHoverCloseTimeoutRef.current !== null) {
            window.clearTimeout(postalGroupHoverCloseTimeoutRef.current);
            postalGroupHoverCloseTimeoutRef.current = null;
        }
    }, []);
    const clearDesktopPinPreview = useCallback(() => {
        if (!isDesktop || lockedPrimaryPinKey) return;
        setHoveredPinKeys([]);
        setHoveredPrimaryPinKey(null);
        setHoveredMapPinKey(null);
        setSelectedPlacePinKey(null);
        setDesktopPaneMode('browse');
    }, [isDesktop, lockedPrimaryPinKey]);

    useEffect(() => {
        if (!isDesktop) {
            setIsSearchPanelCollapsed(false);
            setDesktopPaneMode('browse');
            setSelectedPlacePinKey(null);
            setHoveredMapPinKey(null);
        }
    }, [isDesktop]);

    useEffect(() => {
        // Clear focus states when the location search changes
        clearHoveredCardState();
        clearLockedCardState();
        clearTransientFocusState();
    }, [clearHoveredCardState, clearLockedCardState, clearTransientFocusState, isDesktop, searchOrigin]);

    const isPubliclyVisible = useCallback((asset) => {
        if (asset.isHidden) return false;
        const now = new Date();
        const from = asset.hideFrom ? new Date(asset.hideFrom) : null;
        const until = asset.hideUntil ? new Date(asset.hideUntil) : null;

        if (from && until) return !(now >= from && now <= until);
        if (from) return now < from;
        if (until) return now > until;
        return true;
    }, []);

    const visibleHardAssets = useMemo(() => hardAssets.filter(isPubliclyVisible), [hardAssets, isPubliclyVisible]);
    const visibleSoftAssets = useMemo(() => softAssets.filter(isPubliclyVisible), [isPubliclyVisible, softAssets]);
    const visibleHardAssetLookup = useMemo(
        () => new Map(visibleHardAssets.map((asset) => [asset.id, asset])),
        [visibleHardAssets]
    );

    const allDiscoveryItems = useMemo(() => {
        const items = [];

        items.push(...visibleHardAssets.map((asset) => ({ ...asset, _type: 'hard' })));
        items.push(...visibleSoftAssets.map((asset) => ({ ...asset, _type: 'soft' })));

        return items.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    }, [visibleHardAssets, visibleSoftAssets]);

    const filteredUniverse = useMemo(() => {
        let items = allDiscoveryItems.map((resource, index) => {
            const displayLocation = resource._type === 'hard' ? resource : getBestLocation(resource, effectiveUserLocation);
            const lat = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lat) : null;
            const lng = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lng) : null;
            const distance = effectiveUserLocation && Number.isFinite(lat) && Number.isFinite(lng)
                ? getDistance(effectiveUserLocation.lat, effectiveUserLocation.lng, lat, lng)
                : null;
            const searchHaystack = buildDiscoverySearchHaystack(resource);
            const nameHaystack = normalizeSearchText(resource.name);

            return {
                ...resource,
                _distance: distance,
                _displayLat: lat,
                _displayLng: lng,
                _displayLocation: displayLocation,
                _locationCount: resource._type === 'soft' ? getAssetLocations(resource).length : 1,
                _baseIndex: index,
                _nameHaystack: nameHaystack,
                _searchHaystack: searchHaystack,
            };
        });

        if (activeDiscoverySubregion?.postalCodeSet?.size && !isSingaporeWideSubregion(activeDiscoverySubregion)) {
            items = items.filter((resource) => {
                if (resource._type === 'hard') {
                    return hasPostalCodeInBoundary(resource.postalCode, activeDiscoverySubregion.postalCodeSet);
                }

                return getAssetLocations(resource).some((location) => (
                    hasPostalCodeInBoundary(location?.postalCode, activeDiscoverySubregion.postalCodeSet)
                ));
            });
        }

        if (effectiveUserLocation && !hasScopedDiscoverySubregion) {
            if (searchRadius < 100) {
                items = items.filter((resource) => resource._distance !== null && resource._distance <= searchRadius);
            }
        }

        items = items.filter((resource) => {
            if (showFavoritesOnly && user) {
                const isSavedResource = savedAssetKeys.has(buildSavedAssetKey(resource._type, resource.id));
                if (!isSavedResource) return false;
            }

            if (searchGroups.length === 0) return true;

            const searchMatch = computeDiscoverySearchMatch(
                resource._searchHaystack,
                resource._nameHaystack,
                searchGroups,
            );
            if (!searchMatch.matches) return false;

            resource._matchedGroupCount = searchMatch.matchedGroupCount;
            resource._bestGroupPhraseCount = searchMatch.bestGroupPhraseCount;
            resource._matchedPhraseCount = searchMatch.matchedPhraseCount;
            resource._nameMatchCount = searchMatch.nameMatchCount;
            return true;
        });

        items.sort((left, right) => {
            if (effectiveUserLocation) {
                if (left._distance === null && right._distance === null) {
                    // Continue to search/base ordering below.
                } else if (left._distance === null) {
                    return 1;
                } else if (right._distance === null) {
                    return -1;
                } else if (left._distance !== right._distance) {
                    return left._distance - right._distance;
                }
            }

            if (searchGroups.length > 0) {
                if ((right._bestGroupPhraseCount || 0) !== (left._bestGroupPhraseCount || 0)) {
                    return (right._bestGroupPhraseCount || 0) - (left._bestGroupPhraseCount || 0);
                }

                if ((right._matchedGroupCount || 0) !== (left._matchedGroupCount || 0)) {
                    return (right._matchedGroupCount || 0) - (left._matchedGroupCount || 0);
                }

                if ((right._matchedPhraseCount || 0) !== (left._matchedPhraseCount || 0)) {
                    return (right._matchedPhraseCount || 0) - (left._matchedPhraseCount || 0);
                }

                if ((right._nameMatchCount || 0) !== (left._nameMatchCount || 0)) {
                    return (right._nameMatchCount || 0) - (left._nameMatchCount || 0);
                }
            }

            return left._baseIndex - right._baseIndex;
        });

        return items;
    }, [
        activeDiscoverySubregion,
        allDiscoveryItems,
        effectiveUserLocation,
        hasScopedDiscoverySubregion,
        savedAssetKeys,
        searchGroups,
        searchRadius,
        showFavoritesOnly,
        user,
    ]);

    const tabCounts = useMemo(() => ({
        all: filteredUniverse.length,
        hard: filteredUniverse.reduce((count, resource) => (resource._type === 'hard' ? count + 1 : count), 0),
        soft: filteredUniverse.reduce((count, resource) => (resource._type === 'soft' ? count + 1 : count), 0),
    }), [filteredUniverse]);

    const filtered = useMemo(() => {
        if (activeTab === 'all') {
            return filteredUniverse;
        }

        return filteredUniverse.filter((resource) => resource._type === activeTab);
    }, [activeTab, filteredUniverse]);

    const displayedResources = useMemo(
        () => filtered.slice(0, visibleCount),
        [filtered, visibleCount]
    );

    const saveAllTargetItems = useMemo(() => (
        filtered.map((resource) => ({
            resourceType: resource._type,
            resourceId: resource.id,
        }))
    ), [filtered]);

    const savedWithinFilteredCount = useMemo(() => (
        saveAllTargetItems.reduce((count, item) => (
            savedAssetKeys.has(buildSavedAssetKey(item.resourceType, item.resourceId)) ? count + 1 : count
        ), 0)
    ), [saveAllTargetItems, savedAssetKeys]);

    const isSaveAllChecked = saveAllTargetItems.length > 0 && savedWithinFilteredCount === saveAllTargetItems.length;
    const isSaveAllIndeterminate = savedWithinFilteredCount > 0 && savedWithinFilteredCount < saveAllTargetItems.length;
    const hasMeaningfulDiscoveryContext = useMemo(() => (
        searchGroups.length > 0 || hasScopedDiscoverySubregion
    ), [hasScopedDiscoverySubregion, searchGroups.length]);
    const canShowSaveAllControl = Boolean(user) && hasMeaningfulDiscoveryContext;

    const handleToggleSaveAll = useCallback(async (nextChecked) => {
        if (!user || saveAllTargetItems.length === 0 || isBulkFavoritesPending) return;

        setFavoritesActionNotice('');
        setSaveAllPendingAction(nextChecked ? 'save' : 'remove');

        try {
            if (nextChecked) {
                await bulkSaveSavedAssets(saveAllTargetItems);
            } else {
                await bulkRemoveSavedAssets(saveAllTargetItems);
            }
        } catch (err) {
            console.error(err);
            setFavoritesActionNotice(err.message || 'Discovery favorites could not be updated. Please try again.');
        } finally {
            setSaveAllPendingAction(null);
        }
    }, [
        bulkRemoveSavedAssets,
        bulkSaveSavedAssets,
        isBulkFavoritesPending,
        saveAllTargetItems,
        user,
    ]);

    const savedPlacePinData = useMemo(() => (
        buildSavedPlacePins(savedAssets, visibleHardAssets, visibleSoftAssets, {
            userLocation: effectiveUserLocation,
            categoryMetaByKey: subCategoryMetaByKey,
        })
    ), [effectiveUserLocation, savedAssets, subCategoryMetaByKey, visibleHardAssets, visibleSoftAssets]);

    const savedPlacePins = savedPlacePinData.pins;
    const savedPlacePinLookup = useMemo(
        () => new Map(savedPlacePins.map((pin) => [pin.pinKey, pin])),
        [savedPlacePins]
    );
    const transientPlacePinLookup = useMemo(
        () => new Map(transientPlacePins.map((pin) => [pin.pinKey, pin])),
        [transientPlacePins]
    );
    const interactivePinLookup = useMemo(
        () => new Map([...savedPlacePins, ...transientPlacePins].map((pin) => [pin.pinKey, pin])),
        [savedPlacePins, transientPlacePins]
    );
    const groupedSavedPlacePinData = useMemo(
        () => buildPostalGroupedSavedPlacePins(savedPlacePins),
        [savedPlacePins]
    );
    const postalGroups = groupedSavedPlacePinData.groups;
    const postalGroupLookup = useMemo(
        () => new Map(postalGroups.map((group) => [group.postalGroupKey, group])),
        [postalGroups]
    );
    const postalGroupKeyByPinKey = groupedSavedPlacePinData.postalGroupKeyByPinKey;
    const renderedSavedPlacePins = useMemo(
        () => buildRenderedPostalGroupedSavedPins(postalGroups, {
            expandedPostalGroupKey,
            interactionMode: isDesktop ? 'desktop' : 'mobile',
        }),
        [expandedPostalGroupKey, isDesktop, postalGroups]
    );
    const selectedPlacePin = useMemo(
        () => (selectedPlacePinKey ? interactivePinLookup.get(selectedPlacePinKey) || null : null),
        [interactivePinLookup, selectedPlacePinKey]
    );
    const activePostalGroup = useMemo(() => {
        if (!expandedPostalGroupKey) return null;
        const group = postalGroupLookup.get(expandedPostalGroupKey) || null;
        return group?.isPostalGroup ? group : null;
    }, [expandedPostalGroupKey, postalGroupLookup]);
    const hoveredPostalGroup = useMemo(() => {
        if (activePostalGroup || !hoveredPostalGroupKey) return null;
        const group = postalGroupLookup.get(hoveredPostalGroupKey) || null;
        return group?.isPostalGroup ? group : null;
    }, [activePostalGroup, hoveredPostalGroupKey, postalGroupLookup]);
    const visiblePostalGroup = activePostalGroup || hoveredPostalGroup;

    useEffect(() => {
        if (!visiblePostalGroup) {
            setTrackedPostalGroupLayout(null);
        }
    }, [visiblePostalGroup]);

    useEffect(() => {
        if (!hoveredPostalGroupKey) return;
        const activeGroup = postalGroupLookup.get(hoveredPostalGroupKey);
        if (!activeGroup?.isPostalGroup) {
            setHoveredPostalGroupKey(null);
        }
    }, [hoveredPostalGroupKey, postalGroupLookup]);

    useEffect(() => () => {
        if (postalGroupHoverCloseTimeoutRef.current !== null) {
            window.clearTimeout(postalGroupHoverCloseTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (!flyTarget) return;
        if (savedPlacePins.length) {
            setMapFocusRequest({
                kind: 'saved-fit',
                requestId: nextFocusRequestId(),
                savedPlacePins,
                anchorPoint: flyTarget,
                includeAnchorInBounds: false,
                keepAnchorVisible: true,
                source: `location-${flyTarget.source || 'set'}`,
            });
        } else {
            setMapFocusRequest({
                kind: 'single-pin',
                requestId: nextFocusRequestId(),
                lat: flyTarget.lat,
                lng: flyTarget.lng,
                zoom: flyTarget.zoom,
            });
        }
        setFlyTarget(null);
    }, [flyTarget, savedPlacePins, setFlyTarget]);

    const savedMapAssetKeys = useMemo(
        () => new Set(savedPlacePinData.contributingAssetKeys),
        [savedPlacePinData.contributingAssetKeys]
    );
    const hasSavedMapPins = savedPlacePins.length > 0;
    const savedAssetCount = savedAssets.length;
    const unmappableSavedCount = savedPlacePinData.unmappableSavedAssetKeys.size;

    const hasTransientFocusPins = transientPlacePins.length > 0;

    useEffect(() => {
        if (!isDesktop && !hasSavedMapPins && !hasTransientFocusPins && !effectiveOrigin && mobileMode === 'map') {
            setMobileMode('browse');
        }
    }, [effectiveOrigin, hasSavedMapPins, hasTransientFocusPins, isDesktop, mobileMode]);

    useEffect(() => {
        if (isDesktop || mobileMode !== 'map') {
            setMobileBrowseDrawerOpen(false);
        }
    }, [isDesktop, mobileMode]);

    useEffect(() => {
        if (!isDesktop && mobileMode !== 'map' && selectedPlacePinKey) {
            setSelectedPlacePinKey(null);
        }
    }, [isDesktop, mobileMode, selectedPlacePinKey]);

    useEffect(() => {
        if (selectedPlacePinKey && !interactivePinLookup.has(selectedPlacePinKey)) {
            setSelectedPlacePinKey(null);
            setDesktopPaneMode('browse');
            setHoveredMapPinKey(null);
        }
    }, [interactivePinLookup, selectedPlacePinKey]);

    useEffect(() => {
        if (!expandedPostalGroupKey) return;
        const activeGroup = postalGroupLookup.get(expandedPostalGroupKey);
        if (!activeGroup?.isPostalGroup) {
            setExpandedPostalGroupKey(null);
        }
    }, [expandedPostalGroupKey, postalGroupLookup]);

    useEffect(() => {
        setHoveredPinKeys((current) => current.filter((pinKey) => interactivePinLookup.has(pinKey)));
        setLockedPinKeys((current) => current.filter((pinKey) => interactivePinLookup.has(pinKey)));
        if (hoveredPrimaryPinKey && !interactivePinLookup.has(hoveredPrimaryPinKey)) {
            setHoveredPrimaryPinKey(null);
        }
        if (lockedPrimaryPinKey && !interactivePinLookup.has(lockedPrimaryPinKey)) {
            setLockedPrimaryPinKey(null);
        }
        if (hoveredMapPinKey && !interactivePinLookup.has(hoveredMapPinKey)) {
            setHoveredMapPinKey(null);
        }
    }, [hoveredMapPinKey, hoveredPrimaryPinKey, interactivePinLookup, lockedPrimaryPinKey]);

    useEffect(() => {
        if (!lockedAssetKey) return;
        const stillExists = savedMapAssetKeys.has(lockedAssetKey);
        if (!stillExists) {
            setLockedAssetKey(null);
            setLockedPinKeys([]);
            setLockedPrimaryPinKey(null);
        }
    }, [lockedAssetKey, savedMapAssetKeys]);

    useEffect(() => {
        if (!isDesktop || desktopPaneMode !== 'browse') return;

        const frameId = window.requestAnimationFrame(() => {
            if (resultsListRef.current) {
                resultsListRef.current.scrollTop = lastBrowseScrollTopRef.current;
                autoCollapseScrollTopRef.current = lastBrowseScrollTopRef.current;
            }
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [desktopPaneMode, isDesktop]);

    const resolveSavedPinForAsset = useCallback((asset) => {
        if (!asset) return null;
        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        const assetKey = buildSavedAssetKey(normalizedAsset._type, normalizedAsset.id);
        const pinKeys = savedPlacePinData.assetToPinKeys.get(assetKey);

        if (!pinKeys?.length) {
            return null;
        }

        return savedPlacePinLookup.get(pinKeys[0]) || null;
    }, [savedPlacePinData.assetToPinKeys, savedPlacePinLookup]);

    const resolveSavedPinKeysForAsset = useCallback((asset) => {
        if (!asset) return [];
        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        const assetKey = buildSavedAssetKey(normalizedAsset._type, normalizedAsset.id);
        return savedPlacePinData.assetToPinKeys.get(assetKey) || [];
    }, [savedPlacePinData.assetToPinKeys]);

    const resolvePostalGroupForPinKeys = useCallback((pinKeys = []) => {
        if (!pinKeys.length) return null;

        const relatedGroupKeys = [...new Set(
            pinKeys
                .map((pinKey) => postalGroupKeyByPinKey.get(String(pinKey)) || String(pinKey))
                .filter(Boolean)
        )];

        if (relatedGroupKeys.length !== 1) {
            return null;
        }

        const group = postalGroupLookup.get(relatedGroupKeys[0]) || null;
        return group?.isPostalGroup ? group : null;
    }, [postalGroupKeyByPinKey, postalGroupLookup]);

    const createSinglePinFocusRequest = useCallback((pin, source = 'address-click', options = {}) => ({
        kind: 'single-pin',
        requestId: nextFocusRequestId(),
        pinKey: pin.pinKey,
        lat: pin.lat,
        lng: pin.lng,
        offsetPx: options.offsetPx || null,
        zoom: SAVED_PIN_FOCUS_ZOOM,
        source,
    }), []);

    const createPostalGroupFocusRequest = useCallback((group, source = 'address-click') => {
        const lat = group?.anchorLat ?? group?.lat;
        const lng = group?.anchorLng ?? group?.lng;

        if (!group || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }

        const memberCount = Math.max(1, Number(group?.memberPins?.length || group?.hardAssetCount || 0));
        const estimatedPanelHeight = isDesktop
            ? Math.min(360, 148 + (memberCount * 68))
            : Math.min(300, 136 + (memberCount * 72));
        const offsetY = isDesktop
            ? -Math.round((estimatedPanelHeight * 0.26) + 28)
            : -Math.round((estimatedPanelHeight * 0.32) + 30);

        return {
            kind: 'single-pin',
            requestId: nextFocusRequestId(),
            pinKey: group.postalGroupKey,
            lat,
            lng,
            offsetPx: { x: 0, y: offsetY },
            zoom: SAVED_PIN_FOCUS_ZOOM,
            source,
        };
    }, [isDesktop]);

    const createPinGroupFocusRequest = useCallback((pinKeys, source = 'address-click') => {
        const points = pinKeys
            .map((pinKey) => savedPlacePinLookup.get(pinKey))
            .filter(Boolean)
            .map((pin) => [pin.lat, pin.lng]);

        if (!points.length) return null;

        return {
            kind: 'pin-group',
            requestId: nextFocusRequestId(),
            pinKeys,
            points,
            maxZoom: SAVED_PIN_FOCUS_ZOOM,
            source,
        };
    }, [savedPlacePinLookup]);

    const createPointGroupFocusRequest = useCallback((pins, source = 'address-click') => {
        const points = pins
            .filter(Boolean)
            .map((pin) => [pin.lat, pin.lng]);

        if (!points.length) return null;

        return {
            kind: 'pin-group',
            requestId: nextFocusRequestId(),
            pinKeys: pins.map((pin) => pin.pinKey),
            points,
            maxZoom: SAVED_PIN_FOCUS_ZOOM,
            source,
        };
    }, []);

    const createSavedFitFocusRequest = useCallback((source = 'detail-close') => ({
        kind: 'saved-fit',
        requestId: nextFocusRequestId(),
        anchorPoint: effectiveOrigin,
        includeAnchorInBounds: false,
        keepAnchorVisible: false,
        savedPlacePins,
        source,
    }), [effectiveOrigin, savedPlacePins]);

    const saveBrowseScrollPosition = useCallback(() => {
        if (resultsListRef.current) {
            lastBrowseScrollTopRef.current = resultsListRef.current.scrollTop;
        }
    }, []);

    useEffect(() => {
        if (!transientFocusAssetKey) return;
        if (savedMapAssetKeys.has(transientFocusAssetKey)) {
            clearTransientFocusState();
        }
    }, [clearTransientFocusState, savedMapAssetKeys, transientFocusAssetKey]);

    const buildTransientPlacePinsForAsset = useCallback((asset) => {
        if (!asset) {
            return { assetKey: null, pins: [], primaryPinKey: null };
        }

        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        const assetKey = buildSavedAssetKey(normalizedAsset._type, normalizedAsset.id);

        if (normalizedAsset._type === 'hard') {
            if (!hasValidCoordinates(normalizedAsset)) {
                return { assetKey, pins: [], primaryPinKey: null };
            }

            const pinKey = `transient-${assetKey}`;
            const transientCategoryIconUrl = subCategoryMetaByKey[normalizeSubCategoryLookupKey(normalizedAsset.subCategory)]?.iconUrl || null;
            return {
                assetKey,
                primaryPinKey: pinKey,
                pins: [
                    {
                        pinKey,
                        placeKey: resolveSavedPlaceKey({
                            hardAssetId: normalizedAsset.id,
                            lat: normalizedAsset.lat,
                            lng: normalizedAsset.lng,
                        }) || pinKey,
                        title: normalizedAsset.name,
                        address: normalizedAsset.address || null,
                        lat: Number.parseFloat(normalizedAsset.lat),
                        lng: Number.parseFloat(normalizedAsset.lng),
                        postalCode: normalizedAsset.postalCode || '',
                        placeAsset: normalizedAsset,
                        totalOfferingsCount: Array.isArray(normalizedAsset.softAssets) ? normalizedAsset.softAssets.length : 0,
                        detailTargetType: 'hard',
                        detailTargetId: normalizedAsset.id,
                        detailTargetFallbackAsset: normalizedAsset,
                        sourceAssetKey: assetKey,
                        sourceAssetType: 'hard',
                        sourceAssetId: normalizedAsset.id,
                        categoryIconUrl: transientCategoryIconUrl,
                        tone: 'preview',
                        isTransient: true,
                    },
                ],
            };
        }

        const orderedLocations = [...getAssetLocations(normalizedAsset)]
            .filter(hasValidCoordinates)
            .sort((left, right) => {
                if (!effectiveUserLocation) return 0;
                const leftDistance = getDistance(
                    effectiveUserLocation.lat,
                    effectiveUserLocation.lng,
                    Number.parseFloat(left.lat),
                    Number.parseFloat(left.lng),
                );
                const rightDistance = getDistance(
                    effectiveUserLocation.lat,
                    effectiveUserLocation.lng,
                    Number.parseFloat(right.lat),
                    Number.parseFloat(right.lng),
                );
                return leftDistance - rightDistance;
            });

        if (!orderedLocations.length) {
            return { assetKey, pins: [], primaryPinKey: null };
        }

        const transientCategoryIconUrl = subCategoryMetaByKey[normalizeSubCategoryLookupKey(normalizedAsset.subCategory)]?.iconUrl || null;
        const pins = orderedLocations.map((location, index) => {
            const placeAsset = Number.isInteger(location?.id)
                ? visibleHardAssetLookup.get(location.id) || location
                : location;
            const resolvedPlaceKey = resolveSavedPlaceKey({
                hardAssetId: Number.isInteger(placeAsset?.id) ? placeAsset.id : null,
                locationId: Number.isInteger(location?.id) ? location.id : null,
                lat: location.lat,
                lng: location.lng,
            }) || `${assetKey}-${index}`;

            return {
                pinKey: `transient-${assetKey}-${resolvedPlaceKey}`,
                placeKey: resolvedPlaceKey,
                title: placeAsset?.name || location.name || normalizedAsset.name,
                address: placeAsset?.address || location.address || normalizedAsset.address || null,
                lat: Number.parseFloat(location.lat),
                lng: Number.parseFloat(location.lng),
                postalCode: placeAsset?.postalCode || location?.postalCode || '',
                placeAsset: Number.isInteger(placeAsset?.id) ? placeAsset : null,
                locationId: Number.isInteger(location?.id) ? location.id : null,
                totalOfferingsCount: Array.isArray(placeAsset?.softAssets) ? placeAsset.softAssets.length : 0,
                detailTargetType: 'soft',
                detailTargetId: normalizedAsset.id,
                detailTargetFallbackAsset: normalizedAsset,
                sourceAssetKey: assetKey,
                sourceAssetType: 'soft',
                sourceAssetId: normalizedAsset.id,
                categoryIconUrl: transientCategoryIconUrl,
                tone: 'preview',
                isTransient: true,
            };
        });

        return {
            assetKey,
            pins,
            primaryPinKey: pins[0]?.pinKey || null,
        };
    }, [effectiveUserLocation, subCategoryMetaByKey, visibleHardAssetLookup]);

    const handleHoverAssetOnMap = useCallback((asset) => {
        const pinKeys = resolveSavedPinKeysForAsset(asset);
        if (!pinKeys.length) return;

        const primaryPin = resolveSavedPinForAsset(asset);
        setHoveredPinKeys(pinKeys);
        setHoveredPrimaryPinKey(primaryPin?.pinKey || pinKeys[0] || null);
    }, [resolveSavedPinForAsset, resolveSavedPinKeysForAsset]);

    const handleClearHoveredAssetOnMap = useCallback(() => {
        clearHoveredCardState();
    }, [clearHoveredCardState]);

    const handleLockAssetOnMap = useCallback((asset) => {
        const pinKeys = resolveSavedPinKeysForAsset(asset);
        if (!pinKeys.length) return;

        const primaryPin = resolveSavedPinForAsset(asset);
        clearHoveredCardState();
        clearTransientFocusState();
        setHoveredMapPinKey(null);
        setDesktopPaneMode('browse');
        setSelectedPlacePinKey(null);
        setLockedAssetKey(buildSavedAssetKey(asset._type, asset.id));
        setLockedPinKeys(pinKeys);
        setLockedPrimaryPinKey(primaryPin?.pinKey || pinKeys[0] || null);
    }, [clearHoveredCardState, clearTransientFocusState, resolveSavedPinForAsset, resolveSavedPinKeysForAsset]);

    const handleFocusAssetOnMap = useCallback((asset) => {
        const assetKey = buildSavedAssetKey(asset._type, asset.id);

        if (
            isDesktop
            && desktopPaneMode === 'browse'
            && lockedAssetKey === assetKey
            && !hoveredMapPinKey
            && !transientFocusAssetKey
        ) {
            return;
        }

        const pinKeys = resolveSavedPinKeysForAsset(asset);

        if (!isDesktop) {
            setMobileMode('map');
            setMobileBrowseDrawerOpen(false);
        }

        clearHoveredCardState();
        setHoveredMapPinKey(null);
        setDesktopPaneMode('browse');
        setSelectedPlacePinKey(null);
        if (pinKeys.length) {
            const primaryPin = resolveSavedPinForAsset(asset);
            if (!primaryPin) return;
            const postalGroup = resolvePostalGroupForPinKeys(pinKeys);

            clearTransientFocusState();
            setLockedAssetKey(assetKey);
            setLockedPinKeys(pinKeys);
            setLockedPrimaryPinKey(primaryPin.pinKey);
            setExpandedPostalGroupKey(postalGroup?.postalGroupKey || null);

            if (postalGroup) {
                const groupFocus = createPostalGroupFocusRequest(postalGroup, 'address-click');
                if (groupFocus) {
                    setMapFocusRequest(groupFocus);
                }
                return;
            }

            if (pinKeys.length === 1) {
                setMapFocusRequest(createSinglePinFocusRequest(primaryPin, 'address-click'));
                return;
            }

            const groupFocus = createPinGroupFocusRequest(pinKeys, 'address-click');
            if (groupFocus) {
                setMapFocusRequest(groupFocus);
            }
            return;
        }

        const { assetKey: transientAssetKey, pins, primaryPinKey } = buildTransientPlacePinsForAsset(asset);
        if (!pins.length) return;

        setExpandedPostalGroupKey(null);
        clearLockedCardState();
        setTransientFocusAssetKey(transientAssetKey);
        setTransientPlacePins(pins);
        setTransientPrimaryPinKey(primaryPinKey);

        if (pins.length === 1) {
            setMapFocusRequest(createSinglePinFocusRequest(pins[0], 'address-click'));
            return;
        }

        const groupFocus = createPointGroupFocusRequest(pins, 'address-click');
        if (groupFocus) {
            setMapFocusRequest(groupFocus);
        }
    }, [
        buildTransientPlacePinsForAsset,
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        createPointGroupFocusRequest,
        createPostalGroupFocusRequest,
        createPinGroupFocusRequest,
        createSinglePinFocusRequest,
        desktopPaneMode,
        isDesktop,
        lockedAssetKey,
        hoveredMapPinKey,
        resolveSavedPinForAsset,
        resolveSavedPinKeysForAsset,
        resolvePostalGroupForPinKeys,
        transientFocusAssetKey,
    ]);

    const handleMapPinSelect = useCallback((pin) => {
        if (pin.kind === 'postal-group') {
            const nextGroupKey = pin.postalGroupKey || pin.pinKey;
            if (expandedPostalGroupKey === nextGroupKey) {
                setExpandedPostalGroupKey(null);
                return;
            }
            clearHoveredCardState();
            clearLockedCardState();
            clearTransientFocusState();
            setHoveredMapPinKey(null);
            setHoveredPostalGroupKey(null);
            setSelectedPlacePinKey(null);
            setDesktopPaneMode('browse');
            setExpandedPostalGroupKey(nextGroupKey);
            const groupFocus = createPostalGroupFocusRequest(pin, 'group-pin-click');
            if (groupFocus) {
                setMapFocusRequest(groupFocus);
            }
            return;
        }

        const isTransientPin = Boolean(pin?.isTransient || pin?.tone === 'preview' || pin?.tone === 'temporary');
        clearHoveredCardState();
        if (!isTransientPin) {
            clearTransientFocusState();
        } else {
            setTransientPrimaryPinKey(pin.pinKey);
        }
        setHoveredMapPinKey(pin.pinKey);
        setHoveredPostalGroupKey(null);
        setSelectedPlacePinKey(pin.pinKey);
        setExpandedPostalGroupKey(pin.postalGroupKey || null);

        if (isDesktop) {
            if (desktopPaneMode !== 'detail') {
                saveBrowseScrollPosition();
            }
            setDesktopPaneMode('detail');
            setLockedAssetKey(pin.primarySavedAsset?.assetKey || null);
            setLockedPinKeys([pin.pinKey]);
            setLockedPrimaryPinKey(pin.pinKey);
            setMapFocusRequest(createSinglePinFocusRequest(pin, 'pin-click'));
            return;
        }

        clearLockedCardState();
        setMobileBrowseDrawerOpen(false);
        setMapFocusRequest(createSinglePinFocusRequest(pin, 'pin-click'));
    }, [
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        createPostalGroupFocusRequest,
        createSinglePinFocusRequest,
        desktopPaneMode,
        expandedPostalGroupKey,
        isDesktop,
        saveBrowseScrollPosition,
    ]);

    const handlePostalGroupMemberSelect = useCallback((pin, group = null) => {
        cancelPostalGroupHoverClose();

        if (!isDesktop) {
            setHoveredPostalGroupKey(null);
            setExpandedPostalGroupKey(null);
            handleMapPinSelect(pin);
            return;
        }

        const groupKey = group?.postalGroupKey || pin?.postalGroupKey || postalGroupKeyByPinKey.get(pin?.pinKey) || null;
        const activeGroup = groupKey ? (postalGroupLookup.get(groupKey) || null) : null;

        clearHoveredCardState();
        clearTransientFocusState();
        setHoveredPostalGroupKey(null);
        setHoveredMapPinKey(pin.pinKey);
        setSelectedPlacePinKey(pin.pinKey);
        setExpandedPostalGroupKey(groupKey);

        if (desktopPaneMode !== 'detail') {
            saveBrowseScrollPosition();
        }
        setDesktopPaneMode('detail');
        setLockedAssetKey(pin.primarySavedAsset?.assetKey || null);
        setLockedPinKeys([pin.pinKey]);
        setLockedPrimaryPinKey(pin.pinKey);

        const groupFocus = activeGroup?.isPostalGroup
            ? createPostalGroupFocusRequest(activeGroup, 'group-member-click')
            : null;

        if (groupFocus) {
            setMapFocusRequest(groupFocus);
            return;
        }

        handleMapPinSelect(pin);
    }, [
        cancelPostalGroupHoverClose,
        clearHoveredCardState,
        clearTransientFocusState,
        createPostalGroupFocusRequest,
        desktopPaneMode,
        handleMapPinSelect,
        isDesktop,
        postalGroupKeyByPinKey,
        postalGroupLookup,
        saveBrowseScrollPosition,
    ]);

    const handlePostalGroupPreviewStart = useCallback((pin, group = null) => {
        if (!isDesktop || !pin || lockedPrimaryPinKey) return;

        cancelPostalGroupHoverClose();
        if (desktopPaneMode !== 'detail') {
            saveBrowseScrollPosition();
        }

        const groupKey = group?.postalGroupKey || pin.postalGroupKey || postalGroupKeyByPinKey.get(pin.pinKey) || null;
        if (groupKey) {
            setHoveredPostalGroupKey(groupKey);
        }

        setHoveredPinKeys([pin.pinKey]);
        setHoveredPrimaryPinKey(pin.pinKey);
        setHoveredMapPinKey(pin.pinKey);
        setSelectedPlacePinKey(pin.pinKey);
        setDesktopPaneMode('detail');
    }, [
        cancelPostalGroupHoverClose,
        desktopPaneMode,
        isDesktop,
        lockedPrimaryPinKey,
        postalGroupKeyByPinKey,
        saveBrowseScrollPosition,
    ]);

    const schedulePostalGroupHoverClose = useCallback((groupKey, options = {}) => {
        if (!isDesktop || expandedPostalGroupKey || !groupKey) {
            if (options.clearPreview) {
                clearDesktopPinPreview();
            }
            return;
        }

        cancelPostalGroupHoverClose();
        postalGroupHoverCloseTimeoutRef.current = window.setTimeout(() => {
            setHoveredPostalGroupKey((current) => (current === groupKey ? null : current));
            if (options.clearPreview) {
                clearDesktopPinPreview();
            }
            postalGroupHoverCloseTimeoutRef.current = null;
        }, 120);
    }, [
        cancelPostalGroupHoverClose,
        clearDesktopPinPreview,
        expandedPostalGroupKey,
        isDesktop,
    ]);

    const handlePostalGroupPanelHoverEnter = useCallback((group) => {
        if (!isDesktop || !group?.postalGroupKey) return;
        cancelPostalGroupHoverClose();
        if (!expandedPostalGroupKey) {
            setHoveredPostalGroupKey(group.postalGroupKey);
        }
    }, [cancelPostalGroupHoverClose, expandedPostalGroupKey, isDesktop]);

    const handlePostalGroupPanelHoverLeave = useCallback((group) => {
        if (!group?.postalGroupKey) return;
        if (expandedPostalGroupKey) {
            clearDesktopPinPreview();
            return;
        }
        schedulePostalGroupHoverClose(group.postalGroupKey, { clearPreview: true });
    }, [clearDesktopPinPreview, expandedPostalGroupKey, schedulePostalGroupHoverClose]);

    const handleCloseDetailMode = useCallback(() => {
        clearHoveredCardState();
        setDesktopPaneMode('browse');
        setSelectedPlacePinKey(null);
        setHoveredMapPinKey(null);
        clearLockedCardState();
        clearTransientFocusState();
    }, [clearHoveredCardState, clearLockedCardState, clearTransientFocusState]);

    const handleCloseMobileDetail = useCallback(() => {
        setSelectedPlacePinKey(null);
        setHoveredMapPinKey(null);
        if (selectedPlacePinKey && transientPlacePinLookup.has(selectedPlacePinKey)) {
            clearTransientFocusState();
            return;
        }
        if (savedPlacePins.length) {
            setMapFocusRequest(createSavedFitFocusRequest('detail-close'));
        }
    }, [clearTransientFocusState, createSavedFitFocusRequest, savedPlacePins.length, selectedPlacePinKey, transientPlacePinLookup]);

    const handleMapBackgroundClick = useCallback(() => {
        if (desktopPaneMode === 'detail') {
            handleCloseDetailMode();
            return;
        }

        clearHoveredCardState();
        clearLockedCardState();
        clearTransientFocusState();
        setHoveredMapPinKey(null);
        setHoveredPostalGroupKey(null);
        setExpandedPostalGroupKey(null);
    }, [clearHoveredCardState, clearLockedCardState, clearTransientFocusState, desktopPaneMode, handleCloseDetailMode]);

    const handleMobileMapBackgroundClick = useCallback(() => {
        if (selectedPlacePinKey) {
            handleCloseMobileDetail();
            return;
        }

        clearHoveredCardState();
        clearLockedCardState();
        clearTransientFocusState();
        setHoveredMapPinKey(null);
        setHoveredPostalGroupKey(null);
        setExpandedPostalGroupKey(null);
    }, [
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        handleCloseMobileDetail,
        selectedPlacePinKey,
    ]);

    const handleResetDiscoveryMapView = useCallback(() => {
        cancelPostalGroupHoverClose();
        clearHoveredCardState();
        clearLockedCardState();
        clearTransientFocusState();
        setHoveredMapPinKey(null);
        setHoveredPostalGroupKey(null);
        setSelectedPlacePinKey(null);
        setExpandedPostalGroupKey(null);
        setDesktopPaneMode('browse');

        if (savedPlacePins.length || effectiveOrigin) {
            setMapFocusRequest(createSavedFitFocusRequest('manual-reset'));
        }
    }, [
        cancelPostalGroupHoverClose,
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        createSavedFitFocusRequest,
        effectiveOrigin,
        savedPlacePins.length,
    ]);

    const handleMapHoverStart = useCallback((pinKey, meta = null) => {
        if (meta?.kind === 'postal-group') {
            if (!isDesktop || expandedPostalGroupKey || lockedPrimaryPinKey) return;
            cancelPostalGroupHoverClose();
            setHoveredPostalGroupKey(pinKey);
            return;
        }
        if (!isDesktop || lockedPrimaryPinKey) return;
        if (desktopPaneMode !== 'detail') {
            saveBrowseScrollPosition();
        }
        cancelPostalGroupHoverClose();
        setHoveredPostalGroupKey(null);
        setHoveredMapPinKey(pinKey);
        setSelectedPlacePinKey(pinKey);
        setDesktopPaneMode('detail');
    }, [
        cancelPostalGroupHoverClose,
        desktopPaneMode,
        expandedPostalGroupKey,
        isDesktop,
        lockedPrimaryPinKey,
        saveBrowseScrollPosition,
    ]);

    const handleMapHoverEnd = useCallback((pinKey, meta = null) => {
        if (meta?.kind === 'postal-group') {
            schedulePostalGroupHoverClose(pinKey, { clearPreview: true });
            return;
        }
        if (lockedPrimaryPinKey) return;
        setHoveredMapPinKey((current) => (current === pinKey ? null : current));
        setSelectedPlacePinKey((current) => (current === pinKey ? null : current));
        setDesktopPaneMode((current) => (current === 'detail' ? 'browse' : current));
    }, [lockedPrimaryPinKey, schedulePostalGroupHoverClose]);

    const activeRelatedPinKeys = hoveredPinKeys.length ? hoveredPinKeys : lockedPinKeys;
    const activePrimaryPinKey = hoveredPrimaryPinKey || lockedPrimaryPinKey;

    const childPinEmphasisByKey = useMemo(() => {
        const nextMap = new Map();
        const relatedPinKeySet = new Set(activeRelatedPinKeys);
        const useUniformGroupEmphasis = relatedPinKeySet.size > 1 && !selectedPlacePinKey && !hoveredMapPinKey;

        savedPlacePins.forEach((pin) => {
            let emphasis = 'default';

            if (useUniformGroupEmphasis && relatedPinKeySet.has(pin.pinKey)) {
                emphasis = 'primary';
            } else if (selectedPlacePinKey === pin.pinKey || (!selectedPlacePinKey && hoveredMapPinKey === pin.pinKey)) {
                emphasis = 'primary';
            } else if (activePrimaryPinKey === pin.pinKey) {
                emphasis = 'primary';
            } else if (relatedPinKeySet.has(pin.pinKey)) {
                emphasis = 'related';
            }

            nextMap.set(pin.pinKey, emphasis);
        });

        transientPlacePins.forEach((pin) => {
            let emphasis = 'default';

            if (selectedPlacePinKey === pin.pinKey || (!selectedPlacePinKey && hoveredMapPinKey === pin.pinKey)) {
                emphasis = 'primary';
            } else if (activePrimaryPinKey === pin.pinKey || transientPrimaryPinKey === pin.pinKey) {
                emphasis = 'primary';
            }

            nextMap.set(pin.pinKey, emphasis);
        });

        return nextMap;
    }, [
        activePrimaryPinKey,
        activeRelatedPinKeys,
        hoveredMapPinKey,
        savedPlacePins,
        selectedPlacePinKey,
        transientPlacePins,
        transientPrimaryPinKey,
    ]);

    const pinEmphasisByKey = useMemo(() => {
        const nextMap = new Map();

        renderedSavedPlacePins.forEach((pin) => {
            if (pin.kind === 'postal-group') {
                if (activePostalGroup?.postalGroupKey === pin.pinKey) {
                    nextMap.set(pin.pinKey, 'primary');
                    return;
                }
                if (hoveredPostalGroupKey === pin.pinKey && !activePostalGroup) {
                    nextMap.set(pin.pinKey, 'primary');
                    return;
                }
                const groupEmphasis = (pin.memberPins || []).reduce((current, memberPin) => {
                    const memberEmphasis = childPinEmphasisByKey.get(memberPin.pinKey) || 'default';
                    if (memberEmphasis === 'primary') return 'primary';
                    if (memberEmphasis === 'related' && current !== 'primary') return 'related';
                    return current;
                }, 'default');
                nextMap.set(pin.pinKey, groupEmphasis);
                return;
            }

            nextMap.set(pin.pinKey, childPinEmphasisByKey.get(pin.pinKey) || 'default');
        });

        transientPlacePins.forEach((pin) => {
            nextMap.set(pin.pinKey, childPinEmphasisByKey.get(pin.pinKey) || 'default');
        });

        return nextMap;
    }, [activePostalGroup, childPinEmphasisByKey, hoveredPostalGroupKey, renderedSavedPlacePins, transientPlacePins]);

    const selectedBrowseAssetKey = desktopPaneMode === 'browse' ? lockedAssetKey : null;
    const touchDesktopPanePresetWidths = useMemo(() => (
        TOUCH_DESKTOP_PANE_PRESET_WIDTHS
            .filter((width, index) => index === 0 || maxPaneWidth >= width)
            .map((width) => Math.round(Math.max(discoveryPaneMinWidth, Math.min(width, maxPaneWidth))))
    ), [discoveryPaneMinWidth, maxPaneWidth]);
    const activeTouchDesktopPanePresetIndex = useMemo(() => {
        if (!touchDesktopPanePresetWidths.length) return 0;

        return touchDesktopPanePresetWidths.reduce((bestIndex, width, index, widths) => (
            Math.abs(width - listWidth) < Math.abs(widths[bestIndex] - listWidth) ? index : bestIndex
        ), 0);
    }, [listWidth, touchDesktopPanePresetWidths]);
    const canExpandTouchDesktopPane = activeTouchDesktopPanePresetIndex < touchDesktopPanePresetWidths.length - 1;
    const canCollapseTouchDesktopPane = activeTouchDesktopPanePresetIndex > 0;
    const showTouchDesktopPaneToggle = (
        isTouchDesktop
        && desktopPaneMode === 'browse'
        && touchDesktopPanePresetWidths.length > 1
    );

    const handleTouchDesktopPaneToggle = useCallback(() => {
        if (!showTouchDesktopPaneToggle) return;

        const nextIndex = canExpandTouchDesktopPane
            ? activeTouchDesktopPanePresetIndex + 1
            : (canCollapseTouchDesktopPane ? activeTouchDesktopPanePresetIndex - 1 : activeTouchDesktopPanePresetIndex);

        if (nextIndex === activeTouchDesktopPanePresetIndex) return;

        setPaneWidth(touchDesktopPanePresetWidths[nextIndex]);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
            });
        });
    }, [
        activeTouchDesktopPanePresetIndex,
        canCollapseTouchDesktopPane,
        canExpandTouchDesktopPane,
        setPaneWidth,
        showTouchDesktopPaneToggle,
        touchDesktopPanePresetWidths,
    ]);

    const handleApplySearch = useCallback(async (event) => {
        if (postalInput.trim()) {
            await handlePostalSearch(event);
            return;
        }

        event.preventDefault();
    }, [handlePostalSearch, postalInput]);

    const handleSearchChange = useCallback((value) => {
        setFavoritesActionNotice('');
        setSearch(value);
    }, []);

    const handleCollapseSearchPanel = useCallback(() => {
        if (resultsListRef.current) {
            autoCollapseScrollTopRef.current = resultsListRef.current.scrollTop;
        }
        setIsSearchPanelCollapsed(true);
    }, []);

    const handleExpandSearchPanel = useCallback(() => {
        if (resultsListRef.current) {
            autoCollapseScrollTopRef.current = resultsListRef.current.scrollTop;
        }
        setIsSearchPanelCollapsed(false);
    }, []);

    const handleResultsListScroll = useCallback((event) => {
        const nextScrollTop = event.currentTarget.scrollTop;
        const previousScrollTop = autoCollapseScrollTopRef.current;
        autoCollapseScrollTopRef.current = nextScrollTop;

        if (!isDesktop || desktopPaneMode !== 'browse' || isSearchPanelCollapsed) {
            return;
        }

        const scrolledDown = nextScrollTop - previousScrollTop >= DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_DELTA;
        if (nextScrollTop >= DISCOVERY_SEARCH_AUTO_COLLAPSE_SCROLL_TOP && scrolledDown) {
            setIsSearchPanelCollapsed(true);
        }
    }, [desktopPaneMode, isDesktop, isSearchPanelCollapsed]);

    const handleHomeAnchorAndCollapse = useCallback(async () => {
        await handleHomeAnchor();
    }, [handleHomeAnchor]);

    const handleLocateMeAndCollapse = useCallback(() => {
        handleLocateMe();
    }, [handleLocateMe]);

    const handleDesktopRailDragStart = useCallback((event) => {
        startDragging(event);
    }, [startDragging]);

    const handleClearLocationSearch = useCallback(() => {
        clearLocationSearch();
        if (
            isDesktop
            && searchGroups.length === 0
            && activeTab === 'all'
            && !(showFavoritesOnly && user)
            && !hasScopedDiscoverySubregion
        ) {
            setIsSearchPanelCollapsed(false);
        }
    }, [activeTab, clearLocationSearch, hasScopedDiscoverySubregion, isDesktop, searchGroups.length, showFavoritesOnly, user]);

    useEffect(() => {
        const previousCollapsed = previousSearchPanelCollapsedRef.current;
        previousSearchPanelCollapsedRef.current = isSearchPanelCollapsed;

        if (previousCollapsed === isSearchPanelCollapsed) {
            return undefined;
        }

        if (!isDesktop || (!savedPlacePins.length && !effectiveOrigin)) {
            return undefined;
        }

        let frameOneId = null;
        let frameTwoId = null;

        frameOneId = window.requestAnimationFrame(() => {
            frameTwoId = window.requestAnimationFrame(() => {
                setMapFocusRequest(createSavedFitFocusRequest(
                    isSearchPanelCollapsed ? 'panel-collapse' : 'panel-expand'
                ));
            });
        });

        return () => {
            if (frameOneId !== null) {
                window.cancelAnimationFrame(frameOneId);
            }
            if (frameTwoId !== null) {
                window.cancelAnimationFrame(frameTwoId);
            }
        };
    }, [createSavedFitFocusRequest, effectiveOrigin, isDesktop, isSearchPanelCollapsed, savedPlacePins.length]);

    const savedMapEmptyState = (
        <SavedMapEmptyState
            encourageHomePostalCode={Boolean(isAuth && !user?.postalCode && !effectiveOrigin)}
            hasSavedAssets={savedAssetCount > 0}
            isAuthenticated={isAuth}
            onBrowse={!isDesktop ? () => setMobileMode('browse') : undefined}
            unmappableCount={unmappableSavedCount}
        />
    );

    const hasRenderableMapPins = hasSavedMapPins || hasTransientFocusPins || Boolean(effectiveOrigin);

    const mapView = hasRenderableMapPins ? (
        <div className="relative h-full w-full">
            <DiscoveryMap
                cameraAnchor={effectiveOrigin}
                focusRequest={mapFocusRequest}
                interactionMode={isDesktop ? 'desktop' : 'mobile'}
                layoutSignature={isDesktop ? (isSearchPanelCollapsed ? 'desktop-collapsed' : 'desktop-expanded') : `mobile-${mobileMode}`}
                onBackgroundClick={isDesktop ? handleMapBackgroundClick : handleMobileMapBackgroundClick}
                onMapHoverEnd={handleMapHoverEnd}
                onMapHoverStart={handleMapHoverStart}
                onResetView={handleResetDiscoveryMapView}
                onTrackedPinLayoutChange={setTrackedPostalGroupLayout}
                onSelectGroupPin={handleMapPinSelect}
                onSelectPin={handleMapPinSelect}
                pinEmphasisByKey={pinEmphasisByKey}
                renderedSavedPlacePins={renderedSavedPlacePins}
                savedPlacePins={savedPlacePins}
                trackedPinKey={visiblePostalGroup?.postalGroupKey || null}
                transientPlacePins={transientPlacePins}
                userLocation={effectiveUserLocation}
            />
            {visiblePostalGroup ? (
                <DiscoverPostalGroupListPanel
                    anchorLayout={trackedPostalGroupLayout?.pinKey === visiblePostalGroup.postalGroupKey ? trackedPostalGroupLayout : null}
                    group={visiblePostalGroup}
                    highlightedPinKey={lockedPrimaryPinKey || hoveredPrimaryPinKey || hoveredMapPinKey || selectedPlacePinKey || null}
                    hoverPreview={!activePostalGroup}
                    isDesktop={isDesktop}
                    onClose={() => {
                        cancelPostalGroupHoverClose();
                        clearDesktopPinPreview();
                        setHoveredPostalGroupKey(null);
                        setExpandedPostalGroupKey(null);
                    }}
                    onHoverPanelEnter={handlePostalGroupPanelHoverEnter}
                    onHoverPanelLeave={handlePostalGroupPanelHoverLeave}
                    onHoverPin={handlePostalGroupPreviewStart}
                    onSelectPin={handlePostalGroupMemberSelect}
                />
            ) : null}
        </div>
    ) : (savedAssetsLoading && isAuth) ? (
        <div className="flex h-full items-center justify-center p-6">
            <div className="card flex flex-col items-center gap-4 p-8" style={{ border: '2px solid var(--color-border)' }}>
                <div className="h-10 w-10 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    Loading your map…
                </p>
            </div>
        </div>
    ) : savedMapEmptyState;

    const filterPanel = (
        <DiscoveryFilterPanel
            activeTab={activeTab}
            activeSubregionLabel={activeDiscoverySubregion?.discoveryLabel || ''}
            canShowSaveAll={canShowSaveAllControl}
            canUseSubregionScope={discoverySubregionOptions.length > 0}
            canClearLocationSearch={hasUserSelectedLocationFilter}
            clearLocationSearch={handleClearLocationSearch}
            discoverySubregionOptions={discoverySubregionOptions}
            distanceOverridden={hasScopedDiscoverySubregion}
            favoritesActionNotice={favoritesActionNotice}
            handleHomeAnchor={handleHomeAnchorAndCollapse}
            handleLocateMe={handleLocateMeAndCollapse}
            handlePostalSearch={handlePostalSearch}
            hasHomePostalCode={hasHomePostalCode}
            isCollapsed={isSearchPanelCollapsed}
            isGeocoding={isGeocoding}
            isSaveAllChecked={isSaveAllChecked}
            isSaveAllIndeterminate={isSaveAllIndeterminate}
            isSaveAllPending={Boolean(saveAllPendingAction) || isBulkFavoritesPending}
            locationNotice={locationNotice}
            mobileMode={mobileMode}
            mobileCardDensity={mobileCardDensity}
            onApplySearch={handleApplySearch}
            onChangeMobileCardDensity={setMobileCardDensity}
            onCollapse={handleCollapseSearchPanel}
            onExpand={handleExpandSearchPanel}
            onOpenBrowse={() => setMobileMode('browse')}
            onOpenMap={() => setMobileMode('map')}
            onOpenMobileBrowseDrawer={() => setMobileBrowseDrawerOpen(true)}
            onSearchChange={handleSearchChange}
            onToggleSaveAll={handleToggleSaveAll}
            pinCount={savedPlacePins.length}
            postalInput={postalInput}
            resultCount={filtered.length}
            savedAssetCount={savedAssetCount}
            saveAllCount={saveAllTargetItems.length}
            saveAllPendingLabel={saveAllPendingAction === 'remove' ? 'Clearing saved…' : 'Saving all…'}
            search={search}
            searchOrigin={searchOrigin}
            searchRadius={searchRadius}
            selectedDiscoverySubregionId={selectedDiscoverySubregionId}
            setActiveTab={setActiveTab}
            setPostalInput={setPostalInput}
            setSelectedDiscoverySubregion={setSelectedDiscoverySubregionId}
            setSearchRadius={setSearchRadius}
            setShowFavoritesOnly={setShowFavoritesOnly}
            showFavoritesOnly={showFavoritesOnly}
            tabCounts={tabCounts}
            unmappableSavedCount={unmappableSavedCount}
            user={user}
            userLocation={effectiveUserLocation}
        />
    );

    const resultsList = (
        <DiscoveryResultsList
            filtered={displayedResources}
            totalCount={filtered.length}
            pageSize={listPageSize}
            onLoadMore={() => setVisibleCount((current) => current + listPageSize)}
            isDesktop={isDesktop}
            loading={loading}
            mobileCardDensity={mobileCardDensity}
            onCardHoverEnd={handleClearHoveredAssetOnMap}
            onCardHoverStart={handleHoverAssetOnMap}
            onCardLockOnMap={handleLockAssetOnMap}
            onCategoryClick={handleSearchChange}
            onFocusAssetOnMap={handleFocusAssetOnMap}
            onResultsScroll={handleResultsListScroll}
            onTagClick={handleSearchChange}
            savedMapAssetKeys={savedMapAssetKeys}
            scrollContainerRef={resultsListRef}
            selectedAssetKey={selectedBrowseAssetKey}
            subCatColors={subCatColors}
        />
    );

    const desktopLeftPane = desktopPaneMode === 'detail' && selectedPlacePin ? (
        <DesktopSavedPlaceDetailPanel
            onBack={handleCloseDetailMode}
            paneWidth={listWidth}
            pin={selectedPlacePin}
            subCatColors={subCatColors}
            userLocation={effectiveUserLocation}
        />
    ) : (
        <>
            {filterPanel}
            {resultsList}
        </>
    );

    const desktopRailWidth = listWidth;

    const mobileBrowseDrawer = !isDesktop && mobileMode === 'map' ? (
        <MobileBottomSheet
            open={mobileBrowseDrawerOpen}
            onOpenChange={setMobileBrowseDrawerOpen}
            title="Quick List"
            description={`Showing ${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'}`}
            headerActions={(
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setMobileBrowseDrawerOpen(false);
                            setMobileMode('browse');
                        }}
                        className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap"
                    >
                        Browse screen
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileBrowseDrawerOpen(false)}
                        className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap"
                    >
                        Done
                    </button>
                </div>
            )}
            bodyClassName="-mx-4 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0"
        >
            {user ? (
                <div className="mx-4 mt-1 mb-2 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.88)' }}>
                    <label className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>Saved assets only</p>
                            <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                Narrow this quick list to items you have already saved.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={showFavoritesOnly}
                            onChange={(event) => setShowFavoritesOnly(event.target.checked)}
                            className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                    </label>
                </div>
            ) : null}
            {resultsList}
        </MobileBottomSheet>
    ) : null;

    const mobileDetailDrawer = !isDesktop && mobileMode === 'map' && selectedPlacePin ? (
        <Drawer.Root
            open={Boolean(selectedPlacePin)}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    handleCloseMobileDetail();
                }
            }}
        >
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[595] bg-slate-950/35" />
                <Drawer.Content
                    className="fixed bottom-0 left-0 right-0 z-[600] flex max-h-[86svh] flex-col overflow-hidden rounded-t-[28px] border-t bg-white shadow-2xl"
                    style={{
                        borderColor: 'var(--color-border)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,252,251,0.97) 100%)',
                    }}
                >
                    <Drawer.Title className="sr-only">
                        {selectedPlacePin?.title || 'Saved place details'}
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        View saved place details and related resources for the selected map pin.
                    </Drawer.Description>
                    <div className="mx-auto mt-3 h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <DesktopSavedPlaceDetailPanel
                            onBack={handleCloseMobileDetail}
                            paneWidth={typeof window !== 'undefined' ? window.innerWidth : 390}
                            pin={selectedPlacePin}
                            subCatColors={subCatColors}
                            userLocation={effectiveUserLocation}
                        />
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    ) : null;

    return (
        <div
            className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
            style={{ background: 'var(--page-gradient)' }}
        >
            <div className="hidden lg:flex flex-1 w-full h-full relative">
                <div
                    className="flex h-full flex-shrink-0 flex-col overflow-hidden z-20"
                    style={{
                        width: `${desktopRailWidth}px`,
                        backgroundColor: 'rgba(255,255,255,0.84)',
                        borderRight: '1px solid var(--color-border)',
                        boxShadow: '28px 0 54px rgba(15, 89, 91, 0.08)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    {desktopLeftPane}
                </div>

                {!isTouchDesktop && desktopPaneMode === 'browse' ? (
                    <div
                        className={`absolute z-30 h-full w-2 cursor-col-resize transition-colors ${isDragging ? 'bg-brand-500 opacity-60' : 'hover:bg-brand-300 hover:opacity-60'}`}
                        onMouseDown={handleDesktopRailDragStart}
                        style={{ left: `${desktopRailWidth - 4}px` }}
                    />
                ) : null}

                {showTouchDesktopPaneToggle ? (
                    <button
                        type="button"
                        onClick={handleTouchDesktopPaneToggle}
                        className="absolute z-30 top-1/2 flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 bg-white/92 shadow-[14px_0_24px_rgba(15,89,91,0.12)] backdrop-blur"
                        style={{
                            left: `${desktopRailWidth - 1}px`,
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-brand-strong)',
                        }}
                        aria-label={canExpandTouchDesktopPane ? 'Expand resource cards to the next column width' : 'Reduce resource cards by one column width'}
                        title={canExpandTouchDesktopPane ? 'Expand cards' : 'Collapse cards'}
                    >
                        {canExpandTouchDesktopPane ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                ) : null}

                <div className="relative z-0 h-full w-full flex-1">
                    {mapView}
                </div>
            </div>

            <div className="flex lg:hidden min-h-0 flex-1 flex-col">
                {filterPanel}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {mobileMode === 'browse' ? resultsList : mapView}
                </div>
                {mobileBrowseDrawer}
                {mobileDetailDrawer}
            </div>

            {loading ? (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <div className="card flex flex-col items-center gap-4 p-8" style={{ border: '2px solid var(--color-border)' }}>
                        <div className="h-12 w-12 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                        <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Loading Directory…</p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
