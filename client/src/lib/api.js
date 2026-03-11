import { getImpersonationToken, getSessionAuthHeaders } from './sessionAuth.js';

const rawBase = typeof import.meta.env.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL.trim()
    : '';

const BASE = rawBase ? rawBase.replace(/\/+$/, '') : '/api';
const DEFAULT_API_BASE = '/api';
const runtimeHost = typeof window !== 'undefined' ? window.location.hostname : '';
const resolvedBase = runtimeHost.endsWith('.pages.dev')
    ? DEFAULT_API_BASE
    : (BASE || DEFAULT_API_BASE);
const BASE_CANDIDATES = Array.from(new Set([
    resolvedBase,
    DEFAULT_API_BASE,
]));

function notifyAuthExpired() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('carearound:auth-expired'));
}

function headers(extra = {}) {
    return {
        'Content-Type': 'application/json',
        ...getSessionAuthHeaders(),
        ...extra,
    };
}

async function request(method, path, body) {
    const isImpersonating = Boolean(getImpersonationToken());
    const canRetryAcrossBases = method === 'GET' || method === 'HEAD';
    for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
        const base = BASE_CANDIDATES[i];
        const res = await fetch(`${base}${path}`, {
            method,
            headers: headers(),
            credentials: 'include',
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json() : await res.text();

        if (!res.ok) {
            if (isJson && data?.error) {
                if (
                    isImpersonating &&
                    (data.error === 'Invalid token' || data.error === 'No token provided')
                ) {
                    throw new Error('User view session expired. Exit User View and reopen the account.');
                }
                if (data.error === 'Invalid token' || data.error === 'No token provided') {
                    notifyAuthExpired();
                    throw new Error('Session expired. Please log in again.');
                }
                throw new Error(data.error);
            }
            // Retry on non-JSON responses to survive rewrite/base URL mismatches.
            if (!isJson && canRetryAcrossBases && i < BASE_CANDIDATES.length - 1) continue;
            if (!isJson) {
                throw new Error('API route misconfigured: received HTML instead of JSON. Check VITE_API_URL and /api rewrites.');
            }
            throw new Error('Request failed');
        }

        if (!isJson) {
            if (canRetryAcrossBases && i < BASE_CANDIDATES.length - 1) continue;
            throw new Error('API returned non-JSON response unexpectedly.');
        }

        return data;
    }

    throw new Error('API request failed.');
}

export const api = {
    // Auth
    login: (body) => request('POST', '/auth/login', body),
    register: (body) => request('POST', '/auth/register', body),
    googleAuth: (body) => request('POST', '/auth/google', body),
    createImpersonationSession: (id) => request('POST', `/auth/impersonate/${id}`),

    // Hard Assets
    getHardAssets: () => request('GET', '/hard-assets'),
    getHardAsset: (id) => request('GET', `/hard-assets/${id}`),
    createHardAsset: (body) => request('POST', '/hard-assets', body),
    updateHardAsset: (id, body) => request('PUT', `/hard-assets/${id}`, body),
    deleteHardAsset: (id) => request('DELETE', `/hard-assets/${id}`),

    // Soft Assets
    getSoftAssets: () => request('GET', '/soft-assets'),
    getSoftAsset: (id) => request('GET', `/soft-assets/${id}`),
    createSoftAsset: (body) => request('POST', '/soft-assets', body),
    updateSoftAsset: (id, body) => request('PUT', `/soft-assets/${id}`, body),
    deleteSoftAsset: (id) => request('DELETE', `/soft-assets/${id}`),

    // Tags & Categories
    searchTags: (query) => request('GET', `/tags?q=${encodeURIComponent(query)}`),
    getSubCategories: () => request('GET', '/sub-categories'),
    createSubCategory: (body) => request('POST', '/sub-categories', body),
    deleteSubCategory: (id) => request('DELETE', `/sub-categories/${id}`),

    // Subregions
    getSubregions: () => request('GET', '/subregions'),
    createSubregion: (body) => request('POST', '/subregions', body),
    bulkCreateSubregions: (body) => request('POST', '/subregions/bulk', body),
    bulkUploadSubregionBoundaries: (body) => request('POST', '/subregions/boundaries/bulk', body),
    bulkDeleteSubregions: (ids) => request('POST', '/subregions/bulk-delete', { ids }),
    deleteSubregion: (id) => request('DELETE', `/subregions/${id}`),

    // Admin
    exportFullDB: () => request('GET', '/admin/export'),
    importCSV: (body) => request('POST', '/admin/import', body),

    // Upload Media (Handles FormData)
    uploadMedia: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
            const base = BASE_CANDIDATES[i];
            const res = await fetch(`${base}/upload`, {
                method: 'POST',
                headers: getSessionAuthHeaders(),
                credentials: 'include',
                body: formData, // browser sets multipart/form-data boundary automatically
            });
            const contentType = res.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            const data = isJson ? await res.json() : await res.text();

            if (!res.ok) {
                if (isJson && data?.error) {
                    const isImpersonating = Boolean(getImpersonationToken());
                    if (
                        isImpersonating &&
                        (data.error === 'Invalid token' || data.error === 'No token provided')
                    ) {
                        throw new Error('User view session expired. Exit User View and reopen the account.');
                    }
                    if (data.error === 'Invalid token' || data.error === 'No token provided') {
                        notifyAuthExpired();
                        throw new Error('Session expired. Please log in again.');
                    }
                    throw new Error(data.error);
                }
                if (!isJson) {
                    throw new Error('Upload API misconfigured: received HTML instead of JSON.');
                }
                throw new Error('Upload failed');
            }

            if (!isJson) {
                throw new Error('Upload API returned non-JSON response unexpectedly.');
            }

            return data.secure_url;
        }

        throw new Error('Upload failed');
    },

    // Users (admin + profile)
    getUsers: () => request('GET', '/users'),
    createUser: (body) => request('POST', '/users', body),
    bulkCreateUsers: (body) => request('POST', '/users/bulk', body),
    updateRole: (id, role) => request('PUT', `/users/${id}/role`, { role }),
    updateUserManager: (id, managerUserId) => request('PUT', `/users/${id}/manager`, { managerUserId }),

    deleteUser: (id) => request('DELETE', `/users/${id}`),
    updateMe: (body) => request('PUT', '/users/me', body),

    // Partner boundaries
    getPartnerBoundaries: (partnerId) => request('GET', `/partners/${partnerId}/boundaries`),
    bulkUploadPartnerBoundaries: (partnerId, body) => request('POST', `/partners/${partnerId}/boundaries/bulk`, body),
    exportPartnerBoundaries: (partnerId) => request('GET', `/partners/${partnerId}/boundaries/export`),

    // Favorites
    getFavorites: () => request('GET', '/favorites'),
    toggleFavorite: (resourceType, resourceId) => request('POST', '/favorites/toggle', { resourceType, resourceId }),

    // Combined Helpers (for Admin/Partner generic tables)
    getResources: async () => {
        const [hard, soft] = await Promise.all([
            api.getHardAssets(),
            api.getSoftAssets()
        ]);
        return [
            ...hard.map(h => ({ ...h, category: 'Places' })),
            ...soft.map(s => ({ ...s, category: 'Offerings', address: '— (Service/Program)' }))
        ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    // Public API
    getMapCache: (subregionId = 'all') => request('GET', `/public/map-cache/${subregionId}`),
};
