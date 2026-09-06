import { z } from 'zod';
import { normalizeRole } from './roles.js';

export const NOTIFICATION_CATEGORIES = ['calendar', 'resources'];
export const RESOURCE_CHANGE_FIELDS = ['name', 'category', 'address', 'hours', 'contact'];
export const NOTIFICATION_BATCH_SIZE = 25;
export const NOTIFICATION_PAGE_SIZE = 20;
export const notificationIdSchema = z.string().uuid();
export const notificationPreferenceSchema = z.object({
    category: z.enum(NOTIFICATION_CATEGORIES), enabled: z.boolean(),
}).strict();
export const notificationStateSchema = z.object({
    revision: z.number().int().positive().max(2147483647), action: z.enum(['read', 'unread', 'dismiss']),
}).strict();
export const notificationMuteSchema = z.object({
    revision: z.number().int().positive().max(2147483647), muted: z.boolean(),
}).strict();

export class NotificationError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export function requireNotificationOwner(user) {
    if (user?.isImpersonating) throw new NotificationError('Exit User View to use private notifications.', 403);
    const id = Number(user?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || normalizeRole(user?.role) === 'guest') {
        throw new NotificationError('Sign in to use private notifications.', 401);
    }
    return id;
}

export function parseNotificationInput(schema, input) {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new NotificationError('Check your notification details and try again.');
    return parsed.data;
}

// Missing categories are opt-out, while an absent legacy master switch permits
// explicit category consent. An explicit disabled master always takes priority.
export function notificationSettings(rows = []) {
    const master = rows.find((row) => row.category === 'general');
    const masterEnabled = !master || (master.enabled === true && master.deliveryAllowed === true);
    const categories = Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => {
        const row = rows.find((entry) => entry.category === category);
        return [category, { enabled: row?.enabled === true,
            active: masterEnabled && row?.enabled === true && row?.deliveryAllowed === true,
            key: JSON.stringify([master || null, row || null]) }];
    }));
    return { masterEnabled, categories };
}

export function publicNotificationSettings(rows) {
    const settings = notificationSettings(rows);
    return { masterEnabled: settings.masterEnabled, categories: Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((category) => [category, {
            enabled: settings.categories[category].enabled, active: settings.categories[category].active,
        }]),
    ) };
}

async function digest(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Only hashes and typed schedule state enter the baseline. Names, contact
// details, addresses and historical action URLs are never persisted here.
export async function observeSavedResource(favorite, source, settings) {
    if (!source || source.favoriteId !== favorite.id) throw new Error('Incomplete notification source batch.');
    const controls = [favorite.control_revision || 1, favorite.muted === true];
    const keys = Object.fromEntries(await Promise.all(NOTIFICATION_CATEGORIES.map(async (category) => [category,
        await digest([settings.categories[category].key, controls])])));
    const baseline = { version: 1, available: source.available === true, keys, fields: {}, schedule: null };
    if (baseline.available) {
        baseline.fields = Object.fromEntries(await Promise.all(RESOURCE_CHANGE_FIELDS.map(async (field) =>
            [field, await digest(source.fields[field])])));
        baseline.schedule = source.schedule;
    }
    const previous = favorite.baseline?.version === 1 ? favorite.baseline : null;
    const categories = [], changedFields = [];
    const canNotify = (category) => previous && !favorite.muted && settings.categories[category].active
        && previous.keys?.[category] === baseline.keys[category];
    if (canNotify('resources')) {
        const fields = previous.available !== baseline.available ? ['availability']
            : baseline.available ? RESOURCE_CHANGE_FIELDS.filter((field) => previous.fields?.[field] !== baseline.fields[field]) : [];
        if (fields.length) { categories.push('resources'); changedFields.push(...fields); }
    }
    if (favorite.resourceType === 'soft' && canNotify('calendar')) {
        const hadSchedule = previous.schedule?.enabled === true;
        const hasSchedule = baseline.schedule?.enabled === true;
        const changed = previous.available !== baseline.available ? hadSchedule || hasSchedule
            : baseline.available && (hadSchedule || hasSchedule)
                && ['revision', 'enabled', 'status'].some((key) => previous.schedule?.[key] !== baseline.schedule?.[key]);
        if (changed) { categories.push('calendar'); changedFields.push('schedule'); }
    }
    return { favorite_id: favorite.id, watch_id: favorite.watch_id || crypto.randomUUID(),
        control_revision: favorite.control_revision || 0, baseline,
        notification_id: crypto.randomUUID(), categories, changed_fields: [...new Set(changedFields)] };
}

export function renderNotification(row, source, rows) {
    const settings = notificationSettings(rows);
    const categories = row.categories.filter((category) => settings.categories[category]?.active);
    const available = source?.available === true;
    return { id: row.id, revision: row.revision, unread: row.read_revision < row.revision,
        updatedAt: row.updated_at, categories,
        title: available ? source.summary.name : 'Saved resource update',
        message: !available ? 'This saved resource is currently unavailable. Its details cannot be shown.'
            : categories.includes('calendar') ? 'A saved schedule has changed. Check the current programme details before reviewing your plans. Your plans have not been changed.'
                : 'Information about this saved resource has changed.',
        changedFields: available ? row.changed_fields.filter((field) => field === 'schedule'
            ? categories.includes('calendar') : categories.includes('resources')) : [],
        actions: !available ? [] : categories.includes('calendar')
            ? [{ label: 'View programme', path: source.summary.detailPath }, { label: 'Open calendar', path: '/dashboard/calendar' }]
            : [{ label: 'View resource', path: source.summary.detailPath }],
        watch: { id: row.watch_id, revision: row.control_revision, muted: row.muted },
    };
}
