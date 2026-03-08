import { useCallback, useEffect, useRef, useState } from 'react';
import { searchOneMap } from '../../lib/geo.js';
import {
    clearSearchLocation,
    GEOLOCATION_OPTIONS,
    loadSearchLocation,
    saveSearchLocation,
} from '../../lib/searchLocation.js';

export function useDiscoveryLocation(hardAssets = []) {
    const storedSearchLocationRef = useRef(loadSearchLocation());
    const [userLocation, setUserLocation] = useState(() => {
        const stored = storedSearchLocationRef.current;
        return stored ? { lat: stored.lat, lng: stored.lng } : null;
    });
    const [searchRadius, setSearchRadius] = useState(100);
    const [postalInput, setPostalInput] = useState(() => (
        storedSearchLocationRef.current?.source === 'postal' ? storedSearchLocationRef.current.postalCode : ''
    ));
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [searchOrigin, setSearchOrigin] = useState(storedSearchLocationRef.current);
    const [locationNotice, setLocationNotice] = useState(null);
    const geolocationRequestRef = useRef(0);
    const latestLocationStateRef = useRef({
        userLocation: storedSearchLocationRef.current ? { lat: storedSearchLocationRef.current.lat, lng: storedSearchLocationRef.current.lng } : null,
        searchOrigin: storedSearchLocationRef.current,
    });

    useEffect(() => {
        latestLocationStateRef.current = { userLocation, searchOrigin };
    }, [userLocation, searchOrigin]);

    const clearLocationSearch = useCallback(() => {
        setUserLocation(null);
        setSearchOrigin(null);
        setPostalInput('');
        setLocationNotice(null);
        latestLocationStateRef.current = { userLocation: null, searchOrigin: null };
        clearSearchLocation();
    }, []);

    const handleLocateMe = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationNotice({ type: 'error', message: 'Geolocation is not supported in this browser.' });
            return;
        }

        setLocationNotice(null);
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
                const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 15 : searchRadius <= 2 ? 14 : 13;
                setFlyTarget({ ...loc, zoom });
            },
            (error) => {
                if (geolocationRequestRef.current !== requestId || resolved) return;
                const latestLocationState = latestLocationStateRef.current;
                const hasActiveGeolocation = !!latestLocationState.userLocation && latestLocationState.searchOrigin?.source === 'geolocation';
                if (hasActiveGeolocation) {
                    setLocationNotice(null);
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

        const localMatch = hardAssets.find((asset) => asset.postalCode === val);
        if (localMatch) {
            result = { lat: parseFloat(localMatch.lat), lng: parseFloat(localMatch.lng) };
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
        const zoom = searchRadius <= 0.3 ? 17 : searchRadius <= 0.5 ? 16 : searchRadius <= 1 ? 15 : searchRadius <= 2 ? 14 : 13;
        setFlyTarget({ lat: result.lat, lng: result.lng, zoom });
    }, [postalInput, searchRadius, hardAssets]);

    return {
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
        clearLocationSearch,
    };
}
