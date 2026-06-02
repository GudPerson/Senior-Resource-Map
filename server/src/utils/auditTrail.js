import { and, eq, isNull } from 'drizzle-orm';

import { organizationResourceLinks, sensitiveAuditLogs } from '../db/schema.js';
import { normalizeOrganizationAccessRole } from './governance.js';
import { normalizeRole } from './roles.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SECRET_KEY_PATTERN = /(password|secret|token|jwt|credential|private[_-]?key|api[_-]?key|authorization|cookie)/i;

const ACTION_LABELS = {
    resource_created: 'Resource created',
    resource_updated: 'Resource updated',
    resource_deleted: 'Resource deleted',
    resource_hidden: 'Resource hidden',
    resource_shown: 'Resource shown',
    resource_availability_updated: 'Resource availability updated',
    resource_access_added: 'Resource access added',
    resource_access_updated: 'Resource access updated',
    resource_access_revoked: 'Resource access revoked',
    resource_imported: 'Resource import completed',
    organization_created: 'Organisation created',
    organization_updated: 'Organisation updated',
    organization_deleted: 'Organisation deleted',
    organization_access_added: 'Organisation access added',
    organization_access_revoked: 'Organisation access revoked',
    organization_agreement_created: 'Agreement created',
    organization_agreement_updated: 'Agreement updated',
    organization_agreement_revoked: 'Agreement revoked',
    organization_resource_linked: 'Resource linked to organisation',
    organization_resource_unlinked: 'Resource unlinked from organisation',
    user_view_started: 'User view started',
    workbook_exported: 'Workbook exported',
    filtered_workbook_exported: 'Filtered workbook exported',
    restricted_content_updated: 'Restricted content updated',
    private_file_uploaded: 'Private file uploaded',
    private_file_downloaded: 'Private file downloaded',
    private_file_deleted: 'Private file deleted',
};

const RESOURCE_TYPE_LABELS = {
    hard: 'place',
    soft: 'offering',
    template: 'template',
};

const VISIBLE_AUDIT_VALUE_FIELDS = new Set([
    'accessRole',
    'agreementType',
    'deletionEligible',
    'deletionStatus',
    'governanceStatus',
    'isHidden',
    'linkStatus',
    'name',
    'resourceType',
    'staffRole',
    'status',
    'verificationConfidence',
    'verificationStatus',
]);

function toPositiveInt(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value, maxLength = 240) {
    const text = String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function toDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function sanitizeValue(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (depth > 4) return '[nested]';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
        return value.slice(0, 40).map((entry) => sanitizeValue(entry, depth + 1));
    }
    if (typeof value === 'object') {
        return sanitizeAuditMetadata(value, depth + 1);
    }
    if (typeof value === 'string') return cleanText(value, 300);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return cleanText(String(value), 300);
}

function formatUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name || row.username || row.email || `User ${row.id}`,
        email: row.email || null,
        role: row.role || null,
    };
}

function formatOrganization(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name || `Organisation ${row.id}`,
    };
}

function formatResource(row, resourceType, resourceId) {
    if (!row && !resourceType && !resourceId) return null;
    return {
        id: row?.id || resourceId || null,
        type: resourceType || null,
        label: RESOURCE_TYPE_LABELS[resourceType] || resourceType || null,
        name: row?.name || (resourceId ? `Resource ${resourceId}` : null),
    };
}

function defaultActionLabel(actionType) {
    return cleanText(actionType || 'audit_event', 120)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sanitizeAuditMetadata(metadata = {}, depth = 0) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (SECRET_KEY_PATTERN.test(key)) continue;
        const cleanedKey = cleanText(key, 80);
        if (!cleanedKey) continue;
        sanitized[cleanedKey] = sanitizeValue(value, depth);
    }
    return sanitized;
}

export function normalizeAuditLogQuery(raw = {}) {
    const parsedLimit = toPositiveInt(raw.limit);
    const limit = Math.min(parsedLimit || DEFAULT_LIMIT, MAX_LIMIT);
    return {
        limit,
        beforeId: toPositiveInt(raw.beforeId),
        before: toDate(raw.before),
        actorUserId: toPositiveInt(raw.actorUserId),
        targetUserId: toPositiveInt(raw.targetUserId),
        organizationId: toPositiveInt(raw.organizationId),
        resourceId: toPositiveInt(raw.resourceId),
        resourceType: cleanText(raw.resourceType, 20).toLowerCase() || '',
        actionType: cleanText(raw.actionType, 120),
        category: cleanText(raw.category, 40).toLowerCase(),
        from: toDate(raw.from),
        to: toDate(raw.to),
    };
}

export function buildAuditAccessScope(actor, organizationAccessRows = []) {
    if (normalizeRole(actor?.role) === 'super_admin') {
        return { mode: 'all', organizationIds: [] };
    }

    const actorId = Number(actor?.id);
    const organizationIds = [...new Set((organizationAccessRows || [])
        .filter((row) => (
            Number(row?.userId) === actorId
            && !row?.revokedAt
            && normalizeOrganizationAccessRole(row?.accessRole) === 'admin'
        ))
        .map((row) => Number(row.organizationId))
        .filter((id) => Number.isInteger(id) && id > 0))]
        .sort((left, right) => left - right);

    return organizationIds.length
        ? { mode: 'organizations', organizationIds }
        : { mode: 'none', organizationIds: [] };
}

export function buildResourceAuditPayload({
    action,
    resourceType,
    resourceId,
    resourceName,
    organizationId = null,
    changedFields = [],
    metadata = {},
} = {}) {
    const cleanResourceType = cleanText(resourceType, 20).toLowerCase();
    const cleanAction = cleanText(action, 80).toLowerCase() || 'updated';
    const fields = [...new Set((changedFields || [])
        .map((field) => cleanText(field, 80))
        .filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));

    return {
        actionType: `resource_${cleanAction}`,
        entityType: 'resource',
        entityId: toPositiveInt(resourceId),
        resourceType: cleanResourceType || null,
        resourceId: toPositiveInt(resourceId),
        organizationId: toPositiveInt(organizationId),
        metadata: sanitizeAuditMetadata({
            resourceName: cleanText(resourceName, 180),
            ...(fields.length ? { changedFields: fields, changedFieldCount: fields.length } : {}),
            ...metadata,
        }),
    };
}

export function buildAuditChangeMetadata(existing = {}, patch = {}, options = {}) {
    const visibleFields = new Set([
        ...VISIBLE_AUDIT_VALUE_FIELDS,
        ...((options.visibleValueFields || []).map((field) => cleanText(field, 80)).filter(Boolean)),
    ]);
    const fields = diffAuditFieldNames(existing, patch)
        .sort((left, right) => left.localeCompare(right));
    const changeDetails = fields.map((field) => {
        if (!visibleFields.has(field)) {
            return { field, valuePolicy: 'redacted' };
        }
        return {
            field,
            previous: sanitizeValue(existing?.[field]),
            next: sanitizeValue(patch?.[field]),
            valuePolicy: 'visible',
        };
    });

    return sanitizeAuditMetadata({
        ...(fields.length ? { changedFields: fields, changedFieldCount: fields.length } : {}),
        ...(changeDetails.length ? { changeDetails } : {}),
    });
}

export async function recordAuditLog(db, actor, payload = {}) {
    if (!db || !payload?.actionType) return null;
    return db.insert(sensitiveAuditLogs).values({
        actorUserId: actor?.id || null,
        targetUserId: payload.targetUserId || null,
        actionType: payload.actionType,
        entityType: payload.entityType || null,
        entityId: payload.entityId || null,
        resourceType: payload.resourceType || null,
        resourceId: payload.resourceId || null,
        organizationId: payload.organizationId || null,
        metadata: sanitizeAuditMetadata(payload.metadata || {}),
    });
}

export async function safelyRecordAuditLog(db, actor, payload = {}) {
    try {
        return await recordAuditLog(db, actor, payload);
    } catch (err) {
        console.warn('audit log write skipped:', err?.message || err);
        return null;
    }
}

export async function loadResourceAuditOrganizationId(db, resourceType, resourceId) {
    const type = cleanText(resourceType, 20).toLowerCase();
    const id = toPositiveInt(resourceId);
    if (!db || !type || !id) return null;

    const rows = await db.select({ organizationId: organizationResourceLinks.organizationId })
        .from(organizationResourceLinks)
        .where(and(
            eq(organizationResourceLinks.resourceType, type),
            eq(organizationResourceLinks.resourceId, id),
            isNull(organizationResourceLinks.unlinkedAt),
        ))
        .limit(2);

    return rows.length === 1 ? rows[0].organizationId : null;
}

export function formatAuditLogForResponse(row, lookups = {}) {
    const resourceKey = row?.resourceType && row?.resourceId
        ? `${row.resourceType}:${row.resourceId}`
        : null;
    const resource = resourceKey ? lookups.resources?.get(resourceKey) : null;

    return {
        id: row.id,
        actionType: row.actionType,
        actionLabel: ACTION_LABELS[row.actionType] || defaultActionLabel(row.actionType),
        entityType: row.entityType || null,
        entityId: row.entityId || null,
        resourceType: row.resourceType || null,
        resourceId: row.resourceId || null,
        organizationId: row.organizationId || null,
        actor: formatUser(lookups.actors?.get(Number(row.actorUserId))) || (row.actorUserId ? { id: row.actorUserId, name: `User ${row.actorUserId}` } : null),
        target: formatUser(lookups.targets?.get(Number(row.targetUserId))) || (row.targetUserId ? { id: row.targetUserId, name: `User ${row.targetUserId}` } : null),
        organization: formatOrganization(lookups.organizations?.get(Number(row.organizationId))),
        resource: formatResource(resource, row.resourceType, row.resourceId),
        metadata: sanitizeAuditMetadata(row.metadata || {}),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
}

export function isResourceVisibilityAction(existing = {}, patch = {}) {
    if (!Object.prototype.hasOwnProperty.call(patch, 'isHidden')) return false;
    return Boolean(existing.isHidden) !== Boolean(patch.isHidden);
}

export function diffAuditFieldNames(existing = {}, patch = {}) {
    return Object.keys(patch || {})
        .filter((key) => !['updatedAt'].includes(key))
        .filter((key) => Object.prototype.hasOwnProperty.call(patch, key))
        .filter((key) => {
            const previous = existing?.[key];
            const next = patch?.[key];
            if (previous instanceof Date || next instanceof Date) {
                return String(previous || '') !== String(next || '');
            }
            return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
        });
}
