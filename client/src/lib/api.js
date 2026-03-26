import { getImpersonationToken, getSessionAuthHeaders } from './sessionAuth.js';
import { getApiBaseCandidates } from './apiBase.js';

const BASE_CANDIDATES = getApiBaseCandidates();

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

function parseContentDispositionFilename(value) {
    if (!value) return null;
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            return utf8Match[1];
        }
    }

    const basicMatch = value.match(/filename="([^"]+)"/i) || value.match(/filename=([^;]+)/i);
    return basicMatch?.[1] ? basicMatch[1].trim() : null;
}

function handleAuthJsonError(data) {
    const isImpersonating = Boolean(getImpersonationToken());
    if (
        isImpersonating &&
        (data?.error === 'Invalid token' || data?.error === 'No token provided')
    ) {
        throw new Error('User view session expired. Exit User View and reopen the account.');
    }
    if (data?.error === 'Invalid token' || data?.error === 'No token provided') {
        notifyAuthExpired();
        throw new Error('Session expired. Please log in again.');
    }
}

async function request(method, path, body) {
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
                handleAuthJsonError(data);
                throw new Error(data.error);
            }
            // Retry on non-JSON responses to survive rewrite/base URL mismatches.
            if (!isJson && canRetryAcrossBases && i < BASE_CANDIDATES.length - 1) continue;
            if (!isJson) {
                throw new Error('API route misconfigured: received HTML instead of JSON. Check VITE_API_URL and Cloudflare /api routing.');
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

async function requestFormData(path, formData) {
    for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
        const base = BASE_CANDIDATES[i];
        const res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: getSessionAuthHeaders(),
            credentials: 'include',
            body: formData,
        });
        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json() : await res.text();

        if (!res.ok) {
            if (isJson && data?.error) {
                handleAuthJsonError(data);
                throw new Error(data.error);
            }
            if (!isJson && i < BASE_CANDIDATES.length - 1) continue;
            if (!isJson) {
                throw new Error('Upload API misconfigured: received HTML instead of JSON.');
            }
            throw new Error('Upload failed');
        }

        if (!isJson) {
            if (i < BASE_CANDIDATES.length - 1) continue;
            throw new Error('Upload API returned non-JSON response unexpectedly.');
        }

        return data;
    }

    throw new Error('Upload failed');
}

async function requestBlob(path) {
    for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
        const base = BASE_CANDIDATES[i];
        const res = await fetch(`${base}${path}`, {
            method: 'GET',
            headers: getSessionAuthHeaders(),
            credentials: 'include',
        });
        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const isHtml = contentType.includes('text/html');

        if (!res.ok) {
            const data = isJson ? await res.json() : await res.text();
            if (isJson && data?.error) {
                handleAuthJsonError(data);
                throw new Error(data.error);
            }
            if ((!isJson || isHtml) && i < BASE_CANDIDATES.length - 1) continue;
            throw new Error(isJson ? 'Download failed' : 'Download API misconfigured: received HTML instead of a file.');
        }

        if (isJson) {
            const data = await res.json();
            if (data?.error) {
                handleAuthJsonError(data);
                throw new Error(data.error);
            }
            if (i < BASE_CANDIDATES.length - 1) continue;
            throw new Error('Download API returned JSON instead of a file.');
        }

        if (isHtml) {
            if (i < BASE_CANDIDATES.length - 1) continue;
            throw new Error('Download API misconfigured: received HTML instead of a file.');
        }

        return {
            blob: await res.blob(),
            fileName: parseContentDispositionFilename(res.headers.get('content-disposition')),
            contentType,
        };
    }

    throw new Error('Download failed');
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
    resetSoftAssetOverrides: (id, body) => request('POST', `/soft-assets/${id}/reset-overrides`, body),
    deleteSoftAsset: (id) => request('DELETE', `/soft-assets/${id}`),

    // Soft Asset Parents
    getSoftAssetParents: () => request('GET', '/soft-asset-parents'),
    getSoftAssetParent: (id) => request('GET', `/soft-asset-parents/${id}`),
    getSoftAssetParentChildren: (id) => request('GET', `/soft-asset-parents/${id}/children`),
    createSoftAssetParent: (body) => request('POST', '/soft-asset-parents', body),
    updateSoftAssetParent: (id, body) => request('PUT', `/soft-asset-parents/${id}`, body),
    deleteSoftAssetParent: (id) => request('DELETE', `/soft-asset-parents/${id}`),
    generateSoftAssetChildren: (id, body) => request('POST', `/soft-asset-parents/${id}/generate-children`, body),

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

    // Audience zones
    getAudienceZones: () => request('GET', '/audience-zones'),
    createAudienceZone: (body) => request('POST', '/audience-zones', body),
    updateAudienceZone: (id, body) => request('PUT', `/audience-zones/${id}`, body),
    deleteAudienceZone: (id) => request('DELETE', `/audience-zones/${id}`),
    bulkDeleteAudienceZones: (ids) => request('POST', '/audience-zones/bulk-delete', { ids }),
    bulkUploadAudienceZoneBoundaries: (body) => request('POST', '/audience-zones/boundaries/bulk', body),

    // Admin asset workbooks
    downloadWorkbookTemplate: (resourceType, format = 'xlsx') => requestBlob(`/admin/workbooks/${resourceType}/template?format=${encodeURIComponent(format)}`),
    exportWorkbook: (resourceType, format = 'xlsx') => requestBlob(`/admin/workbooks/${resourceType}/export?format=${encodeURIComponent(format)}`),
    importWorkbook: (resourceType, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return requestFormData(`/admin/imports/${resourceType}`, formData);
    },

    // Upload Media (Handles FormData)
    uploadMedia: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const data = await requestFormData('/upload', formData);
        return data.secure_url;
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

    // Saved assets / favorites
    getSavedAssets: () => request('GET', '/favorites'),
    toggleSavedAsset: (resourceType, resourceId) => request('POST', '/favorites/toggle', { resourceType, resourceId }),

    // Favorites (compatibility aliases)
    getFavorites: () => request('GET', '/favorites'),
    toggleFavorite: (resourceType, resourceId) => request('POST', '/favorites/toggle', { resourceType, resourceId }),

    // My Maps
    getMyMaps: () => request('GET', '/my-maps'),
    createMyMap: (body) => request('POST', '/my-maps', body),
    getMyMap: (id) => request('GET', `/my-maps/${id}`),
    updateMyMap: (id, body) => request('PATCH', `/my-maps/${id}`, body),
    deleteMyMap: (id) => request('DELETE', `/my-maps/${id}`),
    publishMyMapShare: (id) => request('POST', `/my-maps/${id}/share`),
    unpublishMyMapShare: (id) => request('DELETE', `/my-maps/${id}/share`),
    addMyMapAsset: (id, body) => request('POST', `/my-maps/${id}/assets`, body),
    removeMyMapAsset: (id, resourceType, resourceId) => request('DELETE', `/my-maps/${id}/assets/${resourceType}/${resourceId}`),
    getSharedMap: (token) => request('GET', `/shared-maps/${encodeURIComponent(token)}`),
    copySharedMap: (token) => request('POST', `/shared-maps/${encodeURIComponent(token)}/copy`),

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
