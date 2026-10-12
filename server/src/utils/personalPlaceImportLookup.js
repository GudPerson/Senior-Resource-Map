import { validateSingaporePostalCodeWithOneMap } from './singaporePostalFallback.js';

const UNAVAILABLE = 'The location service is temporarily unavailable. We could not finish checking this postal code. Try again later.';
const NOT_FOUND = 'No exact Singapore address was found for this postal code. Check the postal code.';

function lookupError(status, code, message, retryable = false, retryAfterMs = 0) {
    return Object.assign(new Error(message), { status, code, retryable, retryAfterMs });
}

function abortError() {
    return Object.assign(new Error('Location lookup was cancelled.'), { name: 'AbortError' });
}

function waitForRetry(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(abortError()); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
        signal?.addEventListener('abort', cancel, { once: true });
    });
}

function retryAfterMs(response) {
    const value = response?.headers?.get?.('Retry-After');
    if (!value) return 0;
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    return Number.isFinite(delay) ? Math.max(0, Math.min(5000, delay)) : 0;
}

/** Import-only retries; the shared geocoder and exact postal validator stay intact. */
export async function resolvePersonalPlaceImportLocation(postalCode, options = {}) {
    if (typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode)) {
        throw lookupError(400, 'invalid_postal_code', 'Postal Code must contain exactly six digits.');
    }
    const { fetchImpl = fetch, signal, wait = waitForRetry, timeoutMs = 5000 } = options;
    let notFoundCount = 0;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (signal?.aborted) throw abortError();
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let failure;
        try {
            const validation = await validateSingaporePostalCodeWithOneMap(postalCode, async (url) => {
                const response = await fetchImpl(url, { signal: controller.signal });
                if (!response?.ok) {
                    const status = response?.status;
                    throw lookupError(503, 'postal_lookup_unavailable', UNAVAILABLE,
                        status === 429 || status >= 500 || !status, retryAfterMs(response));
                }
                const payload = await response.json();
                if (!Array.isArray(payload?.results) || (payload.error && !payload.results.some((result) => String(result?.POSTAL || '').trim() === postalCode))) {
                    throw lookupError(503, 'postal_lookup_unavailable', UNAVAILABLE, true);
                }
                return { ok: true, json: async () => payload };
            });
            if (!validation.valid && validation.reason === 'not_found') {
                // Reconfirm empty/mismatched responses before calling the postal code invalid.
                notFoundCount += 1;
                throw lookupError(400, 'postal_not_found', NOT_FOUND, true);
            }
            if (!validation.valid || validation.postalCode !== postalCode || !validation.address || validation.address.length > 500
                || !Number.isFinite(validation.lat) || Math.abs(validation.lat) > 90
                || !Number.isFinite(validation.lng) || Math.abs(validation.lng) > 180) {
                throw lookupError(503, 'postal_lookup_unavailable', UNAVAILABLE, true);
            }
            return { locationMode: 'addressed', address: validation.address, postalCode,
                lat: validation.lat, lng: validation.lng };
        } catch (error) {
            if (signal?.aborted) throw abortError();
            failure = ['postal_lookup_unavailable', 'postal_not_found'].includes(error?.code)
                ? error : lookupError(503, 'postal_lookup_unavailable', UNAVAILABLE, true);
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        }
        if (!failure.retryable || attempt === 3) {
            if (failure.code === 'postal_not_found' && notFoundCount < 2) {
                throw lookupError(503, 'postal_lookup_unavailable', UNAVAILABLE);
            }
            throw failure;
        }
        await wait(Math.max(1000 * attempt, failure.retryAfterMs), signal);
    }
}
