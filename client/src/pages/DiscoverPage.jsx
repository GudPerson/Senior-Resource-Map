import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { api } from '../lib/api.js';
import { getDistance } from '../lib/geo.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useFavorites } from '../hooks/useFavorites.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useSplitPaneResize } from '../hooks/useSplitPaneResize.js';
import { DiscoveryFilterPanel } from '../features/discover/DiscoveryFilterPanel.jsx';
import { DiscoveryInspector } from '../features/discover/DiscoveryInspector.jsx';
import { DiscoveryMap } from '../features/discover/DiscoveryMap.jsx';
import { DiscoveryResultsList } from '../features/discover/DiscoveryResultsList.jsx';
import {
    buildDerivedMapLocations,
    buildMarkerKey,
    getAssetLocations,
    getBestLocation,
    hasValidCoordinates,
} from '../features/discover/discoverUtils.js';
import { useDiscoveryLocation } from '../features/discover/useDiscoveryLocation.js';

export default function DiscoverPage() {
    const [subCatColors, setSubCatColors] = useState({});
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cachedLocations, setCachedLocations] = useState([]);
    const [mapLocations, setMapLocations] = useState([]);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [selectedMarkerKey, setSelectedMarkerKey] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [activeTooltipKey, setActiveTooltipKey] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [activeSnap, setActiveSnap] = useState(0.55);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const workerRef = useRef(null);
    const tooltipCloseTimeoutRef = useRef(null);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const { isDragging, listWidth, startDragging } = useSplitPaneResize(450);
    const { user } = useAuth();
    const { favorites, toggleFavorite: handleToggleFavorite, isFavorite } = useFavorites(user);
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

    const drawerOffsetPx = useMemo(() => {
        if (!isDrawerOpen) return 0;
        return typeof window !== 'undefined' ? window.innerHeight * activeSnap : 0;
    }, [isDrawerOpen, activeSnap]);

    const derivedMapLocations = useMemo(() => buildDerivedMapLocations(hardAssets, softAssets), [hardAssets, softAssets]);
    const assetLookup = useMemo(() => {
        const lookup = new Map();
        hardAssets.forEach((asset) => lookup.set(`hard-${asset.id}`, { ...asset, _type: 'hard' }));
        softAssets.forEach((asset) => lookup.set(`soft-${asset.id}`, { ...asset, _type: 'soft' }));
        return lookup;
    }, [hardAssets, softAssets]);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/spatialWorker.js', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (event) => setMapLocations(event.data);
        return () => workerRef.current?.terminate();
    }, []);

    useEffect(() => {
        Promise.all([
            api.getHardAssets().catch(() => []),
            api.getSoftAssets().catch(() => []),
            api.getSubCategories().catch(() => []),
            api.getMapCache('all').catch(() => []),
        ]).then(([hard, soft, subcategories, cached]) => {
            const colors = {};
            subcategories.forEach((subcategory) => {
                colors[subcategory.name] = subcategory.color || '#94a3b8';
            });

            setSubCatColors(colors);
            setHardAssets(hard);
            setSoftAssets(soft);

            const liveLocations = buildDerivedMapLocations(hard, soft);
            const fetchedLocations = Array.isArray(cached) ? cached : (cached?.data || []);
            const initialLocations = (fetchedLocations.length > 0 ? fetchedLocations : liveLocations).filter(hasValidCoordinates);
            setCachedLocations(initialLocations);
            setMapLocations(initialLocations);
            setLoading(false);

            const urlId = parseInt(searchParams.get('id'), 10);
            if (!urlId) return;
            const foundHard = hard.find((asset) => asset.id === urlId);
            if (!foundHard) return;

            setSelectedMarkerKey(buildMarkerKey({
                asset_type: 'hard',
                id: foundHard.id,
                locationId: foundHard.id,
                lat: foundHard.lat,
                lng: foundHard.lng,
            }));
            setSelectedAsset({ ...foundHard, _type: 'hard' });
        });
    }, [searchParams]);

    useEffect(() => () => {
        if (tooltipCloseTimeoutRef.current) {
            clearTimeout(tooltipCloseTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        if (isDesktop) {
            setIsDrawerOpen(false);
            setActiveSnap(0.55);
        }
    }, [isDesktop]);

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
        const visibleHardAssets = hardAssets.filter(isPubliclyVisible);
        const visibleSoftAssets = softAssets.filter(isPubliclyVisible);

        if (activeTab === 'all' || activeTab === 'hard') {
            items.push(...visibleHardAssets.map((asset) => ({ ...asset, _type: 'hard' })));
        }
        if (activeTab === 'all' || activeTab === 'soft') {
            items.push(...visibleSoftAssets.map((asset) => ({ ...asset, _type: 'soft' })));
        }

        return items.sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    }, [activeTab, hardAssets, isPubliclyVisible, softAssets]);

    const filtered = useMemo(() => {
        let items = combined.map((resource) => {
            const displayLocation = resource._type === 'hard' ? resource : getBestLocation(resource, userLocation);
            const lat = hasValidCoordinates(displayLocation) ? parseFloat(displayLocation.lat) : null;
            const lng = hasValidCoordinates(displayLocation) ? parseFloat(displayLocation.lng) : null;
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
                const isFavoriteResource = favorites.some((favorite) => favorite.resourceId === resource.id && favorite.resourceType === resource._type);
                if (!isFavoriteResource) return false;
            }
            if (!query) return true;

            const matchName = resource.name.toLowerCase().includes(query);
            const matchDescription = (resource.description || '').toLowerCase().includes(query);
            const matchTag = resource.tags?.some((tag) => tag.toLowerCase().includes(query));
            const matchCategory = resource.subCategory?.toLowerCase().includes(query);
            return matchName || matchDescription || matchTag || matchCategory;
        });
    }, [combined, favorites, search, searchRadius, showFavoritesOnly, user, userLocation]);

    useEffect(() => {
        const sourceLocations = (cachedLocations.length > 0 ? cachedLocations : derivedMapLocations).filter(hasValidCoordinates);
        if (!workerRef.current || sourceLocations.length === 0) return;

        workerRef.current.postMessage({
            locations: sourceLocations,
            userLocation,
            radiusInMeters: searchRadius < 100 ? searchRadius * 1000 : Infinity,
        });
    }, [cachedLocations, derivedMapLocations, searchRadius, userLocation]);

    const finalMapLocations = useMemo(() => {
        let items = (mapLocations.length > 0 ? mapLocations : derivedMapLocations).filter(hasValidCoordinates);

        if (showFavoritesOnly && user) {
            items = items.filter((resource) => favorites.some((favorite) => favorite.resourceId === resource.id && favorite.resourceType === resource.asset_type));
        }

        if (search) {
            const query = search.toLowerCase();
            items = items.filter((resource) => (
                (resource.title || '').toLowerCase().includes(query)
                || (resource.category || '').toLowerCase().includes(query)
            ));
        }

        return items;
    }, [derivedMapLocations, favorites, mapLocations, search, showFavoritesOnly, user]);

    const enrichedMapLocations = useMemo(() => (
        finalMapLocations.map((location) => {
            const asset = assetLookup.get(`${location.asset_type}-${location.id}`);
            return {
                ...location,
                asset: asset || {
                    id: location.id,
                    name: location.title,
                    subCategory: location.category,
                    logoUrl: null,
                    _type: location.asset_type,
                },
            };
        })
    ), [assetLookup, finalMapLocations]);

    const handleSelect = useCallback((asset, preferredLocation = null) => {
        if (!asset) {
            setSelectedMarkerKey(null);
            setSelectedAsset(null);
            return;
        }

        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        const displayLocation = preferredLocation || normalizedAsset._displayLocation || getBestLocation(normalizedAsset, userLocation);
        const lat = normalizedAsset._type === 'hard'
            ? parseFloat(normalizedAsset.lat)
            : parseFloat(displayLocation?.lat);
        const lng = normalizedAsset._type === 'hard'
            ? parseFloat(normalizedAsset.lng)
            : parseFloat(displayLocation?.lng);

        setSelectedAsset({
            ...normalizedAsset,
            _displayLocation: displayLocation || normalizedAsset._displayLocation || null,
        });
        setSelectedMarkerKey(buildMarkerKey({
            asset_type: normalizedAsset._type,
            id: normalizedAsset.id,
            locationId: displayLocation?.id || normalizedAsset.locationId,
            lat,
            lng,
        }));

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 15 : searchRadius <= 2 ? 14 : 13;
            setFlyTarget({ lat, lng, zoom });
            setActiveTooltipKey(null);
        }

        const element = document.getElementById(`asset-card-${normalizedAsset._type}-${normalizedAsset.id}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchRadius, setFlyTarget, userLocation]);

    const handleMapSelect = useCallback((asset, preferredLocation = null) => {
        handleSelect(asset, preferredLocation);
    }, [handleSelect]);

    const handleOpenResourcePage = useCallback((asset) => {
        if (!asset) return;
        navigate(`/resource/${asset._type}/${asset.id}`);
    }, [navigate]);

    const handleMapDetailAction = useCallback((asset, preferredLocation = null) => {
        if (!asset) return;

        if (isDesktop) {
            handleSelect(asset, preferredLocation);
            return;
        }

        const normalizedAsset = asset._type ? asset : { ...asset, _type: asset.asset_type };
        navigate(`/resource/${normalizedAsset._type}/${normalizedAsset.id}`);
    }, [handleSelect, isDesktop, navigate]);

    const filterPanel = (
        <DiscoveryFilterPanel
            activeTab={activeTab}
            clearLocationSearch={clearLocationSearch}
            handleLocateMe={handleLocateMe}
            handlePostalSearch={handlePostalSearch}
            isGeocoding={isGeocoding}
            locationNotice={locationNotice}
            onSearchChange={setSearch}
            postalInput={postalInput}
            search={search}
            searchOrigin={searchOrigin}
            searchRadius={searchRadius}
            setActiveTab={setActiveTab}
            setPostalInput={setPostalInput}
            setSearchRadius={setSearchRadius}
            setShowFavoritesOnly={setShowFavoritesOnly}
            showFavoritesOnly={showFavoritesOnly}
            user={user}
            userLocation={userLocation}
        />
    );

    const resultsList = (
        <DiscoveryResultsList
            favorites={favorites}
            filtered={filtered}
            loading={loading}
            onCategoryClick={setSearch}
            onSelectAsset={handleSelect}
            onTagClick={setSearch}
            onToggleFavorite={handleToggleFavorite}
            selectedAsset={selectedAsset}
            subCatColors={subCatColors}
            user={user}
        />
    );

    const mapView = (
        <div className="relative h-full w-full">
            <DiscoveryMap
                activeTooltipKey={activeTooltipKey}
                bottomOffsetPx={drawerOffsetPx}
                enrichedMapLocations={enrichedMapLocations}
                flyTarget={flyTarget}
                isFavorite={isFavorite}
                onKeepTooltipOpen={keepTooltipOpen}
                onScheduleTooltipClose={scheduleTooltipClose}
                onSelectAsset={handleMapSelect}
                onToggleFavorite={handleToggleFavorite}
                onViewDetails={handleMapDetailAction}
                selectedMarkerKey={selectedMarkerKey}
                subCatColors={subCatColors}
                user={user}
                userLocation={userLocation}
            />
            {isDesktop && (
                <DiscoveryInspector
                    asset={selectedAsset}
                    isFavorite={selectedAsset ? isFavorite(selectedAsset.id, selectedAsset._type) : false}
                    onClose={() => handleSelect(null)}
                    onOpenResourcePage={handleOpenResourcePage}
                    onTagClick={setSearch}
                    onToggleFavorite={handleToggleFavorite}
                    subCatColors={subCatColors}
                    user={user}
                    userLocation={userLocation}
                />
            )}
        </div>
    );

    return (
        <div
            className="relative flex flex-col h-[calc(100vh-4rem)] overflow-hidden"
            style={{ background: 'var(--page-gradient)' }}
        >
            <div className="hidden lg:flex flex-1 w-full h-full relative">
                <div
                    className="flex-shrink-0 h-full z-20 overflow-hidden flex flex-col"
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
                    className={`w-2 h-full absolute cursor-col-resize z-30 transition-colors ${isDragging ? 'bg-brand-500 opacity-60' : 'hover:bg-brand-300 hover:opacity-60'}`}
                    onMouseDown={startDragging}
                    style={{ left: `${listWidth - 4}px` }}
                />

                <div className="flex-1 w-full h-full relative z-0">
                    {mapView}
                </div>
            </div>

            <div className="flex lg:hidden flex-1 w-full h-full relative">
                <div className="absolute inset-0 w-full h-full z-0">
                    {mapView}
                </div>

                {!isDrawerOpen && (
                    <button
                        onClick={() => setIsDrawerOpen(true)}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] text-white px-6 py-3 min-h-[48px] rounded-full shadow-lg font-bold flex items-center gap-2 transition-all active:scale-95"
                        style={{
                            background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)',
                            boxShadow: '0 18px 36px rgba(15, 163, 154, 0.28)',
                        }}
                    >
                        <Search size={18} /> Browse Directory
                    </button>
                )}

                <Drawer.Root
                    open={isDrawerOpen}
                    onOpenChange={setIsDrawerOpen}
                    snapPoints={[0.55, 0.92]}
                    activeSnapPoint={activeSnap}
                    setActiveSnapPoint={setActiveSnap}
                    modal={false}
                >
                    <Drawer.Portal>
                        <Drawer.Content
                            className="fixed flex flex-col rounded-t-[24px] h-full max-h-[96%] mt-24 bottom-0 left-0 right-0 z-[501]"
                            style={{
                                backgroundColor: 'var(--color-drawer-bg)',
                                boxShadow: '0 -18px 42px rgba(15, 89, 91, 0.18)',
                                borderTop: '1px solid var(--color-border)',
                                backdropFilter: 'blur(18px)',
                            }}
                        >
                            <VisuallyHidden><Drawer.Title>Directory List</Drawer.Title></VisuallyHidden>
                            <div className="flex justify-center py-2">
                                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />
                            </div>
                            {filterPanel}
                            {resultsList}
                        </Drawer.Content>
                    </Drawer.Portal>
                </Drawer.Root>
            </div>

            {loading && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
                    <div className="card flex flex-col items-center gap-4 p-8" style={{ border: '2px solid var(--color-border)' }}>
                        <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-brand)' }} />
                        <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>Loading Directory…</p>
                    </div>
                </div>
            )}
        </div>
    );
}
