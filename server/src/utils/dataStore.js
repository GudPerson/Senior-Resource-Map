/**
 * Generic data store abstraction for Netlify Blobs or Cloudflare KV
 */
class DataStore {
    async getJSON(key, envVars = {}) {
        if (envVars.NETLIFY_SITE_ID && envVars.NETLIFY_API_TOKEN) {
            try {
                const { getStore } = await import('@netlify/blobs');
                const store = getStore({
                    name: 'map-cache',
                    siteID: envVars.NETLIFY_SITE_ID,
                    token: envVars.NETLIFY_API_TOKEN,
                });
                return await store.getJSON(key);
            } catch (err) {
                console.error('Error importing or reading from Netlify Blobs', err);
                return null;
            }
        }

        const kv = envVars.MAP_CACHE;
        if (kv) {
            const data = await kv.get(key);
            return data ? JSON.parse(data) : null;
        }

        return null;
    }

    async setJSON(key, value, envVars = {}) {
        if (envVars.NETLIFY_SITE_ID && envVars.NETLIFY_API_TOKEN) {
            try {
                const { getStore } = await import('@netlify/blobs');
                const store = getStore({
                    name: 'map-cache',
                    siteID: envVars.NETLIFY_SITE_ID,
                    token: envVars.NETLIFY_API_TOKEN,
                });
                await store.setJSON(key, value);
                return true;
            } catch (err) {
                console.error('Error importing or writing to Netlify Blobs', err);
                return false;
            }
        }

        const kv = envVars.MAP_CACHE;
        if (kv) {
            await kv.put(key, JSON.stringify(value));
            return true;
        }

        return false;
    }
}

export const dataStore = new DataStore();
