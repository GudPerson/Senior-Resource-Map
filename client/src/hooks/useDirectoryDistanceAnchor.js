import { useCallback, useEffect, useMemo, useState } from 'react';

import { searchOneMap } from '../lib/geo.js';

const ACTIVE_MODE_STORAGE_PREFIX = 'directory:active-anchor';
const TEMPORARY_ANCHOR_STORAGE_PREFIX = 'directory:temporary-anchor';

function buildStorageKey(prefix, storageKey) {
    return `${prefix}:${storageKey || 'default'}`;
}

function normalizeAnchor(value) {
    if (!value) return null;

    const lat = Number.parseFloat(value.lat);
    const lng = Number.parseFloat(value.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        kind: value.kind === 'home' ? 'home' : 'temporary',
        lat,
        lng,
        postalCode: typeof value.postalCode === 'string' ? value.postalCode : '',
        address: typeof value.address === 'string' ? value.address : '',
    };
}

function loadStoredJson(storageKey) {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
    } catch {
        window.sessionStorage.removeItem(storageKey);
        return null;
    }
}

function loadStoredActiveMode(storageKey, hasHome) {
    if (typeof window === 'undefined') {
        return hasHome ? 'home' : null;
    }

    const stored = window.sessionStorage.getItem(storageKey);
    if (stored === 'home' || stored === 'temporary' || stored === 'none') {
        return stored === 'none' ? null : stored;
    }

    return hasHome ? 'home' : null;
}

export function useDirectoryDistanceAnchor({
    storageKey,
    userPostalCode = '',
}) {
    const normalizedPostalCode = String(userPostalCode || '').trim();
    const activeModeStorageKey = buildStorageKey(ACTIVE_MODE_STORAGE_PREFIX, storageKey);
    const temporaryAnchorStorageKey = buildStorageKey(TEMPORARY_ANCHOR_STORAGE_PREFIX, storageKey);
    const [activeMode, setActiveMode] = useState(() => loadStoredActiveMode(activeModeStorageKey, Boolean(normalizedPostalCode)));
    const [temporaryAnchor, setTemporaryAnchor] = useState(() => normalizeAnchor(loadStoredJson(temporaryAnchorStorageKey)));
    const [homeAnchor, setHomeAnchor] = useState(null);
    const [error, setError] = useState('');
    const [isResolvingHome, setIsResolvingHome] = useState(false);
    const [isSettingTemporary, setIsSettingTemporary] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.sessionStorage.setItem(activeModeStorageKey, activeMode || 'none');
    }, [activeMode, activeModeStorageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (temporaryAnchor) {
            window.sessionStorage.setItem(temporaryAnchorStorageKey, JSON.stringify(temporaryAnchor));
            return;
        }
        window.sessionStorage.removeItem(temporaryAnchorStorageKey);
    }, [temporaryAnchor, temporaryAnchorStorageKey]);

    useEffect(() => {
        if (!normalizedPostalCode && activeMode === 'home') {
            setActiveMode(temporaryAnchor ? 'temporary' : null);
        }
    }, [activeMode, normalizedPostalCode, temporaryAnchor]);

    useEffect(() => {
        let cancelled = false;

        async function resolveHomeAnchor() {
            if (!normalizedPostalCode || activeMode !== 'home') return;
            if (homeAnchor?.postalCode === normalizedPostalCode) return;

            setIsResolvingHome(true);
            setError('');

            try {
                const result = await searchOneMap(normalizedPostalCode);
                if (!result) {
                    if (!cancelled) {
                        setError('Home postal code could not be located.');
                        setActiveMode(temporaryAnchor ? 'temporary' : null);
                    }
                    return;
                }

                if (!cancelled) {
                    setHomeAnchor({
                        kind: 'home',
                        lat: result.lat,
                        lng: result.lng,
                        postalCode: normalizedPostalCode,
                        address: result.address || `Postal code ${normalizedPostalCode}`,
                    });
                }
            } finally {
                if (!cancelled) {
                    setIsResolvingHome(false);
                }
            }
        }

        resolveHomeAnchor();

        return () => {
            cancelled = true;
        };
    }, [activeMode, homeAnchor?.postalCode, normalizedPostalCode, temporaryAnchor]);

    const activeAnchor = useMemo(() => {
        if (activeMode === 'temporary' && temporaryAnchor) {
            return temporaryAnchor;
        }

        if (activeMode === 'home' && homeAnchor) {
            return homeAnchor;
        }

        return null;
    }, [activeMode, homeAnchor, temporaryAnchor]);

    const activateHome = useCallback(async () => {
        if (!normalizedPostalCode) {
            setError('Set a postal code in your profile before using Home.');
            return false;
        }

        if (homeAnchor?.postalCode === normalizedPostalCode) {
            setActiveMode('home');
            setError('');
            return true;
        }

        setIsResolvingHome(true);
        setError('');

        try {
            const result = await searchOneMap(normalizedPostalCode);
            if (!result) {
                setError('Home postal code could not be located.');
                return false;
            }

            setHomeAnchor({
                kind: 'home',
                lat: result.lat,
                lng: result.lng,
                postalCode: normalizedPostalCode,
                address: result.address || `Postal code ${normalizedPostalCode}`,
            });
            setActiveMode('home');
            return true;
        } finally {
            setIsResolvingHome(false);
        }
    }, [homeAnchor?.postalCode, normalizedPostalCode]);

    const setTemporaryLocation = useCallback(async (postalCode) => {
        const normalized = String(postalCode || '').replace(/\D/g, '').slice(0, 6);
        if (normalized.length !== 6) {
            setError('Enter a valid 6-digit postal code.');
            return false;
        }

        setIsSettingTemporary(true);
        setError('');

        try {
            const result = await searchOneMap(normalized);
            if (!result) {
                setError('That postal code could not be located.');
                return false;
            }

            const nextAnchor = {
                kind: 'temporary',
                lat: result.lat,
                lng: result.lng,
                postalCode: normalized,
                address: result.address || `Postal code ${normalized}`,
            };
            setTemporaryAnchor(nextAnchor);
            setActiveMode('temporary');
            return true;
        } finally {
            setIsSettingTemporary(false);
        }
    }, []);

    const clearTemporaryLocation = useCallback(() => {
        setTemporaryAnchor(null);
        setError('');
        setActiveMode(normalizedPostalCode ? 'home' : null);
    }, [normalizedPostalCode]);

    const clearActiveAnchor = useCallback(() => {
        setError('');
        setActiveMode(null);
    }, []);

    return {
        activeAnchor,
        activeMode,
        userPostalCode: normalizedPostalCode,
        homeAvailable: Boolean(normalizedPostalCode),
        temporaryAnchor,
        error,
        isResolvingHome,
        isSettingTemporary,
        activateHome,
        setTemporaryLocation,
        clearTemporaryLocation,
        clearActiveAnchor,
    };
}

export default useDirectoryDistanceAnchor;

