import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    addGovernedMapResource,
    archiveDueGovernedMaps,
    createGovernedMap,
    getGovernedMap,
    getPublishedGovernedMap,
    listGovernedMapNotifications,
    listGovernedMapRegions,
    listGovernedMaps,
    markGovernedMapNotificationRead,
    publishGovernedMap,
    requestGovernedMapRetirement,
    restoreGovernedMap,
    updateGovernedMap,
    withdrawGovernedMapResource,
} from '../utils/governedMaps.js';
import {
    optionalTextSchema,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const resourceRefSchema = z.object({
    resourceType: z.enum(['hard', 'soft']),
    resourceId: positiveIntValueSchema('Resource id'),
});

const createMapSchema = z.object({
    regionGroupId: positiveIntValueSchema('Region group id'),
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
});

const updateMapSchema = z.object({
    name: requiredOneLineTextSchema('Map name', 160),
    description: optionalTextSchema(2000),
    presentation: z.record(z.unknown()).optional(),
    expectedRevision: z.number().int().positive(),
});

const publishSchema = z.object({
    allowedOrigins: z.array(z.string().trim().min(1).max(500)).max(20).optional().default([]),
});

const reasonSchema = z.object({
    reason: z.string().trim().min(10).max(2000),
});

const withdrawSchema = resourceRefSchema.extend({
    reason: z.string().trim().min(10).max(2000),
});

function handleError(c, error, fallback) {
    if (!error?.status || error.status >= 500) console.error(`${fallback}:`, error);
    return c.json({
        error: error?.message || fallback,
        ...(error?.code ? { code: error.code } : {}),
    }, error?.status || 500);
}

export async function getRegions(c) {
    try {
        return c.json({ regions: await listGovernedMapRegions(getDb(c.env), c.get('user')) });
    } catch (error) {
        return handleError(c, error, 'Failed to load Governed Care Map regions.');
    }
}

export async function getMaps(c) {
    try {
        return c.json({ maps: await listGovernedMaps(getDb(c.env), c.get('user')) });
    } catch (error) {
        return handleError(c, error, 'Failed to load Governed Care Maps.');
    }
}

export async function getMap(c) {
    try {
        return c.json({ map: await getGovernedMap(getDb(c.env), c.get('user'), c.req.param('mapId')) });
    } catch (error) {
        return handleError(c, error, 'Failed to load the Governed Care Map.');
    }
}

export async function postMap(c) {
    try {
        const body = validateRequestBody(await c.req.json(), createMapSchema, 'Governed Care Map');
        return c.json({ map: await createGovernedMap(getDb(c.env), c.get('user'), body) }, 201);
    } catch (error) {
        return handleError(c, error, 'Failed to create the Governed Care Map.');
    }
}

export async function patchMap(c) {
    try {
        const body = validateRequestBody(await c.req.json(), updateMapSchema, 'Governed Care Map');
        return c.json({ map: await updateGovernedMap(getDb(c.env), c.get('user'), c.req.param('mapId'), body) });
    } catch (error) {
        return handleError(c, error, 'Failed to update the Governed Care Map.');
    }
}

export async function postResource(c) {
    try {
        const body = validateRequestBody(await c.req.json(), resourceRefSchema, 'Map resource');
        return c.json({ map: await addGovernedMapResource(getDb(c.env), c.get('user'), c.req.param('mapId'), body) }, 201);
    } catch (error) {
        return handleError(c, error, 'Failed to add the resource.');
    }
}

export async function postResourceWithdrawal(c) {
    try {
        const body = validateRequestBody(await c.req.json(), withdrawSchema, 'Resource withdrawal');
        return c.json({ map: await withdrawGovernedMapResource(getDb(c.env), c.get('user'), c.req.param('mapId'), body) });
    } catch (error) {
        return handleError(c, error, 'Failed to remove the resource.');
    }
}

export async function postPublish(c) {
    try {
        const body = validateRequestBody(await c.req.json().catch(() => ({})), publishSchema, 'Map publication');
        return c.json({ map: await publishGovernedMap(getDb(c.env), c.get('user'), c.req.param('mapId'), body) });
    } catch (error) {
        return handleError(c, error, 'Failed to publish the Governed Care Map.');
    }
}

export async function postRetirement(c) {
    try {
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Map retirement');
        return c.json({ map: await requestGovernedMapRetirement(getDb(c.env), c.get('user'), c.req.param('mapId'), body) });
    } catch (error) {
        return handleError(c, error, 'Failed to request map retirement.');
    }
}

export async function postRestore(c) {
    try {
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Map restoration');
        return c.json({ map: await restoreGovernedMap(getDb(c.env), c.get('user'), c.req.param('mapId'), body) });
    } catch (error) {
        return handleError(c, error, 'Failed to restore the Governed Care Map.');
    }
}

export async function getPublicMap(c) {
    try {
        const result = await getPublishedGovernedMap(getDb(c.env), c.req.param('token'), 'sharedMaps');
        c.header('Cache-Control', 'no-store');
        c.header('X-Robots-Tag', 'noindex, nofollow');
        return c.json(result.snapshot);
    } catch (error) {
        return handleError(c, error, 'Published map is unavailable.');
    }
}

export async function getPublicEmbedMap(c) {
    try {
        const result = await getPublishedGovernedMap(getDb(c.env), c.req.param('token'), 'embeds');
        c.header('Cache-Control', 'no-store');
        c.header('X-Robots-Tag', 'noindex, nofollow');
        return c.json(result.snapshot);
    } catch (error) {
        return handleError(c, error, 'Published map is unavailable.');
    }
}

export async function getEmbedConfig(c) {
    try {
        const result = await getPublishedGovernedMap(getDb(c.env), c.req.param('token'), null);
        c.header('Cache-Control', 'no-store');
        return c.json({ allowedOrigins: result.publication.allowedOrigins || [] });
    } catch (error) {
        return handleError(c, error, 'Published map is unavailable.');
    }
}

export async function getNotifications(c) {
    try {
        return c.json({ notifications: await listGovernedMapNotifications(getDb(c.env), c.get('user')) });
    } catch (error) {
        return handleError(c, error, 'Failed to load Governed Care Map notifications.');
    }
}

export async function postNotificationRead(c) {
    try {
        const notification = await markGovernedMapNotificationRead(getDb(c.env), c.get('user'), c.req.param('notificationId'));
        return c.json({ notification });
    } catch (error) {
        return handleError(c, error, 'Failed to mark the notification as read.');
    }
}

export async function postArchiveDue(c) {
    try {
        return c.json(await archiveDueGovernedMaps(getDb(c.env)));
    } catch (error) {
        return handleError(c, error, 'Failed to archive eligible Governed Care Maps.');
    }
}
