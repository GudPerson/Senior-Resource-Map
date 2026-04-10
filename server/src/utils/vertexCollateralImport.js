import { inferSoftAssetBucket, normalizeSoftAssetBucket } from './softAssetBuckets.js';

const DEFAULT_VERTEX_LOCATION = 'global';
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';
const MAX_TOTAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;

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
        throw clientError(
            'Vertex AI collateral import is not configured. Add VERTEX_AI_PROJECT_ID and VERTEX_AI_SERVICE_ACCOUNT_JSON first.',
            503,
        );
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

function normalizeUploadMimeType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'image/jpg') return 'image/jpeg';
    return normalized;
}

function validateFiles(files = []) {
    if (!Array.isArray(files) || files.length === 0) {
        throw clientError('Upload at least one PDF or image to continue.');
    }
    if (files.length > MAX_FILES) {
        throw clientError(`Upload at most ${MAX_FILES} files at a time.`);
    }

    let totalBytes = 0;
    let pdfCount = 0;

    for (const file of files) {
        if (!file || typeof file.arrayBuffer !== 'function') {
            throw clientError('One of the uploaded files could not be read.');
        }

        const mimeType = normalizeUploadMimeType(file.type);
        const isPdf = mimeType === 'application/pdf';
        const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType);

        if (!isPdf && !isImage) {
            throw clientError('Only PDF, JPG, PNG, WEBP, or HEIC collateral is supported right now.');
        }

        if (isPdf) pdfCount += 1;
        totalBytes += Number(file.size) || 0;
    }

    if (pdfCount > 1) {
        throw clientError('Upload only one PDF at a time, or switch to image uploads for multi-page collateral.');
    }

    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
        throw clientError('The selected files are too large. Keep the total upload size under 15 MB.');
    }
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
    const cacheKey = `${config.projectId}:${config.location}:${config.clientEmail}`;
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

async function buildFileParts(files) {
    return Promise.all(files.map(async (file) => ({
        inlineData: {
            mimeType: normalizeUploadMimeType(file.type),
            data: toBase64(await file.arrayBuffer()),
        },
    })));
}

function buildCollateralPrompt({ hostAsset, softSubCategoryNames, tagNames }) {
    const categoryHint = softSubCategoryNames.length
        ? `Prefer these existing soft subcategories when they fit: ${softSubCategoryNames.join(', ')}.`
        : 'If no existing subcategory fits, return your best short suggestion.';
    const tagHint = tagNames.length
        ? `Useful existing tags include: ${tagNames.slice(0, 120).join(', ')}. Reuse them when relevant, but do not invent noise tags.`
        : 'Suggest concise tags only when they clearly help discovery.';

    return [
        'You are extracting CareAround SG offerings from uploaded collateral.',
        `The collateral belongs to this host place: ${hostAsset.name}${hostAsset.address ? `, ${hostAsset.address}` : ''}.`,
        'One collateral can contain many separate offerings. Split them into multiple draft rows when needed.',
        'Every draft row must fit exactly one CareAround bucket: Programmes, Services, or Promotions.',
        'Programmes are scheduled activities, classes, workshops, talks, events, clubs, or recurring sessions.',
        'Services are ongoing support, consultations, screenings, assessments, care services, transport, therapy, or operational offerings.',
        'Promotions are discounts, benefits, campaigns, vouchers, grants, special offers, or limited-time deals.',
        'If a service is not clearly scheduled, leave schedule blank instead of inventing one.',
        'Return only JSON matching the schema. No markdown.',
        categoryHint,
        tagHint,
        'For each detected offering candidate, extract these fields when present: bucket, name, subCategorySuggestion, description, schedule, newTags, contactPhone, contactEmail, ctaLabel, ctaUrl, venueNote, sourceExcerpt, confidence.',
        'Confidence should be a number from 0 to 1.',
        'sourceExcerpt should quote or tightly paraphrase the exact collateral text that supports the row.',
        'If the collateral includes general venue-level details instead of offering-specific details, only attach them to a row when they clearly belong to that row.',
        'Ignore decorative marketing copy that does not represent a real offering.',
    ].join('\n');
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

function normalizeEmail(value) {
    const email = normalizeText(value).toLowerCase();
    if (!email) return '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
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

function normalizeTags(values, knownTagNames = []) {
    const preferredTags = new Map(knownTagNames.map((tag) => [tag.toLowerCase(), tag]));
    const seen = new Set();
    const next = [];

    for (const rawTag of Array.isArray(values) ? values : []) {
        const normalized = normalizeText(rawTag).toLowerCase();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        next.push(preferredTags.get(normalized) || normalized);
    }

    return next.slice(0, 12);
}

function normalizeSubCategorySuggestion(value, softSubCategoryNames) {
    const text = normalizeText(value);
    if (!text) return '';
    const matched = softSubCategoryNames.find((name) => name.toLowerCase() === text.toLowerCase());
    return matched || text;
}

function normalizeConfidence(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Math.max(0, Math.min(1, numeric));
}

function normalizeDraftRow(rawRow, softSubCategoryNames, knownTagNames) {
    const normalizedName = normalizeText(rawRow?.name);
    if (!normalizedName) return null;

    let bucket = null;
    try {
        bucket = normalizeSoftAssetBucket(rawRow?.bucket, null);
    } catch {
        bucket = null;
    }
    if (!bucket) {
        bucket = inferSoftAssetBucket({
            name: normalizedName,
            description: rawRow?.description,
            subCategory: rawRow?.subCategorySuggestion,
            tags: rawRow?.newTags,
        }).bucket;
    }

    const subCategorySuggestion = normalizeSubCategorySuggestion(
        rawRow?.subCategorySuggestion || rawRow?.subcategory || bucket,
        softSubCategoryNames,
    );

    return {
        bucket,
        name: normalizedName,
        subCategorySuggestion: subCategorySuggestion || bucket,
        description: normalizeLongText(rawRow?.description || ''),
        schedule: normalizeLongText(rawRow?.schedule || ''),
        newTags: normalizeTags(rawRow?.newTags, knownTagNames),
        contactPhone: normalizeText(rawRow?.contactPhone || ''),
        contactEmail: normalizeEmail(rawRow?.contactEmail || ''),
        ctaLabel: normalizeText(rawRow?.ctaLabel || ''),
        ctaUrl: normalizeUrl(rawRow?.ctaUrl || ''),
        venueNote: normalizeLongText(rawRow?.venueNote || ''),
        sourceExcerpt: normalizeLongText(rawRow?.sourceExcerpt || ''),
        confidence: normalizeConfidence(rawRow?.confidence),
    };
}

function extractTextFromVertexResponse(responseJson) {
    const parts = responseJson?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        throw clientError('Vertex AI returned no extraction result.', 502);
    }
    const combined = parts
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
    if (!combined) {
        throw clientError('Vertex AI returned an empty extraction result.', 502);
    }
    return combined;
}

export async function extractCollateralDraftRows({
    env,
    hostAsset,
    files,
    softSubCategoryNames = [],
    knownTagNames = [],
}) {
    const config = resolveVertexConfig(env);
    validateFiles(files);

    const accessToken = await getVertexAccessToken(config);
    const fileParts = await buildFileParts(files);
    const prompt = buildCollateralPrompt({ hostAsset, softSubCategoryNames, tagNames: knownTagNames });

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
                        { text: prompt },
                        ...fileParts,
                    ],
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
                        draftRows: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    bucket: { type: 'string' },
                                    name: { type: 'string' },
                                    subCategorySuggestion: { type: 'string' },
                                    description: { type: 'string' },
                                    schedule: { type: 'string' },
                                    newTags: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                    contactPhone: { type: 'string' },
                                    contactEmail: { type: 'string' },
                                    ctaLabel: { type: 'string' },
                                    ctaUrl: { type: 'string' },
                                    venueNote: { type: 'string' },
                                    sourceExcerpt: { type: 'string' },
                                    confidence: { type: 'number' },
                                },
                                required: ['name'],
                            },
                        },
                    },
                    required: ['draftRows'],
                },
            },
        }),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('Vertex collateral import error:', responseJson);
        throw clientError(
            responseJson?.error?.message || 'Vertex AI could not process that collateral right now.',
            response.status >= 400 && response.status < 600 ? response.status : 502,
        );
    }

    const rawText = extractTextFromVertexResponse(responseJson);

    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        console.error('Vertex collateral import JSON parse error:', rawText);
        throw clientError(`Vertex AI returned malformed JSON. ${err.message}`, 502);
    }

    const draftRows = (Array.isArray(parsed?.draftRows) ? parsed.draftRows : [])
        .map((row) => normalizeDraftRow(row, softSubCategoryNames, knownTagNames))
        .filter(Boolean);

    if (draftRows.length === 0) {
        throw clientError('No clear offerings could be extracted from that collateral. Try a cleaner scan or use manual creation.', 422);
    }

    const warnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings.map((warning) => normalizeText(warning)).filter(Boolean)
        : [];

    return { draftRows, warnings };
}
