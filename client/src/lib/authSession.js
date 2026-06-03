export const SESSION_FETCH_TIMEOUT_MS = 5_000;
export const EMPTY_SESSION_RECHECK_ATTEMPTS = 2;
export const EMPTY_SESSION_RECHECK_DELAY_MS = 350;

export class SessionRequestTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`Session request timed out after ${timeoutMs}ms`);
        this.name = 'SessionRequestTimeoutError';
    }
}

export function isDefinitiveSignedOutSessionResponse(response, data = null) {
    const status = Number(response?.status);
    if (status !== 401 && status !== 403) return false;

    const error = String(data?.error || '').trim().toLowerCase();
    if (!error) return true;

    return error === 'no token provided'
        || error === 'invalid token'
        || error.includes('session expired')
        || error.includes('token is invalid');
}

export function isAmbiguousEmptySessionResponse(response, data = null) {
    const status = Number(response?.status);
    return status >= 200
        && status < 300
        && data
        && typeof data === 'object'
        && data.user === null
        && !data.error;
}

export function resolveUserAfterSessionCheckFailure(currentUser, failure = {}) {
    if (isDefinitiveSignedOutSessionResponse(failure.response, failure.data)) {
        return null;
    }
    return currentUser || null;
}

export function resolveImpersonationSessionFailure(currentUser, failure = {}) {
    if (isDefinitiveSignedOutSessionResponse(failure.response, failure.data)) {
        return {
            clearToken: true,
            retryNormalSession: true,
            user: null,
        };
    }

    return {
        clearToken: false,
        retryNormalSession: false,
        user: currentUser || null,
    };
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
