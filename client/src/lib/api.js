const BASE = import.meta.env.VITE_API_URL || '/api';

function headers(extra = {}) {
    return {
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(),
        credentials: 'include',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
        if (isJson && data?.error) throw new Error(data.error);
        if (!isJson) {
            throw new Error('API route misconfigured: received HTML instead of JSON. Check VITE_API_URL and /api rewrites.');
        }
        throw new Error('Request failed');
    }

    if (!isJson) {
        throw new Error('API returned non-JSON response unexpectedly.');
    }

    return data;
}

export const api = {
    // Auth
    login: (body) => request('POST', '/auth/login', body),
    register: (body) => request('POST', '/auth/register', body),
    googleAuth: (body) => request('POST', '/auth/google', body),

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

    // Admin
    exportFullDB: () => request('GET', '/admin/export'),
    importCSV: (body) => request('POST', '/admin/import', body),

    // Upload Media (Handles FormData)
    uploadMedia: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${BASE}/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData, // the browser sets multipart/form-data boundary automatically
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        return data.secure_url;
    },

    // Users (admin + profile)
    getUsers: () => request('GET', '/users'),
    updateRole: (id, role) => request('PUT', `/users/${id}/role`, { role }),
    deleteUser: (id) => request('DELETE', `/users/${id}`),
    updateMe: (body) => request('PUT', '/users/me', body),

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
};
