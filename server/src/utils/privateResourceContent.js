import { and, eq } from 'drizzle-orm';

import {
    hardAssets,
    privateResourceContentAccess,
    privateResourceContentFiles,
    privateResourceContents,
    softAssets,
    users,
} from '../db/schema.js';
import { actorCanManageAsset } from './ownership.js';
import { normalizeRole } from './roles.js';

export const PRIVATE_RESOURCE_TYPES = new Set(['hard', 'soft']);
export const PRIVATE_FILE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Map([
    ['application/pdf', 'pdf'],
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/heic', 'heic'],
    ['image/heif', 'heif'],
]);

const EXTENSION_MIME_TYPES = new Map([
    ['pdf', 'application/pdf'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['heic', 'image/heic'],
    ['heif', 'image/heif'],
]);

export function normalizePrivateResourceType(value) {
    const type = String(value || '').trim().toLowerCase();
    return PRIVATE_RESOURCE_TYPES.has(type) ? type : null;
}

export function normalizePrivateNotes(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

export function sanitizePrivateFileName(value, fallback = 'partner-file') {
    const base = String(value || fallback)
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    return base || fallback;
}

export function getPrivateFileExtension(fileName = '') {
    const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] || '';
}

export function resolvePrivateFileMimeType(file) {
    const declared = String(file?.type || '').trim().toLowerCase();
    if (ALLOWED_MIME_TYPES.has(declared)) return declared;

    const extension = getPrivateFileExtension(file?.name);
    return EXTENSION_MIME_TYPES.get(extension) || '';
}

export function validatePrivateFile(file) {
    if (!file) {
        return { ok: false, error: 'Choose a PDF or image file first.' };
    }

    const size = Number(file.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
        return { ok: false, error: 'The selected file is empty.' };
    }

    if (size > PRIVATE_FILE_MAX_BYTES) {
        return { ok: false, error: 'Private files must be 10 MB or smaller.' };
    }

    const mimeType = resolvePrivateFileMimeType(file);
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return { ok: false, error: 'Only PDF, JPG, PNG, WEBP, and HEIC files are supported.' };
    }

    return {
        ok: true,
        mimeType,
        fileName: sanitizePrivateFileName(file.name || `partner-file.${ALLOWED_MIME_TYPES.get(mimeType)}`),
        size,
    };
}

export function encodePrivateFileData(arrayBuffer) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(arrayBuffer).toString('base64');
    }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
}

export function decodePrivateFileData(base64) {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64, 'base64'));
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function canManagePrivateResource(actor, resource) {
    return actorCanManageAsset(actor, resource, resource?.partner || null);
}

export function canViewPrivateResource(actor, resource, accessGrants = []) {
    if (canManagePrivateResource(actor, resource)) return true;
    if (normalizeRole(actor?.role) !== 'partner') return false;
    return accessGrants.some((grant) => Number(grant.userId) === Number(actor?.id));
}

export function formatPrivateFile(file) {
    if (!file) return null;
    return {
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: Number(file.fileSize || 0),
        createdAt: file.createdAt || null,
        uploadedByName: file.uploader?.name || null,
    };
}

export function formatPrivateAccessUser(grant) {
    if (!grant?.user) return null;
    return {
        id: grant.user.id,
        name: grant.user.name,
        username: grant.user.username,
    };
}

export async function loadPrivateResource(db, resourceType, resourceId) {
    if (resourceType === 'hard') {
        const asset = await db.query.hardAssets.findFirst({
            where: eq(hardAssets.id, resourceId),
            with: {
                partner: { columns: { id: true, name: true, username: true, role: true, managerUserId: true } },
            },
        });
        return asset && !asset.isDeleted ? asset : null;
    }

    if (resourceType === 'soft') {
        const asset = await db.query.softAssets.findFirst({
            where: eq(softAssets.id, resourceId),
            with: {
                partner: { columns: { id: true, name: true, username: true, role: true, managerUserId: true } },
            },
        });
        return asset && !asset.isDeleted ? asset : null;
    }

    return null;
}

export async function loadPrivateContent(db, resourceType, resourceId, options = {}) {
    const includeFileData = Boolean(options.includeFileData);
    return db.query.privateResourceContents.findFirst({
        where: and(
            eq(privateResourceContents.resourceType, resourceType),
            eq(privateResourceContents.resourceId, resourceId),
        ),
        with: {
            accessGrants: {
                with: {
                    user: { columns: { id: true, name: true, username: true, role: true } },
                },
            },
            files: {
                columns: includeFileData
                    ? undefined
                    : {
                        id: true,
                        contentId: true,
                        fileName: true,
                        mimeType: true,
                        fileSize: true,
                        uploadedByUserId: true,
                        createdAt: true,
                    },
                with: {
                    uploader: { columns: { id: true, name: true } },
                },
            },
        },
    });
}

export async function ensurePrivateContent(db, resourceType, resourceId, actor) {
    const existing = await loadPrivateContent(db, resourceType, resourceId);
    if (existing) return existing;

    const [created] = await db.insert(privateResourceContents).values({
        resourceType,
        resourceId,
        notes: '',
        createdByUserId: actor?.id || null,
        updatedByUserId: actor?.id || null,
    }).returning();

    return loadPrivateContent(db, created.resourceType, created.resourceId);
}

export async function loadPrivateAccessCandidates(db, resourceSubregionId, resourcePartnerId = null) {
    if (!Number.isInteger(resourceSubregionId)) return [];

    const rows = await db.query.users.findMany({
        columns: {
            id: true,
            username: true,
            name: true,
            role: true,
            managerUserId: true,
        },
        with: {
            subregions: {
                columns: { subregionId: true },
            },
        },
    });

    return rows
        .filter((candidate) => normalizeRole(candidate.role) === 'partner')
        .filter((candidate) => Number(candidate.id) !== Number(resourcePartnerId))
        .filter((candidate) => (candidate.subregions || []).some((entry) => Number(entry.subregionId) === Number(resourceSubregionId)))
        .map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            username: candidate.username,
            managerUserId: candidate.managerUserId || null,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

export async function assertValidPrivateAccessUserIds(db, resource, userIds) {
    const requested = [...new Set((userIds || [])
        .map((value) => Number.parseInt(String(value), 10))
        .filter(Number.isInteger))];
    if (requested.length === 0) return [];

    const candidates = await loadPrivateAccessCandidates(db, resource.subregionId, resource.partnerId);
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const invalid = requested.filter((id) => !candidateIds.has(id));
    if (invalid.length > 0) {
        const err = new Error('One or more selected partner viewers are outside this resource subregion.');
        err.status = 400;
        throw err;
    }

    return requested;
}

export async function syncPrivateAccessGrants(db, contentId, resource, requestedUserIds, actor) {
    const userIds = await assertValidPrivateAccessUserIds(db, resource, requestedUserIds);

    await db.delete(privateResourceContentAccess)
        .where(eq(privateResourceContentAccess.contentId, contentId));

    if (userIds.length > 0) {
        await db.insert(privateResourceContentAccess).values(
            userIds.map((userId) => ({
                contentId,
                userId,
                createdByUserId: actor?.id || null,
            }))
        );
    }
}

export async function insertPrivateFile(db, contentId, file, actor) {
    const validation = validatePrivateFile(file);
    if (!validation.ok) {
        const err = new Error(validation.error);
        err.status = 400;
        throw err;
    }

    const fileData = encodePrivateFileData(await file.arrayBuffer());
    const [created] = await db.insert(privateResourceContentFiles).values({
        contentId,
        fileName: validation.fileName,
        mimeType: validation.mimeType,
        fileSize: validation.size,
        fileData,
        uploadedByUserId: actor?.id || null,
    }).returning();

    return created;
}

export async function loadPrivateFileForContent(db, contentId, fileId) {
    return db.query.privateResourceContentFiles.findFirst({
        where: and(
            eq(privateResourceContentFiles.contentId, contentId),
            eq(privateResourceContentFiles.id, fileId),
        ),
        with: {
            uploader: { columns: { id: true, name: true } },
        },
    });
}

export async function deletePrivateFileForContent(db, contentId, fileId) {
    await db.delete(privateResourceContentFiles)
        .where(and(
            eq(privateResourceContentFiles.contentId, contentId),
            eq(privateResourceContentFiles.id, fileId),
        ));
}

export async function updatePrivateNotes(db, contentId, notes, actor) {
    await db.update(privateResourceContents)
        .set({
            notes: normalizePrivateNotes(notes),
            updatedByUserId: actor?.id || null,
            updatedAt: new Date(),
        })
        .where(eq(privateResourceContents.id, contentId));
}
