import { getImpersonationToken, getSessionAuthHeaders } from './sessionAuth.js';
import { getApiBaseCandidates } from './apiBase.js';

const BASE_CANDIDATES = getApiBaseCandidates();

function notifyAuthExpired() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('carearound:auth-expired'));
}

const COOKIE_SCOPED_AUTH_PATH_PREFIXES = [
    '/admin',
    '/audience-zones',
    '/favorites',
    '/governance',
    '/memberships',
    '/my-maps',
    '/phone-identities',
    '/private-resource-content',
    '/soft-asset-parents',
    '/soft-assets',
    '/subregions',
    '/users',
];

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function canRetryAcrossBasesForPath(path) {
    const normalizedPath = String(path || '');
    if (normalizedPath.includes('scope=managed')) return false;
    return !COOKIE_SCOPED_AUTH_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

function isJsonBodyMethod(method) {
    return !['GET', 'HEAD'].includes(String(method || '').toUpperCase());
}

export function buildRequestHeaders(method = 'GET', extra = {}, hasJsonBody = false) {
    return {
        ...(hasJsonBody && isJsonBodyMethod(method) ? { 'Content-Type': 'application/json' } : {}),
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

export async function requestWithBaseCandidates(method, path, body, options = {}) {
    const {
        baseCandidates = BASE_CANDIDATES,
        fetchImpl = globalThis.fetch,
        retryDelayMs = 250,
        networkAttemptsPerBase = 2,
    } = options;
    const canRetryAcrossBases = method === 'GET' || method === 'HEAD';
    const canUseFallbackBase = canRetryAcrossBases && canRetryAcrossBasesForPath(path);
    let lastNetworkError = null;

    for (let i = 0; i < baseCandidates.length; i += 1) {
        if (!canUseFallbackBase && i > 0) break;

        const base = baseCandidates[i];
        let res;
        const attemptsForBase = canRetryAcrossBases ? Math.max(1, networkAttemptsPerBase) : 1;

        for (let attempt = 1; attempt <= attemptsForBase; attempt += 1) {
            try {
                res = await fetchImpl(`${base}${path}`, {
                    method,
                    headers: buildRequestHeaders(method, {}, body !== undefined),
                    credentials: 'include',
                    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
                });
                break;
            } catch (err) {
                lastNetworkError = err;
                if (attempt < attemptsForBase) {
                    await sleep(retryDelayMs * attempt);
                    continue;
                }
                if (canUseFallbackBase && i < baseCandidates.length - 1) {
                    break;
                }
                throw err;
            }
        }

        if (!res) continue;

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json() : await res.text();

        if (!res.ok) {
            if (isJson && data?.error) {
                handleAuthJsonError(data);
                const error = new Error(data.error);
                if (data.code) error.code = data.code;
                throw error;
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

    if (lastNetworkError) throw lastNetworkError;
    throw new Error('API request failed.');
}

async function request(method, path, body) {
    return requestWithBaseCandidates(method, path, body);
}

export async function requestFormDataWithBaseCandidates(path, formData, options = {}) {
    const {
        baseCandidates = BASE_CANDIDATES,
        fetchImpl = globalThis.fetch,
    } = options;
    const canUseFallbackBase = canRetryAcrossBasesForPath(path);
    let lastNetworkError = null;

    for (let i = 0; i < baseCandidates.length; i += 1) {
        if (!canUseFallbackBase && i > 0) break;

        const base = baseCandidates[i];
        let res;

        try {
            res = await fetchImpl(`${base}${path}`, {
                method: 'POST',
                headers: getSessionAuthHeaders(),
                credentials: 'include',
                body: formData,
            });
        } catch (err) {
            lastNetworkError = err;
            if (canUseFallbackBase && i < baseCandidates.length - 1) continue;
            throw new Error('Upload request could not reach the API. Please refresh and try again.');
        }

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson ? await res.json() : await res.text();

        if (!res.ok) {
            if (isJson && data?.error) {
                handleAuthJsonError(data);
                throw new Error(data.error);
            }
            if (!isJson && canUseFallbackBase && i < baseCandidates.length - 1) continue;
            if (!isJson) {
                throw new Error('Upload API returned an unexpected response. Please refresh and try again.');
            }
            throw new Error('Upload failed');
        }

        if (!isJson) {
            if (canUseFallbackBase && i < baseCandidates.length - 1) continue;
            throw new Error('Upload API returned an unexpected response. Please refresh and try again.');
        }

        return data;
    }

    if (lastNetworkError) {
        throw new Error('Upload request could not reach the API. Please refresh and try again.');
    }
    throw new Error('Upload failed');
}

async function requestFormData(path, formData) {
    return requestFormDataWithBaseCandidates(path, formData);
}

async function requestBlob(path, options = {}) {
    const method = options.method || 'GET';
    const hasBody = options.body !== undefined;
    const requestHeaders = hasBody
        ? buildRequestHeaders(method, options.headers || {}, true)
        : {
            ...getSessionAuthHeaders(),
            ...(options.headers || {}),
        };

    for (let i = 0; i < BASE_CANDIDATES.length; i += 1) {
        const base = BASE_CANDIDATES[i];
        const res = await fetch(`${base}${path}`, {
            method,
            headers: requestHeaders,
            credentials: 'include',
            ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
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
    startPhoneLogin: (body) => request('POST', '/auth/phone/start', body),
    getPhoneLoginAttempt: (attemptId) => request('GET', `/auth/phone/${attemptId}`),
    completePhoneLoginSignup: (attemptId, body) => request('POST', `/auth/phone/${attemptId}/signup`, body),
    createImpersonationSession: (id) => request('POST', `/auth/impersonate/${id}`),

    // Hard Assets
    getHardAssets: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) searchParams.append(key, value);
        });
        const qs = searchParams.toString();
        return request('GET', `/hard-assets${qs ? `?${qs}` : ''}`);
    },
    getHardAsset: (id) => request('GET', `/hard-assets/${id}`),
    createHardAsset: (body) => request('POST', '/hard-assets', body),
    searchGoogleHardAssetCandidatesByPostal: (body) => request('POST', '/hard-assets/import/google-candidates', body),
    previewGoogleHardAssetImport: (body) => request('POST', '/hard-assets/import/google-preview', body),
    enrichHardAssetDraft: (body) => request('POST', '/hard-assets/import/enrich-draft', body),
    updateHardAsset: (id, body) => request('PUT', `/hard-assets/${id}`, body),
    generateHardAssetMembershipQr: (id) => request('POST', `/hard-assets/${id}/membership-qr`),
    deleteHardAsset: (id) => request('DELETE', `/hard-assets/${id}`),
    getHardAssetStaff: (id) => request('GET', `/hard-assets/${id}/staff`),
    getHardAssetStaffCandidates: (id, query = '') => request('GET', `/hard-assets/${id}/staff-candidates?q=${encodeURIComponent(query)}`),
    addHardAssetStaff: (id, body) => request('POST', `/hard-assets/${id}/staff`, body),
    updateHardAssetStaffRole: (id, membershipId, body) => request('PUT', `/hard-assets/${id}/staff/${membershipId}`, body),
    revokeHardAssetStaff: (id, membershipId) => request('DELETE', `/hard-assets/${id}/staff/${membershipId}`),

    // Soft Assets
    getSoftAssets: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) searchParams.append(key, value);
        });
        const qs = searchParams.toString();
        return request('GET', `/soft-assets${qs ? `?${qs}` : ''}`);
    },
    getSoftAsset: (id) => request('GET', `/soft-assets/${id}`),
    createSoftAsset: (body) => request('POST', '/soft-assets', body),
    previewSoftAssetCollateralImport: (formData) => requestFormData('/soft-assets/import/collateral/preview', formData),
    commitSoftAssetCollateralImport: (body) => request('POST', '/soft-assets/import/collateral/commit', body),
    updateSoftAsset: (id, body) => request('PUT', `/soft-assets/${id}`, body),
    updateSoftAssetAvailability: (id, body) => request('PATCH', `/soft-assets/${id}/availability`, body),
    resetSoftAssetOverrides: (id, body) => request('POST', `/soft-assets/${id}/reset-overrides`, body),
    deleteSoftAsset: (id) => request('DELETE', `/soft-assets/${id}`),
    getSoftAssetStaff: (id) => request('GET', `/soft-assets/${id}/staff`),
    getSoftAssetStaffCandidates: (id, query = '') => request('GET', `/soft-assets/${id}/staff-candidates?q=${encodeURIComponent(query)}`),
    addSoftAssetStaff: (id, body) => request('POST', `/soft-assets/${id}/staff`, body),
    revokeSoftAssetStaff: (id, membershipId) => request('DELETE', `/soft-assets/${id}/staff/${membershipId}`),

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
    updateSubCategory: (id, body) => request('PUT', `/sub-categories/${id}`, body),
    deleteSubCategory: (id) => request('DELETE', `/sub-categories/${id}`),

    // Subregions
    getSubregions: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) searchParams.append(key, value);
        });
        const qs = searchParams.toString();
        return request('GET', `/subregions${qs ? `?${qs}` : ''}`);
    },
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
    exportFilteredWorkbook: (resourceType, ids, format = 'xlsx') => requestBlob(`/admin/workbooks/${resourceType}/export-filtered`, {
        method: 'POST',
        body: { ids, format },
    }),
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

    // Restricted resource content
    getPrivateResourceContent: (resourceType, resourceId) => request('GET', `/private-resource-content/${resourceType}/${resourceId}`),
    updatePrivateResourceContent: (resourceType, resourceId, body) => request('PUT', `/private-resource-content/${resourceType}/${resourceId}`, body),
    getPrivateResourceAccessCandidates: (resourceType, resourceId) => request('GET', `/private-resource-content/${resourceType}/${resourceId}/access-candidates`),
    uploadPrivateResourceFile: (resourceType, resourceId, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return requestFormData(`/private-resource-content/${resourceType}/${resourceId}/files`, formData);
    },
    downloadPrivateResourceFile: (resourceType, resourceId, fileId) => requestBlob(`/private-resource-content/${resourceType}/${resourceId}/files/${fileId}/download`),
    deletePrivateResourceFile: (resourceType, resourceId, fileId) => request('DELETE', `/private-resource-content/${resourceType}/${resourceId}/files/${fileId}`),

    // Resource translations
    getResourceTranslations: (resourceType, resourceId) => request('GET', `/resource-translations/${resourceType}/${resourceId}`),
    updateResourceTranslation: (resourceType, resourceId, locale, body) => request('PUT', `/resource-translations/${resourceType}/${resourceId}/${encodeURIComponent(locale)}`, body),
    regenerateResourceTranslations: (resourceType, resourceId, body = {}) => request('POST', `/resource-translations/${resourceType}/${resourceId}/regenerate`, body),

    // Users (admin + profile)
    getUsers: () => request('GET', '/users'),
    createUser: (body) => request('POST', '/users', body),
    bulkCreateUsers: (body) => request('POST', '/users/bulk', body),
    updateRole: (id, role) => request('PUT', `/users/${id}/role`, { role }),
    updateUserManager: (id, managerUserId) => request('PUT', `/users/${id}/manager`, { managerUserId }),

    deleteUser: (id) => request('DELETE', `/users/${id}`),
    updateMe: (body) => request('PUT', '/users/me', body),

    // Legacy organisations and staff access
    getPartnerOrganizations: () => request('GET', '/partner-organizations'),
    getPartnerOrganizationStaff: (organizationId) => request('GET', `/partner-organizations/${organizationId}/staff`),
    getPartnerOrganizationStaffCandidates: (organizationId, query = '') => request('GET', `/partner-organizations/${organizationId}/staff-candidates?q=${encodeURIComponent(query)}`),
    addPartnerOrganizationStaff: (organizationId, body) => request('POST', `/partner-organizations/${organizationId}/staff`, body),
    updatePartnerOrganizationStaffRole: (organizationId, membershipId, body) => request('PUT', `/partner-organizations/${organizationId}/staff/${membershipId}`, body),
    revokePartnerOrganizationStaff: (organizationId, membershipId) => request('DELETE', `/partner-organizations/${organizationId}/staff/${membershipId}`),
    handoverPartnerOrganizationOwner: (organizationId, body) => request('POST', `/partner-organizations/${organizationId}/handover`, body),

    // Governance foundation
    getGovernanceOrganizations: () => request('GET', '/governance/organizations'),
    createGovernanceOrganization: (body) => request('POST', '/governance/organizations', body),
    getGovernanceOrganization: (organizationId) => request('GET', `/governance/organizations/${organizationId}`),
    updateGovernanceOrganization: (organizationId, body) => request('PUT', `/governance/organizations/${organizationId}`, body),
    deleteGovernanceOrganization: (organizationId) => request('DELETE', `/governance/organizations/${organizationId}`),
    getGovernanceOrganizationAccessCandidates: (organizationId, query = '') => request('GET', `/governance/organizations/${organizationId}/access-candidates?q=${encodeURIComponent(query)}`),
    getGovernanceOrganizationResourceCandidates: (organizationId, resourceType = 'hard', query = '') => request('GET', `/governance/organizations/${organizationId}/resource-candidates?type=${encodeURIComponent(resourceType)}&q=${encodeURIComponent(query)}`),
    addGovernanceOrganizationAccess: (organizationId, body) => request('POST', `/governance/organizations/${organizationId}/access`, body),
    revokeGovernanceOrganizationAccess: (organizationId, membershipId) => request('DELETE', `/governance/organizations/${organizationId}/access/${membershipId}`),
    createGovernanceAgreement: (organizationId, body) => request('POST', `/governance/organizations/${organizationId}/agreements`, body),
    updateGovernanceAgreement: (organizationId, agreementId, body) => request('PUT', `/governance/organizations/${organizationId}/agreements/${agreementId}`, body),
    revokeGovernanceAgreement: (organizationId, agreementId) => request('DELETE', `/governance/organizations/${organizationId}/agreements/${agreementId}`),
    linkGovernanceResource: (organizationId, body) => request('POST', `/governance/organizations/${organizationId}/resources`, body),
    unlinkGovernanceResource: (organizationId, linkId) => request('DELETE', `/governance/organizations/${organizationId}/resources/${linkId}`),
    getMyConsentStatus: () => request('GET', '/governance/me/consents'),
    recordMyConsent: (body) => request('POST', '/governance/me/consents', body),
    getMyNotificationPreferences: () => request('GET', '/governance/me/notification-preferences'),
    updateMyNotificationPreferences: (body) => request('PUT', '/governance/me/notification-preferences', body),
    recordMyOptOut: (body) => request('POST', '/governance/me/opt-outs', body),
    getGovernanceAuditLogs: () => request('GET', '/governance/audit-logs'),
    getGovernanceRetentionQueue: () => request('GET', '/governance/retention'),
    updateGovernanceRetentionRecord: (retentionId, body) => request('PATCH', `/governance/retention/${retentionId}`, body),
    updateResourceFreshness: (resourceType, resourceId, body) => request('PATCH', `/governance/resources/${resourceType}/${resourceId}/freshness`, body),

    // Phone identity verification
    getMyPhoneIdentity: () => request('GET', '/phone-identities/me'),
    unlinkMyPhoneIdentity: () => request('DELETE', '/phone-identities/me'),
    startPhoneIdentityLink: (body = {}) => request('POST', '/phone-identities/link/start', body),
    getPhoneIdentityLinkAttempt: (attemptId) => request('GET', `/phone-identities/link/${attemptId}`),

    // Memberships
    getMyMemberships: () => request('GET', '/memberships/me'),

    // Legacy boundaries
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
    publishMyMapShare: (id, body = {}) => request('POST', `/my-maps/${id}/share`, body),
    unpublishMyMapShare: (id) => request('DELETE', `/my-maps/${id}/share`),
    addMyMapAsset: (id, body) => request('POST', `/my-maps/${id}/assets`, body),
    updateMyMapAssetNotes: (id, resourceType, resourceId, body) => request('PATCH', `/my-maps/${id}/assets/${resourceType}/${resourceId}/notes`, body),
    removeMyMapAsset: (id, resourceType, resourceId) => request('DELETE', `/my-maps/${id}/assets/${resourceType}/${resourceId}`),
    getSharedMap: (token) => request('GET', `/shared-maps/${encodeURIComponent(token)}`),
    getSharedMapNoteTranslations: (token, locale) => request('GET', `/shared-maps/${encodeURIComponent(token)}/note-translations?locale=${encodeURIComponent(locale)}`),
    copySharedMap: (token) => request('POST', `/shared-maps/${encodeURIComponent(token)}/copy`),

    // Memberships
    redeemMembershipLink: (body) => request('POST', '/memberships/link', body),

    // Combined Helpers (for Admin generic tables)
    getResources: async (params = {}) => {
        const [hardRes, softRes] = await Promise.all([
            api.getHardAssets(params),
            api.getSoftAssets(params)
        ]);
        const hard = hardRes.data || [];
        const soft = softRes.data || [];
        return {
            data: [
                ...hard.map(h => ({ ...h, category: 'Places' })),
                ...soft.map(s => ({ ...s, category: 'Offerings', address: '— (Service/Program)' }))
            ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
            pagination: {
                totalCount: (hardRes.pagination?.totalCount || 0) + (softRes.pagination?.totalCount || 0),
                page: params.page || 1,
                pageSize: params.pageSize || 50,
            }
        };
    },

    // Public API
    getMapCache: (subregionId = 'all') => request('GET', `/public/map-cache/${subregionId}`),
    getDiscoveryCache: (subregionId = 'all') => request('GET', `/public/discovery-cache/${subregionId}`),
    getDiscoveryLocationIndicators: (body) => request('POST', '/discovery/location-indicators', body),
};
