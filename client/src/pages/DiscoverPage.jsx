import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Drawer } from 'vaul';

import { api } from '../lib/api.js';
import { getDistance } from '../lib/geo.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useSplitPaneResize } from '../hooks/useSplitPaneResize.js';
import DiscoveryFilterPanel from '../features/discover/DiscoveryFilterPanel.jsx';
import DesktopSavedPlaceDetailPanel from '../features/discover/DesktopSavedPlaceDetailPanel.jsx';
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

function createFocusRequestIdGenerator() {
    let current = 0;
    return () => {
        current += 1;
        return current;
    };
}

const nextFocusRequestId = createFocusRequestIdGenerator();
const SAVED_PIN_FOCUS_ZOOM = 18;
const MOBILE_PIN_DRAWER_MAX_WIDTH = 360;
const MOBILE_PIN_DRAWER_WIDTH_RATIO = 0.8;
const MOBILE_PIN_DRAWER_POINTER_SIZE = 26;
const MOBILE_PIN_DRAWER_POINTER_VERTICAL_RATIO = 0.62;
const MOBILE_PIN_DRAWER_POINTER_GAP = 6;
const MOBILE_PIN_VISUAL_CENTER_OFFSET_X = 2;
const MOBILE_PIN_VISUAL_CENTER_OFFSET_Y = 22;
const MOBILE_PIN_POINTER_LIFT_Y = 8;

export default function DiscoverPage() {
    const [subCatColors, setSubCatColors] = useState({});
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [desktopPaneMode, setDesktopPaneMode] = useState('browse');
    const [selectedPlacePinKey, setSelectedPlacePinKey] = useState(null);
    const [hoveredPinKeys, setHoveredPinKeys] = useState([]);
    const [hoveredPrimaryPinKey, setHoveredPrimaryPinKey] = useState(null);
    const [hoveredMapPinKey, setHoveredMapPinKey] = useState(null);
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
    const [mobileMapViewport, setMobileMapViewport] = useState(null);

    const navigate = useNavigate();
    const resultsListRef = useRef(null);
    const lastBrowseScrollTopRef = useRef(0);
    const mobileMapViewportRef = useRef(null);
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

    useEffect(() => {
        if (!flyTarget) return;
        setMapFocusRequest({
            kind: 'single-pin',
            requestId: nextFocusRequestId(),
            lat: flyTarget.lat,
            lng: flyTarget.lng,
            zoom: flyTarget.zoom,
        });
        setFlyTarget(null);
    }, [flyTarget, setFlyTarget]);

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
    const selectedPlacePin = useMemo(
        () => (selectedPlacePinKey ? savedPlacePinLookup.get(selectedPlacePinKey) || null : null),
        [selectedPlacePinKey, savedPlacePinLookup]
    );
    const savedMapAssetKeys = useMemo(
        () => new Set(savedPlacePinData.contributingAssetKeys),
        [savedPlacePinData.contributingAssetKeys]
    );
    const hasSavedMapPins = savedPlacePins.length > 0;
    const savedAssetCount = savedAssets.length;
    const unmappableSavedCount = savedPlacePinData.unmappableSavedAssetKeys.size;

    const hasTransientFocusPins = transientPlacePins.length > 0;

    useEffect(() => {
        if (!isDesktop && !hasSavedMapPins && !hasTransientFocusPins && mobileMode === 'map') {
            setMobileMode('browse');
        }
    }, [hasSavedMapPins, hasTransientFocusPins, isDesktop, mobileMode]);

    useEffect(() => {
        if (isDesktop || mobileMode !== 'map') {
            setMobileBrowseDrawerOpen(false);
        }
    }, [isDesktop, mobileMode]);

    useEffect(() => {
        if (isDesktop || mobileMode !== 'map') {
            setMobileMapViewport(null);
            return undefined;
        }

        const node = mobileMapViewportRef.current;
        if (!node) return undefined;

        const updateViewport = () => {
            const rect = node.getBoundingClientRect();
            setMobileMapViewport({
                top: rect.top,
                height: rect.height,
                width: rect.width,
            });
        };

        updateViewport();

        const resizeObserver = new ResizeObserver(updateViewport);
        resizeObserver.observe(node);
        window.addEventListener('resize', updateViewport);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', updateViewport);
        };
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

    const mobileDetailDrawerWidth = useMemo(() => (
        typeof window !== 'undefined'
            ? Math.min(Math.round(window.innerWidth * MOBILE_PIN_DRAWER_WIDTH_RATIO), MOBILE_PIN_DRAWER_MAX_WIDTH)
            : 320
    ), []);

    const mobileDetailGeometry = useMemo(() => {
        const drawerTop = typeof window !== 'undefined' && window.innerWidth >= 640 ? 64 : 56;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
        const mapTop = mobileMapViewport?.top ?? drawerTop;
        const mapHeight = mobileMapViewport?.height ?? Math.max(320, (typeof window !== 'undefined' ? window.innerHeight : 844) - drawerTop);
        const mapCenterY = mapTop + (mapHeight / 2);
        const pointerTargetY = mapTop + (mapHeight * MOBILE_PIN_DRAWER_POINTER_VERTICAL_RATIO);
        const pointerTargetX = Math.min(
            viewportWidth - 28,
            mobileDetailDrawerWidth + MOBILE_PIN_DRAWER_POINTER_SIZE + MOBILE_PIN_DRAWER_POINTER_GAP
        );

        return {
            offsetX: Math.round((pointerTargetX + MOBILE_PIN_VISUAL_CENTER_OFFSET_X) - (viewportWidth / 2)),
            offsetY: Math.round((pointerTargetY + MOBILE_PIN_VISUAL_CENTER_OFFSET_Y) - mapCenterY),
            pointerTopPx: Math.round(pointerTargetY - drawerTop - MOBILE_PIN_POINTER_LIFT_Y),
        };
    }, [mobileDetailDrawerWidth, mobileMapViewport]);

    const getMobilePinDrawerOffset = useCallback(() => {
        return {
            x: mobileDetailGeometry.offsetX,
            y: mobileDetailGeometry.offsetY,
        };
    }, [mobileDetailGeometry]);

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
        savedPlacePins,
        source,
    }), [savedPlacePins]);

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
                if (!userLocation) return 0;
                const leftDistance = getDistance(
                    userLocation.lat,
                    userLocation.lng,
                    Number.parseFloat(left.lat),
                    Number.parseFloat(left.lng),
                );
                const rightDistance = getDistance(
                    userLocation.lat,
                    userLocation.lng,
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
    }, [userLocation, visibleHardAssetLookup]);

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
        const pinKeys = resolveSavedPinKeysForAsset(asset);

        if (!isDesktop) {
            setMobileMode('map');
        }

        clearHoveredCardState();
        setHoveredMapPinKey(null);
        setDesktopPaneMode('browse');
        setSelectedPlacePinKey(null);
        if (pinKeys.length) {
            const primaryPin = resolveSavedPinForAsset(asset);
            if (!primaryPin) return;

            clearTransientFocusState();
            setLockedAssetKey(buildSavedAssetKey(asset._type, asset.id));
            setLockedPinKeys(pinKeys);
            setLockedPrimaryPinKey(primaryPin.pinKey);

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

        const { assetKey, pins, primaryPinKey } = buildTransientPlacePinsForAsset(asset);
        if (!pins.length) return;

        clearLockedCardState();
        setTransientFocusAssetKey(assetKey);
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
        createPinGroupFocusRequest,
        createSinglePinFocusRequest,
        isDesktop,
        resolveSavedPinForAsset,
        resolveSavedPinKeysForAsset,
    ]);

    const handleMapPinSelect = useCallback((pin) => {
        clearHoveredCardState();
        clearTransientFocusState();
        setHoveredMapPinKey(pin.pinKey);
        setSelectedPlacePinKey(pin.pinKey);

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
        setMapFocusRequest(createSinglePinFocusRequest(pin, 'pin-click', { offsetPx: getMobilePinDrawerOffset() }));
    }, [
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        createSinglePinFocusRequest,
        desktopPaneMode,
        getMobilePinDrawerOffset,
        isDesktop,
        saveBrowseScrollPosition,
    ]);

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
    }, [
        clearHoveredCardState,
        clearLockedCardState,
        clearTransientFocusState,
        handleCloseMobileDetail,
        selectedPlacePinKey,
    ]);

    const handleMapHoverStart = useCallback((pinKey) => {
        if (!isDesktop || lockedPrimaryPinKey) return;
        if (desktopPaneMode !== 'detail') {
            saveBrowseScrollPosition();
        }
        setHoveredMapPinKey(pinKey);
        setSelectedPlacePinKey(pinKey);
        setDesktopPaneMode('detail');
    }, [desktopPaneMode, isDesktop, lockedPrimaryPinKey, saveBrowseScrollPosition]);

    const handleMapHoverEnd = useCallback((pinKey) => {
        if (lockedPrimaryPinKey) return;
        setHoveredMapPinKey((current) => (current === pinKey ? null : current));
        setSelectedPlacePinKey((current) => (current === pinKey ? null : current));
        setDesktopPaneMode((current) => (current === 'detail' ? 'browse' : current));
    }, [lockedPrimaryPinKey]);

    const activeRelatedPinKeys = hoveredPinKeys.length ? hoveredPinKeys : lockedPinKeys;
    const activePrimaryPinKey = hoveredPrimaryPinKey || lockedPrimaryPinKey;

    const pinEmphasisByKey = useMemo(() => {
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

    const selectedBrowseAssetKey = desktopPaneMode === 'browse' ? lockedAssetKey : null;

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
            hasSavedAssets={savedAssetCount > 0}
            isAuthenticated={isAuth}
            onBrowse={!isDesktop ? () => setMobileMode('browse') : undefined}
            unmappableCount={unmappableSavedCount}
        />
    );

    const hasRenderableMapPins = hasSavedMapPins || hasTransientFocusPins;

    const mapView = hasRenderableMapPins ? (
        <div className="relative h-full w-full">
            <DiscoveryMap
                focusRequest={mapFocusRequest}
                interactionMode={isDesktop ? 'desktop' : 'mobile'}
                onBackgroundClick={isDesktop ? handleMapBackgroundClick : handleMobileMapBackgroundClick}
                onMapHoverEnd={handleMapHoverEnd}
                onMapHoverStart={handleMapHoverStart}
                onSelectPin={handleMapPinSelect}
                pinEmphasisByKey={pinEmphasisByKey}
                savedPlacePins={savedPlacePins}
                transientPlacePins={transientPlacePins}
                userLocation={userLocation}
            />
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
            onOpenMobileBrowseDrawer={() => setMobileBrowseDrawerOpen(true)}
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
            userLocation={userLocation}
        />
    ) : (
        <>
            {filterPanel}
            {resultsList}
        </>
    );

    const mobileBrowseDrawer = !isDesktop && mobileMode === 'map' ? (
        <Drawer.Root direction="left" open={mobileBrowseDrawerOpen} onOpenChange={setMobileBrowseDrawerOpen}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[580] bg-slate-950/35" />
                <Drawer.Content
                    className="fixed bottom-0 left-0 top-[56px] z-[590] flex w-[min(88vw,380px)] flex-col border-r bg-white shadow-2xl sm:top-[64px]"
                    style={{
                        borderColor: 'var(--color-border)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,252,251,0.96) 100%)',
                    }}
                >
                    <Drawer.Title className="sr-only">Browse results</Drawer.Title>
                    <Drawer.Description className="sr-only">
                        Review discover results while keeping the saved map visible.
                    </Drawer.Description>
                    <div
                        className="flex items-center justify-between gap-3 border-b px-4 py-3"
                        style={{ borderColor: 'var(--color-border)' }}
                    >
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-brand)' }}>
                                Browse Results
                            </p>
                            <p className="truncate text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                Showing {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileBrowseDrawerOpen(false);
                                    setMobileMode('browse');
                                }}
                                className="btn-ghost px-3 py-2 text-xs whitespace-nowrap"
                            >
                                Full browse
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileBrowseDrawerOpen(false)}
                                aria-label="Close browse drawer"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-600"
                                style={{ borderColor: 'var(--color-border)' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {resultsList}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    ) : null;

    const mobileDetailDrawer = !isDesktop && mobileMode === 'map' && selectedPlacePin ? (
        <Drawer.Root
            direction="left"
            open={Boolean(selectedPlacePin)}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    handleCloseMobileDetail();
                }
            }}
        >
            <Drawer.Portal>
                <Drawer.Content
                    className="fixed bottom-0 left-0 top-[56px] z-[600] flex flex-col overflow-visible border-r bg-white shadow-2xl sm:top-[64px]"
                    style={{
                        width: `${mobileDetailDrawerWidth}px`,
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
                    <div
                        className="pointer-events-none absolute z-[610] -translate-y-1/2 drop-shadow-[10px_0_18px_rgba(15,89,91,0.08)]"
                        style={{
                            top: `${mobileDetailGeometry.pointerTopPx}px`,
                            right: `-${MOBILE_PIN_DRAWER_POINTER_SIZE - 1}px`,
                            width: `${MOBILE_PIN_DRAWER_POINTER_SIZE}px`,
                            height: `${MOBILE_PIN_DRAWER_POINTER_SIZE * 2}px`,
                            backgroundColor: 'rgba(246, 252, 251, 0.97)',
                            clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                            borderTop: '1px solid var(--color-border)',
                            borderRight: '1px solid var(--color-border)',
                            borderBottom: '1px solid var(--color-border)',
                        }}
                    />
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <DesktopSavedPlaceDetailPanel
                            onBack={handleCloseMobileDetail}
                            paneWidth={mobileDetailDrawerWidth}
                            pin={selectedPlacePin}
                            subCatColors={subCatColors}
                            userLocation={userLocation}
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
                <div ref={mobileMapViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
