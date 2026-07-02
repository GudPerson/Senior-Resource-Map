import {
    createEmptySocialLinks,
    detectSocialPlatform,
    mergeSocialLinks,
    splitWebsiteAndSocialLinks,
} from './socialLinks.js';

function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function extractMetaContent(html, selectors = []) {
    return extractMetaContents(html, selectors)[0] || '';
}

function parseAttributes(tag) {
    const attrs = {};
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;
    while ((match = pattern.exec(tag))) {
        const name = String(match[1] || '').toLowerCase();
        if (!name || name.startsWith('<')) continue;
        attrs[name] = decodeHtmlEntities(match[2] || match[3] || match[4] || '');
    }
    return attrs;
}

function extractTags(html, tagName) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    return Array.from(html.matchAll(pattern), (match) => match[0]);
}

function extractMetaContents(html, selectors = []) {
    const metaTags = extractTags(html, 'meta').map(parseAttributes);
    const matches = [];

    for (const selector of selectors) {
        const attribute = String(selector.attribute || 'property').toLowerCase();
        const expectedValue = String(selector.value || '').toLowerCase();
        for (const attrs of metaTags) {
            const selectorValue = String(attrs[attribute] || '').toLowerCase();
            const content = normalizeWhitespace(attrs.content || '');
            if (selectorValue === expectedValue && content) {
                matches.push(content);
            }
        }
    }

    return [...new Set(matches)];
}

function extractLinkHrefs(html, selectors = []) {
    const linkTags = extractTags(html, 'link').map(parseAttributes);
    const matches = [];

    for (const relValue of selectors) {
        const expectedRel = String(relValue || '').toLowerCase();
        for (const attrs of linkTags) {
            const rel = String(attrs.rel || '').toLowerCase();
            const href = normalizeWhitespace(attrs.href || '');
            if (rel.includes(expectedRel) && href) {
                matches.push(href);
            }
        }
    }

    return [...new Set(matches)];
}

function extractAnchorHrefs(html) {
    return extractTags(html, 'a')
        .map((tag) => normalizeWhitespace(parseAttributes(tag).href || ''))
        .filter(Boolean);
}

function extractSocialLinks(html, baseUrl) {
    const normalized = createEmptySocialLinks();

    for (const href of extractAnchorHrefs(html)) {
        let absoluteUrl = '';
        try {
            absoluteUrl = new URL(href, baseUrl).toString();
        } catch {
            continue;
        }
        const platform = detectSocialPlatform(absoluteUrl);
        if (platform && !normalized[platform]) {
            normalized[platform] = absoluteUrl;
        }
    }

    return normalized;
}

function extractJsonLdBlocks(html) {
    const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    return Array.from(matches, (match) => match[1]).filter(Boolean);
}

function flattenJsonLdNodes(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.flatMap((item) => flattenJsonLdNodes(item));
    }
    if (typeof value !== 'object') return [];
    const graphItems = value['@graph'] ? flattenJsonLdNodes(value['@graph']) : [];
    return [value, ...graphItems];
}

function extractJsonLdHints(html) {
    const nodes = extractJsonLdBlocks(html)
        .flatMap((block) => {
            try {
                return flattenJsonLdNodes(JSON.parse(block));
            } catch {
                return [];
            }
        });

    let description = '';
    let logoUrl = '';

    for (const node of nodes) {
        if (!description && typeof node?.description === 'string') {
            description = normalizeWhitespace(node.description);
        }

        if (!logoUrl) {
            const logoValue = node?.logo;
            if (typeof logoValue === 'string') {
                logoUrl = normalizeWhitespace(logoValue);
            } else if (logoValue && typeof logoValue === 'object') {
                logoUrl = normalizeWhitespace(logoValue.url || logoValue.contentUrl || '');
            }
        }

        if (description && logoUrl) break;
    }

    return { description, logoUrl };
}

function extractFirstSrcsetUrl(value) {
    const first = String(value || '').split(',')[0]?.trim() || '';
    return first.split(/\s+/)[0] || '';
}

function compactLogoHint(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getSiteBrandToken(baseUrl) {
    try {
        const hostname = new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, '');
        const firstLabel = hostname.split('.')[0] || '';
        const compact = compactLogoHint(firstLabel);
        return compact.length >= 5 ? compact : '';
    } catch {
        return '';
    }
}

function collectImageSources(attrs) {
    return [
        attrs.src,
        attrs['data-src'],
        attrs['data-lazy-src'],
        attrs['data-wpfc-original-src'],
        extractFirstSrcsetUrl(attrs.srcset),
        extractFirstSrcsetUrl(attrs['data-srcset']),
        extractFirstSrcsetUrl(attrs['data-wpfc-original-srcset']),
    ].map(normalizeWhitespace).filter(Boolean);
}

function extractLikelyLogoImages(html, resolvedUrl = '') {
    const strongMatches = [];
    const fallbackMatches = [];
    const imgTags = extractTags(html, 'img').map(parseAttributes);
    const logoPattern = /(^|[^a-z0-9])(logo|brand|site-logo|navbar-logo|header-logo)([^a-z0-9]|$)/i;
    const genericVisualPattern = /(^|[^a-z0-9])(award|awards|badge|carousel|cert|certificate|partner|program|programme|service|sponsor|thumbnail)([^a-z0-9]|$)/i;
    const siteBrandToken = getSiteBrandToken(resolvedUrl);

    for (const attrs of imgTags) {
        const sources = collectImageSources(attrs);
        if (sources.length === 0) continue;

        const hintText = [
            attrs.alt,
            attrs.title,
            attrs.class,
            attrs.id,
            attrs.src,
            attrs['data-src'],
            attrs['data-lazy-src'],
            attrs['data-wpfc-original-src'],
            ].map((value) => String(value || '')).join(' ');
        const compactHintText = compactLogoHint(hintText);

        for (const src of sources) {
            const sourceHintText = `${hintText} ${src}`;
            const sourceCompactHintText = compactLogoHint(sourceHintText);
            const looksLikeLogo = logoPattern.test(sourceHintText)
                || (siteBrandToken && sourceCompactHintText.includes(siteBrandToken));
            if (!looksLikeLogo) continue;

            if (genericVisualPattern.test(sourceHintText) || genericVisualPattern.test(compactHintText)) {
                fallbackMatches.push(src);
            } else {
                strongMatches.push(src);
            }
        }
    }

    return [...new Set([...strongMatches, ...fallbackMatches])];
}

function buildLogoCandidates({ html, resolvedUrl, jsonLd }) {
    const candidates = [];
    const add = (value, source, priority) => {
        const url = toAbsoluteUrl(value, resolvedUrl);
        if (!url) return;
        candidates.push({ url, source, priority });
    };

    add(jsonLd.logoUrl, 'json-ld-logo', 100);

    for (const value of extractMetaContents(html, [
        { attribute: 'property', value: 'og:logo' },
        { attribute: 'name', value: 'twitter:logo' },
    ])) {
        add(value, 'meta-logo', 95);
    }

    for (const value of extractLikelyLogoImages(html, resolvedUrl)) {
        add(value, 'logo-image', 90);
    }

    for (const value of extractMetaContents(html, [
        { attribute: 'name', value: 'twitter:image' },
        { attribute: 'name', value: 'twitter:image:src' },
        { attribute: 'property', value: 'og:image' },
        { attribute: 'property', value: 'og:image:url' },
    ])) {
        add(value, 'meta-image', 70);
    }

    for (const value of extractLinkHrefs(html, ['apple-touch-icon', 'icon', 'shortcut icon'])) {
        add(value, 'link-icon', 55);
    }

    try {
        add('/favicon.ico', 'favicon-fallback', 30);
    } catch {
        // ignore malformed resolvedUrl; toAbsoluteUrl handles the real validation
    }

    const deduped = new Map();
    for (const candidate of candidates.sort((left, right) => right.priority - left.priority)) {
        if (!deduped.has(candidate.url)) deduped.set(candidate.url, candidate);
    }
    return [...deduped.values()];
}

function toAbsoluteUrl(candidate, baseUrl) {
    if (!candidate) return '';
    try {
        const parsed = new URL(candidate, baseUrl);
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

function normalizeHostname(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function parseIpv4Address(hostname) {
    const parts = normalizeHostname(hostname).split('.');
    if (parts.length !== 4) return null;
    const octets = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) return null;
        const value = Number.parseInt(part, 10);
        return value >= 0 && value <= 255 ? value : null;
    });
    return octets.every((value) => value !== null) ? octets : null;
}

function isBlockedIpv4(hostname) {
    const octets = parseIpv4Address(hostname);
    if (!octets) return false;
    const [first, second] = octets;
    if (first === 0 || first === 10 || first === 127) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    if (first === 169 && second === 254) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && [0, 2, 168].includes(second)) return true;
    if (first === 198 && (second === 18 || second === 19 || second === 51)) return true;
    if (first === 203 && second === 0) return true;
    if (first >= 224) return true;
    return false;
}

function isBlockedIpv6(hostname) {
    const host = normalizeHostname(hostname);
    if (!host.includes(':')) return false;
    if (host === '::' || host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
    if (host.startsWith('ff') || host.startsWith('2001:db8:')) return true;
    if (host.startsWith('::ffff:')) return isBlockedIpv4(host.slice('::ffff:'.length));
    return false;
}

export function assertSafeMetadataUrl(value, baseUrl = undefined) {
    const parsed = new URL(value, baseUrl);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error('Website metadata URL must use HTTP or HTTPS.');
    }

    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname
        || hostname === 'localhost'
        || hostname.endsWith('.localhost')
        || hostname.endsWith('.local')
        || hostname.endsWith('.internal')
        || isBlockedIpv4(hostname)
        || isBlockedIpv6(hostname)) {
        throw new Error('Website metadata URL must point to a public site.');
    }

    parsed.hash = '';
    return parsed.toString();
}

async function fetchSafeMetadataUrl(url, options = {}, redirectLimit = 3) {
    let currentUrl = assertSafeMetadataUrl(url);

    for (let redirectCount = 0; redirectCount <= redirectLimit; redirectCount += 1) {
        const response = await fetch(currentUrl, {
            ...options,
            redirect: 'manual',
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) {
            return { response, url: currentUrl };
        }

        const location = response.headers.get('location');
        if (!location) throw new Error('Website metadata redirect did not include a destination.');
        currentUrl = assertSafeMetadataUrl(location, currentUrl);
    }

    throw new Error('Website metadata redirected too many times.');
}

async function fetchHtml(url) {
    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(6000)
        : undefined;

    const { response, url: resolvedUrl } = await fetchSafeMetadataUrl(url, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'CareAroundSGImport/1.0',
        },
        signal: timeoutSignal,
    });

    if (!response.ok) {
        throw new Error(`Website returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('html')) {
        throw new Error('Website does not expose HTML metadata');
    }

    const html = (await response.text()).slice(0, 250_000);
    return {
        url: resolvedUrl,
        html,
    };
}

function looksLikeImageUrl(value) {
    try {
        const parsed = new URL(value);
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        const pathname = parsed.pathname.toLowerCase();
        return /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/.test(pathname);
    } catch {
        return false;
    }
}

async function isFetchImageResponse(response, url) {
    if (!response?.ok) return false;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('image/')) return true;
    return looksLikeImageUrl(url);
}

async function validateImageUrl(url) {
    try {
        const protocol = new URL(url).protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return false;
    } catch {
        return false;
    }

    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(4000)
        : undefined;

    const requestOptions = {
        headers: {
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'User-Agent': 'CareAroundSGImport/1.0',
        },
        redirect: 'follow',
        signal: timeoutSignal,
    };

    try {
        const { response: headResponse } = await fetchSafeMetadataUrl(url, { ...requestOptions, method: 'HEAD' });
        if (await isFetchImageResponse(headResponse, url)) return true;
    } catch {
        // Some sites reject HEAD; fall back to a tiny GET below.
    }

    try {
        const { response: getResponse } = await fetchSafeMetadataUrl(url, {
            ...requestOptions,
            method: 'GET',
            headers: {
                ...requestOptions.headers,
                Range: 'bytes=0-2047',
            },
        });
        const isImage = await isFetchImageResponse(getResponse, url);
        try {
            await getResponse.body?.cancel?.();
        } catch {
            // Ignore body cleanup failures; validation already has the response headers it needs.
        }
        return isImage;
    } catch {
        return false;
    }
}

async function chooseValidatedLogoUrl(candidates) {
    for (const candidate of candidates) {
        if (await validateImageUrl(candidate.url)) {
            return candidate.url;
        }
    }
    return '';
}

export async function fetchWebsiteMetadata(url) {
    if (!url) {
        return {
            description: '',
            logoUrl: '',
            socialLinks: createEmptySocialLinks(),
            warnings: [],
        };
    }

    const directSocialMatch = splitWebsiteAndSocialLinks(url);
    if (!directSocialMatch.website) {
        return {
            description: '',
            logoUrl: '',
            socialLinks: directSocialMatch.socialLinks,
            warnings: [],
        };
    }

    try {
        const { url: resolvedUrl, html } = await fetchHtml(directSocialMatch.website);
        const jsonLd = extractJsonLdHints(html);
        const metaDescription = extractMetaContent(html, [
            { attribute: 'name', value: 'description' },
            { attribute: 'property', value: 'og:description' },
            { attribute: 'name', value: 'twitter:description' },
        ]);
        const discoveredSocialLinks = extractSocialLinks(html, resolvedUrl);

        const description = normalizeWhitespace(jsonLd.description || metaDescription);
        const logoUrl = await chooseValidatedLogoUrl(buildLogoCandidates({ html, resolvedUrl, jsonLd }));

        return {
            description,
            logoUrl,
            socialLinks: mergeSocialLinks(directSocialMatch.socialLinks, discoveredSocialLinks),
            warnings: [],
        };
    } catch (error) {
        return {
            description: '',
            logoUrl: '',
            socialLinks: directSocialMatch.socialLinks,
            warnings: [error.message || 'Website metadata could not be read.'],
        };
    }
}
