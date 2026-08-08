import { detectSocialPlatform } from './socialLinks.js';

const EMBEDDED_RESOURCE_CONTACT_LIMIT = 500;
const EMBEDDED_RESOURCE_URL_MAX_LENGTH = 2048;
const EMBEDDED_RESOURCE_PHONE_MAX_LENGTH = 80;
const SOCIAL_PLATFORM_KEYS = [
    'facebook',
    'instagram',
    'tiktok',
    'youtube',
    'linkedin',
];

function normalizeExternalHttpUrl(value) {
    const text = String(value || '').trim();
    if (!text || text.length > EMBEDDED_RESOURCE_URL_MAX_LENGTH) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return '';

    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
        return url.toString();
    } catch {
        return '';
    }
}

function normalizeContactPhone(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (
        !text
        || text.length > EMBEDDED_RESOURCE_PHONE_MAX_LENGTH
        || !/\d/.test(text)
        || /[<>\u0000-\u001f\u007f]/.test(text)
    ) {
        return '';
    }
    return text;
}

export function normalizeEmbeddedResourceContact(value) {
    const website = normalizeExternalHttpUrl(value?.website);
    const contactPhone = normalizeContactPhone(value?.contactPhone ?? value?.phone);
    const socialLinks = {};

    for (const key of SOCIAL_PLATFORM_KEYS) {
        const url = normalizeExternalHttpUrl(value?.socialLinks?.[key]);
        if (url && detectSocialPlatform(url) === key) socialLinks[key] = url;
    }

    return {
        ...(website ? { website } : {}),
        ...(contactPhone ? { contactPhone } : {}),
        ...(Object.keys(socialLinks).length ? { socialLinks } : {}),
    };
}

function buildResourceContactKey(row) {
    const resourceId = Number.parseInt(String(row?.resourceId ?? ''), 10);
    if (!['hard', 'soft'].includes(row?.resourceType) || !Number.isInteger(resourceId) || resourceId <= 0) {
        return '';
    }
    return `${row.resourceType}:${resourceId}`;
}

export function buildEmbeddedResourceContactSnapshot(directory) {
    const contacts = {};

    for (const place of directory?.places || []) {
        for (const row of place?.rows || []) {
            if (Object.keys(contacts).length >= EMBEDDED_RESOURCE_CONTACT_LIMIT) return contacts;
            if (row?.status === 'unavailable') continue;

            const key = buildResourceContactKey(row);
            if (!key || contacts[key]) continue;
            const contact = normalizeEmbeddedResourceContact(row);
            if (Object.keys(contact).length) contacts[key] = contact;
        }
    }

    return contacts;
}

export function normalizeEmbeddedResourceContactSnapshot(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const contacts = {};
    for (const [key, rawContact] of Object.entries(value)) {
        if (Object.keys(contacts).length >= EMBEDDED_RESOURCE_CONTACT_LIMIT) break;
        if (!/^(hard|soft):[1-9]\d*$/.test(key)) continue;

        const contact = normalizeEmbeddedResourceContact(rawContact);
        if (Object.keys(contact).length) contacts[key] = contact;
    }
    return contacts;
}

export function stripEmbeddedResourceContactsFromDirectory(directory) {
    if (!directory || typeof directory !== 'object') return directory;
    return {
        ...directory,
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map((row) => {
                const {
                    website,
                    contactPhone,
                    socialLinks,
                    ...publicRow
                } = row;
                void website;
                void contactPhone;
                void socialLinks;
                return publicRow;
            }),
        })),
    };
}

export function applyEmbeddedResourceContactSnapshot(directory, value) {
    if (!directory || typeof directory !== 'object') return directory;
    const contacts = normalizeEmbeddedResourceContactSnapshot(value);

    return {
        ...directory,
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map((row) => {
                if (row?.status === 'unavailable') return row;
                const contact = contacts[buildResourceContactKey(row)];
                return contact ? { ...row, ...contact } : row;
            }),
        })),
    };
}
