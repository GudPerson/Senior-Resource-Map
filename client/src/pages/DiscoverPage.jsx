import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Heart, Layers3, X } from 'lucide-react';
import { Drawer } from 'vaul';

import { api } from '../lib/api.js';
import { getDistance } from '../lib/geo.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
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

function createFocusRequestIdGenerator() {
    let current = 0;
    return () => {
        current += 1;
        return current;
    };
}

const nextFocusRequestId = createFocusRequestIdGenerator();
const SAVED_PIN_FOCUS_ZOOM = 18;
const TOUCH_DESKTOP_PANE_PRESET_WIDTHS = [450, 676, 992];

function normalizeSubCategoryLookupKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function DiscoverPostalGroupListPanel({
    anchorLayout = null,
    group,
    highlightedPinKey = null,
    isDesktop = false,
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
    const minVisibleHeight = isDesktop ? 190 : 170;
    const preferredMaxHeight = isDesktop ? 520 : 420;
    const bottomPadding = isDesktop ? 24 : 16;
    const desiredTop = anchorLayout ? anchorLayout.y + 8 : null;
    const clampedLeft = (anchorLayout && panelWidth)
        ? Math.max(horizontalMargin, Math.min(anchorLayout.x - (panelWidth / 2), anchorLayout.width - horizontalMargin - panelWidth))
        : null;
    const clampedTop = anchorLayout
        ? Math.min(
            desiredTop,
            Math.max(12, anchorLayout.height - bottomPadding - minVisibleHeight),
        )
        : null;
    const availableHeight = (anchorLayout && clampedTop !== null)
        ? Math.max(140, anchorLayout.height - clampedTop - bottomPadding)
        : preferredMaxHeight;
    const panelMaxHeight = Math.min(preferredMaxHeight, availableHeight);
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
                                    onClick={() => onSelectPin?.(pin)}
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

function DiscoverPostalGroupHoverHint({ anchorLayout = null, isDesktop = false }) {
    if (!isDesktop || !anchorLayout) return null;

    const panelWidth = 188;
    const panelHeight = 44;
    const horizontalMargin = 16;
    const left = Math.max(
        horizontalMargin,
        Math.min(
            anchorLayout.x - (panelWidth / 2),
            anchorLayout.width - horizontalMargin - panelWidth,
        ),
    );
    const top = Math.max(
        16,
        Math.min(
            anchorLayout.y + 8,
            anchorLayout.height - 16 - panelHeight,
        ),
    );

    return (
        <div
            className="pointer-events-none absolute z-[610]"
            style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${panelWidth}px`,
            }}
        >
            <div className="rounded-full border border-amber-200 bg-white/96 px-3 py-2 text-center text-[12px] font-bold tracking-[0.01em] text-slate-700 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.45)] backdrop-blur">
                Click to expand list
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

    const navigate = useNavigate();
    const resultsListRef = useRef(null);
    const lastBrowseScrollTopRef = useRef(0);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const isTouchDesktop = useMediaQuery('(min-width: 1024px) and (pointer: coarse)');
    const { isDragging, listWidth, maxPaneWidth, setPaneWidth, startDragging } = useSplitPaneResize(450);
    const { user, isAuth } = useAuth();
    const { savedAssets, savedAssetsLoading } = useSavedAssets();
    const {
        clearLocationSearch,
        effectiveOrigin,
        effectiveUserLocation,
        flyTarget,
        handleLocateMe,
        handlePostalSearch,
        homeOrigin,
        isResolvingHome,
        isGeocoding,
        locationNotice,
        postalInput,
        searchOrigin,
        searchRadius,
        setFlyTarget,
        setPostalInput,
        setSearchRadius,
    } = useDiscoveryLocation(hardAssets, user?.postalCode || '');

    // Sync state to URL
    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams);
        
        if (search.trim()) {
            nextParams.set('q', search.trim());
        } else {
            nextParams.delete('q');
        }

        const postal = searchOrigin?.postalCode || (searchOrigin?.source === 'postal' ? searchOrigin.postalCode : null);
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
                const [hard, soft, subcategories] = await Promise.all([
                    withTimeout(api.getHardAssets().catch(() => []), []),
                    withTimeout(api.getSoftAssets().catch(() => []), []),
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
                setHardAssets(hard);
                setSoftAssets(soft);
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

    useEffect(() => {
        if (!isDesktop) {
            setIsSearchPanelCollapsed(false);
            setDesktopPaneMode('browse');
            setSelectedPlacePinKey(null);
            setHoveredMapPinKey(null);
        }
    }, [isDesktop]);

    useEffect(() => {
        if (searchOrigin && isDesktop) {
            setIsSearchPanelCollapsed(true);
        }
        
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

    const combined = useMemo(() => {
        const items = [];

        if (activeTab === 'all' || activeTab === 'hard') {
            items.push(...visibleHardAssets.map((asset) => ({ ...asset, _type: 'hard' })));
        }
        if (activeTab === 'all' || activeTab === 'soft') {
            items.push(...visibleSoftAssets.map((asset) => ({ ...asset, _type: 'soft' })));
        }

        return items.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    }, [activeTab, visibleHardAssets, visibleSoftAssets]);

    const filtered = useMemo(() => {
        let items = combined.map((resource) => {
            const displayLocation = resource._type === 'hard' ? resource : getBestLocation(resource, effectiveUserLocation);
            const lat = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lat) : null;
            const lng = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lng) : null;
            const distance = effectiveUserLocation && Number.isFinite(lat) && Number.isFinite(lng)
                ? getDistance(effectiveUserLocation.lat, effectiveUserLocation.lng, lat, lng)
                : null;

            return {
                ...resource,
                _distance: distance,
                _displayLat: lat,
                _displayLng: lng,
                _displayLocation: displayLocation,
                _locationCount: resource._type === 'soft' ? getAssetLocations(resource).length : 1,
            };
        });

        if (effectiveUserLocation) {
            if (searchRadius < 100) {
                items = items.filter((resource) => resource._distance !== null && resource._distance <= searchRadius);
            }

            items.sort((left, right) => {
                if (left._distance === null) return 1;
                if (right._distance === null) return -1;
                return left._distance - right._distance;
            });
        }

        const query = search.toLowerCase();
        return items.filter((resource) => {
            if (showFavoritesOnly && user) {
                const isSavedResource = savedAssets.some((savedAsset) => savedAsset.resourceId === resource.id && savedAsset.resourceType === resource._type);
                if (!isSavedResource) return false;
            }

            if (!query) return true;

            const matchName = resource.name.toLowerCase().includes(query);
            const matchDescription = (resource.description || '').toLowerCase().includes(query);
            const matchTag = resource.tags?.some((tag) => tag.toLowerCase().includes(query));
            const matchCategory = resource.subCategory?.toLowerCase().includes(query);
            return matchName || matchDescription || matchTag || matchCategory;
        });
    }, [combined, effectiveUserLocation, savedAssets, search, searchRadius, showFavoritesOnly, user]);

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
        () => (selectedPlacePinKey ? savedPlacePinLookup.get(selectedPlacePinKey) || null : null),
        [selectedPlacePinKey, savedPlacePinLookup]
    );
    const activePostalGroup = useMemo(() => {
        if (!expandedPostalGroupKey) return null;
        const group = postalGroupLookup.get(expandedPostalGroupKey) || null;
        return group?.isPostalGroup ? group : null;
    }, [expandedPostalGroupKey, postalGroupLookup]);

    useEffect(() => {
        if (!activePostalGroup) {
            setTrackedPostalGroupLayout(null);
        }
    }, [activePostalGroup]);

    useEffect(() => {
        if (!hoveredPostalGroupKey) return;
        const activeGroup = postalGroupLookup.get(hoveredPostalGroupKey);
        if (!activeGroup?.isPostalGroup) {
            setHoveredPostalGroupKey(null);
        }
    }, [hoveredPostalGroupKey, postalGroupLookup]);

    useEffect(() => {
        if (!flyTarget) return;
        if (savedPlacePins.length) {
            setMapFocusRequest({
                kind: 'saved-fit',
                requestId: nextFocusRequestId(),
                savedPlacePins,
                anchorPoint: flyTarget,
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
        if (selectedPlacePinKey && !savedPlacePinLookup.has(selectedPlacePinKey)) {
            setSelectedPlacePinKey(null);
            setDesktopPaneMode('browse');
            setHoveredMapPinKey(null);
        }
    }, [savedPlacePinLookup, selectedPlacePinKey]);

    useEffect(() => {
        if (!expandedPostalGroupKey) return;
        const activeGroup = postalGroupLookup.get(expandedPostalGroupKey);
        if (!activeGroup?.isPostalGroup) {
            setExpandedPostalGroupKey(null);
        }
    }, [expandedPostalGroupKey, postalGroupLookup]);

    useEffect(() => {
        setHoveredPinKeys((current) => current.filter((pinKey) => savedPlacePinLookup.has(pinKey)));
        setLockedPinKeys((current) => current.filter((pinKey) => savedPlacePinLookup.has(pinKey)));
        if (hoveredPrimaryPinKey && !savedPlacePinLookup.has(hoveredPrimaryPinKey)) {
            setHoveredPrimaryPinKey(null);
        }
        if (lockedPrimaryPinKey && !savedPlacePinLookup.has(lockedPrimaryPinKey)) {
            setLockedPrimaryPinKey(null);
        }
        if (hoveredMapPinKey && !savedPlacePinLookup.has(hoveredMapPinKey)) {
            setHoveredMapPinKey(null);
        }
    }, [hoveredMapPinKey, hoveredPrimaryPinKey, lockedPrimaryPinKey, savedPlacePinLookup]);

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
            return {
                assetKey,
                primaryPinKey: pinKey,
                pins: [
                    {
                        pinKey,
                        title: normalizedAsset.name,
                        address: normalizedAsset.address || null,
                        lat: Number.parseFloat(normalizedAsset.lat),
                        lng: Number.parseFloat(normalizedAsset.lng),
                        totalOfferingsCount: Math.max(1, Array.isArray(normalizedAsset.softAssets) ? normalizedAsset.softAssets.length : 0),
                        tone: 'temporary',
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
                title: placeAsset?.name || location.name || normalizedAsset.name,
                address: placeAsset?.address || location.address || normalizedAsset.address || null,
                lat: Number.parseFloat(location.lat),
                lng: Number.parseFloat(location.lng),
                totalOfferingsCount: Math.max(1, Array.isArray(placeAsset?.softAssets) ? placeAsset.softAssets.length : 0),
                tone: 'temporary',
                isTransient: true,
            };
        });

        return {
            assetKey,
            pins,
            primaryPinKey: pins[0]?.pinKey || null,
        };
    }, [effectiveUserLocation, visibleHardAssetLookup]);

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

        clearHoveredCardState();
        clearTransientFocusState();
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

    const handlePostalGroupMemberSelect = useCallback((pin) => {
        setHoveredPostalGroupKey(null);
        setExpandedPostalGroupKey(null);
        handleMapPinSelect(pin);
    }, [handleMapPinSelect]);

    const handleCloseDetailMode = useCallback(() => {
        setDesktopPaneMode('browse');
        setSelectedPlacePinKey(null);
        setHoveredMapPinKey(null);
        clearLockedCardState();
        clearTransientFocusState();
    }, [clearLockedCardState, clearTransientFocusState]);

    const handleCloseMobileDetail = useCallback(() => {
        setSelectedPlacePinKey(null);
        setHoveredMapPinKey(null);
        if (savedPlacePins.length) {
            setMapFocusRequest(createSavedFitFocusRequest('detail-close'));
        }
    }, [createSavedFitFocusRequest, savedPlacePins.length]);

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

    const handleMapHoverStart = useCallback((pinKey, meta = null) => {
        if (meta?.kind === 'postal-group') {
            if (!isDesktop || expandedPostalGroupKey) return;
            setHoveredPostalGroupKey(pinKey);
            return;
        }
        if (!isDesktop || lockedPrimaryPinKey) return;
        if (desktopPaneMode !== 'detail') {
            saveBrowseScrollPosition();
        }
        setHoveredPostalGroupKey(null);
        setHoveredMapPinKey(pinKey);
        setSelectedPlacePinKey(pinKey);
        setDesktopPaneMode('detail');
    }, [desktopPaneMode, expandedPostalGroupKey, isDesktop, lockedPrimaryPinKey, saveBrowseScrollPosition]);

    const handleMapHoverEnd = useCallback((pinKey, meta = null) => {
        if (meta?.kind === 'postal-group') {
            setHoveredPostalGroupKey((current) => (current === pinKey ? null : current));
            return;
        }
        if (lockedPrimaryPinKey) return;
        setHoveredMapPinKey((current) => (current === pinKey ? null : current));
        setSelectedPlacePinKey((current) => (current === pinKey ? null : current));
        setDesktopPaneMode((current) => (current === 'detail' ? 'browse' : current));
    }, [lockedPrimaryPinKey]);

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
            // Only highlight transient pins if they are the primary focus
            const emphasis = transientPrimaryPinKey === pin.pinKey ? 'primary' : 'default';
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
            const emphasis = transientPrimaryPinKey === pin.pinKey ? 'primary' : 'default';
            nextMap.set(pin.pinKey, emphasis);
        });

        return nextMap;
    }, [activePostalGroup, childPinEmphasisByKey, hoveredPostalGroupKey, renderedSavedPlacePins, transientPlacePins, transientPrimaryPinKey]);

    const selectedBrowseAssetKey = desktopPaneMode === 'browse' ? lockedAssetKey : null;
    const touchDesktopPanePresetWidths = useMemo(() => (
        TOUCH_DESKTOP_PANE_PRESET_WIDTHS
            .filter((width, index) => index === 0 || maxPaneWidth >= width)
            .map((width) => Math.round(Math.max(430, Math.min(width, maxPaneWidth))))
    ), [maxPaneWidth]);
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

        if (
            search.trim()
            || activeTab !== 'all'
            || (showFavoritesOnly && user)
            || searchRadius < 100
        ) {
            setIsSearchPanelCollapsed(true);
        }
    }, [activeTab, handlePostalSearch, postalInput, search, searchRadius, showFavoritesOnly, user]);

    const handleLocateMeAndCollapse = useCallback(() => {
        handleLocateMe();
        if (isDesktop) {
            setIsSearchPanelCollapsed(true);
        }
    }, [handleLocateMe, isDesktop]);

    const handleClearLocationSearch = useCallback(() => {
        clearLocationSearch();
        if (isDesktop && !search.trim() && activeTab === 'all' && !(showFavoritesOnly && user)) {
            setIsSearchPanelCollapsed(false);
        }
    }, [activeTab, clearLocationSearch, isDesktop, search, showFavoritesOnly, user]);

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
                onBackgroundClick={isDesktop ? handleMapBackgroundClick : handleMobileMapBackgroundClick}
                onMapHoverEnd={handleMapHoverEnd}
                onMapHoverStart={handleMapHoverStart}
                onTrackedPinLayoutChange={setTrackedPostalGroupLayout}
                onSelectGroupPin={handleMapPinSelect}
                onSelectPin={handleMapPinSelect}
                pinEmphasisByKey={pinEmphasisByKey}
                renderedSavedPlacePins={renderedSavedPlacePins}
                savedPlacePins={savedPlacePins}
                trackedPinKey={activePostalGroup?.postalGroupKey || hoveredPostalGroupKey || null}
                transientPlacePins={transientPlacePins}
                userLocation={effectiveUserLocation}
            />
            {hoveredPostalGroupKey && !activePostalGroup ? (
                <DiscoverPostalGroupHoverHint
                    anchorLayout={trackedPostalGroupLayout?.pinKey === hoveredPostalGroupKey ? trackedPostalGroupLayout : null}
                    isDesktop={isDesktop}
                />
            ) : null}
            {activePostalGroup ? (
                <DiscoverPostalGroupListPanel
                    anchorLayout={trackedPostalGroupLayout}
                    group={activePostalGroup}
                    highlightedPinKey={lockedPrimaryPinKey || hoveredPrimaryPinKey || null}
                    isDesktop={isDesktop}
                    onClose={() => setExpandedPostalGroupKey(null)}
                    onSelectPin={handlePostalGroupMemberSelect}
                />
            ) : null}
        </div>
    ) : (savedAssetsLoading && isAuth) || (isResolvingHome && isAuth && Boolean(user?.postalCode)) ? (
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
            canClearLocationSearch={Boolean(searchOrigin)}
            clearLocationSearch={handleClearLocationSearch}
            handleLocateMe={handleLocateMeAndCollapse}
            handlePostalSearch={handlePostalSearch}
            isCollapsed={isSearchPanelCollapsed}
            isGeocoding={isGeocoding}
            locationNotice={locationNotice}
            mobileMode={mobileMode}
            mobileCardDensity={mobileCardDensity}
            onApplySearch={handleApplySearch}
            onChangeMobileCardDensity={setMobileCardDensity}
            onCollapse={() => setIsSearchPanelCollapsed(true)}
            onExpand={() => setIsSearchPanelCollapsed(false)}
            onOpenBrowse={() => setMobileMode('browse')}
            onOpenMap={() => setMobileMode('map')}
            onOpenMobileBrowseDrawer={() => setMobileBrowseDrawerOpen(true)}
            onSearchChange={setSearch}
            pinCount={savedPlacePins.length}
            postalInput={postalInput}
            resultCount={filtered.length}
            savedAssetCount={savedAssetCount}
            search={search}
            searchOrigin={searchOrigin || homeOrigin}
            searchRadius={searchRadius}
            setActiveTab={setActiveTab}
            setPostalInput={setPostalInput}
            setSearchRadius={setSearchRadius}
            setShowFavoritesOnly={setShowFavoritesOnly}
            showFavoritesOnly={showFavoritesOnly}
            unmappableSavedCount={unmappableSavedCount}
            user={user}
            userLocation={effectiveUserLocation}
        />
    );

    const resultsList = (
        <DiscoveryResultsList
            filtered={filtered}
            isDesktop={isDesktop}
            loading={loading}
            mobileCardDensity={mobileCardDensity}
            onCardHoverEnd={handleClearHoveredAssetOnMap}
            onCardHoverStart={handleHoverAssetOnMap}
            onCardLockOnMap={handleLockAssetOnMap}
            onCategoryClick={setSearch}
            onFocusAssetOnMap={handleFocusAssetOnMap}
            onTagClick={setSearch}
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
                        width: `${listWidth}px`,
                        backgroundColor: 'rgba(255,255,255,0.84)',
                        borderRight: '1px solid var(--color-border)',
                        boxShadow: '28px 0 54px rgba(15, 89, 91, 0.08)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    {desktopLeftPane}
                </div>

                {!isTouchDesktop ? (
                    <div
                        className={`absolute z-30 h-full w-2 cursor-col-resize transition-colors ${isDragging ? 'bg-brand-500 opacity-60' : 'hover:bg-brand-300 hover:opacity-60'}`}
                        onMouseDown={startDragging}
                        style={{ left: `${listWidth - 4}px` }}
                    />
                ) : null}

                {showTouchDesktopPaneToggle ? (
                    <button
                        type="button"
                        onClick={handleTouchDesktopPaneToggle}
                        className="absolute z-30 top-1/2 flex h-20 w-8 -translate-y-1/2 items-center justify-center rounded-r-2xl border border-l-0 bg-white/92 shadow-[14px_0_24px_rgba(15,89,91,0.12)] backdrop-blur"
                        style={{
                            left: `${listWidth - 1}px`,
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
