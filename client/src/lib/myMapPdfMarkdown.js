import { normalizeMarkdownLiteInput } from './markdownLite.js';

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const MARKDOWN_LINK_TEST_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/;
const BOLD_PATTERN = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/;
const ITALIC_PATTERN = /(^|[^*_])([*_])(?=\S)([^*_\n]*?\S)\2(?!\2)/;

function normalizePdfMarkdownLine(line) {
    const text = String(line || '').trim();
    if (!text) return '';

    const heading = text.match(/^#{1,6}\s+(.+)$/);
    const nextText = heading ? `**${heading[1]}**` : text;
    return nextText.replace(/^(\s*)[*+]\s+/, '$1- ');
}

function getPdfMarkdownFontStyle(line) {
    const hasBold = BOLD_PATTERN.test(line);
    const hasItalic = ITALIC_PATTERN.test(line);

    if (hasBold && hasItalic) return 'bolditalic';
    if (hasBold) return 'bold';
    if (hasItalic) return 'italic';
    return 'normal';
}

function stripPdfMarkdownSyntax(line) {
    return String(line || '')
        .replace(MARKDOWN_LINK_PATTERN, '$1 ($2)')
        .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
        .replace(/(^|[^*_])([*_])(?=\S)([^*_\n]*?\S)\2(?!\2)/g, '$1$3')
        .replace(/~~([^~\n]+?)~~/g, '$1')
        .replace(/`+/g, '')
        .trim();
}

export function buildPdfMarkdownLines(value) {
    return normalizeMarkdownLiteInput(value)
        .split('\n')
        .map(normalizePdfMarkdownLine)
        .filter(Boolean)
        .map((line) => ({
            text: stripPdfMarkdownSyntax(line),
            fontStyle: getPdfMarkdownFontStyle(line),
            hasLink: MARKDOWN_LINK_TEST_PATTERN.test(line),
        }))
        .filter((line) => line.text);
}
