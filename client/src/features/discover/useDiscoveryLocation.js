import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchOneMap } from '../../lib/geo.js';
import {
    clearSearchLocation,
    GEOLOCATION_OPTIONS,
    loadSearchLocation,
    saveSearchLocation,
} from '../../lib/searchLocation.js';

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

export function useDiscoveryLocation(hardAssets = [], userPostalCode = '') {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const urlPostal = searchParams.get('postal');
    const isValidUrlPostal = /^\d{6}$/.test(urlPostal || '');

    const storedSearchLocationRef = useRef(loadSearchLocation());
    const [userLocation, setUserLocation] = useState(() => {
        if (isValidUrlPostal) return null; // Wait for geocoding to resolve the URL postal
        const stored = storedSearchLocationRef.current;
        return stored ? { lat: stored.lat, lng: stored.lng } : null;
    });
    const [searchRadius, setSearchRadius] = useState(100);
    const [postalInput, setPostalInput] = useState(() => {
        if (isValidUrlPostal) return urlPostal;
        return storedSearchLocationRef.current?.source === 'postal' ? storedSearchLocationRef.current.postalCode : '';
    });
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [searchOrigin, setSearchOrigin] = useState(() => {
        if (isValidUrlPostal) return null; // We'll trigger a search for this in an effect
        return storedSearchLocationRef.current;
    });
    const [locationNotice, setLocationNotice] = useState(null);
    const [homeOrigin, setHomeOrigin] = useState(null);
    const [isResolvingHome, setIsResolvingHome] = useState(false);
    const geolocationRequestRef = useRef(0);
    const normalizedHomePostalCode = String(userPostalCode || '').trim();
    const latestLocationStateRef = useRef({
        userLocation: isValidUrlPostal ? null : (storedSearchLocationRef.current ? { lat: storedSearchLocationRef.current.lat, lng: storedSearchLocationRef.current.lng } : null),
        searchOrigin: isValidUrlPostal ? null : storedSearchLocationRef.current,
    });

    useEffect(() => {
        latestLocationStateRef.current = { userLocation, searchOrigin };
    }, [userLocation, searchOrigin]);

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

    // Handle initial mount with URL postal
    const initializedRef = useRef(false);
    useEffect(() => {
        if (initializedRef.current || !isValidUrlPostal || hardAssets.length === 0) return;
        initializedRef.current = true;

        async function resolveUrlPostal() {
            setIsGeocoding(true);
            try {
                const localMatch = resolveLocalPostalMatch(hardAssets, urlPostal);
                const result = localMatch || await searchOneMap(urlPostal);
                if (result) {
                    const loc = { lat: result.lat, lng: result.lng };
                    const nextOrigin = { ...loc, source: 'postal', postalCode: urlPostal, address: result.address || `Postal code ${urlPostal}`, updatedAt: Date.now() };
                    setUserLocation(loc);
                    setSearchOrigin(nextOrigin);
                    latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };
                    // Set neighborhood zoom for URL-based landing
                    const zoom = searchRadius <= 0.3 ? 17 : 16;
                    setFlyTarget({ ...loc, zoom, source: 'postal' });
                }
            } finally {
                setIsGeocoding(false);
            }
        }
        resolveUrlPostal();
    }, [hardAssets, isValidUrlPostal, urlPostal, searchRadius]);

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

    useEffect(() => {
        let cancelled = false;

        async function resolveHomeOrigin() {
            if (!/^\d{6}$/.test(normalizedHomePostalCode)) {
                setHomeOrigin(null);
                return;
            }

            if (homeOrigin?.postalCode === normalizedHomePostalCode) {
                return;
            }

            setIsResolvingHome(true);

            try {
                const localResult = resolveLocalPostalMatch(hardAssets, normalizedHomePostalCode);
                const result = localResult || await searchOneMap(normalizedHomePostalCode);

                if (cancelled) return;

                if (!result) {
                    setHomeOrigin(null);
                    return;
                }

                setHomeOrigin({
                    lat: result.lat,
                    lng: result.lng,
                    source: 'home',
                    postalCode: normalizedHomePostalCode,
                    address: result.address || `Postal code ${normalizedHomePostalCode}`,
                    restored: false,
                });
            } finally {
                if (!cancelled) {
                    setIsResolvingHome(false);
                }
            }
        }

        resolveHomeOrigin();

        return () => {
            cancelled = true;
        };
    }, [hardAssets, homeOrigin?.postalCode, normalizedHomePostalCode]);

    const handlePostalSearch = useCallback(async (e) => {
        e.preventDefault();
        const val = postalInput.trim();
        if (!/^\d{6}$/.test(val)) {
            setLocationNotice({ type: 'error', message: 'Enter a valid 6-digit Singapore postal code.' });
            return;
        }

        setIsGeocoding(true);
        setLocationNotice(null);

        let result = null;
        let address = '';

        const localMatch = resolveLocalPostalMatch(hardAssets, val);
        if (localMatch) {
            result = localMatch;
            address = localMatch.address || '';
        } else {
            result = await searchOneMap(val);
            address = result?.address || '';
        }

        setIsGeocoding(false);
        if (!result) {
            setLocationNotice({ type: 'error', message: `Postal code ${val} could not be located.` });
            return;
        }

        const loc = { lat: result.lat, lng: result.lng };
        const nextOrigin = { ...loc, source: 'postal', postalCode: val, address, updatedAt: Date.now() };
        setUserLocation(loc);
        setSearchOrigin(nextOrigin);
        setLocationNotice(null);
        latestLocationStateRef.current = { userLocation: loc, searchOrigin: nextOrigin };
        saveSearchLocation(nextOrigin);
        
        // Neighborhood zoom (at least zoom 15 for search)
        const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 16 : 15;
        setFlyTarget({ lat: result.lat, lng: result.lng, zoom, source: 'postal' });
    }, [postalInput, searchRadius, hardAssets]);

    const effectiveOrigin = useMemo(
        () => searchOrigin || homeOrigin || null,
        [homeOrigin, searchOrigin]
    );
    const effectiveUserLocation = useMemo(() => (
        effectiveOrigin
            ? { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng }
            : null
    ), [effectiveOrigin?.lat, effectiveOrigin?.lng]);

    return {
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
        setSearchOrigin,
        setSearchRadius,
        userLocation,
        clearLocationSearch,
    };
}
