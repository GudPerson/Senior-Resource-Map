const SOCIAL_PLATFORM_CONFIG = [
    { key: 'facebook', domains: ['facebook.com', 'fb.com'] },
    { key: 'instagram', domains: ['instagram.com'] },
    { key: 'tiktok', domains: ['tiktok.com'] },
    { key: 'youtube', domains: ['youtube.com', 'youtu.be'] },
    { key: 'linkedin', domains: ['linkedin.com'] },
];

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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

export function createEmptySocialLinks() {
    return {
        facebook: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        linkedin: '',
    };
}

export function detectSocialPlatform(url) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return '';

    let hostname = '';
    try {
        hostname = new URL(normalizedUrl).hostname.toLowerCase();
    } catch {
        return '';
    }

    const normalizedHost = hostname.replace(/^www\./, '').replace(/^m\./, '');
    const match = SOCIAL_PLATFORM_CONFIG.find((platform) => (
        platform.domains.some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`))
    ));

    return match?.key || '';
}

export function normalizeSocialLinks(value) {
    const normalized = createEmptySocialLinks();
    if (!value || typeof value !== 'object') return normalized;

    for (const platform of SOCIAL_PLATFORM_CONFIG) {
        normalized[platform.key] = normalizeUrl(value?.[platform.key]);
    }

    return normalized;
}

export function mergeSocialLinks(...sources) {
    const merged = createEmptySocialLinks();

    for (const source of sources) {
        const normalized = normalizeSocialLinks(source);
        for (const platform of SOCIAL_PLATFORM_CONFIG) {
            if (!merged[platform.key] && normalized[platform.key]) {
                merged[platform.key] = normalized[platform.key];
            }
        }
    }

    return merged;
}

export function splitWebsiteAndSocialLinks(url) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
        return {
            website: '',
            socialLinks: createEmptySocialLinks(),
        };
    }

    const platform = detectSocialPlatform(normalizedUrl);
    if (!platform) {
        return {
            website: normalizedUrl,
            socialLinks: createEmptySocialLinks(),
        };
    }

    return {
        website: '',
        socialLinks: {
            ...createEmptySocialLinks(),
            [platform]: normalizedUrl,
        },
    };
}
