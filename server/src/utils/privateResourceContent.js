import { and, eq } from 'drizzle-orm';

import {
    hardAssets,
    hardAssetStaffMemberships,
    privateResourceContentAccess,
    privateResourceContentFiles,
    privateResourceContents,
    softAssets,
    softAssetStaffMemberships,
    userSubregions,
    users,
} from '../db/schema.js';
import { hasAnyHardAssetStaffAccess } from './hardAssetStaff.js';
import { actorCanManageAsset } from './ownership.js';
import { normalizeRole } from './roles.js';
import { hasAnySoftAssetStaffAccess } from './softAssetAccess.js';

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

function toInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) ? number : null;
}

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

export function canReceivePrivateResourceViewerGrant(actor) {
    const role = normalizeRole(actor?.role);
    if (role === 'regional_admin') return true;
    return hasAnyHardAssetStaffAccess(actor) || hasAnySoftAssetStaffAccess(actor);
}

export function canViewPrivateResource(actor, resource, accessGrants = []) {
    if (canManagePrivateResource(actor, resource)) return true;
    if (!canReceivePrivateResourceViewerGrant(actor)) return false;
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
                hostHardAsset: { columns: { id: true, subregionId: true } },
                locations: {
                    with: {
                        hardAsset: { columns: { id: true, subregionId: true } },
                    },
                },
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

function createCandidateViewerActor(candidate) {
    const hardAssetStaffAccess = (candidate?.hardAssetStaffMemberships || []).map((entry) => ({
        hardAssetId: toInteger(entry?.hardAssetId),
        staffRole: entry?.staffRole || null,
        revokedAt: entry?.revokedAt || null,
    }));
    const softAssetStaffAccess = (candidate?.softAssetStaffMemberships || []).map((entry) => ({
        softAssetId: toInteger(entry?.softAssetId),
        staffRole: entry?.staffRole || null,
        revokedAt: entry?.revokedAt || null,
    }));

    return {
        ...candidate,
        hardAssetStaffAccess,
        softAssetStaffAccess,
    };
}

function addUniqueByKey(items, item, key) {
    if (!key || items.some((existing) => existing.__key === key)) return;
    items.push({ ...item, __key: key });
}

function groupPrivateAccessCandidateRows(rows) {
    const grouped = new Map();

    for (const row of rows || []) {
        const id = toInteger(row?.id);
        if (!id) continue;

        if (!grouped.has(id)) {
            grouped.set(id, {
                id,
                username: row.username,
                name: row.name,
                role: row.role,
                managerUserId: row.managerUserId || null,
                subregions: [],
                hardAssetStaffMemberships: [],
                softAssetStaffMemberships: [],
            });
        }

        const candidate = grouped.get(id);
        const subregionId = toInteger(row.subregionId);
        if (subregionId) {
            addUniqueByKey(candidate.subregions, { subregionId }, `subregion:${subregionId}`);
        }

        const hardAssetId = toInteger(row.hardAssetId);
        if (hardAssetId) {
            addUniqueByKey(candidate.hardAssetStaffMemberships, {
                hardAssetId,
                staffRole: row.hardStaffRole,
                revokedAt: row.hardRevokedAt || null,
            }, `hard:${hardAssetId}:${row.hardStaffRole}:${row.hardRevokedAt || ''}`);
        }

        const softAssetId = toInteger(row.softAssetId);
        if (softAssetId) {
            addUniqueByKey(candidate.softAssetStaffMemberships, {
                softAssetId,
                staffRole: row.softStaffRole,
                revokedAt: row.softRevokedAt || null,
            }, `soft:${softAssetId}:${row.softStaffRole}:${row.softRevokedAt || ''}`);
        }
    }

    return [...grouped.values()].map((candidate) => ({
        ...candidate,
        subregions: candidate.subregions.map(({ __key, ...entry }) => entry),
        hardAssetStaffMemberships: candidate.hardAssetStaffMemberships.map(({ __key, ...entry }) => entry),
        softAssetStaffMemberships: candidate.softAssetStaffMemberships.map(({ __key, ...entry }) => entry),
    }));
}

export async function loadPrivateAccessCandidates(db, resourceOrSubregionId, resourcePartnerId = null) {
    const resource = typeof resourceOrSubregionId === 'object' && resourceOrSubregionId !== null
        ? resourceOrSubregionId
        : { subregionId: resourceOrSubregionId, partnerId: resourcePartnerId };

    const rows = await db.select({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        managerUserId: users.managerUserId,
        subregionId: userSubregions.subregionId,
        hardAssetId: hardAssetStaffMemberships.hardAssetId,
        hardStaffRole: hardAssetStaffMemberships.staffRole,
        hardRevokedAt: hardAssetStaffMemberships.revokedAt,
        softAssetId: softAssetStaffMemberships.softAssetId,
        softStaffRole: softAssetStaffMemberships.staffRole,
        softRevokedAt: softAssetStaffMemberships.revokedAt,
    })
        .from(users)
        .leftJoin(userSubregions, eq(userSubregions.userId, users.id))
        .leftJoin(hardAssetStaffMemberships, eq(hardAssetStaffMemberships.userId, users.id))
        .leftJoin(softAssetStaffMemberships, eq(softAssetStaffMemberships.userId, users.id));

    return groupPrivateAccessCandidateRows(rows)
        .map((candidate) => ({ candidate, actor: createCandidateViewerActor(candidate) }))
        .filter(({ candidate }) => Number(candidate.id) !== Number(resource?.partnerId))
        .filter(({ actor }) => canReceivePrivateResourceViewerGrant(actor))
        .filter(({ actor }) => !canManagePrivateResource(actor, resource))
        .map(({ candidate }) => ({
            id: candidate.id,
            name: candidate.name,
            username: candidate.username,
            managerUserId: candidate.managerUserId || null,
        }))
        .sort((left, right) => (left.name || left.username || '').localeCompare(right.name || right.username || ''));
}

export async function assertValidPrivateAccessUserIds(db, resource, userIds) {
    const requested = [...new Set((userIds || [])
        .map((value) => Number.parseInt(String(value), 10))
        .filter(Number.isInteger))];
    if (requested.length === 0) return [];

    const candidates = await loadPrivateAccessCandidates(db, resource);
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const invalid = requested.filter((id) => !candidateIds.has(id));
    if (invalid.length > 0) {
        const err = new Error('One or more selected read-only viewers are not eligible for this restricted content.');
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
