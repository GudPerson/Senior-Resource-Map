/**
 * Generic data store abstraction for Netlify Blobs or Cloudflare KV
 */
class DataStore {
    constructor() {
        this.isCloudflare = !!process.env.CF_PAGES || !!process.env.CLOUDFLARE_CONTEXT;
        this.isNetlify = !!process.env.NETLIFY;
    }

    async getJSON(key, context = {}) {
        if (this.isNetlify) {
            try {
                const { getStore } = await import('@netlify/blobs');
                const store = getStore({
                    name: 'map-cache',
                    siteID: process.env.NETLIFY_SITE_ID,
                    token: process.env.NETLIFY_API_TOKEN,
                });
                return await store.getJSON(key);
            } catch (err) {
                console.error('Error importing or reading from Netlify Blobs', err);
                return null;
            }
        }

        if (this.isCloudflare) {
            // Context should contain the KV binding if passed from middleware/handler
            const kv = context.env?.MAP_CACHE || context.MAP_CACHE;
            if (kv) {
                const data = await kv.get(key);
                return data ? JSON.parse(data) : null;
            }
        }

        return null;
    }

    async setJSON(key, value, context = {}) {
        if (this.isNetlify) {
            try {
                const { getStore } = await import('@netlify/blobs');
                const store = getStore({
                    name: 'map-cache',
                    siteID: process.env.NETLIFY_SITE_ID,
                    token: process.env.NETLIFY_API_TOKEN,
                });
                await store.setJSON(key, value);
                return true;
            } catch (err) {
                console.error('Error importing or writing to Netlify Blobs', err);
                return false;
            }
        }

        if (this.isCloudflare) {
            const kv = context.env?.MAP_CACHE || context.MAP_CACHE;
            if (kv) {
                await kv.put(key, JSON.stringify(value));
                return true;
            }
        }

        return false;
    }
}

export const dataStore = new DataStore();
