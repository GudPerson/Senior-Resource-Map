export const SESSION_FETCH_TIMEOUT_MS = 5_000;

export class SessionRequestTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`Session request timed out after ${timeoutMs}ms`);
        this.name = 'SessionRequestTimeoutError';
    }
}

export function resolveUserAfterSessionCheckFailure(currentUser) {
    return currentUser || null;
}

export async function fetchSessionJsonWithTimeout(url, options = {}) {
    const {
        timeoutMs = SESSION_FETCH_TIMEOUT_MS,
        fetchImpl = globalThis.fetch,
        ...fetchOptions
    } = options;
    const controller = new AbortController();
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            reject(new SessionRequestTimeoutError(timeoutMs));
        }, timeoutMs);
    });

    const requestPromise = (async () => {
        const response = await fetchImpl(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return { response, data: null, isJson: false };
        }

        return { response, data: await response.json(), isJson: true };
    })();

    try {
        return await Promise.race([requestPromise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}
