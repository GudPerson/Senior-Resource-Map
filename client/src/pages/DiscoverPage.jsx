import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api.js';
import { getDistance } from '../lib/geo.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useSplitPaneResize } from '../hooks/useSplitPaneResize.js';
import DiscoveryFilterPanel from '../features/discover/DiscoveryFilterPanel.jsx';
import { DiscoveryInspector } from '../features/discover/DiscoveryInspector.jsx';
import DiscoveryMap from '../features/discover/DiscoveryMap.jsx';
import { DiscoveryResultsList } from '../features/discover/DiscoveryResultsList.jsx';
import SavedMapEmptyState from '../features/discover/SavedMapEmptyState.jsx';
import {
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

function getZoomForRadius(searchRadius) {
    if (searchRadius <= 0.3) return 17;
    if (searchRadius <= 0.5) return 16;
    if (searchRadius <= 1) return 15;
    if (searchRadius <= 2) return 14;
    return 13;
}

function buildDisplayLocationFromPin(pin) {
    return {
        id: pin.locationId || pin.placeId || pin.pinKey,
        name: pin.title,
        address: pin.address,
        lat: pin.lat,
        lng: pin.lng,
    };
}

export default function DiscoverPage() {
    const [subCatColors, setSubCatColors] = useState({});
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedMarkerKey, setSelectedMarkerKey] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [activeTooltipKey, setActiveTooltipKey] = useState(null);
    const [mobileMode, setMobileMode] = useState('browse');
    const [mobileCardDensity, setMobileCardDensity] = useState('compact');
    const [isSearchPanelCollapsed, setIsSearchPanelCollapsed] = useState(false);

    const navigate = useNavigate();
    const tooltipCloseTimeoutRef = useRef(null);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const { isDragging, listWidth, startDragging } = useSplitPaneResize(450);
    const { user, isAuth } = useAuth();
    const { savedAssets, savedAssetsLoading } = useSavedAssets();
    const {
        clearLocationSearch,
        flyTarget,
        handleLocateMe,
        handlePostalSearch,
        isGeocoding,
        locationNotice,
        postalInput,
        searchOrigin,
        searchRadius,
        setFlyTarget,
        setPostalInput,
        setSearchRadius,
        userLocation,
    } = useDiscoveryLocation(hardAssets);

    const assetLookup = useMemo(() => {
        const lookup = new Map();
        hardAssets.forEach((asset) => lookup.set(`hard-${asset.id}`, { ...asset, _type: 'hard' }));
        softAssets.forEach((asset) => lookup.set(`soft-${asset.id}`, { ...asset, _type: 'soft' }));
        return lookup;
    }, [hardAssets, softAssets]);

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
                subcategories.forEach((subcategory) => {
                    colors[subcategory.name] = subcategory.color || '#94a3b8';
                });

                setSubCatColors(colors);
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

    useEffect(() => () => {
        if (tooltipCloseTimeoutRef.current) {
            clearTimeout(tooltipCloseTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (!isDesktop) {
            setIsSearchPanelCollapsed(false);
        }
    }, [isDesktop]);

    useEffect(() => {
        if (selectedAsset && isDesktop) {
            setIsSearchPanelCollapsed(true);
        }
    }, [isDesktop, selectedAsset]);

    useEffect(() => {
        if (searchOrigin && isDesktop) {
            setIsSearchPanelCollapsed(true);
        }
    }, [isDesktop, searchOrigin]);

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

    const keepTooltipOpen = useCallback((markerKey) => {
        if (tooltipCloseTimeoutRef.current) {
            clearTimeout(tooltipCloseTimeoutRef.current);
        }
        setActiveTooltipKey(markerKey);
    }, []);

    const scheduleTooltipClose = useCallback((markerKey) => {
        if (tooltipCloseTimeoutRef.current) {
            clearTimeout(tooltipCloseTimeoutRef.current);
        }

        tooltipCloseTimeoutRef.current = setTimeout(() => {
            setActiveTooltipKey((current) => (current === markerKey ? null : current));
            tooltipCloseTimeoutRef.current = null;
        }, 180);
    }, []);

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
            const displayLocation = resource._type === 'hard' ? resource : getBestLocation(resource, userLocation);
            const lat = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lat) : null;
            const lng = hasValidCoordinates(displayLocation) ? Number.parseFloat(displayLocation.lng) : null;
            const distance = userLocation && Number.isFinite(lat) && Number.isFinite(lng)
                ? getDistance(userLocation.lat, userLocation.lng, lat, lng)
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

        if (userLocation) {
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
    }, [combined, savedAssets, search, searchRadius, showFavoritesOnly, user, userLocation]);

    const savedPlacePinData = useMemo(() => (
        buildSavedPlacePins(savedAssets, visibleHardAssets, visibleSoftAssets, { userLocation })
    ), [savedAssets, userLocation, visibleHardAssets, visibleSoftAssets]);

    const savedPlacePins = savedPlacePinData.pins;
    const savedPlacePinLookup = useMemo(
        () => new Map(savedPlacePins.map((pin) => [pin.pinKey, pin])),
        [savedPlacePins]
    );
    const savedMapAssetKeys = useMemo(
        () => new Set(savedPlacePinData.contributingAssetKeys),
        [savedPlacePinData.contributingAssetKeys]
    );
    const hasSavedMapPins = savedPlacePins.length > 0;
    const savedAssetCount = savedAssets.length;
    const unmappableSavedCount = savedPlacePinData.unmappableSavedAssetKeys.size;

    useEffect(() => {
        if (!isDesktop && !hasSavedMapPins && mobileMode === 'map') {
            setMobileMode('browse');
        }
    }, [hasSavedMapPins, isDesktop, mobileMode]);

    useEffect(() => {
        if (selectedMarkerKey && !savedPlacePinLookup.has(selectedMarkerKey)) {
            setSelectedMarkerKey(null);
            setSelectedAsset(null);
            setActiveTooltipKey(null);
        }
    }, [savedPlacePinLookup, selectedMarkerKey]);

    const buildSelectedAssetFromPin = useCallback((pin) => {
        if (!pin) return null;

        if (pin.placeAsset) {
            return {
                ...pin.placeAsset,
                _type: 'hard',
                _displayLocation: buildDisplayLocationFromPin(pin),
            };
        }

        const primarySavedAsset = pin.primarySavedAsset;
        if (!primarySavedAsset?.liveAsset) {
            return null;
        }

        if (primarySavedAsset.resourceType === 'soft') {
            return {
                ...primarySavedAsset.liveAsset,
                _type: 'soft',
                _displayLocation: buildDisplayLocationFromPin(pin),
            };
        }

        return {
            ...primarySavedAsset.liveAsset,
            _type: 'hard',
            _displayLocation: buildDisplayLocationFromPin(pin),
        };
    }, []);

    const resolveSavedPinForAsset = useCallback((asset, preferredLocation = null) => {
        if (!asset) return null;
        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        const assetKey = buildSavedAssetKey(normalizedAsset._type, normalizedAsset.id);
        const pinKeys = savedPlacePinData.assetToPinKeys.get(assetKey);

        if (!pinKeys || pinKeys.length === 0) {
            return null;
        }

        if (preferredLocation) {
            const preferredPinKey = resolveSavedPlaceKey({
                hardAssetId: normalizedAsset._type === 'hard' ? normalizedAsset.id : preferredLocation.id,
                locationId: normalizedAsset._type === 'soft' ? preferredLocation.id : normalizedAsset.id,
                lat: normalizedAsset._type === 'hard' ? normalizedAsset.lat : preferredLocation.lat,
                lng: normalizedAsset._type === 'hard' ? normalizedAsset.lng : preferredLocation.lng,
            });

            if (preferredPinKey && savedPlacePinLookup.has(preferredPinKey)) {
                return savedPlacePinLookup.get(preferredPinKey);
            }
        }

        return savedPlacePinLookup.get(pinKeys[0]) || null;
    }, [savedPlacePinData.assetToPinKeys, savedPlacePinLookup]);

    const handleSelectSavedPin = useCallback((pin, options = {}) => {
        if (!pin) {
            setSelectedMarkerKey(null);
            setSelectedAsset(null);
            return;
        }

        const { focusMap = true, openTooltip = true } = options;
        const nextSelectedAsset = buildSelectedAssetFromPin(pin);

        setSelectedMarkerKey(pin.pinKey);
        setSelectedAsset(nextSelectedAsset);
        if (openTooltip) {
            setActiveTooltipKey(pin.pinKey);
        }

        if (focusMap && Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
            setFlyTarget({ lat: pin.lat, lng: pin.lng, zoom: getZoomForRadius(searchRadius) });
        }
    }, [buildSelectedAssetFromPin, searchRadius, setFlyTarget]);

    const handleFocusAssetOnMap = useCallback((asset, preferredLocation = null) => {
        const targetPin = resolveSavedPinForAsset(asset, preferredLocation);
        if (!targetPin) return;

        if (!isDesktop) {
            setMobileMode('map');
        }

        handleSelectSavedPin(targetPin, { focusMap: true, openTooltip: true });
    }, [handleSelectSavedPin, isDesktop, resolveSavedPinForAsset]);

    const handleMapSelect = useCallback((pin) => {
        handleSelectSavedPin(pin, { focusMap: false, openTooltip: true });
    }, [handleSelectSavedPin]);

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

    const handleOpenResourcePage = useCallback((asset) => {
        if (!asset) return;
        navigate(`/resource/${asset._type}/${asset.id}`);
    }, [navigate]);

    const handleOpenSavedAssetFromMap = useCallback((savedAsset) => {
        if (!savedAsset) return;
        navigate(savedAsset.detailPath || `/resource/${savedAsset.resourceType}/${savedAsset.resourceId}`);
    }, [navigate]);

    const handleOpenPlaceFromMap = useCallback((pin) => {
        if (pin?.placeDetailPath) {
            navigate(pin.placeDetailPath);
            return;
        }

        const fallbackPath = pin?.primarySavedAsset?.detailPath;
        if (fallbackPath) {
            navigate(fallbackPath);
        }
    }, [navigate]);

    const savedMapEmptyState = (
        <SavedMapEmptyState
            hasSavedAssets={savedAssetCount > 0}
            isAuthenticated={isAuth}
            onBrowse={!isDesktop ? () => setMobileMode('browse') : undefined}
            unmappableCount={unmappableSavedCount}
        />
    );

    const mapView = hasSavedMapPins ? (
        <div className="relative h-full w-full">
            <DiscoveryMap
                activeTooltipKey={activeTooltipKey}
                bottomOffsetPx={0}
                flyTarget={flyTarget}
                onKeepTooltipOpen={keepTooltipOpen}
                onOpenAsset={handleOpenSavedAssetFromMap}
                onOpenPlace={handleOpenPlaceFromMap}
                onScheduleTooltipClose={scheduleTooltipClose}
                onSelectPin={handleMapSelect}
                savedPlacePins={savedPlacePins}
                selectedMarkerKey={selectedMarkerKey}
                userLocation={userLocation}
            />
            {isDesktop ? (
                <DiscoveryInspector
                    asset={selectedAsset}
                    onClose={() => handleSelectSavedPin(null)}
                    onOpenResourcePage={handleOpenResourcePage}
                    onTagClick={setSearch}
                    subCatColors={subCatColors}
                    userLocation={userLocation}
                />
            ) : null}
        </div>
    ) : savedAssetsLoading && isAuth ? (
        <div className="flex h-full items-center justify-center p-6">
            <div className="card flex flex-col items-center gap-4 p-8" style={{ border: '2px solid var(--color-border)' }}>
                <div className="h-10 w-10 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                    Loading your saved map…
                </p>
            </div>
        </div>
    ) : savedMapEmptyState;

    const filterPanel = (
        <DiscoveryFilterPanel
            activeTab={activeTab}
            clearLocationSearch={handleClearLocationSearch}
            handleLocateMe={handleLocateMeAndCollapse}
            handlePostalSearch={handlePostalSearch}
            isCollapsed={isSearchPanelCollapsed}
            isGeocoding={isGeocoding}
            locationNotice={locationNotice}
            mobileMode={mobileMode}
            mobileCardDensity={mobileCardDensity}
            onApplySearch={handleApplySearch}
            onChangeMode={setMobileMode}
            onChangeMobileCardDensity={setMobileCardDensity}
            onCollapse={() => setIsSearchPanelCollapsed(true)}
            onExpand={() => setIsSearchPanelCollapsed(false)}
            onSearchChange={setSearch}
            pinCount={savedPlacePins.length}
            postalInput={postalInput}
            resultCount={filtered.length}
            savedAssetCount={savedAssetCount}
            search={search}
            searchOrigin={searchOrigin}
            searchRadius={searchRadius}
            setActiveTab={setActiveTab}
            setPostalInput={setPostalInput}
            setSearchRadius={setSearchRadius}
            setShowFavoritesOnly={setShowFavoritesOnly}
            showFavoritesOnly={showFavoritesOnly}
            unmappableSavedCount={unmappableSavedCount}
            user={user}
            userLocation={userLocation}
        />
    );

    const resultsList = (
        <DiscoveryResultsList
            filtered={filtered}
            isDesktop={isDesktop}
            isSearchPanelCollapsed={isSearchPanelCollapsed}
            loading={loading}
            mobileCardDensity={mobileCardDensity}
            onChangeMobileCardDensity={setMobileCardDensity}
            onCategoryClick={setSearch}
            onFocusAssetOnMap={handleFocusAssetOnMap}
            onTagClick={setSearch}
            savedMapAssetKeys={savedMapAssetKeys}
            selectedAsset={selectedAsset}
            subCatColors={subCatColors}
        />
    );

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
                    {filterPanel}
                    {resultsList}
                </div>

                <div
                    className={`absolute z-30 h-full w-2 cursor-col-resize transition-colors ${isDragging ? 'bg-brand-500 opacity-60' : 'hover:bg-brand-300 hover:opacity-60'}`}
                    onMouseDown={startDragging}
                    style={{ left: `${listWidth - 4}px` }}
                />

                <div className="relative z-0 h-full w-full flex-1">
                    {mapView}
                </div>
            </div>

            <div className="flex lg:hidden min-h-0 flex-1 flex-col">
                {filterPanel}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {mobileMode === 'browse' ? resultsList : mapView}
                </div>
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
