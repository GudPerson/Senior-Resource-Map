export const SOCIAL_PLATFORMS = [
    { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-page' },
    { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-account' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@your-account' },
    { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@your-channel' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/your-page' },
];

const SOCIAL_PLATFORM_DOMAINS = {
    facebook: ['facebook.com', 'fb.com'],
    instagram: ['instagram.com'],
    tiktok: ['tiktok.com'],
    youtube: ['youtube.com', 'youtu.be'],
    linkedin: ['linkedin.com'],
};

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
    const match = SOCIAL_PLATFORMS.find((platform) => (
        (SOCIAL_PLATFORM_DOMAINS[platform.key] || []).some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`))
    ));

    return match?.key || '';
}

export function normalizeSocialLinks(value) {
    const normalized = createEmptySocialLinks();
    if (!value || typeof value !== 'object') return normalized;

    for (const platform of SOCIAL_PLATFORMS) {
        normalized[platform.key] = normalizeUrl(value?.[platform.key]);
    }

    return normalized;
}

export function mergeSocialLinks(...sources) {
    const merged = createEmptySocialLinks();

    for (const source of sources) {
        const normalized = normalizeSocialLinks(source);
        for (const platform of SOCIAL_PLATFORMS) {
            if (!merged[platform.key] && normalized[platform.key]) {
                merged[platform.key] = normalized[platform.key];
            }
        }
    }

    return merged;
}

export function getSocialLinkEntries(value) {
    const normalized = normalizeSocialLinks(value);
    return SOCIAL_PLATFORMS
        .map((platform) => ({
            ...platform,
            url: normalized[platform.key],
        }))
        .filter((platform) => platform.url);
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
