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

function formatValidationIssue(issue) {
    const field = issue.path?.length ? `${issue.path.join('.')}: ` : '';
    return `${field}${issue.message}`;
}

export function createValidationError(message) {
    const err = new Error(message || 'Request body is invalid.');
    err.status = 400;
    return err;
}

export function validateRequestBody(body, schema, label = 'Request body') {
    const result = schema.safeParse(body ?? {});
    if (result.success) return result.data;

    const firstIssue = result.error.issues[0];
    throw createValidationError(`${label} is invalid. ${formatValidationIssue(firstIssue)}`);
}

export function requiredOneLineTextSchema(label, maxLength = 500) {
    return z.string({
        required_error: `${label} is required.`,
        invalid_type_error: `${label} must be text.`,
    })
        .transform((value) => cleanOneLineText(value, maxLength))
        .refine((value) => Boolean(value), { message: `${label} is required.` });
}

export function optionalOneLineTextSchema(maxLength = 500) {
    return z.union([z.string(), z.number(), z.boolean(), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined) return undefined;
            if (value === null) return null;
            return cleanOneLineText(value, maxLength);
        });
}

export function optionalTextSchema(maxLength = 5000) {
    return z.union([z.string(), z.number(), z.boolean(), z.null()])
        .optional()
        .transform((value) => {
            if (value === undefined) return undefined;
            if (value === null) return null;
            return cleanText(value, maxLength);
        });
}

export function positiveIntValueSchema(label = 'id') {
    return z.any().transform((value, ctx) => {
        if (typeof value !== 'number' && typeof value !== 'string') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${label} must be a positive number.`,
            });
            return z.NEVER;
        }

        const text = String(value ?? '').trim();
        if (!/^\d+$/.test(text)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${label} must be a positive number.`,
            });
            return z.NEVER;
        }

        const parsed = Number.parseInt(text, 10);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${label} must be a positive number.`,
            });
            return z.NEVER;
        }

        return parsed;
    });
}

export function optionalPositiveIntValueSchema(label = 'id') {
    return z.union([positiveIntValueSchema(label), z.null(), z.literal('')])
        .optional()
        .transform((value) => {
            if (value === '') return undefined;
            return value;
        });
}

export const importCellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
    .optional()
    .transform((value) => {
        if (typeof value === 'string') return cleanText(value, 5000);
        return value;
    });

export const flexibleImportRowSchema = z.record(z.string().max(160), importCellValueSchema)
    .refine((row) => Object.keys(row).length <= 120, {
        message: 'Each import row must contain 120 columns or fewer.',
    });

export function flexibleImportRowsSchema(label = 'Rows', maxRows = 5000) {
    return z.array(flexibleImportRowSchema, {
        invalid_type_error: `${label} must be a list of row objects.`,
    })
        .min(1, `${label} must include at least one row.`)
        .max(maxRows, `${label} cannot contain more than ${maxRows} rows per request.`);
}

export function positiveIntListSchema(label = 'IDs', maxItems = 1000) {
    return z.array(positiveIntValueSchema(label), {
        invalid_type_error: `${label} must be a list.`,
    })
        .min(1, `${label} must include at least one value.`)
        .max(maxItems, `${label} cannot contain more than ${maxItems} values.`)
        .transform((values, ctx) => {
            const seen = new Set();
            const unique = [];
            for (const value of values) {
                if (seen.has(value)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${label} must not contain duplicates.`,
                    });
                    return z.NEVER;
                }
                seen.add(value);
                unique.push(value);
            }
            return unique;
        });
}

export function identifierListSchema(label = 'IDs', maxItems = 1000) {
    return z.array(z.union([z.string(), z.number()]), {
        invalid_type_error: `${label} must be a list.`,
    })
        .min(1, `${label} must include at least one value.`)
        .max(maxItems, `${label} cannot contain more than ${maxItems} values.`)
        .transform((values, ctx) => {
            const seen = new Set();
            const unique = [];
            for (const value of values) {
                const text = cleanOneLineText(value, 160);
                if (!text) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${label} must not contain blank values.`,
                    });
                    return z.NEVER;
                }
                const key = text.toLowerCase();
                if (seen.has(key)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `${label} must not contain duplicates.`,
                    });
                    return z.NEVER;
                }
                seen.add(key);
                unique.push(text);
            }
            return unique;
        });
}

export const postalCodeListInputSchema = z.union([
    z.string(),
    z.number(),
    z.array(z.union([z.string(), z.number(), z.null()])).max(10000),
    z.null(),
]).optional();

export const safeResourceTypeSchema = z.enum(['hard', 'soft', 'template']);
export const safeLocaleSchema = z.enum(['zh-CN', 'ms', 'ta']);
