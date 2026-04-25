import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchOneMap } from '../../lib/geo.js';
import {
    clearSearchLocation,
    GEOLOCATION_OPTIONS,
    saveSearchLocation,
} from '../../lib/searchLocation.js';

function normalizePostalCode(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function isValidPostalCode(value) {
    return /^\d{6}$/.test(value);
}

function resolveLocalPostalMatch(hardAssets, postalCode) {
    const localMatch = hardAssets.find((asset) => asset.postalCode === postalCode);
    if (!localMatch) return null;

    const lat = Number.parseFloat(localMatch.lat);
    const lng = Number.parseFloat(localMatch.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        lat,
        lng,
        address: localMatch.address || '',
    };
}

function buildSearchOrigin({ address, lat, lng, postalCode = '', source }) {
    return {
        lat,
        lng,
        source,
        postalCode,
        address: address || (postalCode ? `Postal code ${postalCode}` : ''),
        updatedAt: Date.now(),
    };
}

function getAnchorZoom(searchRadius, fallback = 15) {
    if (searchRadius <= 0.3) return 17;
    if (searchRadius <= 1) return 16;
    return fallback;
}

export function useDiscoveryLocation(hardAssets = [], homePostalCodeValue = '') {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const urlPostal = normalizePostalCode(searchParams.get('postal'));
    const isValidUrlPostal = isValidPostalCode(urlPostal);
    const homePostalCode = normalizePostalCode(homePostalCodeValue);
    const hasHomePostalCode = isValidPostalCode(homePostalCode);

    const [userLocation, setUserLocation] = useState(null);
    const [searchRadius, setSearchRadius] = useState(100);
    const [postalInput, setPostalInput] = useState(() => (isValidUrlPostal ? urlPostal : ''));
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [searchOrigin, setSearchOrigin] = useState(null);
    const [locationNotice, setLocationNotice] = useState(null);
    const geolocationRequestRef = useRef(0);
    const initializedUrlPostalRef = useRef('');
    const latestLocationStateRef = useRef({
        userLocation: null,
        searchOrigin: null,
    });

    useEffect(() => {
        latestLocationStateRef.current = { userLocation, searchOrigin };
    }, [userLocation, searchOrigin]);

    const resolvePostalLocation = useCallback(async (postalCode) => {
        const localMatch = resolveLocalPostalMatch(hardAssets, postalCode);
        return localMatch || await searchOneMap(postalCode);
    }, [hardAssets]);

    const clearLocationSearch = useCallback(() => {
        geolocationRequestRef.current = Date.now();
        setUserLocation(null);
        setSearchOrigin(null);
        setPostalInput('');
        setLocationNotice(null);
        setFlyTarget(null);
        latestLocationStateRef.current = { userLocation: null, searchOrigin: null };
        clearSearchLocation();
    }, []);

    const handleHomeAnchor = useCallback(async ({ focusMap = true } = {}) => {
        if (!hasHomePostalCode) return false;

        setIsGeocoding(true);
        setLocationNotice(null);

        try {
            const result = await resolvePostalLocation(homePostalCode);
            if (!result) {
                setLocationNotice({
                    type: 'error',
                    message: `Home postal code ${homePostalCode} could not be located.`,
                });
                return false;
            }

            const nextOrigin = buildSearchOrigin({
                lat: result.lat,
                lng: result.lng,
                address: result.address,
                postalCode: homePostalCode,
                source: 'home',
            });
            const loc = { lat: nextOrigin.lat, lng: nextOrigin.lng };

            setUserLocation(loc);
            setSearchOrigin(nextOrigin);
            setLocationNotice(null);
            setPostalInput('');
            latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };

            if (focusMap) {
                setFlyTarget({
                    ...loc,
                    zoom: getAnchorZoom(searchRadius, 15),
                    source: 'home',
                });
            }

            return true;
        } finally {
            setIsGeocoding(false);
        }
    }, [hasHomePostalCode, homePostalCode, resolvePostalLocation, searchRadius]);

    // Handle URL-driven landing exactly once per URL postal value.
    useEffect(() => {
        if (!isValidUrlPostal || searchOrigin || initializedUrlPostalRef.current === urlPostal) return;
        initializedUrlPostalRef.current = urlPostal;

        async function resolveUrlPostal() {
            setIsGeocoding(true);
            try {
                const result = await resolvePostalLocation(urlPostal);
                if (result) {
                    const nextOrigin = buildSearchOrigin({
                        lat: result.lat,
                        lng: result.lng,
                        address: result.address,
                        postalCode: urlPostal,
                        source: 'postal',
                    });
                    const loc = { lat: nextOrigin.lat, lng: nextOrigin.lng };

                    setUserLocation(loc);
                    setSearchOrigin(nextOrigin);
                    setLocationNotice(null);
                    latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };

                    const zoom = searchRadius <= 0.3 ? 17 : 16;
                    setFlyTarget({ ...loc, zoom, source: 'postal' });
                } else {
                    setLocationNotice({
                        type: 'error',
                        message: `Postal code ${urlPostal} could not be located.`,
                    });
                }
            } finally {
                setIsGeocoding(false);
            }
        }
        resolveUrlPostal();
    }, [isValidUrlPostal, resolvePostalLocation, searchOrigin, searchRadius, urlPostal]);

    // Default discovery anchor: Home postal code from profile when available.
    useEffect(() => {
        if (isValidUrlPostal || !hasHomePostalCode) return;

        const shouldApplyHome =
            !searchOrigin
            || (searchOrigin.source === 'home' && searchOrigin.postalCode !== homePostalCode);

        if (!shouldApplyHome) return;

        void handleHomeAnchor({ focusMap: false });
    }, [handleHomeAnchor, hasHomePostalCode, homePostalCode, isValidUrlPostal, searchOrigin]);

    const runLocateMe = useCallback((options = {}) => {
        const { silent = false } = options;

        if (!navigator.geolocation) {
            if (!silent) {
                setLocationNotice({ type: 'error', message: 'Geolocation is not supported in this browser.' });
            }
            return;
        }

        if (!silent) {
            setLocationNotice(null);
        }
        const requestId = Date.now();
        geolocationRequestRef.current = requestId;
        let resolved = false;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (geolocationRequestRef.current !== requestId) return;
                resolved = true;
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const nextOrigin = { ...loc, source: 'geolocation', updatedAt: Date.now(), restored: false };
                setUserLocation(loc);
                setSearchOrigin(nextOrigin);
                setPostalInput('');
                setLocationNotice(null);
                latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };
                saveSearchLocation(nextOrigin);
                
                // Neighborhood zoom (at least zoom 16 for Locate Me)
                const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : 16;
                setFlyTarget({ ...loc, zoom, source: 'geolocation' });
            },
            (error) => {
                if (geolocationRequestRef.current !== requestId || resolved) return;
                const latestLocationState = latestLocationStateRef.current;
                const hasActiveGeolocation = !!latestLocationState.userLocation && latestLocationState.searchOrigin?.source === 'geolocation';
                if (hasActiveGeolocation) {
                    setLocationNotice(null);
                    return;
                }

                if (silent) {
                    return;
                }

                const message = error?.code === 1
                    ? 'Location access was blocked. Enable it in your browser to sort by nearest results.'
                    : error?.code === 3
                        ? 'Location lookup timed out. Please try again.'
                        : 'Unable to retrieve your location right now.';

                setLocationNotice({ type: 'error', message });
            },
            GEOLOCATION_OPTIONS,
        );
    }, [searchRadius]);

    const handleLocateMe = useCallback(() => {
        runLocateMe({ silent: false });
    }, [runLocateMe]);

    const handlePostalSearch = useCallback(async (e) => {
        e.preventDefault();
        const val = postalInput.trim();
        if (!/^\d{6}$/.test(val)) {
            setLocationNotice({ type: 'error', message: 'Enter a valid 6-digit Singapore postal code.' });
            return;
        }

        setIsGeocoding(true);
        setLocationNotice(null);
        try {
            const result = await resolvePostalLocation(val);
            if (!result) {
                setLocationNotice({ type: 'error', message: `Postal code ${val} could not be located.` });
                return;
            }

            const nextOrigin = buildSearchOrigin({
                lat: result.lat,
                lng: result.lng,
                address: result.address,
                postalCode: val,
                source: 'postal',
            });
            const loc = { lat: nextOrigin.lat, lng: nextOrigin.lng };

            setUserLocation(loc);
            setSearchOrigin(nextOrigin);
            setLocationNotice(null);
            latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };
            saveSearchLocation(nextOrigin);

            const zoom = getAnchorZoom(searchRadius, 15);
            setFlyTarget({ lat: nextOrigin.lat, lng: nextOrigin.lng, zoom, source: 'postal' });
        } finally {
            setIsGeocoding(false);
        }
    }, [postalInput, resolvePostalLocation, searchRadius]);

    const effectiveOrigin = useMemo(() => searchOrigin || null, [searchOrigin]);
    const effectiveUserLocation = useMemo(() => (
        effectiveOrigin
            ? { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng }
            : null
    ), [effectiveOrigin?.lat, effectiveOrigin?.lng]);

    return {
        effectiveOrigin,
        effectiveUserLocation,
        flyTarget,
        handleHomeAnchor,
        handleLocateMe,
        handlePostalSearch,
        hasHomePostalCode,
        homePostalCode,
        isGeocoding,
        locationNotice,
        postalInput,
        searchOrigin,
        searchRadius,
        setFlyTarget,
        setPostalInput,
        setSearchOrigin,
        setSearchRadius,
        userLocation,
        clearLocationSearch,
    };
}
