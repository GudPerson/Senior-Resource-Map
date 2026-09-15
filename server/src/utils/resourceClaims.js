import { RESOURCE_PUBLICATION_FIELDS } from './resourcePublicationPolicy.js';

export const RESOURCE_CLAIM_USES = Object.freeze(['sharedMaps', 'embeds']);

const FIELD_SET = new Set(RESOURCE_PUBLICATION_FIELDS);
const USE_SET = new Set(RESOURCE_CLAIM_USES);

export function allowedResourceClaimFields(resourceType) {
    return RESOURCE_PUBLICATION_FIELDS.filter((field) => resourceType === 'soft' || field !== 'ctaUrl');
}

export function normalizeResourceClaimFields(value, resourceType) {
    const allowed = new Set(allowedResourceClaimFields(resourceType));
    return [...new Set((Array.isArray(value) ? value : [])
        .map((field) => String(field || '').trim())
        .filter((field) => FIELD_SET.has(field) && allowed.has(field)))];
}

export function normalizeResourceClaimUses(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.fromEntries(RESOURCE_CLAIM_USES.map((key) => [key, source[key] === true]));
}

export function hasRequestedPublicationScope(fields, uses) {
    return Array.isArray(fields)
        && fields.length > 0
        && Object.entries(uses || {}).some(([key, enabled]) => USE_SET.has(key) && enabled === true);
}

export function isPublicationScopeWithinRequest({ requestedFields, requestedUses, approvedFields, approvedUses }) {
    const requestedFieldSet = new Set(requestedFields || []);
    if (!(approvedFields || []).every((field) => requestedFieldSet.has(field))) return false;
    return RESOURCE_CLAIM_USES.every((key) => approvedUses?.[key] !== true || requestedUses?.[key] === true);
}

export function resourceClaimDisplayStatus(claim) {
    const status = String(claim?.status || '').trim();
    if (status !== 'permission_withdrawn') return status;
    if (!claim?.approvedAt && claim?.reviewedByUserId) return 'claim_rejected';
    return 'permission_withdrawn';
}

export function resourceFieldHasValue(resource, field) {
    const value = resource?.[field];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value !== null && value !== undefined && String(value).trim().length > 0;
}
