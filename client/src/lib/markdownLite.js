export const DESCRIPTION_MARKDOWN_HINT = 'Supports **bold**, *italic*, bullet lists, numbered lists, and links. Use two leading spaces before a bullet to nest it.';

export function stripMarkdownLite(value) {
    if (value === undefined || value === null) return '';

    return String(value)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1 $2')
        .replace(/^>\s+/gm, '')
        .replace(/^\s*([-+*]|\d+\.)\s+/gm, '')
        .replace(/[`*_#~]/g, '')
        .replace(/\r\n/g, '\n');
}

export function toPlainTextPreview(value) {
    return stripMarkdownLite(value).replace(/\s+/g, ' ').trim();
}
