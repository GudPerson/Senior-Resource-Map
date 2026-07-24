import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    myMapPersonalPlaceLinks,
    myMaps,
    userPersonalPlaceCategories,
    userPersonalPlaces,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    optionalOneLineTextSchema,
    optionalTextSchema,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { normalizeRole } from '../utils/roles.js';

const PERSONAL_PLACE_NOTE_MAX_LENGTH = 3000;
const PERSONAL_PLACE_ICON_KEYS = new Set([
    'bus',
    'map-pin',
    'package-check',
    'shopping-bag',
    'trees',
    'utensils',
]);

export const DEFAULT_PERSONAL_PLACE_CATEGORIES = [
    { name: 'Shop', iconKey: 'shopping-bag', color: '#0F766E' },
    { name: 'Food', iconKey: 'utensils', color: '#C2410C' },
    { name: 'Transport', iconKey: 'bus', color: '#2563EB' },
    { name: 'Pickup point', iconKey: 'package-check', color: '#7C3AED' },
    { name: 'Outdoor', iconKey: 'trees', color: '#15803D' },
    { name: 'Other', iconKey: 'map-pin', color: '#475569' },
];

function coordinateValueSchema(label, min, max) {
    return z.any().transform((value, ctx) => {
        const parsed = Number.parseFloat(String(value ?? '').trim());
        if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${label} must be a valid coordinate.`,
            });
            return z.NEVER;
        }
        return parsed;
    });
}

const categoryIdSchema = positiveIntValueSchema('Category id');
const personalPlaceIdSchema = positiveIntValueSchema('Personal place id');
const categoryColorSchema = z.string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Category colour must be a six-digit hex colour.');
const categoryIconSchema = z.string()
    .trim()
    .refine((value) => PERSONAL_PLACE_ICON_KEYS.has(value), 'Choose a supported category icon.');

export const personalPlaceBodySchema = z.object({
    name: requiredOneLineTextSchema('Personal place name', 160),
    categoryId: categoryIdSchema.nullable().optional(),
    categoryLabel: optionalOneLineTextSchema(120),
    address: optionalTextSchema(500),
    postalCode: optionalOneLineTextSchema(20),
    lat: coordinateValueSchema('Latitude', -90, 90),
    lng: coordinateValueSchema('Longitude', -180, 180),
    note: optionalTextSchema(PERSONAL_PLACE_NOTE_MAX_LENGTH),
});

export const attachPersonalPlaceBodySchema = z.object({
    personalPlaceId: personalPlaceIdSchema,
});

const createCategoryBodySchema = z.object({
    name: requiredOneLineTextSchema('Category name', 120),
    iconKey: categoryIconSchema,
    color: categoryColorSchema,
});

const updateCategoryBodySchema = z.object({
    name: requiredOneLineTextSchema('Category name', 120).optional(),
    iconKey: categoryIconSchema.optional(),
    color: categoryColorSchema.optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    isArchived: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, {
    message: 'At least one category field is required.',
});

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export function assertPersonalPlacesUser(user) {
    if (!user?.id || normalizeRole(user?.role) === 'guest') {
        throw createHttpError(403, 'Only authenticated non-guest users can manage My Places');
    }
}

function parsePositiveId(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalText(value) {
    if (value === undefined) return null;
    const text = String(value ?? '').trim();
    return text || null;
}

function normalizeCategoryName(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeColor(value) {
    return String(value || '#64748B').toUpperCase();
}

function normalizePersonalPlaceInput(body = {}) {
    return {
        name: String(body.name ?? '').trim(),
        categoryId: body.categoryId === null || body.categoryId === undefined
            ? null
            : parsePositiveId(body.categoryId),
        categoryLabel: normalizeOptionalText(body.categoryLabel),
        address: normalizeOptionalText(body.address),
        postalCode: normalizeOptionalText(body.postalCode),
        lat: Number(body.lat),
        lng: Number(body.lng),
        note: normalizeOptionalText(body.note),
    };
}

export function serializePersonalPlaceCategory(category) {
    return {
        id: category.id,
        name: category.name,
        iconKey: category.iconKey || 'map-pin',
        color: normalizeColor(category.color),
        sortOrder: Number(category.sortOrder || 0),
        isArchived: Boolean(category.isArchived),
        createdAt: category.createdAt ?? null,
        updatedAt: category.updatedAt ?? null,
    };
}

export function serializePersonalPlace(place) {
    const lat = Number.parseFloat(place?.lat);
    const lng = Number.parseFloat(place?.lng);
    const category = place?.category ? serializePersonalPlaceCategory(place.category) : null;
    const mapLinks = Array.isArray(place?.mapLinks) ? place.mapLinks : [];
    return {
        id: place.id,
        name: place.name,
        categoryId: category?.id ?? place.categoryId ?? null,
        categoryLabel: category?.name || place.legacyCategoryLabel || null,
        category,
        address: place.address || null,
        postalCode: place.postalCode || null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        note: place.note || null,
        mapIds: mapLinks.map((link) => link.mapId),
        maps: mapLinks.map((link) => ({
            id: link.mapId,
            name: link.map?.name || null,
            addedAt: link.addedAt ?? null,
        })),
        createdAt: place.createdAt ?? null,
        updatedAt: place.updatedAt ?? null,
    };
}

async function findOwnedCategory(db, userId, categoryId) {
    if (!categoryId) return null;
    return db.query.userPersonalPlaceCategories.findFirst({
        where: and(
            eq(userPersonalPlaceCategories.id, categoryId),
            eq(userPersonalPlaceCategories.userId, userId)
        ),
    });
}

async function findCategoryByName(db, userId, name) {
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName) return null;
    return db.query.userPersonalPlaceCategories.findFirst({
        where: and(
            eq(userPersonalPlaceCategories.userId, userId),
            eq(userPersonalPlaceCategories.normalizedName, normalizedName)
        ),
    });
}

async function createCategoryRecord(db, userId, values) {
    const timestamp = new Date();
    const [created] = await db.insert(userPersonalPlaceCategories).values({
        userId,
        name: String(values.name).trim(),
        normalizedName: normalizeCategoryName(values.name),
        iconKey: values.iconKey || 'map-pin',
        color: normalizeColor(values.color),
        sortOrder: Number(values.sortOrder || 0),
        isArchived: Boolean(values.isArchived),
        createdAt: timestamp,
        updatedAt: timestamp,
    }).returning();
    return created;
}

async function resolveCategory(db, userId, values) {
    if (values.categoryId) {
        const category = await findOwnedCategory(db, userId, values.categoryId);
        if (!category) throw createHttpError(400, 'Personal place category not found');
        if (category.isArchived) throw createHttpError(400, 'Choose an active personal place category');
        return category;
    }

    if (!values.categoryLabel) return null;
    const existing = await findCategoryByName(db, userId, values.categoryLabel);
    if (existing) return existing;
    return createCategoryRecord(db, userId, {
        name: values.categoryLabel,
        iconKey: 'map-pin',
        color: '#64748B',
        sortOrder: 1000,
    });
}

export async function ensureDefaultPersonalPlaceCategories(db, userId) {
    const existing = await db.query.userPersonalPlaceCategories.findMany({
        where: eq(userPersonalPlaceCategories.userId, userId),
        orderBy: [asc(userPersonalPlaceCategories.sortOrder), asc(userPersonalPlaceCategories.name)],
    });
    const names = new Set(existing.map((category) => category.normalizedName));
    const missing = DEFAULT_PERSONAL_PLACE_CATEGORIES.filter(
        (category) => !names.has(normalizeCategoryName(category.name))
    );

    if (missing.length > 0) {
        const timestamp = new Date();
        await db.insert(userPersonalPlaceCategories)
            .values(missing.map((category, index) => ({
                userId,
                name: category.name,
                normalizedName: normalizeCategoryName(category.name),
                iconKey: category.iconKey,
                color: normalizeColor(category.color),
                sortOrder: existing.length + index,
                isArchived: false,
                createdAt: timestamp,
                updatedAt: timestamp,
            })))
            .onConflictDoNothing({
                target: [
                    userPersonalPlaceCategories.userId,
                    userPersonalPlaceCategories.normalizedName,
                ],
            });
    }

    if (missing.length === 0) return existing;
    return db.query.userPersonalPlaceCategories.findMany({
        where: eq(userPersonalPlaceCategories.userId, userId),
        orderBy: [asc(userPersonalPlaceCategories.sortOrder), asc(userPersonalPlaceCategories.name)],
    });
}

export async function listPersonalPlaceCategories(db, user) {
    assertPersonalPlacesUser(user);
    const categories = await ensureDefaultPersonalPlaceCategories(db, user.id);
    return categories.map(serializePersonalPlaceCategory);
}

export async function createPersonalPlaceCategory(db, user, body) {
    assertPersonalPlacesUser(user);
    const normalizedName = normalizeCategoryName(body.name);
    const existing = await findCategoryByName(db, user.id, body.name);
    if (existing) throw createHttpError(409, 'A personal place category with this name already exists');
    if (!normalizedName) throw createHttpError(400, 'Category name is required');

    const categories = await db.query.userPersonalPlaceCategories.findMany({
        where: eq(userPersonalPlaceCategories.userId, user.id),
    });
    const created = await createCategoryRecord(db, user.id, {
        ...body,
        sortOrder: categories.length,
    });
    return serializePersonalPlaceCategory(created);
}

export async function updatePersonalPlaceCategory(db, user, categoryId, body) {
    assertPersonalPlacesUser(user);
    const existing = await findOwnedCategory(db, user.id, categoryId);
    if (!existing) throw createHttpError(404, 'Personal place category not found');

    if (body.name) {
        const duplicate = await findCategoryByName(db, user.id, body.name);
        if (duplicate && duplicate.id !== existing.id) {
            throw createHttpError(409, 'A personal place category with this name already exists');
        }
    }

    const updateValues = {
        ...(body.name ? {
            name: String(body.name).trim(),
            normalizedName: normalizeCategoryName(body.name),
        } : {}),
        ...(body.iconKey ? { iconKey: body.iconKey } : {}),
        ...(body.color ? { color: normalizeColor(body.color) } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isArchived !== undefined ? { isArchived: body.isArchived } : {}),
        updatedAt: new Date(),
    };
    await db.update(userPersonalPlaceCategories)
        .set(updateValues)
        .where(and(
            eq(userPersonalPlaceCategories.id, categoryId),
            eq(userPersonalPlaceCategories.userId, user.id)
        ));

    const updated = await findOwnedCategory(db, user.id, categoryId);
    return serializePersonalPlaceCategory(updated || { ...existing, ...updateValues });
}

export async function listPersonalPlaces(db, user) {
    assertPersonalPlacesUser(user);
    await ensureDefaultPersonalPlaceCategories(db, user.id);
    const places = await db.query.userPersonalPlaces.findMany({
        where: eq(userPersonalPlaces.userId, user.id),
        with: {
            category: true,
            mapLinks: {
                columns: {
                    mapId: true,
                    addedAt: true,
                },
                with: {
                    map: {
                        columns: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: [asc(userPersonalPlaces.name), asc(userPersonalPlaces.id)],
    });
    return places.map(serializePersonalPlace);
}

export async function createPersonalPlace(db, user, body) {
    assertPersonalPlacesUser(user);
    const values = normalizePersonalPlaceInput(body);
    const category = await resolveCategory(db, user.id, values);
    const timestamp = new Date();
    const [created] = await db.insert(userPersonalPlaces).values({
        userId: user.id,
        categoryId: category?.id || null,
        legacyCategoryLabel: values.categoryLabel,
        name: values.name,
        address: values.address,
        postalCode: values.postalCode,
        lat: String(values.lat),
        lng: String(values.lng),
        note: values.note,
        createdAt: timestamp,
        updatedAt: timestamp,
    }).returning();
    return serializePersonalPlace({ ...created, category, mapLinks: [] });
}

async function findOwnedPersonalPlace(db, userId, personalPlaceId, includeLinks = false) {
    return db.query.userPersonalPlaces.findFirst({
        where: and(
            eq(userPersonalPlaces.id, personalPlaceId),
            eq(userPersonalPlaces.userId, userId)
        ),
        with: {
            category: true,
            ...(includeLinks ? {
                mapLinks: {
                    columns: {
                        mapId: true,
                        addedAt: true,
                    },
                    with: {
                        map: {
                            columns: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            } : {}),
        },
    });
}

export async function updatePersonalPlace(db, user, personalPlaceId, body) {
    assertPersonalPlacesUser(user);
    const existing = await findOwnedPersonalPlace(db, user.id, personalPlaceId, true);
    if (!existing) throw createHttpError(404, 'Personal place not found');

    const values = normalizePersonalPlaceInput(body);
    const category = await resolveCategory(db, user.id, values);
    const updateValues = {
        categoryId: category?.id || null,
        legacyCategoryLabel: values.categoryLabel,
        name: values.name,
        address: values.address,
        postalCode: values.postalCode,
        lat: String(values.lat),
        lng: String(values.lng),
        note: values.note,
        updatedAt: new Date(),
    };
    await db.update(userPersonalPlaces)
        .set(updateValues)
        .where(and(
            eq(userPersonalPlaces.id, personalPlaceId),
            eq(userPersonalPlaces.userId, user.id)
        ));

    const updated = await findOwnedPersonalPlace(db, user.id, personalPlaceId, true);
    return serializePersonalPlace(updated || { ...existing, ...updateValues, category });
}

export async function deletePersonalPlace(db, user, personalPlaceId) {
    assertPersonalPlacesUser(user);
    const existing = await findOwnedPersonalPlace(db, user.id, personalPlaceId, true);
    if (!existing) throw createHttpError(404, 'Personal place not found');

    const mapIds = (existing.mapLinks || []).map((link) => link.mapId);
    await db.delete(userPersonalPlaces)
        .where(and(
            eq(userPersonalPlaces.id, personalPlaceId),
            eq(userPersonalPlaces.userId, user.id)
        ));
    for (const mapId of mapIds) {
        await db.update(myMaps).set({ updatedAt: new Date() }).where(eq(myMaps.id, mapId));
    }
    return { success: true, personalPlaceId, removedFromMapIds: mapIds };
}

export async function attachPersonalPlaceToMap(db, user, mapId, personalPlaceId) {
    assertPersonalPlacesUser(user);
    const map = await db.query.myMaps.findFirst({
        where: and(eq(myMaps.id, mapId), eq(myMaps.userId, user.id)),
    });
    if (!map) throw createHttpError(404, 'Map not found');

    const place = await findOwnedPersonalPlace(db, user.id, personalPlaceId, true);
    if (!place) throw createHttpError(404, 'Personal place not found');

    const existingLink = await db.query.myMapPersonalPlaceLinks.findFirst({
        where: and(
            eq(myMapPersonalPlaceLinks.mapId, mapId),
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId)
        ),
    });
    if (!existingLink) {
        await db.insert(myMapPersonalPlaceLinks).values({
            mapId,
            personalPlaceId,
            addedAt: new Date(),
        });
        await db.update(myMaps).set({ updatedAt: new Date() }).where(eq(myMaps.id, mapId));
    }

    return {
        ...serializePersonalPlace(place),
        mapId,
        attached: !existingLink,
    };
}

export async function detachPersonalPlaceFromMap(db, user, mapId, personalPlaceId) {
    assertPersonalPlacesUser(user);
    const map = await db.query.myMaps.findFirst({
        where: and(eq(myMaps.id, mapId), eq(myMaps.userId, user.id)),
    });
    if (!map) throw createHttpError(404, 'Map not found');

    const place = await findOwnedPersonalPlace(db, user.id, personalPlaceId);
    if (!place) throw createHttpError(404, 'Personal place not found');
    const link = await db.query.myMapPersonalPlaceLinks.findFirst({
        where: and(
            eq(myMapPersonalPlaceLinks.mapId, mapId),
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId)
        ),
    });
    if (!link) throw createHttpError(404, 'Personal place is not on this map');

    await db.delete(myMapPersonalPlaceLinks)
        .where(and(
            eq(myMapPersonalPlaceLinks.mapId, mapId),
            eq(myMapPersonalPlaceLinks.personalPlaceId, personalPlaceId)
        ));
    await db.update(myMaps).set({ updatedAt: new Date() }).where(eq(myMaps.id, mapId));
    return { success: true, mapId, personalPlaceId };
}

export const getPersonalPlaces = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        return c.json(await listPersonalPlaces(db, user));
    } catch (err) {
        console.error('getPersonalPlaces Error:', err);
        return c.json({ error: err.message || 'Failed to fetch personal places' }, err.status || 500);
    }
};

export const postPersonalPlace = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), personalPlaceBodySchema, 'Personal place');
        return c.json(await createPersonalPlace(db, user, body), 201);
    } catch (err) {
        console.error('postPersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to create personal place' }, err.status || 500);
    }
};

export const patchPersonalPlace = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const personalPlaceId = parsePositiveId(c.req.param('placeId'));
        if (!personalPlaceId) return c.json({ error: 'Personal place id is required' }, 400);
        const body = validateRequestBody(await c.req.json(), personalPlaceBodySchema, 'Personal place');
        return c.json(await updatePersonalPlace(db, user, personalPlaceId, body));
    } catch (err) {
        console.error('patchPersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to update personal place' }, err.status || 500);
    }
};

export const deletePersonalPlaceRoute = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const personalPlaceId = parsePositiveId(c.req.param('placeId'));
        if (!personalPlaceId) return c.json({ error: 'Personal place id is required' }, 400);
        return c.json(await deletePersonalPlace(db, user, personalPlaceId));
    } catch (err) {
        console.error('deletePersonalPlace Error:', err);
        return c.json({ error: err.message || 'Failed to delete personal place' }, err.status || 500);
    }
};

export const getPersonalPlaceCategories = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        return c.json(await listPersonalPlaceCategories(db, user));
    } catch (err) {
        console.error('getPersonalPlaceCategories Error:', err);
        return c.json({ error: err.message || 'Failed to fetch personal place categories' }, err.status || 500);
    }
};

export const postPersonalPlaceCategory = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), createCategoryBodySchema, 'Personal place category');
        return c.json(await createPersonalPlaceCategory(db, user, body), 201);
    } catch (err) {
        console.error('postPersonalPlaceCategory Error:', err);
        return c.json({ error: err.message || 'Failed to create personal place category' }, err.status || 500);
    }
};

export const patchPersonalPlaceCategory = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const categoryId = parsePositiveId(c.req.param('categoryId'));
        if (!categoryId) return c.json({ error: 'Category id is required' }, 400);
        const body = validateRequestBody(await c.req.json(), updateCategoryBodySchema, 'Personal place category');
        return c.json(await updatePersonalPlaceCategory(db, user, categoryId, body));
    } catch (err) {
        console.error('patchPersonalPlaceCategory Error:', err);
        return c.json({ error: err.message || 'Failed to update personal place category' }, err.status || 500);
    }
};
