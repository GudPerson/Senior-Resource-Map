import { z } from 'zod';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value, maxLength = 5000) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(CONTROL_CHARS, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .slice(0, maxLength)
        .trim();
}

export function cleanOneLineText(value, maxLength = 500) {
    return cleanText(value, maxLength).replace(/[ \t]*\n+[ \t]*/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanOptionalText(value, maxLength = 5000) {
    const text = cleanText(value, maxLength);
    return text || null;
}

export function cleanOptionalOneLineText(value, maxLength = 500) {
    const text = cleanOneLineText(value, maxLength);
    return text || null;
}

export function cleanTagList(value, maxItems = 30) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const tags = [];

    for (const item of value) {
        const tag = cleanOneLineText(item, 80);
        const key = tag.toLowerCase();
        if (!tag || seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= maxItems) break;
    }

    return tags;
}

export function normalizeUrlText(value, maxLength = 2000) {
    const text = cleanOneLineText(value, maxLength);
    if (!text) return null;
    if (!/^https?:\/\//i.test(text)) return text;

    try {
        const parsed = new URL(text);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return parsed.toString();
    } catch {
        return text;
    }
}

export function parsePositiveInt(value, label = 'id') {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        const err = new Error(`${label} must be a positive number.`);
        err.status = 400;
        throw err;
    }
    return parsed;
}

export const safeResourceTypeSchema = z.enum(['hard', 'soft', 'template']);
export const safeLocaleSchema = z.enum(['zh-CN', 'ms', 'ta']);
