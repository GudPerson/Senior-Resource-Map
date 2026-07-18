import { inferSoftAssetBucket, normalizeSoftAssetBucket } from './softAssetBuckets.js';
import { parseImportedScheduleSessions } from './offeringSchedule.js';
import {
    assertAiImportAllowed,
    fingerprintAiValue,
    getCachedAiResult,
    readEnvValue,
    setCachedAiResult,
} from './aiCostControls.js';

const DEFAULT_VERTEX_LOCATION = 'global';
const DEFAULT_VERTEX_MODEL = 'gemini-2.5-flash';
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const COLLATERAL_EXTRACTION_CONTRACT_VERSION = 5;
const MAX_TOTAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;
const AI_IMPORT_NOT_CONFIGURED_MESSAGE = 'AI import is not set up for this environment yet. Ask the system administrator to enable the AI collateral import service before trying again.';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
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
    const providerPreference = readEnvValue(runtimeEnv, 'AI_IMPORT_PROVIDER').toLowerCase();
    const vertexConfig = resolveVertexConfig(runtimeEnv);
    const geminiConfig = resolveGeminiConfig(runtimeEnv);
    if (providerPreference === 'vertex') {
        if (vertexConfig) return vertexConfig;
        throw clientError('AI_IMPORT_PROVIDER is set to Vertex, but Vertex AI is not configured for this environment.', 503);
    }
    if (providerPreference === 'gemini') {
        if (geminiConfig) return geminiConfig;
        throw clientError('AI_IMPORT_PROVIDER is set to Gemini, but Gemini API is not configured for this environment.', 503);
    }

    if (geminiConfig) return geminiConfig;
    if (vertexConfig) return vertexConfig;

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
        'If the collateral has a visible calendar heading such as "JULY 2026", put it in the root calendarContext field and repeat it in each affected row scheduleContext field.',
        'When source rows show a time line plus date bullets such as "9.30AM - 10.30AM" and "6/7, 13/7, 20/7", preserve that text in scheduleSessions and include scheduleContext such as "July 2026".',
        'Put the exact session list in scheduleSessions. Also put the same sessions in schedule as newline-separated text.',
        'Also return every publishable first-cut session in scheduleEntries. Use type "once" for an exact date and type "weekly" only when the source explicitly describes a recurring weekly series.',
        'Each scheduleEntries item must include startsAt as an absolute Singapore datetime such as "2026-05-04T09:00:00+08:00". Include endsAt only when an end time is printed. Weekly items must also include weekday numbers (Sunday 0 through Saturday 6) and repeatUntil when the source gives a final date.',
        'Never invent a date, year, time, recurrence boundary, or placeholder schedule entry. If the source does not provide enough information for a valid start date and time, leave scheduleEntries empty and keep the source wording in schedule or scheduleSessions for manual review.',
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
        'For each detected offering candidate, extract these fields when present: bucket, name, subCategorySuggestion, description, schedule, scheduleContext, scheduleSessions, scheduleEntries, newTags, contactPhone, whatsappContact, contactEmail, ctaLabel, ctaUrl, venueNote, availabilityStatus, isHidden, visibilityAction, sourceExcerpt, confidence.',
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
            calendarContext: { type: 'string' },
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
                        scheduleContext: { type: 'string' },
                        scheduleSessions: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        scheduleEntries: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string' },
                                    startsAt: { type: 'string' },
                                    endsAt: { type: 'string' },
                                    weekdays: {
                                        type: 'array',
                                        items: { type: 'integer' },
                                    },
                                    repeatUntil: { type: 'string' },
                                    status: { type: 'string' },
                                    note: { type: 'string' },
                                },
                                required: ['type', 'startsAt'],
                            },
                        },
                        newTags: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        contactPhone: { type: 'string' },
                        whatsappContact: { type: 'string' },
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
                    required: [
                        'bucket',
                        'name',
                        'schedule',
                        'scheduleContext',
                        'scheduleSessions',
                        'scheduleEntries',
                        'sourceExcerpt',
                        'confidence',
                    ],
                },
            },
        },
        required: ['warnings', 'calendarContext', 'draftRows'],
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

function buildScheduleRescuePrompt({ hostAsset, draftRows }) {
    const offeringNames = draftRows
        .map((row) => normalizeText(row?.name))
        .filter(Boolean)
        .map((name) => `- ${name}`)
        .join('\n');

    return [
        'Transcribe only the printed schedule evidence from this CareAround SG collateral.',
        `The collateral belongs to this host place: ${hostAsset.name}${hostAsset.address ? `, ${hostAsset.address}` : ''}.`,
        'This is a focused transcription pass, not a programme-classification or schedule-inference pass.',
        'Copy the visible calendar month and year into calendarContext, for example "July 2026".',
        'For each listed offering, return its exact printed time line and every date bullet or weekday rule in scheduleSessions.',
        'Keep separate printed lines separate. Preserve shorthand such as "6/7", dot times such as "1.30PM", and weekday wording such as "Mon to Wed & Fri".',
        'Use the offering name exactly as listed below so the transcription can be matched safely.',
        'If no schedule is visibly printed for an offering, return an empty scheduleSessions array for that offering.',
        'Do not invent, calculate, normalize, or convert dates and times. Do not include closure notices, registration instructions, addresses, or contact details as schedules.',
        'Return only JSON matching the schema. No markdown.',
        'Offering names:',
        offeringNames,
    ].join('\n');
}

function buildScheduleRescueResponseSchema() {
    return {
        type: 'object',
        properties: {
            calendarContext: { type: 'string' },
            scheduleRows: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        scheduleContext: { type: 'string' },
                        scheduleSessions: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                    required: ['name', 'scheduleContext', 'scheduleSessions'],
                },
            },
        },
        required: ['calendarContext', 'scheduleRows'],
    };
}

function buildScheduleRescueBody({ prompt, fileParts }) {
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
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: buildScheduleRescueResponseSchema(),
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

function normalizeDraftRow(rawRow, softSubCategoryNames, knownTagNames, inheritedScheduleContext = '') {
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

    const scheduleContext = normalizeText(
        rawRow?.scheduleContext
        || rawRow?.calendarContext
        || rawRow?.calendarMonthYear
        || inheritedScheduleContext,
    );

    const parsedStructuredSchedule = parseImportedScheduleSessions(
        rawRow?.scheduleEntries || rawRow?.structuredScheduleEntries || [],
        '',
        { contextText: scheduleContext },
    );

    return {
        bucket,
        name: normalizedName,
        subCategorySuggestion: subCategorySuggestion || bucket,
        description: normalizeLongText(rawRow?.description || ''),
        schedule: normalizeLongText(rawRow?.schedule || ''),
        scheduleContext,
        scheduleSessions: normalizeScheduleSessions(
            rawRow?.scheduleSessions || rawRow?.sessions || rawRow?.sessionDates,
            rawRow?.schedule || '',
        ),
        scheduleEntries: parsedStructuredSchedule.entries,
        unparsedScheduleLines: parsedStructuredSchedule.unparsed,
        newTags: normalizeTags(rawRow?.newTags, knownTagNames),
        contactPhone: normalizeText(rawRow?.contactPhone || ''),
        whatsappContact: normalizeText(rawRow?.whatsappContact || rawRow?.whatsAppContact || rawRow?.whatsapp || ''),
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

function scheduleEntrySignature(entry = {}) {
    return JSON.stringify({
        type: entry.type || 'once',
        startsAt: entry.startsAt || '',
        endsAt: entry.endsAt || '',
        weekdays: Array.isArray(entry.weekdays) ? entry.weekdays : [],
        repeatUntil: entry.repeatUntil || '',
        status: entry.status || 'active',
    });
}

function appendUniqueScheduleEntries(existing = [], additions = []) {
    const next = [...existing];
    const seen = new Set(next.map(scheduleEntrySignature));
    additions.forEach((entry) => {
        const signature = scheduleEntrySignature(entry);
        if (seen.has(signature)) return;
        seen.add(signature);
        next.push(entry);
    });
    return next;
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
        const scheduleContext = normalizeText(draftRow.scheduleContext);
        const scheduleParseContext = [
            scheduleContext,
            draftRow.sourceExcerpt,
            draftRow.description,
        ].map(normalizeText).filter(Boolean).join('\n');
        const parsedStructuredSchedule = parseImportedScheduleSessions(
            draftRow.scheduleEntries || [],
            '',
            { contextText: scheduleParseContext },
        );
        const parsedTextSchedule = parsedStructuredSchedule.entries.length > 0
            ? { entries: [], unparsed: [] }
            : parseImportedScheduleSessions(scheduleSessions, draftRow.schedule, { contextText: scheduleParseContext });
        const validatedScheduleEntries = appendUniqueScheduleEntries(
            parsedStructuredSchedule.entries,
            parsedTextSchedule.entries,
        );
        const availabilityStatus = normalizeAvailabilityStatus(draftRow.availabilityStatus, draftRow);
        const isFull = availabilityStatus === 'full';
        const isHidden = Boolean(draftRow.isHidden) || isFull;
        const visibilityAction = normalizeVisibilityAction(draftRow.visibilityAction, isHidden);

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                ...draftRow,
                bucket,
                scheduleSessions: [],
                scheduleEntries: [],
                unparsedScheduleLines: [],
                schedule: '',
                scheduleContext: '',
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
        group.scheduleContext = group.scheduleContext || scheduleContext;
        group.contactPhone = group.contactPhone || draftRow.contactPhone || '';
        group.whatsappContact = group.whatsappContact || draftRow.whatsappContact || '';
        group.contactEmail = group.contactEmail || draftRow.contactEmail || '';
        group.ctaLabel = group.ctaLabel || draftRow.ctaLabel || '';
        group.ctaUrl = group.ctaUrl || draftRow.ctaUrl || '';
        group.venueNote = appendUniqueText(group.venueNote, draftRow.venueNote);
        group.sourceExcerpt = appendUniqueText(group.sourceExcerpt, draftRow.sourceExcerpt);
        group.newTags = mergeTags(group.newTags, draftRow.newTags);
        group.scheduleEntries = appendUniqueScheduleEntries(group.scheduleEntries, validatedScheduleEntries);
        group.unparsedScheduleLines = appendUniqueText(
            group.unparsedScheduleLines.join('\n'),
            [
                ...(draftRow.unparsedScheduleLines || []),
                ...parsedStructuredSchedule.unparsed,
                ...parsedTextSchedule.unparsed,
            ].join('\n'),
        ).split('\n').filter(Boolean);
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
        const scheduleEntries = group.scheduleEntries;
        const row = {
            ...group,
            scheduleSessions,
            scheduleEntries,
            unparsedScheduleLines: [...new Set(group.unparsedScheduleLines)],
            sessionCount: scheduleEntries.length,
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

function normalizeCollateralExtractionResult(result, softSubCategoryNames, knownTagNames) {
    const inheritedScheduleContext = normalizeText(
        result?.calendarContext
        || result?.scheduleContext
        || result?.calendarMonthYear,
    );
    const normalizedDraftRows = (Array.isArray(result?.draftRows) ? result.draftRows : [])
        .map((row) => normalizeDraftRow(row, softSubCategoryNames, knownTagNames, inheritedScheduleContext))
        .filter(Boolean);
    const parsedWarnings = Array.isArray(result?.warnings)
        ? result.warnings.map((warning) => normalizeText(warning)).filter(Boolean)
        : [];
    const consolidation = consolidateCollateralDraftRows(normalizedDraftRows);

    return {
        draftRows: consolidation.draftRows,
        warnings: [...new Set([...parsedWarnings, ...consolidation.warnings])],
    };
}

function rowHasScheduleEvidence(row = {}) {
    return Boolean(
        (Array.isArray(row.scheduleEntries) && row.scheduleEntries.length > 0)
        || (Array.isArray(row.scheduleSessions) && row.scheduleSessions.length > 0)
        || (Array.isArray(row.unparsedScheduleLines) && row.unparsedScheduleLines.length > 0)
        || normalizeText(row.schedule),
    );
}

function needsScheduleTranscriptionRescue(result = {}) {
    const programmeRows = (Array.isArray(result.draftRows) ? result.draftRows : [])
        .filter((row) => normalizeText(row?.bucket).toLowerCase() === 'programmes');
    return programmeRows.length >= 3 && programmeRows.every((row) => !rowHasScheduleEvidence(row));
}

function mergeScheduleTranscription(result, transcription = {}) {
    const inheritedScheduleContext = normalizeText(
        transcription?.calendarContext
        || transcription?.scheduleContext
        || transcription?.calendarMonthYear,
    );
    const scheduleRowsByName = new Map();

    (Array.isArray(transcription?.scheduleRows) ? transcription.scheduleRows : []).forEach((row) => {
        const name = normalizeText(row?.name);
        const groupingName = normalizeGroupingName(name);
        if (!groupingName) return;
        const scheduleSessions = normalizeScheduleSessions(
            row?.scheduleSessions || row?.sessions || row?.sessionDates,
            row?.schedule || '',
        );
        scheduleRowsByName.set(groupingName, {
            scheduleContext: normalizeText(row?.scheduleContext || inheritedScheduleContext),
            scheduleSessions,
        });
    });

    const mergedRows = (Array.isArray(result?.draftRows) ? result.draftRows : []).map((row) => {
        if (rowHasScheduleEvidence(row)) return row;
        const transcriptionRow = scheduleRowsByName.get(normalizeGroupingName(row?.name));
        if (!transcriptionRow?.scheduleSessions.length) return row;
        return {
            ...row,
            scheduleContext: normalizeText(row.scheduleContext || transcriptionRow.scheduleContext),
            scheduleSessions: transcriptionRow.scheduleSessions,
            schedule: transcriptionRow.scheduleSessions.join('\n'),
        };
    });
    const consolidation = consolidateCollateralDraftRows(mergedRows);

    return {
        draftRows: consolidation.draftRows,
        warnings: [...new Set([
            ...(Array.isArray(result?.warnings) ? result.warnings : []),
            ...consolidation.warnings,
        ])],
    };
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

async function rescueMissingScheduleText({
    env,
    config,
    hostAsset,
    fileParts,
    extraction,
}) {
    await assertAiImportAllowed(env);
    const responseJson = await callAiGenerateContent(
        config,
        buildScheduleRescueBody({
            prompt: buildScheduleRescuePrompt({ hostAsset, draftRows: extraction.draftRows }),
            fileParts,
        }),
    );
    const rawText = extractTextFromAiResponse(
        responseJson,
        config.provider === 'gemini' ? 'Gemini AI schedule transcription' : 'Vertex AI schedule transcription',
    );

    let transcription;
    try {
        transcription = JSON.parse(rawText);
    } catch (err) {
        console.error('AI collateral schedule transcription JSON parse error:', {
            provider: config.provider,
            message: err.message,
        });
        throw clientError('AI schedule transcription returned malformed JSON.', 502);
    }

    return mergeScheduleTranscription(extraction, transcription);
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
    const cachePayload = {
        extractionContractVersion: COLLATERAL_EXTRACTION_CONTRACT_VERSION,
        provider: config.provider,
        model: config.model,
        prompt,
        files: fileParts.map((part) => ({
            mimeType: part.inlineData.mimeType,
            dataLength: part.inlineData.data.length,
            dataFingerprint: fingerprintAiValue(part.inlineData.data),
        })),
    };
    const cached = await getCachedAiResult(env, 'collateral-import', cachePayload);
    if (cached) {
        const normalizedCached = normalizeCollateralExtractionResult(
            cached,
            softSubCategoryNames,
            knownTagNames,
        );
        if (normalizedCached.draftRows.length > 0) return normalizedCached;
    }

    await assertAiImportAllowed(env);
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

    let normalizedResult = normalizeCollateralExtractionResult(parsed, softSubCategoryNames, knownTagNames);
    if (needsScheduleTranscriptionRescue(normalizedResult)) {
        try {
            normalizedResult = await rescueMissingScheduleText({
                env,
                config,
                hostAsset,
                fileParts,
                extraction: normalizedResult,
            });
        } catch (err) {
            console.error('AI collateral schedule transcription rescue error:', {
                provider: config.provider,
                status: err?.status || 500,
                message: err?.message || 'Unknown schedule transcription error',
            });
            normalizedResult = {
                ...normalizedResult,
                warnings: [...new Set([
                    ...normalizedResult.warnings,
                    'Programme names were extracted, but schedule transcription could not be completed. Retry the preview or review the schedules manually.',
                ])],
            };
        }
    }

    const draftRows = normalizedResult.draftRows;
    if (draftRows.length === 0) {
        throw clientError('No clear offerings could be extracted from that collateral. Try a cleaner scan or use manual creation.', 422);
    }

    const warnings = normalizedResult.warnings;

    if (needsScheduleTranscriptionRescue(normalizedResult)) {
        return { draftRows, warnings };
    }

    return setCachedAiResult(env, 'collateral-import', cachePayload, { draftRows, warnings });
}
