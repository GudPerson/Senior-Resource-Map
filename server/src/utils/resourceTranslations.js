import { and, eq, inArray } from 'drizzle-orm';

import { resourceTranslations } from '../db/schema.js';
import { cleanOneLineText, cleanText } from './inputValidation.js';

export const SOURCE_LOCALE = 'en';
export const TARGET_LOCALES = ['zh-CN', 'ms', 'ta'];
export const SUPPORTED_LOCALES = [SOURCE_LOCALE, ...TARGET_LOCALES];

const TRANSLATABLE_FIELDS = {
    hard: {
        name: { maxLength: 255, oneLine: true },
        subCategory: { maxLength: 80, oneLine: true },
        address: { maxLength: 500, oneLine: true },
        hours: { maxLength: 2000 },
        description: { maxLength: 8000 },
    },
    soft: {
        name: { maxLength: 255, oneLine: true },
        bucket: { maxLength: 40, oneLine: true },
        subCategory: { maxLength: 80, oneLine: true },
        description: { maxLength: 8000 },
        schedule: { maxLength: 5000 },
        ctaLabel: { maxLength: 255, oneLine: true },
        venueNote: { maxLength: 3000 },
        availabilityUnit: { maxLength: 80, oneLine: true },
    },
    template: {
        name: { maxLength: 255, oneLine: true },
        bucket: { maxLength: 40, oneLine: true },
        subCategory: { maxLength: 80, oneLine: true },
        description: { maxLength: 8000 },
        schedule: { maxLength: 5000 },
    },
};

const LOCALE_LABELS = {
    'zh-CN': 'Mandarin',
    ms: 'Malay',
    ta: 'Tamil',
};

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

function normalizeRuntimeEnv(runtimeEnv = {}) {
    return runtimeEnv?.env ?? runtimeEnv ?? {};
}

export function resolveTranslationConfig(runtimeEnv = {}) {
    const env = normalizeRuntimeEnv(runtimeEnv);
    const projectId = readEnvValue(env, 'GOOGLE_TRANSLATE_PROJECT_ID', 'VERTEX_AI_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT');
    const serviceAccountJson = readEnvValue(env, 'GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON', 'VERTEX_AI_SERVICE_ACCOUNT_JSON');
    const location = readEnvValue(env, 'GOOGLE_TRANSLATE_LOCATION') || 'global';

    if (!projectId || !serviceAccountJson) {
        return null;
    }

    let parsedServiceAccount;
    try {
        parsedServiceAccount = JSON.parse(serviceAccountJson);
    } catch (err) {
        const error = new Error(`Google Translation service-account JSON is invalid. ${err.message}`);
        error.status = 500;
        throw error;
    }

    if (!parsedServiceAccount?.client_email || !parsedServiceAccount?.private_key) {
        const error = new Error('Google Translation service-account JSON must include client_email and private_key.');
        error.status = 500;
        throw error;
    }

    return {
        projectId,
        location,
        clientEmail: parsedServiceAccount.client_email,
        privateKey: String(parsedServiceAccount.private_key).replace(/\\n/g, '\n'),
    };
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

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.access_token) {
        const error = new Error(data?.error_description || data?.error || 'Failed to authenticate with Google Translation.');
        error.status = 502;
        throw error;
    }

    return {
        accessToken: data.access_token,
        expiresAt: Date.now() + ((Number(data.expires_in) || 3600) - 60) * 1000,
    };
}

async function getGoogleTranslationAccessToken(config) {
    const cacheKey = `${config.projectId}:${config.location}:${config.clientEmail}`;
    globalThis.__carearoundTranslateTokenCache = globalThis.__carearoundTranslateTokenCache || new Map();
    const cache = globalThis.__carearoundTranslateTokenCache;
    const cached = cache.get(cacheKey);
    if (cached?.accessToken && cached.expiresAt > Date.now()) {
        return cached.accessToken;
    }

    const fresh = await mintGoogleAccessToken(config);
    cache.set(cacheKey, fresh);
    return fresh.accessToken;
}

export async function translateTextBatch(config, locale, values) {
    if (!Array.isArray(values) || values.length === 0) return [];

    const accessToken = await getGoogleTranslationAccessToken(config);
    const endpoint = `https://translation.googleapis.com/v3/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}:translateText`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: values,
            mimeType: 'text/plain',
            sourceLanguageCode: SOURCE_LOCALE,
            targetLanguageCode: locale,
        }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        console.error('Google Translation API error:', {
            status: response.status,
            message: data?.error?.message || data?.error || 'Unknown translation error',
        });
        const error = new Error('Auto-translation could not run right now. English content was saved, but translations may need to be regenerated later.');
        error.status = response.status >= 400 && response.status < 600 ? response.status : 502;
        throw error;
    }

    return (data?.translations || []).map((item) => cleanText(item?.translatedText || '', 10000));
}

function hashText(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    if (['hard', 'soft', 'template'].includes(type)) return type;
    if (type === 'soft_parent' || type === 'parent') return 'template';
    return null;
}

export function normalizeLocale(value) {
    const text = String(value || '').trim();
    return TARGET_LOCALES.includes(text) ? text : null;
}

export function getLocaleLabel(locale) {
    return LOCALE_LABELS[locale] || locale;
}

export function getTranslatableFieldConfig(resourceType) {
    return TRANSLATABLE_FIELDS[normalizeResourceType(resourceType)] || {};
}

export function extractTranslatableFields(resourceType, source) {
    const config = getTranslatableFieldConfig(resourceType);
    const fields = {};

    for (const [field, options] of Object.entries(config)) {
        const cleaner = options.oneLine ? cleanOneLineText : cleanText;
        const value = cleaner(source?.[field], options.maxLength || 5000);
        if (value) fields[field] = value;
    }

    return fields;
}

function normalizeJsonObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTranslationRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        locale: row.locale,
        fields: normalizeJsonObject(row.fields),
        fieldMeta: normalizeJsonObject(row.fieldMeta),
        reviewedAt: row.reviewedAt || null,
        updatedAt: row.updatedAt || null,
    };
}

export function buildTranslationMap(rows = []) {
    return rows.reduce((map, row) => {
        const normalized = normalizeTranslationRow(row);
        if (!normalized) return map;
        const key = `${normalized.resourceType}:${normalized.resourceId}`;
        const current = map.get(key) || {};
        current[normalized.locale] = {
            fields: normalized.fields,
            fieldMeta: normalized.fieldMeta,
            reviewedAt: normalized.reviewedAt,
            updatedAt: normalized.updatedAt,
        };
        map.set(key, current);
        return map;
    }, new Map());
}

export async function loadTranslationsForResources(db, resourceType, resourceIds = []) {
    const type = normalizeResourceType(resourceType);
    const ids = [...new Set(resourceIds.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!type || ids.length === 0) return new Map();

    if (typeof db.listResourceTranslations === 'function') {
        return buildTranslationMap(await db.listResourceTranslations(type, ids));
    }

    const rows = await db.query.resourceTranslations.findMany({
        where: and(
            eq(resourceTranslations.resourceType, type),
            inArray(resourceTranslations.resourceId, ids),
        ),
    });
    return buildTranslationMap(rows);
}

export async function loadTranslationsForResource(db, resourceType, resourceId) {
    const type = normalizeResourceType(resourceType);
    const id = Number.parseInt(resourceId, 10);
    if (!type || !Number.isInteger(id) || id <= 0) return {};

    if (typeof db.listResourceTranslations === 'function') {
        return buildTranslationMap(await db.listResourceTranslations(type, [id])).get(`${type}:${id}`) || {};
    }

    const rows = await db.query.resourceTranslations.findMany({
        where: and(
            eq(resourceTranslations.resourceType, type),
            eq(resourceTranslations.resourceId, id),
        ),
    });
    return buildTranslationMap(rows).get(`${type}:${id}`) || {};
}

export function sanitizeTranslationsForPublicPayload(translations = {}) {
    return Object.entries(translations || {}).reduce((result, [locale, entry]) => {
        const fields = entry?.fields && typeof entry.fields === 'object'
            ? { ...entry.fields }
            : {};
        const staleFieldMeta = Object.entries(entry?.fieldMeta || {})
            .filter(([, meta]) => meta?.status === 'stale')
            .reduce((metaResult, [field]) => ({
                ...metaResult,
                [field]: { status: 'stale' },
            }), {});

        result[locale] = Object.keys(staleFieldMeta).length > 0
            ? { fields, fieldMeta: staleFieldMeta }
            : { fields };
        return result;
    }, {});
}

export function attachTranslations(resource, translations) {
    if (!resource) return resource;
    return {
        ...resource,
        translations: sanitizeTranslationsForPublicPayload(translations),
    };
}

async function upsertTranslationRow(db, {
    resourceType,
    resourceId,
    locale,
    fields,
    fieldMeta,
    updatedByUserId = null,
    reviewedAt = null,
}) {
    if (typeof db.upsertResourceTranslation === 'function') {
        return db.upsertResourceTranslation({
            resourceType,
            resourceId,
            locale,
            fields,
            fieldMeta,
            updatedByUserId,
            reviewedAt,
        });
    }

    const existing = await db.query.resourceTranslations.findFirst({
        where: and(
            eq(resourceTranslations.resourceType, resourceType),
            eq(resourceTranslations.resourceId, resourceId),
            eq(resourceTranslations.locale, locale),
        ),
    });

    const payload = {
        fields,
        fieldMeta,
        reviewedAt,
        updatedByUserId,
        updatedAt: new Date(),
    };

    if (existing) {
        await db.update(resourceTranslations)
            .set(payload)
            .where(eq(resourceTranslations.id, existing.id));
        return { ...existing, ...payload };
    }

    const [created] = await db.insert(resourceTranslations).values({
        resourceType,
        resourceId,
        locale,
        ...payload,
    }).returning();
    return created;
}

export async function syncResourceTranslations(db, env, {
    resourceType,
    resourceId,
    source,
    updatedByUserId = null,
    force = false,
    targetLocales = TARGET_LOCALES,
    translator = translateTextBatch,
} = {}) {
    const type = normalizeResourceType(resourceType);
    const id = Number.parseInt(resourceId, 10);
    if (!type || !Number.isInteger(id) || id <= 0) {
        return { status: 'skipped', message: 'Resource type or id is invalid.' };
    }

    const sourceFields = extractTranslatableFields(type, source);
    if (Object.keys(sourceFields).length === 0) {
        return { status: 'skipped', message: 'No English text fields were available for translation.' };
    }

    const config = resolveTranslationConfig(env);
    if (!config) {
        return { status: 'not_configured', message: 'Auto-translation is not configured. English was saved.' };
    }

    const currentTranslations = await loadTranslationsForResource(db, type, id);
    const translatedLocales = [];
    const staleFields = [];
    const translatedFields = [];

    const localesToSync = targetLocales.map(normalizeLocale).filter(Boolean);
    for (const locale of localesToSync) {
        const current = currentTranslations[locale] || {};
        const nextFields = { ...normalizeJsonObject(current.fields) };
        const nextMeta = { ...normalizeJsonObject(current.fieldMeta) };
        const fieldNamesToTranslate = [];
        const valuesToTranslate = [];

        for (const [field, sourceText] of Object.entries(sourceFields)) {
            const nextSourceHash = hashText(sourceText);
            const meta = normalizeJsonObject(nextMeta[field]);
            const hasTranslation = cleanText(nextFields[field] || '', 10000);
            const sourceChanged = meta.sourceHash && meta.sourceHash !== nextSourceHash;
            const manuallyControlled = ['human_edited', 'reviewed', 'stale'].includes(meta.status);

            if (sourceChanged && manuallyControlled && !force) {
                nextMeta[field] = {
                    ...meta,
                    status: 'stale',
                    staleSourceHash: nextSourceHash,
                    staleAt: new Date().toISOString(),
                };
                staleFields.push(`${locale}:${field}`);
                continue;
            }

            if (force || !hasTranslation || sourceChanged || meta.status === 'stale') {
                fieldNamesToTranslate.push(field);
                valuesToTranslate.push(sourceText);
            }
        }

        if (fieldNamesToTranslate.length > 0) {
            const translatedValues = await translator(config, locale, valuesToTranslate);
            fieldNamesToTranslate.forEach((field, index) => {
                const sourceText = sourceFields[field];
                nextFields[field] = translatedValues[index] || nextFields[field] || '';
                nextMeta[field] = {
                    status: 'machine',
                    sourceHash: hashText(sourceText),
                    lastTranslatedAt: new Date().toISOString(),
                };
                translatedFields.push(`${locale}:${field}`);
            });
        }

        await upsertTranslationRow(db, {
            resourceType: type,
            resourceId: id,
            locale,
            fields: nextFields,
            fieldMeta: nextMeta,
            updatedByUserId,
        });
        translatedLocales.push(locale);
    }

    return {
        status: 'ok',
        translatedLocales,
        translatedFields,
        staleFields,
    };
}

export async function saveManualTranslation(db, {
    resourceType,
    resourceId,
    locale,
    source,
    fields = {},
    reviewedFields = [],
    updatedByUserId,
}) {
    const type = normalizeResourceType(resourceType);
    const id = Number.parseInt(resourceId, 10);
    const targetLocale = normalizeLocale(locale);
    if (!type || !targetLocale || !Number.isInteger(id) || id <= 0) {
        const error = new Error('Translation target is invalid.');
        error.status = 400;
        throw error;
    }

    const sourceFields = extractTranslatableFields(type, source);
    const fieldConfig = getTranslatableFieldConfig(type);
    const currentTranslations = await loadTranslationsForResource(db, type, id);
    const current = currentTranslations[targetLocale] || {};
    const nextFields = { ...normalizeJsonObject(current.fields) };
    const nextMeta = { ...normalizeJsonObject(current.fieldMeta) };
    const reviewedFieldSet = new Set(
        (Array.isArray(reviewedFields) ? reviewedFields : [])
            .map((field) => String(field || '').trim())
            .filter((field) => Object.prototype.hasOwnProperty.call(fieldConfig, field)),
    );

    for (const [field, options] of Object.entries(fieldConfig)) {
        if (!Object.prototype.hasOwnProperty.call(fields || {}, field)) continue;
        const cleaner = options.oneLine ? cleanOneLineText : cleanText;
        const value = cleaner(fields[field], options.maxLength || 5000);
        const currentValue = cleaner(nextFields[field], options.maxLength || 5000);
        const sourceHash = sourceFields[field] ? hashText(sourceFields[field]) : null;
        if (value) {
            nextFields[field] = value;
            if (reviewedFieldSet.has(field) && value === currentValue) {
                const currentMeta = normalizeJsonObject(nextMeta[field]);
                nextMeta[field] = {
                    ...currentMeta,
                    status: currentMeta.status === 'human_edited' ? 'human_edited' : 'reviewed',
                    sourceHash,
                    reviewedAt: new Date().toISOString(),
                };
            } else {
                nextMeta[field] = {
                    status: 'human_edited',
                    sourceHash,
                    lastEditedAt: new Date().toISOString(),
                };
            }
        } else {
            delete nextFields[field];
            delete nextMeta[field];
        }
    }

    for (const field of reviewedFieldSet) {
        if (Object.prototype.hasOwnProperty.call(fields || {}, field)) continue;
        const options = fieldConfig[field];
        const cleaner = options.oneLine ? cleanOneLineText : cleanText;
        const value = cleaner(nextFields[field], options.maxLength || 5000);
        if (!value) continue;
        const currentMeta = normalizeJsonObject(nextMeta[field]);
        nextMeta[field] = {
            ...currentMeta,
            status: currentMeta.status === 'human_edited' ? 'human_edited' : 'reviewed',
            sourceHash: sourceFields[field] ? hashText(sourceFields[field]) : null,
            reviewedAt: new Date().toISOString(),
        };
    }

    await upsertTranslationRow(db, {
        resourceType: type,
        resourceId: id,
        locale: targetLocale,
        fields: nextFields,
        fieldMeta: nextMeta,
        updatedByUserId,
        reviewedAt: new Date(),
    });

    return loadTranslationsForResource(db, type, id);
}
