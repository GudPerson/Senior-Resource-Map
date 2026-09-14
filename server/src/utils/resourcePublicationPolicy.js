import { and, eq, inArray, isNull, or } from 'drizzle-orm';

import {
    organizationAgreements,
    organizationResourceLinks,
    partnerOrganizations,
    resourcePublicationPermissions,
} from '../db/schema.js';

export const RESOURCE_PUBLICATION_FIELDS = Object.freeze([
    'logoUrl',
    'bannerUrl',
    'galleryUrls',
    'description',
    'website',
    'socialLinks',
    'ctaUrl',
]);

const RESOURCE_PUBLICATION_FIELD_SET = new Set(RESOURCE_PUBLICATION_FIELDS);
const RESOURCE_TYPES = new Set(['hard', 'soft']);
const ALWAYS_PRIVATE_RESOURCE_KEYS = new Set([
    'categoryIconUrl',
    'groundingSourceUrl',
    'mapCategoryIconUrl',
    'sourceUrl',
]);
const RESOURCE_FIELD_BY_PAYLOAD_KEY = new Map([
    ['logoUrl', 'logoUrl'],
    ['bannerUrl', 'bannerUrl'],
    ['galleryUrls', 'galleryUrls'],
    ['description', 'description'],
    ['descriptor', 'description'],
    ['website', 'website'],
    ['websiteUrl', 'website'],
    ['socialLinks', 'socialLinks'],
    ['ctaUrl', 'ctaUrl'],
    ['externalUrl', 'ctaUrl'],
]);

function resourceKey(resourceType, resourceId) {
    const type = String(resourceType || '').trim().toLowerCase();
    const id = Number(resourceId);
    return RESOURCE_TYPES.has(type) && Number.isInteger(id) && id > 0
        ? `${type}:${id}`
        : null;
}

function normalizeApprovedFields(value) {
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((field) => RESOURCE_PUBLICATION_FIELD_SET.has(field)));
}

function normalizeAllowedUses(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isMissingPublicationPermissionTable(error) {
    return error?.code === '42P01'
        && String(error?.message || '').toLowerCase().includes('resource_publication_permissions');
}

export function collectResourcePublicationRefs(value) {
    const refs = new Map();
    const visit = (item) => {
        if (Array.isArray(item)) {
            item.forEach(visit);
            return;
        }
        if (!item || typeof item !== 'object') return;
        const key = resourceKey(item.resourceType, item.resourceId);
        if (key) {
            refs.set(key, {
                resourceType: String(item.resourceType).trim().toLowerCase(),
                resourceId: Number(item.resourceId),
            });
        }
        Object.values(item).forEach(visit);
    };
    visit(value);
    return [...refs.values()];
}

export async function loadApprovedResourcePublicationFields(db, directory, publicUse) {
    const refs = collectResourcePublicationRefs(directory);
    if (!refs.length || typeof db?.select !== 'function') return new Map();

    const refsByType = new Map();
    refs.forEach(({ resourceType, resourceId }) => {
        if (!refsByType.has(resourceType)) refsByType.set(resourceType, []);
        refsByType.get(resourceType).push(resourceId);
    });
    const resourceClauses = [...refsByType.entries()].map(([resourceType, ids]) => and(
        eq(resourcePublicationPermissions.resourceType, resourceType),
        inArray(resourcePublicationPermissions.resourceId, ids),
    ));

    let rows;
    try {
        rows = await db.select({
            resourceType: resourcePublicationPermissions.resourceType,
            resourceId: resourcePublicationPermissions.resourceId,
            approvedFields: resourcePublicationPermissions.approvedFields,
            permissionAllowedUses: resourcePublicationPermissions.allowedUses,
            permissionApprovedAt: resourcePublicationPermissions.approvedAt,
            permissionTermsVersion: resourcePublicationPermissions.termsVersion,
            agreementAllowedUses: organizationAgreements.allowedUses,
            agreementApprovedAt: organizationAgreements.approvedAt,
            agreementEffectiveAt: organizationAgreements.effectiveAt,
            agreementExpiresAt: organizationAgreements.expiresAt,
        })
            .from(resourcePublicationPermissions)
            .innerJoin(partnerOrganizations, eq(
                resourcePublicationPermissions.organizationId,
                partnerOrganizations.id,
            ))
            .innerJoin(organizationResourceLinks, and(
                eq(organizationResourceLinks.organizationId, resourcePublicationPermissions.organizationId),
                eq(organizationResourceLinks.resourceType, resourcePublicationPermissions.resourceType),
                eq(organizationResourceLinks.resourceId, resourcePublicationPermissions.resourceId),
            ))
            .innerJoin(organizationAgreements, and(
                eq(organizationAgreements.id, resourcePublicationPermissions.agreementId),
                eq(organizationAgreements.organizationId, resourcePublicationPermissions.organizationId),
            ))
            .where(and(
                or(...resourceClauses),
                eq(resourcePublicationPermissions.status, 'publishing_approved'),
                isNull(resourcePublicationPermissions.withdrawnAt),
                eq(partnerOrganizations.governanceStatus, 'active'),
                eq(organizationResourceLinks.linkStatus, 'active'),
                isNull(organizationResourceLinks.unlinkedAt),
                eq(organizationAgreements.status, 'active'),
                isNull(organizationAgreements.revokedAt),
            ));
    } catch (error) {
        if (isMissingPublicationPermissionTable(error)) return new Map();
        throw error;
    }

    const now = Date.now();
    const approvedByResource = new Map();
    for (const row of rows) {
        const permissionUses = normalizeAllowedUses(row.permissionAllowedUses);
        const agreementUses = normalizeAllowedUses(row.agreementAllowedUses);
        const effectiveAt = row.agreementEffectiveAt ? new Date(row.agreementEffectiveAt).getTime() : null;
        const expiresAt = row.agreementExpiresAt ? new Date(row.agreementExpiresAt).getTime() : null;
        if (!row.permissionApprovedAt || !String(row.permissionTermsVersion || '').trim()) continue;
        if (!row.agreementApprovedAt) continue;
        if (permissionUses[publicUse] !== true) continue;
        if (agreementUses.publicListing !== true || agreementUses.externalSharing !== true) continue;
        if (Number.isFinite(effectiveAt) && effectiveAt > now) continue;
        if (Number.isFinite(expiresAt) && expiresAt < now) continue;

        const key = resourceKey(row.resourceType, row.resourceId);
        if (!key) continue;
        const existing = approvedByResource.get(key) || new Set();
        normalizeApprovedFields(row.approvedFields).forEach((field) => existing.add(field));
        approvedByResource.set(key, existing);
    }
    return approvedByResource;
}

function deniedValue(key) {
    if (key === 'galleryUrls') return [];
    if (key === 'socialLinks') return {};
    return null;
}

export function applyResourcePublicationPolicy(value, approvedByResource = new Map(), inheritedResourceKey = null) {
    if (Array.isArray(value)) {
        return value.map((item) => applyResourcePublicationPolicy(item, approvedByResource, inheritedResourceKey));
    }
    if (!value || typeof value !== 'object') return value;

    const currentResourceKey = resourceKey(value.resourceType, value.resourceId) || inheritedResourceKey;
    const approvedFields = currentResourceKey
        ? approvedByResource.get(currentResourceKey) || new Set()
        : new Set();

    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (currentResourceKey && ALWAYS_PRIVATE_RESOURCE_KEYS.has(key)) {
            return [key, null];
        }
        const publicationField = currentResourceKey ? RESOURCE_FIELD_BY_PAYLOAD_KEY.get(key) : null;
        if (publicationField && !approvedFields.has(publicationField)) {
            return [key, deniedValue(key)];
        }
        return [key, applyResourcePublicationPolicy(item, approvedByResource, currentResourceKey)];
    }));
}
