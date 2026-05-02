import { getDb } from '../db/index.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { normalizeRole } from '../utils/roles.js';
import { z } from 'zod';
import {
    optionalTextSchema,
    positiveIntValueSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import {
    canManagePrivateResource,
    canViewPrivateResource,
    decodePrivateFileData,
    deletePrivateFileForContent,
    ensurePrivateContent,
    formatPrivateAccessUser,
    formatPrivateFile,
    insertPrivateFile,
    loadPrivateAccessCandidates,
    loadPrivateContent,
    loadPrivateFileForContent,
    loadPrivateResource,
    normalizePrivateNotes,
    normalizePrivateResourceType,
    sanitizePrivateFileName,
    syncPrivateAccessGrants,
    updatePrivateNotes,
} from '../utils/privateResourceContent.js';

const privateContentUpdateBodySchema = z.object({
    notes: optionalTextSchema(20000),
    accessUserIds: z.array(positiveIntValueSchema('Partner viewer id')).max(100).nullable().optional(),
});

function httpError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function parseResourceParams(c) {
    const resourceType = normalizePrivateResourceType(c.req.param('type'));
    const resourceId = Number.parseInt(String(c.req.param('id') || ''), 10);

    if (!resourceType || !Number.isInteger(resourceId)) {
        throw httpError('Resource type and id are required.', 400);
    }

    return { resourceType, resourceId };
}

function parseFileId(c) {
    const fileId = Number.parseInt(String(c.req.param('fileId') || ''), 10);
    if (!Number.isInteger(fileId)) {
        throw httpError('File id is required.', 400);
    }
    return fileId;
}

function requirePartnerOrAdmin(user) {
    const role = normalizeRole(user?.role);
    if (!['partner', 'regional_admin', 'super_admin'].includes(role)) {
        throw httpError('Partner-only content is not available for this account.', 403);
    }
}

async function loadResourceOr404(db, resourceType, resourceId) {
    const resource = await loadPrivateResource(db, resourceType, resourceId);
    if (!resource) {
        throw httpError('Resource not found.', 404);
    }
    return resource;
}

function formatPrivateContent(content, resource, user) {
    const canEdit = canManagePrivateResource(user, resource);
    const accessGrants = content?.accessGrants || [];
    const files = (content?.files || []).map(formatPrivateFile).filter(Boolean);
    const accessUsers = canEdit
        ? accessGrants.map(formatPrivateAccessUser).filter(Boolean)
        : [];

    return {
        resourceType: content?.resourceType || null,
        resourceId: content?.resourceId || null,
        notes: content?.notes || '',
        files,
        accessUserIds: canEdit ? accessUsers.map((userRow) => userRow.id) : [],
        accessUsers,
        canEdit,
        hasContent: Boolean(normalizePrivateNotes(content?.notes) || files.length > 0),
        updatedAt: content?.updatedAt || null,
    };
}

function createEmptyPrivateContent(resourceType, resourceId, resource, user) {
    return {
        resourceType,
        resourceId,
        notes: '',
        files: [],
        accessUserIds: [],
        accessUsers: [],
        canEdit: canManagePrivateResource(user, resource),
        hasContent: false,
        updatedAt: null,
    };
}

function createContentDisposition(fileName) {
    const safeName = sanitizePrivateFileName(fileName || 'partner-file');
    const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export const getPrivateResourceContent = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        const content = await loadPrivateContent(db, resourceType, resourceId);
        if (!content) {
            if (!canManagePrivateResource(user, resource)) {
                return c.json({ error: 'Partner-only content is not available for this resource.' }, 403);
            }
            return c.json(createEmptyPrivateContent(resourceType, resourceId, resource, user));
        }

        if (!canViewPrivateResource(user, resource, content.accessGrants || [])) {
            return c.json({ error: 'Partner-only content is not available for this resource.' }, 403);
        }

        return c.json(formatPrivateContent(content, resource, user));
    } catch (err) {
        console.error('getPrivateResourceContent Error:', err);
        return c.json({ error: err.message || 'Failed to load partner-only content.' }, err.status || 500);
    }
};

export const updatePrivateResourceContent = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        if (!canManagePrivateResource(user, resource)) {
            return c.json({ error: 'Insufficient permissions to edit partner-only content.' }, 403);
        }

        const body = validateRequestBody(await c.req.json(), privateContentUpdateBodySchema, 'Partner-only content');
        const content = await ensurePrivateContent(db, resourceType, resourceId, user);
        await updatePrivateNotes(db, content.id, body?.notes ?? content.notes ?? '', user);

        if (body?.accessUserIds !== undefined) {
            await syncPrivateAccessGrants(db, content.id, resource, body.accessUserIds || [], user);
        }

        const updated = await loadPrivateContent(db, resourceType, resourceId);
        return c.json(formatPrivateContent(updated, resource, user));
    } catch (err) {
        console.error('updatePrivateResourceContent Error:', err);
        return c.json({ error: err.message || 'Failed to save partner-only content.' }, err.status || 500);
    }
};

export const getPrivateResourceAccessCandidates = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        if (!canManagePrivateResource(user, resource)) {
            return c.json({ error: 'Insufficient permissions to manage partner-only access.' }, 403);
        }

        const candidates = await loadPrivateAccessCandidates(db, resource.subregionId, resource.partnerId);
        return c.json(candidates);
    } catch (err) {
        console.error('getPrivateResourceAccessCandidates Error:', err);
        return c.json({ error: err.message || 'Failed to load partner access candidates.' }, err.status || 500);
    }
};

export const uploadPrivateResourceFile = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        if (!canManagePrivateResource(user, resource)) {
            return c.json({ error: 'Insufficient permissions to upload partner-only files.' }, 403);
        }

        const body = await c.req.parseBody();
        const file = body.file;
        const content = await ensurePrivateContent(db, resourceType, resourceId, user);
        await insertPrivateFile(db, content.id, file, user);

        const updated = await loadPrivateContent(db, resourceType, resourceId);
        return c.json(formatPrivateContent(updated, resource, user), 201);
    } catch (err) {
        console.error('uploadPrivateResourceFile Error:', err);
        return c.json({ error: err.message || 'Failed to upload partner-only file.' }, err.status || 500);
    }
};

export const downloadPrivateResourceFile = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const fileId = parseFileId(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        const content = await loadPrivateContent(db, resourceType, resourceId);
        if (!content || !canViewPrivateResource(user, resource, content.accessGrants || [])) {
            return c.json({ error: 'Partner-only file is not available for this resource.' }, 403);
        }

        const file = await loadPrivateFileForContent(db, content.id, fileId);
        if (!file) {
            return c.json({ error: 'File not found.' }, 404);
        }

        const bytes = decodePrivateFileData(file.fileData);
        return new Response(bytes, {
            status: 200,
            headers: {
                'Content-Type': file.mimeType,
                'Content-Length': String(file.fileSize),
                'Content-Disposition': createContentDisposition(file.fileName),
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (err) {
        console.error('downloadPrivateResourceFile Error:', err);
        return c.json({ error: err.message || 'Failed to download partner-only file.' }, err.status || 500);
    }
};

export const deletePrivateResourceFile = async (c) => {
    try {
        const user = c.get('user');
        requirePartnerOrAdmin(user);
        const { resourceType, resourceId } = parseResourceParams(c);
        const fileId = parseFileId(c);
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const resource = await loadResourceOr404(db, resourceType, resourceId);
        if (!canManagePrivateResource(user, resource)) {
            return c.json({ error: 'Insufficient permissions to delete partner-only files.' }, 403);
        }

        const content = await loadPrivateContent(db, resourceType, resourceId);
        if (!content) {
            return c.json({ error: 'File not found.' }, 404);
        }

        const file = await loadPrivateFileForContent(db, content.id, fileId);
        if (!file) {
            return c.json({ error: 'File not found.' }, 404);
        }

        await deletePrivateFileForContent(db, content.id, fileId);
        const updated = await loadPrivateContent(db, resourceType, resourceId);
        return c.json(formatPrivateContent(updated, resource, user));
    } catch (err) {
        console.error('deletePrivateResourceFile Error:', err);
        return c.json({ error: err.message || 'Failed to delete partner-only file.' }, err.status || 500);
    }
};
