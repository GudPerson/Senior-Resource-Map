const STORAGE_KEY = 'discover:last-search-location';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function normalizeLocation(location) {
    if (!location) return null;

    const lat = Number.parseFloat(location.lat);
    const lng = Number.parseFloat(location.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        lat,
        lng,
        source: location.source === 'postal' ? 'postal' : 'geolocation',
        postalCode: typeof location.postalCode === 'string' ? location.postalCode : '',
        address: typeof location.address === 'string' ? location.address : '',
        updatedAt: Number.isFinite(location.updatedAt) ? location.updatedAt : Date.now(),
        restored: location.restored === true,
    };
}

export function saveSearchLocation(location) {
    if (typeof window === 'undefined') return;

    const normalized = normalizeLocation(location);
    if (!normalized) return;

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function loadSearchLocation() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const normalized = normalizeLocation(parsed);
        if (!normalized) {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }

        if (Date.now() - normalized.updatedAt > MAX_AGE_MS) {
            window.sessionStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return { ...normalized, restored: true };
    } catch {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function clearSearchLocation() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(STORAGE_KEY);
}

export function getSearchLocationLabel(location) {
    if (!location) return '';
    if (location.source === 'postal' && location.postalCode) {
        return `postal code ${location.postalCode}`;
    }
    if (location.restored) {
        return 'your last known location';
    }
    return 'your current location';
}

export const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 5 * 60 * 1000,
};
