import { inferSoftAssetBucket, normalizeSoftAssetBucket } from './softAssetBuckets.js';

const DEFAULT_VERTEX_LOCATION = 'global';
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_MODEL = DEFAULT_VERTEX_MODEL;
const MAX_TOTAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;
const AI_IMPORT_NOT_CONFIGURED_MESSAGE = 'AI import is not set up for this environment yet. Ask the system administrator to enable the AI collateral import service before trying again.';

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
        return null;
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
        provider: 'vertex',
        projectId,
        location,
        model,
        clientEmail: parsedServiceAccount.client_email,
        privateKey: String(parsedServiceAccount.private_key).replace(/\\n/g, '\n'),
    };
}

function resolveGeminiConfig(runtimeEnv = {}) {
    const apiKey = readEnvValue(runtimeEnv, 'GEMINI_API_KEY');
    if (!apiKey) return null;

    return {
        provider: 'gemini',
        apiKey,
        model: readEnvValue(runtimeEnv, 'GEMINI_API_MODEL') || DEFAULT_GEMINI_MODEL,
    };
}

export function resolveAiImportProviderConfig(runtimeEnv = {}) {
    const vertexConfig = resolveVertexConfig(runtimeEnv);
    if (vertexConfig) return vertexConfig;

    const geminiConfig = resolveGeminiConfig(runtimeEnv);
    if (geminiConfig) return geminiConfig;

    throw clientError(AI_IMPORT_NOT_CONFIGURED_MESSAGE, 503);
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
        'One collateral can contain many separate offerings, but repeated sessions of the same programme must stay in one draft row.',
        'For programme calendars, do not create one row per date or calendar cell. Create one row per distinct programme name and list every exact session for that programme.',
        'Use the calendar month/year headings to make session dates clear when they are visible. Prefer session text like "4 May 2026 (Monday), 9am-10am".',
        'Put the exact session list in scheduleSessions. Also put the same sessions in schedule as newline-separated text.',
        'Every draft row must fit exactly one CareAround bucket: Programmes, Services, or Promotions.',
        'Programmes are scheduled activities, classes, workshops, talks, events, clubs, or recurring sessions.',
        'Services are ongoing support, consultations, screenings, assessments, care services, transport, therapy, or operational offerings.',
        'Promotions are discounts, benefits, campaigns, vouchers, grants, special offers, or limited-time deals.',
        'If a service is not clearly scheduled, leave schedule blank instead of inventing one.',
        'If a programme is marked full, printed in red where the collateral says red means full, fully booked, or no longer accepting participants, set availabilityStatus to "full", isHidden to true, visibilityAction to "hide", and mention this in venueNote.',
        'Do not create offerings for centre closure notices, public holidays, renovation notices, QR/community prompts, addresses, phone-number blocks, or general instructions. Put useful non-offering notes in warnings instead.',
        'Return only JSON matching the schema. No markdown.',
        categoryHint,
        tagHint,
        'For each detected offering candidate, extract these fields when present: bucket, name, subCategorySuggestion, description, schedule, scheduleSessions, newTags, contactPhone, contactEmail, ctaLabel, ctaUrl, venueNote, availabilityStatus, isHidden, visibilityAction, sourceExcerpt, confidence.',
        'availabilityStatus should be one of "available", "full", or "unknown". visibilityAction should be "hide" only when the reviewer should save the draft as hidden; otherwise use "preserve".',
        'Confidence should be a number from 0 to 1.',
        'sourceExcerpt should quote or tightly paraphrase the exact collateral text that supports the row.',
        'If the collateral includes general venue-level details instead of offering-specific details, only attach them to a row when they clearly belong to that row.',
        'Ignore decorative marketing copy that does not represent a real offering.',
    ].join('\n');
}

function buildCollateralResponseSchema() {
    return {
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
                        scheduleSessions: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        newTags: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        contactPhone: { type: 'string' },
                        contactEmail: { type: 'string' },
                        ctaLabel: { type: 'string' },
                        ctaUrl: { type: 'string' },
                        venueNote: { type: 'string' },
                        availabilityStatus: { type: 'string' },
                        isHidden: { type: 'boolean' },
                        visibilityAction: { type: 'string' },
                        sourceExcerpt: { type: 'string' },
                        confidence: { type: 'number' },
                    },
                    required: ['name'],
                },
            },
        },
        required: ['draftRows'],
    };
}

function buildGenerateContentBody({ prompt, fileParts }) {
    return {
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
            responseSchema: buildCollateralResponseSchema(),
        },
    };
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

function normalizeScheduleLine(value) {
    return normalizeText(value)
        .replace(/[–—]/g, '-')
        .replace(/\s*-\s*/g, '-')
        .toLowerCase();
}

function splitScheduleText(value) {
    const text = normalizeLongText(value);
    if (!text) return [];

    const lines = text
        .split(/\n+/)
        .map(normalizeText)
        .filter(Boolean);
    if (lines.length > 1) return lines;

    return text
        .split(/\s*(?:;|\|)\s*/)
        .map(normalizeText)
        .filter(Boolean);
}

function normalizeScheduleSessions(rawSessions, fallbackSchedule = '') {
    const sessionCandidates = [];
    if (Array.isArray(rawSessions)) {
        rawSessions.forEach((session) => {
            if (typeof session === 'string') {
                sessionCandidates.push(session);
                return;
            }
            if (session && typeof session === 'object') {
                const date = normalizeText(session.date || session.day || session.when || '');
                const time = normalizeText(session.time || session.hours || '');
                const note = normalizeText(session.note || session.remarks || '');
                const combined = [date, time, note].filter(Boolean).join(', ');
                if (combined) sessionCandidates.push(combined);
            }
        });
    }

    if (!sessionCandidates.length) {
        sessionCandidates.push(...splitScheduleText(fallbackSchedule));
    }

    const seen = new Set();
    return sessionCandidates
        .map(normalizeText)
        .filter((session) => {
            const key = normalizeScheduleLine(session);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function normalizeAvailabilityStatus(value, row = {}) {
    const status = normalizeText(value).toLowerCase();
    if (['available', 'full', 'unknown'].includes(status)) return status;

    const combined = [
        row?.description,
        row?.venueNote,
        row?.sourceExcerpt,
    ].map(normalizeText).join(' ').toLowerCase();

    if (/\bmarked\s+(as\s+)?full\b/.test(combined)
        || /\bis\s+full\b/.test(combined)
        || /\bprinted\s+in\s+red\b/.test(combined)
        || /\bred\s+programme\b/.test(combined)
        || /\bfully\s+booked\b/.test(combined)
        || /\bno\s+(slots|places|space|vacancies)\b/.test(combined)
        || /\bsold\s+out\b/.test(combined)) {
        return 'full';
    }

    return 'unknown';
}

function normalizeVisibilityAction(value, isHidden = false) {
    const action = normalizeText(value).toLowerCase();
    if (action === 'hide' || isHidden) return 'hide';
    return 'preserve';
}

function normalizeGroupingName(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/\([^)]*\b(?:mph|rn|blk|block|cck|ave|avenue)\b[^)]*\)/gi, ' ')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isLikelyNonOfferingNotice(row) {
    const name = normalizeText(row?.name).toLowerCase();
    if (!name) return true;

    const noticePatterns = [
        /\bcentre\s+close[sd]?\b/,
        /\bcenter\s+close[sd]?\b/,
        /\bclosed\s+for\s+renovation/,
        /\b(close|closed|closure)\b.{0,30}\brenovation(s)?\b/,
        /\brenovation(s)?\s+from\b/,
        /\blabou?r\s+day\b/,
        /\beid\s+al\s+adha\b/,
        /\bpublic\s+holiday\b/,
        /\bprogrammes?\s+in\s+red\s+are\s+full\b/,
        /\bthank\s+you\b/,
        /\bwhats?app\b/,
        /\bcommunity\s+chat\b/,
        /\bqr\s*code\b/,
        /\bblk\s+\d+/,
        /\bavenue\b.*#\d+/,
    ];

    return noticePatterns.some((pattern) => pattern.test(name));
}

function appendUniqueText(existing, next) {
    const values = splitScheduleText(existing);
    const seen = new Set(values.map((value) => normalizeText(value).toLowerCase()));
    splitScheduleText(next).forEach((value) => {
        const key = normalizeText(value).toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        values.push(value);
    });
    return values.join('\n');
}

function mergeTags(left = [], right = []) {
    const seen = new Set();
    return [...left, ...right]
        .map((tag) => normalizeText(tag).toLowerCase())
        .filter((tag) => {
            if (!tag || seen.has(tag)) return false;
            seen.add(tag);
            return true;
        })
        .slice(0, 12);
}

function addFullVenueNote(row) {
    const note = 'Marked full on source material.';
    if (normalizeText(row.venueNote).toLowerCase().includes('marked full')) return row.venueNote;
    return appendUniqueText(row.venueNote, note);
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
        scheduleSessions: normalizeScheduleSessions(
            rawRow?.scheduleSessions || rawRow?.sessions || rawRow?.sessionDates,
            rawRow?.schedule || '',
        ),
        newTags: normalizeTags(rawRow?.newTags, knownTagNames),
        contactPhone: normalizeText(rawRow?.contactPhone || ''),
        contactEmail: normalizeEmail(rawRow?.contactEmail || ''),
        ctaLabel: normalizeText(rawRow?.ctaLabel || ''),
        ctaUrl: normalizeUrl(rawRow?.ctaUrl || ''),
        venueNote: normalizeLongText(rawRow?.venueNote || ''),
        availabilityStatus: normalizeAvailabilityStatus(rawRow?.availabilityStatus || rawRow?.status, rawRow),
        isHidden: Boolean(rawRow?.isHidden),
        visibilityAction: normalizeVisibilityAction(rawRow?.visibilityAction, rawRow?.isHidden),
        sourceExcerpt: normalizeLongText(rawRow?.sourceExcerpt || ''),
        confidence: normalizeConfidence(rawRow?.confidence),
    };
}

export function consolidateCollateralDraftRows(draftRows = []) {
    const groups = new Map();
    const warnings = [];

    for (const draftRow of Array.isArray(draftRows) ? draftRows : []) {
        if (!draftRow?.name) continue;

        if (isLikelyNonOfferingNotice(draftRow)) {
            warnings.push(`Ignored "${draftRow.name}" because it looks like a notice, closure, or venue instruction rather than an offering.`);
            continue;
        }

        const bucket = normalizeText(draftRow.bucket) || 'Programmes';
        const groupName = normalizeGroupingName(draftRow.name) || normalizeText(draftRow.name).toLowerCase();
        const groupKey = `${bucket.toLowerCase()}::${groupName}`;
        const scheduleSessions = normalizeScheduleSessions(draftRow.scheduleSessions, draftRow.schedule);
        const availabilityStatus = normalizeAvailabilityStatus(draftRow.availabilityStatus, draftRow);
        const isFull = availabilityStatus === 'full';
        const isHidden = Boolean(draftRow.isHidden) || isFull;
        const visibilityAction = normalizeVisibilityAction(draftRow.visibilityAction, isHidden);

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                ...draftRow,
                bucket,
                scheduleSessions: [],
                schedule: '',
                newTags: [],
                sourceExcerpt: '',
                groupedFromCount: 0,
                sessionCount: 0,
                availabilityStatus: 'unknown',
                isHidden: false,
                visibilityAction: 'preserve',
                _confidenceTotal: 0,
            });
        }

        const group = groups.get(groupKey);
        group.groupedFromCount += 1;
        group._confidenceTotal += normalizeConfidence(draftRow.confidence);
        group.description = group.description?.length >= normalizeText(draftRow.description).length
            ? group.description
            : normalizeLongText(draftRow.description || '');
        group.subCategorySuggestion = group.subCategorySuggestion || draftRow.subCategorySuggestion || bucket;
        group.contactPhone = group.contactPhone || draftRow.contactPhone || '';
        group.contactEmail = group.contactEmail || draftRow.contactEmail || '';
        group.ctaLabel = group.ctaLabel || draftRow.ctaLabel || '';
        group.ctaUrl = group.ctaUrl || draftRow.ctaUrl || '';
        group.venueNote = appendUniqueText(group.venueNote, draftRow.venueNote);
        group.sourceExcerpt = appendUniqueText(group.sourceExcerpt, draftRow.sourceExcerpt);
        group.newTags = mergeTags(group.newTags, draftRow.newTags);
        group.availabilityStatus = isFull ? 'full' : group.availabilityStatus;
        group.isHidden = group.isHidden || isHidden;
        group.visibilityAction = normalizeVisibilityAction(group.visibilityAction, group.isHidden || visibilityAction === 'hide');

        const seenSessions = new Set(group.scheduleSessions.map(normalizeScheduleLine));
        scheduleSessions.forEach((session) => {
            const key = normalizeScheduleLine(session);
            if (!key || seenSessions.has(key)) return;
            seenSessions.add(key);
            group.scheduleSessions.push(session);
        });
    }

    const consolidatedRows = [...groups.values()].map((group) => {
        const scheduleSessions = group.scheduleSessions.length
            ? group.scheduleSessions
            : normalizeScheduleSessions([], group.schedule);
        const availabilityStatus = group.availabilityStatus === 'full' ? 'full' : 'unknown';
        const isHidden = Boolean(group.isHidden) || availabilityStatus === 'full';
        const visibilityAction = normalizeVisibilityAction(group.visibilityAction, isHidden);
        const row = {
            ...group,
            scheduleSessions,
            sessionCount: scheduleSessions.length,
            schedule: scheduleSessions.length ? scheduleSessions.join('\n') : normalizeLongText(group.schedule),
            availabilityStatus,
            isHidden,
            visibilityAction,
            confidence: normalizeConfidence(group._confidenceTotal / Math.max(group.groupedFromCount, 1)),
        };

        delete row._confidenceTotal;

        if (row.availabilityStatus === 'full') {
            row.venueNote = addFullVenueNote(row);
        }

        if (row.groupedFromCount > 1) {
            warnings.push(`Grouped ${row.groupedFromCount} "${row.name}" entries into one offering draft.`);
        }

        return row;
    });

    return { draftRows: consolidatedRows, warnings };
}

function extractTextFromAiResponse(responseJson, providerLabel = 'AI import') {
    const parts = responseJson?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        throw clientError(`${providerLabel} returned no extraction result.`, 502);
    }
    const combined = parts
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
    if (!combined) {
        throw clientError(`${providerLabel} returned an empty extraction result.`, 502);
    }
    return combined;
}

async function callVertexGenerateContent(config, body) {
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
        body: JSON.stringify(body),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('AI collateral import Vertex error:', {
            status: response.status,
            message: responseJson?.error?.message || responseJson?.error || 'Unknown Vertex error',
        });
        throw clientError(
            responseJson?.error?.message || 'Vertex AI could not process that collateral right now.',
            response.status >= 400 && response.status < 600 ? response.status : 502,
        );
    }

    return responseJson;
}

async function callGeminiGenerateContent(config, body) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const responseJson = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('AI collateral import Gemini error:', {
            status: response.status,
            message: responseJson?.error?.message || responseJson?.error || 'Unknown Gemini error',
        });
        throw clientError(
            'Gemini AI could not process that collateral right now. Check the Gemini API key, model access, and quota, then try again.',
            response.status >= 400 && response.status < 600 ? response.status : 502,
        );
    }

    return responseJson;
}

async function callAiGenerateContent(config, body) {
    if (config.provider === 'gemini') return callGeminiGenerateContent(config, body);
    return callVertexGenerateContent(config, body);
}

export async function extractCollateralDraftRows({
    env,
    hostAsset,
    files,
    softSubCategoryNames = [],
    knownTagNames = [],
}) {
    const config = resolveAiImportProviderConfig(env);
    validateFiles(files);

    const fileParts = await buildFileParts(files);
    const prompt = buildCollateralPrompt({ hostAsset, softSubCategoryNames, tagNames: knownTagNames });
    const responseJson = await callAiGenerateContent(
        config,
        buildGenerateContentBody({ prompt, fileParts }),
    );
    const rawText = extractTextFromAiResponse(
        responseJson,
        config.provider === 'gemini' ? 'Gemini AI' : 'Vertex AI',
    );

    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (err) {
        console.error('AI collateral import JSON parse error:', {
            provider: config.provider,
            message: err.message,
        });
        throw clientError(`${config.provider === 'gemini' ? 'Gemini AI' : 'Vertex AI'} returned malformed JSON. ${err.message}`, 502);
    }

    const normalizedDraftRows = (Array.isArray(parsed?.draftRows) ? parsed.draftRows : [])
        .map((row) => normalizeDraftRow(row, softSubCategoryNames, knownTagNames))
        .filter(Boolean);

    const parsedWarnings = Array.isArray(parsed?.warnings)
        ? parsed.warnings.map((warning) => normalizeText(warning)).filter(Boolean)
        : [];

    const consolidation = consolidateCollateralDraftRows(normalizedDraftRows);
    const draftRows = consolidation.draftRows;
    if (draftRows.length === 0) {
        throw clientError('No clear offerings could be extracted from that collateral. Try a cleaner scan or use manual creation.', 422);
    }

    const warnings = [...parsedWarnings, ...consolidation.warnings];

    return { draftRows, warnings };
}
