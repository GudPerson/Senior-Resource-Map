export const MY_MAPS_LOAD_ATTEMPTS = 3;

function wait(ms) {
    return new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });
}

function shouldRetryMyMapsLoad(err) {
    const message = String(err?.message || err || '').toLowerCase();
    if (!message) return true;

    return ![
        'session expired',
        'user view session expired',
        'invalid token',
        'no token provided',
        'not found',
        'forbidden',
        'not allowed',
        'permission',
        'access',
        'unauthorized',
        'unauthorised',
    ].some((needle) => message.includes(needle));
}

async function loadWithResilience(load, options = {}) {
    const {
        maxAttempts = MY_MAPS_LOAD_ATTEMPTS,
        retryDelayMs = 250,
        waitMs = wait,
    } = options;
    const attempts = Math.max(1, Number(maxAttempts) || MY_MAPS_LOAD_ATTEMPTS);
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await load();
        } catch (err) {
            lastError = err;
            const retryable = shouldRetryMyMapsLoad(err);
            if (attempt < attempts && retryable) {
                await waitMs(retryDelayMs * attempt);
            }
            if (!retryable) break;
        }
    }

    throw lastError;
}

export function fetchMyMapsWithResilience(loadMaps, options = {}) {
    return loadWithResilience(loadMaps, options);
}

export function fetchMyMapWithResilience(loadMap, options = {}) {
    return loadWithResilience(loadMap, options);
}

export function getMyMapsListStatus({
    mapsLoading = false,
    mapsLoaded = false,
    mapsError = '',
    mapCount = 0,
} = {}) {
    if (mapsLoading || (!mapsLoaded && !mapsError)) return 'loading';
    if (mapsError && Number(mapCount) <= 0) return 'load-error';
    if (Number(mapCount) > 0) return 'ready';
    return 'empty';
}
