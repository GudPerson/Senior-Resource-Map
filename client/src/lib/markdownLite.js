export const DESCRIPTION_MARKDOWN_HINT = 'Supports **bold**, *italic*, bullet lists, numbered lists, and links. Use two leading spaces before a bullet to nest it.';

const HTML_BOUNDARY_TAG_PATTERN = /<\/?(?:p|div|section|article|header|footer|h[1-6]|ul|ol|li|br)\b[^>]*>/gi;
const HTML_TAG_PATTERN = /<[^>\n<>]+>/g;
const BASIC_HTML_ENTITIES = new Map([
    ['nbsp', ' '],
    ['amp', '&'],
    ['lt', '<'],
    ['gt', '>'],
    ['quot', '"'],
    ['apos', "'"],
]);

function decodeBasicHtmlEntities(value) {
    return String(value || '').replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (match, entity) => {
        const normalized = String(entity || '').toLowerCase();

        if (normalized.startsWith('#x')) {
            const codePoint = Number.parseInt(normalized.slice(2), 16);
            return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : match;
        }

        if (normalized.startsWith('#')) {
            const codePoint = Number.parseInt(normalized.slice(1), 10);
            return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : match;
        }

        return BASIC_HTML_ENTITIES.get(normalized) || match;
    });
}

export function normalizeMarkdownLiteInput(value) {
    if (value === undefined || value === null) return '';

    return decodeBasicHtmlEntities(String(value))
        .replace(/\r\n/g, '\n')
        .replace(HTML_BOUNDARY_TAG_PATTERN, '\n')
        .replace(HTML_TAG_PATTERN, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function stripMarkdownLite(value) {
    if (value === undefined || value === null) return '';

    return normalizeMarkdownLiteInput(value)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 $2')
        .replace(/^>\s+/gm, '')
        .replace(/^\s*([-+*]|\d+\.)\s+/gm, '')
        .replace(/[`*_#~]/g, '')
        .replace(/\r\n/g, '\n');
}

export function toPlainTextPreview(value) {
    return stripMarkdownLite(value).replace(/\s+/g, ' ').trim();
}
