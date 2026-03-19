/**
 * Cloudflare KV-backed store for public map-cache payloads.
 */
class DataStore {
    async getJSON(key, envVars = {}) {
        const vars = envVars?.env ?? envVars;
        const kv = vars?.MAP_CACHE;
        if (kv) {
            const data = await kv.get(key);
            return data ? JSON.parse(data) : null;
        }

        return null;
    }

    async setJSON(key, value, envVars = {}) {
        const vars = envVars?.env ?? envVars;
        const kv = vars?.MAP_CACHE;
        if (kv) {
            await kv.put(key, JSON.stringify(value));
            return true;
        }

        return false;
    }
}

export const dataStore = new DataStore();
