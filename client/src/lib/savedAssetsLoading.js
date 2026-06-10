export const SAVED_ASSETS_LOAD_ATTEMPTS = 3;
export const SAVED_ASSETS_LOAD_RETRY_DELAY_MS = 500;

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function loadSavedAssetsWithRetry(fetchSavedAssets, options = {}) {
    const {
        attempts = SAVED_ASSETS_LOAD_ATTEMPTS,
        retryDelayMs = SAVED_ASSETS_LOAD_RETRY_DELAY_MS,
        sleepImpl = sleep,
    } = options;
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const items = await fetchSavedAssets();
            return Array.isArray(items) ? items : [];
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await sleepImpl(retryDelayMs * attempt);
            }
        }
    }

    throw lastError || new Error('Failed to load saved assets.');
}
