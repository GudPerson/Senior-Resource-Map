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

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMetaContent(html, selectors = []) {
    for (const selector of selectors) {
        const attribute = selector.attribute || 'property';
        const value = escapeRegExp(selector.value);
        const pattern = new RegExp(
            `<meta[^>]+${attribute}=["']${value}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${value}["'][^>]*>`,
            'i',
        );
        const match = html.match(pattern);
        const content = decodeHtmlEntities(match?.[1] || match?.[2] || '');
        if (content) return normalizeWhitespace(content);
    }
    return '';
}

function extractLinkHref(html, selectors = []) {
    for (const relValue of selectors) {
        const value = escapeRegExp(relValue);
        const pattern = new RegExp(
            `<link[^>]+rel=["'][^"']*${value}[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${value}[^"']*["'][^>]*>`,
            'i',
        );
        const match = html.match(pattern);
        const href = decodeHtmlEntities(match?.[1] || match?.[2] || '');
        if (href) return normalizeWhitespace(href);
    }
    return '';
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
        const metaLogo = extractMetaContent(html, [
            { attribute: 'property', value: 'og:logo' },
            { attribute: 'name', value: 'twitter:image' },
            { attribute: 'property', value: 'og:image' },
        ]);
        const linkLogo = extractLinkHref(html, ['apple-touch-icon', 'icon', 'shortcut icon']);

        const description = normalizeWhitespace(jsonLd.description || metaDescription);
        const logoCandidate = jsonLd.logoUrl || metaLogo || linkLogo;
        const logoUrl = toAbsoluteUrl(logoCandidate, resolvedUrl);

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
