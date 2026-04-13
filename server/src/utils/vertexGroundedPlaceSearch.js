const DEFAULT_VERTEX_LOCATION = 'global';
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function readEnvValue(runtimeEnv = {}, ...keys) {
    const processEnv = typeof globalThis.process !== 'undefined' ? globalThis.process.env || {} : {};

    for (const source of [runtimeEnv || {}, processEnv]) {
        for (const key of keys) {
            const raw = source?.[key];
            if (raw === undefined || raw === null) continue;
            const value = String(raw).trim().replace(/^['"]|['"]$/g, '');
            if (value) return value;
        }
    }

    return '';
}

function resolveVertexConfig(runtimeEnv = {}) {
    const projectId = readEnvValue(runtimeEnv, 'VERTEX_AI_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT');
    const location = readEnvValue(runtimeEnv, 'VERTEX_AI_LOCATION') || DEFAULT_VERTEX_LOCATION;
    const model = readEnvValue(runtimeEnv, 'VERTEX_AI_MODEL') || DEFAULT_VERTEX_MODEL;
    const serviceAccountJson = readEnvValue(runtimeEnv, 'VERTEX_AI_SERVICE_ACCOUNT_JSON');

    if (!projectId || !serviceAccountJson) {
        throw clientError('Web fallback is unavailable right now.', 503);
    }

    let parsedServiceAccount;
    try {
        parsedServiceAccount = JSON.parse(serviceAccountJson);
    } catch (err) {
        throw clientError(`VERTEX_AI_SERVICE_ACCOUNT_JSON is invalid JSON. ${err.message}`, 500);
    }

    if (!parsedServiceAccount?.client_email || !parsedServiceAccount?.private_key) {
        throw clientError('VERTEX_AI_SERVICE_ACCOUNT_JSON must include client_email and private_key.', 500);
    }

    return {
        projectId,
        location,
        model,
        clientEmail: parsedServiceAccount.client_email,
        privateKey: String(parsedServiceAccount.private_key).replace(/\\n/g, '\n'),
    };
}

function toBase64(buffer) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(buffer).toString('base64');
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function toBase64Url(input) {
    if (typeof input === 'string') {
        return toBase64(new TextEncoder().encode(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    return toBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
    const base64 = String(pem || '')
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s+/g, '');

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(base64, 'base64');
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
}

async function signJwt(unsignedToken, privateKeyPem) {
    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(privateKeyPem),
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
        },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(unsignedToken),
    );
    return toBase64Url(signature);
}

async function mintGoogleAccessToken({ clientEmail, privateKey }) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claimSet = toBase64Url(JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSeconds + 3600,
        iat: nowSeconds,
    }));

    const unsignedToken = `${header}.${claimSet}`;
    const signature = await signJwt(unsignedToken, privateKey);
    const assertion = `${unsignedToken}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });

    const data = await response.json();
    if (!response.ok || !data?.access_token) {
        throw clientError(data?.error_description || data?.error || 'Failed to authenticate with Vertex AI.', 502);
    }

    return {
        accessToken: data.access_token,
        expiresAt: Date.now() + ((Number(data.expires_in) || 3600) - 60) * 1000,
    };
}

async function getVertexAccessToken(config) {
    const cacheKey = `${config.projectId}:${config.location}:${config.clientEmail}:grounded-place-search`;
    globalThis.__carearoundVertexTokenCache = globalThis.__carearoundVertexTokenCache || new Map();
    const cache = globalThis.__carearoundVertexTokenCache;
    const cached = cache.get(cacheKey);
    if (cached?.accessToken && cached.expiresAt > Date.now()) {
        return cached.accessToken;
    }

    const fresh = await mintGoogleAccessToken(config);
    cache.set(cacheKey, fresh);
    return fresh.accessToken;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLongText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeUrl(value) {
    const text = normalizeText(value);
    if (!text) return '';
    const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        return new URL(withProtocol).toString();
    } catch {
        return '';
    }
}

function normalizeConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Math.max(0, Math.min(1, numeric));
}

function dedupeTags(values) {
    const seen = new Set();
    const next = [];

    for (const rawValue of Array.isArray(values) ? values : []) {
        const normalized = normalizeText(rawValue);
        const key = normalized.toLowerCase();
        if (!normalized || seen.has(key)) continue;
        seen.add(key);
        next.push(normalized);
    }

    return next.slice(0, 12);
}

function buildPrompt({ anchor, keywordQuery = '', categoryHints = [], preferredResultCount = 8, radiusLabel = '1 km' }) {
    const categoriesLine = categoryHints.length
        ? `Prioritize places that plausibly fit these CareAround categories when relevant: ${categoryHints.join(', ')}.`
        : 'Prioritize real community, healthcare, and support organizations when relevant.';
    const keywordLine = keywordQuery
        ? `Refine the search using these keywords where helpful: ${keywordQuery}.`
        : 'No extra refine keywords were supplied.';

    return [
        'You are helping CareAround SG find real place candidates near a Singapore postal code when Google Places has no results.',
        `Postal anchor: ${anchor.postalCode}${anchor.address ? `, ${anchor.address}` : ''}.`,
        `Search area: within ${radiusLabel} of the postal anchor, unless the caller requested all of Singapore.`,
        keywordLine,
        categoriesLine,
        `Return up to ${preferredResultCount} distinct place candidates.`,
        'Use Google Search grounding. Only return places supported by grounded web results.',
        'Prefer official organization sites, government/community pages, and credible local directory pages.',
        'Return only JSON matching the schema. No markdown.',
        'For each candidate, extract: name, address, postalCode, website, phone, description, logoUrl, subCategorySuggestion, suggestedTags, sourceUrl, sourceTitle, sourceSnippet, confidence.',
        'Use sourceSnippet to quote or tightly paraphrase the most relevant grounded evidence.',
        'If a field is unclear, leave it blank instead of guessing.',
    ].join('\n');
}

function extractTextFromVertexResponse(responseJson) {
    const parts = responseJson?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        throw clientError('Vertex AI returned no web fallback result.', 502);
    }
    const combined = parts
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
    if (!combined) {
        throw clientError('Vertex AI returned an empty web fallback result.', 502);
    }
    return combined;
}

function normalizeCandidate(rawCandidate) {
    const name = normalizeText(rawCandidate?.name);
    if (!name) return null;

    return {
        name,
        address: normalizeText(rawCandidate?.address),
        postalCode: normalizeText(rawCandidate?.postalCode),
        website: normalizeUrl(rawCandidate?.website),
        phone: normalizeText(rawCandidate?.phone),
        description: normalizeLongText(rawCandidate?.description),
        logoUrl: normalizeUrl(rawCandidate?.logoUrl),
        subCategorySuggestion: normalizeText(rawCandidate?.subCategorySuggestion),
        suggestedTags: dedupeTags(rawCandidate?.suggestedTags),
        sourceUrl: normalizeUrl(rawCandidate?.sourceUrl),
        sourceTitle: normalizeText(rawCandidate?.sourceTitle),
        sourceSnippet: normalizeLongText(rawCandidate?.sourceSnippet),
        confidence: normalizeConfidence(rawCandidate?.confidence),
    };
}

export async function searchVertexGroundedPlaceSuggestions({
    env,
    anchor,
    keywordQuery = '',
    categoryHints = [],
    preferredResultCount = 8,
    radiusLabel = '1 km',
}) {
    const config = resolveVertexConfig(env);
    const accessToken = await getVertexAccessToken(config);
    const host = config.location === 'global'
        ? 'aiplatform.googleapis.com'
        : `${config.location}-aiplatform.googleapis.com`;
    const endpoint = `https://${host}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: buildPrompt({
                                anchor,
                                keywordQuery,
                                categoryHints,
                                preferredResultCount,
                                radiusLabel,
                            }),
                        },
                    ],
                },
            ],
            tools: [
                {
                    googleSearch: {},
                },
            ],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: {
                        warnings: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        candidates: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    address: { type: 'string' },
                                    postalCode: { type: 'string' },
                                    website: { type: 'string' },
                                    phone: { type: 'string' },
                                    description: { type: 'string' },
                                    logoUrl: { type: 'string' },
                                    subCategorySuggestion: { type: 'string' },
                                    suggestedTags: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                    sourceUrl: { type: 'string' },
                                    sourceTitle: { type: 'string' },
                                    sourceSnippet: { type: 'string' },
                                    confidence: { type: 'number' },
                                },
                                required: ['name'],
                            },
                        },
                    },
                    required: ['candidates'],
                },
            },
        }),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('Vertex grounded place fallback error:', responseJson);
        throw clientError(
            responseJson?.error?.message || 'Web fallback is unavailable right now.',
            response.status >= 400 && response.status < 600 ? response.status : 502,
        );
    }

    const rawText = extractTextFromVertexResponse(responseJson);

    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        console.error('Vertex grounded place fallback JSON parse error:', rawText);
        throw clientError(`Vertex AI returned malformed JSON. ${err.message}`, 502);
    }

    const candidates = (Array.isArray(parsed?.candidates) ? parsed.candidates : [])
        .map(normalizeCandidate)
        .filter(Boolean)
        .slice(0, Math.max(1, Number(preferredResultCount) || 8));

    const warnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings.map((warning) => normalizeText(warning)).filter(Boolean)
        : [];

    return { candidates, warnings };
}
