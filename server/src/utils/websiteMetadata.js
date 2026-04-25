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
            } else if (node?.image) {
                const imageValue = node.image;
                if (typeof imageValue === 'string') {
                    logoUrl = normalizeWhitespace(imageValue);
                } else if (Array.isArray(imageValue)) {
                    const first = imageValue.find((entry) => typeof entry === 'string' || entry?.url || entry?.contentUrl);
                    if (typeof first === 'string') {
                        logoUrl = normalizeWhitespace(first);
                    } else if (first) {
                        logoUrl = normalizeWhitespace(first.url || first.contentUrl || '');
                    }
                } else if (typeof imageValue === 'object') {
                    logoUrl = normalizeWhitespace(imageValue.url || imageValue.contentUrl || '');
                }
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

function extractLikelyLogoImages(html) {
    const matches = [];
    const imgTags = extractTags(html, 'img').map(parseAttributes);
    const logoPattern = /\b(logo|brand|site-logo|navbar-logo|header-logo)\b/i;

    for (const attrs of imgTags) {
        const src = normalizeWhitespace(
            attrs.src
            || attrs['data-src']
            || attrs['data-lazy-src']
            || extractFirstSrcsetUrl(attrs.srcset)
            || ''
        );
        if (!src) continue;

        const hintText = [
            attrs.alt,
            attrs.title,
            attrs.class,
            attrs.id,
            attrs.src,
            attrs['data-src'],
            attrs['data-lazy-src'],
        ].map((value) => String(value || '')).join(' ');

        if (logoPattern.test(hintText)) {
            matches.push(src);
        }
    }

    return [...new Set(matches)];
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

    for (const value of extractLikelyLogoImages(html)) {
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
        return new URL(candidate, baseUrl).toString();
    } catch {
        return '';
    }
}

async function fetchHtml(url) {
    const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(6000)
        : undefined;

    const response = await fetch(url, {
        headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'CareAroundSGImport/1.0',
        },
        redirect: 'follow',
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
        url: response.url || url,
        html,
    };
}

function looksLikeImageUrl(value) {
    try {
        const pathname = new URL(value).pathname.toLowerCase();
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
        const headResponse = await fetch(url, { ...requestOptions, method: 'HEAD' });
        if (await isFetchImageResponse(headResponse, url)) return true;
    } catch {
        // Some sites reject HEAD; fall back to a tiny GET below.
    }

    try {
        const getResponse = await fetch(url, {
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
            warnings: [],
        };
    }

    try {
        const { url: resolvedUrl, html } = await fetchHtml(url);
        const jsonLd = extractJsonLdHints(html);
        const metaDescription = extractMetaContent(html, [
            { attribute: 'name', value: 'description' },
            { attribute: 'property', value: 'og:description' },
            { attribute: 'name', value: 'twitter:description' },
        ]);

        const description = normalizeWhitespace(jsonLd.description || metaDescription);
        const logoUrl = await chooseValidatedLogoUrl(buildLogoCandidates({ html, resolvedUrl, jsonLd }));

        return {
            description,
            logoUrl,
            warnings: [],
        };
    } catch (error) {
        return {
            description: '',
            logoUrl: '',
            warnings: [error.message || 'Website metadata could not be read.'],
        };
    }
}
