const DEFAULT_GUDAUTH_TIMEOUT_MS = 12000;

function readEnvValue(env = {}, key) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};
    const value = env?.[key] ?? processEnv?.[key];
    return String(value || '').trim();
}

function createGudAuthConfigError(message) {
    const err = new Error(message);
    err.status = 503;
    err.code = 'gudauth_not_configured';
    return err;
}

function assertGudAuthConfig(env = {}) {
    const baseUrl = readEnvValue(env, 'GUDAUTH_API_BASE_URL');
    const productId = readEnvValue(env, 'GUDAUTH_PRODUCT_ID');
    const requestSecret = readEnvValue(env, 'GUDAUTH_REQUEST_SECRET');

    if (!baseUrl || !productId || !requestSecret) {
        throw createGudAuthConfigError('WhatsApp phone verification is not set up yet.');
    }

    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        productId,
        requestSecret,
    };
}

export function buildGudAuthCanonicalString({ timestamp, method, pathname, rawBody = '' }) {
    return [
        String(timestamp),
        String(method || '').toUpperCase(),
        pathname || '/',
        rawBody || '',
    ].join('\n');
}

function bytesToHex(buffer) {
    return [...new Uint8Array(buffer)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function signGudAuthRequest(secret, canonicalString) {
    const encoder = new TextEncoder();
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.subtle) {
        throw new Error('Web Crypto is required for GudAuth request signing.');
    }

    const key = await cryptoApi.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await cryptoApi.subtle.sign('HMAC', key, encoder.encode(canonicalString));
    return bytesToHex(signature);
}

function encodePathSegment(value) {
    return encodeURIComponent(String(value || '').trim());
}

function parseJsonResponse(response) {
    const contentType = response.headers?.get?.('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) {
        return null;
    }
    return response.json();
}

function createGudAuthHttpError(response, payload) {
    const err = new Error(payload?.error || payload?.message || 'Phone verification provider request failed.');
    err.status = response.status >= 400 && response.status < 500 ? 502 : 503;
    err.providerStatus = response.status;
    err.code = 'gudauth_request_failed';
    return err;
}

export function createGudAuthClient(env = {}, options = {}) {
    const {
        fetchImpl = globalThis.fetch,
        nowInSeconds = () => Math.floor(Date.now() / 1000),
    } = options;

    async function request(method, pathname, body) {
        const config = assertGudAuthConfig(env);
        if (typeof fetchImpl !== 'function') {
            throw createGudAuthConfigError('WhatsApp phone verification cannot make provider requests in this environment.');
        }

        const rawBody = body === undefined ? '' : JSON.stringify(body);
        const timestamp = String(nowInSeconds());
        const url = `${config.baseUrl}${pathname}`;
        const canonicalString = buildGudAuthCanonicalString({
            timestamp,
            method,
            pathname,
            rawBody,
        });
        const signature = await signGudAuthRequest(config.requestSecret, canonicalString);
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = controller
            ? setTimeout(() => controller.abort(), DEFAULT_GUDAUTH_TIMEOUT_MS)
            : null;

        try {
            const headers = {
                'X-GudOTP-Product': config.productId,
                'X-GudOTP-Timestamp': timestamp,
                'X-GudOTP-Signature': signature,
            };

            if (rawBody) {
                headers['Content-Type'] = 'application/json';
            }

            const response = await fetchImpl(url, {
                method: String(method).toUpperCase(),
                headers,
                ...(rawBody ? { body: rawBody } : {}),
                ...(controller ? { signal: controller.signal } : {}),
            });
            const payload = await parseJsonResponse(response);

            if (!response.ok) {
                throw createGudAuthHttpError(response, payload);
            }

            return payload || {};
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    return {
        createChallenge(payload) {
            return request('POST', '/api/integrations/challenges', payload);
        },
        getChallenge(challengeId) {
            return request('GET', `/api/integrations/challenges/${encodePathSegment(challengeId)}`);
        },
    };
}

