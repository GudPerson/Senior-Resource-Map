import { eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { hardAssets, softAssetParents, softAssets } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { actorCanManageAsset } from '../utils/ownership.js';
import { normalizeRole } from '../utils/roles.js';
import {
    TARGET_LOCALES,
    extractTranslatableFields,
    getLocaleLabel,
    loadTranslationsForResource,
    normalizeLocale,
    normalizeResourceType,
    saveManualTranslation,
    syncResourceTranslations,
} from '../utils/resourceTranslations.js';
import { parsePositiveInt } from '../utils/inputValidation.js';

function canManageSoftAssetParent(actor, parent, ownerUser) {
    const actorRole = normalizeRole(actor?.role);

    if (!actor || !parent) return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole === 'partner') return parent.partnerId === actor.id;

    if (actorRole === 'regional_admin') {
        if (parent.partnerId) {
            return ownerUser?.id === parent.partnerId && ownerUser?.managerUserId === actor.id;
        }

        return parent.createdByUserId === actor.id;
    }

    return false;
}

async function loadEditableResource(db, user, type, id) {
    if (type === 'hard') {
        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, id),
            with: { partner: { columns: { id: true, name: true, role: true, managerUserId: true } } },
        });
        if (!asset || asset.isDeleted) return null;
        if (!actorCanManageAsset(user, asset, asset.partner)) return null;
        return asset;
    }

    if (type === 'soft') {
        const asset = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, id),
            with: { partner: { columns: { id: true, name: true, role: true, managerUserId: true } } },
        });
        if (!asset || asset.isDeleted) return null;
        if (!actorCanManageAsset(user, asset, asset.partner)) return null;
        return asset;
    }

    if (type === 'template') {
        const parent = await db.query.softAssetParents.findFirst({
            where: eq(softAssetParents.id, id),
            with: { partner: { columns: { id: true, name: true, role: true, managerUserId: true } } },
        });
        if (!parent || parent.isDeleted) return null;
        if (!canManageSoftAssetParent(user, parent, parent.partner)) return null;
        return parent;
    }

    return null;
}

async function loadRequestContext(c) {
    const user = c.get('user');
    const db = getDb(c.env);
    await ensureBoundarySchema(db, c.env);
    const type = normalizeResourceType(c.req.param('type'));
    const id = parsePositiveInt(c.req.param('id'), 'Resource id');
    if (!type) {
        const err = new Error('Unsupported resource type.');
        err.status = 400;
        throw err;
    }

    const resource = await loadEditableResource(db, user, type, id);
    if (!resource) {
        const err = new Error('Not found or not allowed.');
        err.status = 404;
        throw err;
    }

    return { db, user, type, id, resource };
}

function buildTranslationPayload(type, id, resource, translations) {
    return {
        resourceType: type,
        resourceId: id,
        sourceLocale: 'en',
        targetLocales: TARGET_LOCALES.map((locale) => ({
            locale,
            label: getLocaleLabel(locale),
        })),
        sourceFields: extractTranslatableFields(type, resource),
        translations,
    };
}

export async function getResourceTranslations(c) {
    try {
        const { db, type, id, resource } = await loadRequestContext(c);
        const translations = await loadTranslationsForResource(db, type, id);
        return c.json(buildTranslationPayload(type, id, resource, translations));
    } catch (err) {
        console.error('getResourceTranslations Error:', err.message);
        return c.json({ error: err.message || 'Failed to load translations' }, err.status || 500);
    }
}

export async function updateResourceTranslation(c) {
    try {
        const { db, user, type, id, resource } = await loadRequestContext(c);
        const locale = normalizeLocale(c.req.param('locale'));
        if (!locale) {
            return c.json({ error: 'Unsupported language.' }, 400);
        }

        const body = await c.req.json();
        const translations = await saveManualTranslation(db, {
            resourceType: type,
            resourceId: id,
            locale,
            source: resource,
            fields: body?.fields || {},
            reviewedFields: body?.reviewedFields || [],
            updatedByUserId: user?.id || null,
        });

        return c.json(buildTranslationPayload(type, id, resource, translations));
    } catch (err) {
        console.error('updateResourceTranslation Error:', err.message);
        return c.json({ error: err.message || 'Failed to save translation' }, err.status || 500);
    }
}

export async function regenerateResourceTranslations(c) {
    try {
        const { db, user, type, id, resource } = await loadRequestContext(c);
        const body = await c.req.json().catch(() => ({}));
        const requestedLocales = Array.isArray(body?.locales)
            ? body.locales.map(normalizeLocale).filter(Boolean)
            : TARGET_LOCALES;
        const result = await syncResourceTranslations(db, c.env, {
            resourceType: type,
            resourceId: id,
            source: resource,
            updatedByUserId: user?.id || null,
            force: body?.force === true,
            targetLocales: requestedLocales,
        });

        const translations = await loadTranslationsForResource(db, type, id);
        return c.json({
            ...buildTranslationPayload(type, id, resource, translations),
            requestedLocales,
            translationStatus: result,
        });
    } catch (err) {
        console.error('regenerateResourceTranslations Error:', err.message);
        return c.json({ error: err.message || 'Failed to regenerate translations' }, err.status || 500);
    }
}
