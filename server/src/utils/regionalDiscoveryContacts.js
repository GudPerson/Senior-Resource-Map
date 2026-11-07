import { and, eq, inArray, or } from 'drizzle-orm';
import {
    hardAssets, softAssets, subregions, subregionEnquiryContactFields, regionalEmbedEmailGrants,
} from '../db/schema.js';
import { loadApprovedResourcePublicationFields } from './resourcePublicationPolicy.js';
import { buildRegionalContactHref } from '../../../shared/regionalDiscoveryContactValues.js';

const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const resourceKey = ref => ['hard', 'soft'].includes(ref?.resourceType) && validId(ref?.resourceId)
    ? `${ref.resourceType}:${ref.resourceId}` : null;
const emptyMetadata = () => ({ approvedFields: new Map(), enquiryContacts: new Map() });

function canonical(field, value) {
    const candidate = typeof value === 'string' ? value.trim() : value;
    const href = buildRegionalContactHref(field, candidate);
    return href ? (field === 'email' ? candidate : href.slice(4)) : null;
}

async function hash(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Actor IDs are historical provenance; there must be no live users join (C5).
async function approvedValue(row, field, valueKey = 'value') {
    if (row?.status !== 'approved' || !validId(row.approvedByUserId) || !row.approvedAt
        || !Number.isInteger(row.revision) || row.revision < 1
        || typeof row.provenance !== 'string' || !row.provenance.trim()
        || row.withdrawnAt != null || row.withdrawnByUserId != null || row.withdrawalReason != null) return null;
    const value = canonical(field, row[valueKey]);
    // Governance stores canonical values. A noncanonical/mismatched record is not authority.
    if (!value || value !== row[valueKey] || row.valueHash !== await hash(value)) return null;
    return { value, valueHash: row.valueHash };
}

/**
 * Internal request-local metadata; never serialize these maps into a public DTO.
 * refs: at most 500 exact {resourceType:'hard'|'soft', resourceId:number} identities.
 * subregionIds: at most 85 local SR identities; omitted/empty performs no registry read.
 * No table creation or fallback authority on missing/failed stores.
 */
export async function loadRegionalDiscoveryContactApprovals(db, refs, { subregionIds = [] } = {}) {
    if (!Array.isArray(refs) || refs.length > 500) throw new Error('At most 500 resource references are supported.');
    if (refs.some(ref => !resourceKey(ref))) throw new Error('Invalid resource reference.');
    if (!Array.isArray(subregionIds) || subregionIds.length > 85) throw new Error('At most 85 subregion identifiers are supported.');
    if (subregionIds.some(id => !validId(id))) throw new Error('Invalid subregion identifier.');
    const result = emptyMetadata();
    if ((!refs.length && !subregionIds.length) || typeof db?.select !== 'function') return result;
    const identities = [...new Map(refs.map(ref => [resourceKey(ref), {
        resourceType: ref.resourceType, resourceId: ref.resourceId,
    }])).values()];
    const idsByType = ['hard', 'soft'].map(type => [type, identities.filter(ref => ref.resourceType === type).map(ref => ref.resourceId)]);
    const grantClauses = idsByType.filter(([,ids]) => ids.length).map(([type,ids]) => and(
        eq(regionalEmbedEmailGrants.resourceType, type), inArray(regionalEmbedEmailGrants.resourceId, ids),
    ));
    const [publication, resourcesByType, grants, registry] = await Promise.all([
        identities.length ? loadApprovedResourcePublicationFields(db, identities, 'embeds') : new Map(),
        Promise.all(idsByType.map(async ([type,ids]) => {
            if (!ids.length) return [];
            const table = type === 'hard' ? hardAssets : softAssets;
            const rows = await db.select({id:table.id,contactEmail:table.contactEmail}).from(table).where(inArray(table.id,ids));
            return rows.map(row => ({...row,resourceType:type}));
        })),
        grantClauses.length ? db.select().from(regionalEmbedEmailGrants).where(and(
            or(...grantClauses), eq(regionalEmbedEmailGrants.status,'approved'),
        )) : [],
        subregionIds.length ? db.select({contact:subregionEnquiryContactFields,subregionCode:subregions.subregionCode})
            .from(subregionEnquiryContactFields)
            .innerJoin(subregions,eq(subregions.id,subregionEnquiryContactFields.subregionId))
            .where(and(inArray(subregionEnquiryContactFields.subregionId,[...new Set(subregionIds)]),eq(subregionEnquiryContactFields.status,'approved'))) : [],
    ]);
    const resources = new Map(resourcesByType.flat().map(row => [`${row.resourceType}:${row.id}`, row]));
    for (const grant of grants) {
        const key = resourceKey(grant);
        // Map presence means a live approved embeds permission even when its field Set is empty.
        if (!publication.has(key)) continue;
        const approved = await approvedValue(grant,'email','approvedOriginalEmail');
        const current = canonical('email',resources.get(key)?.contactEmail);
        if (approved && current === approved.value) result.approvedFields.set(key,{email:approved});
    }
    for (const {contact,subregionCode} of registry) {
        const code = typeof subregionCode === 'string' ? subregionCode.trim() : '';
        if (!code || /^(SIN|SG|SINGAPORE|NATIONAL)$/i.test(code) || !['email','phone'].includes(contact.field)) continue;
        const approved = await approvedValue(contact,contact.field);
        if (!approved) continue;
        const fields = result.enquiryContacts.get(contact.subregionId) || {};
        fields[contact.field] = approved;
        result.enquiryContacts.set(contact.subregionId,fields);
    }
    return result;
}

function unavailable(status, appliesTo) { return { status, appliesTo }; }
function available(field, value, appliesTo) {
    const href = buildRegionalContactHref(field,value);
    if (!href) return unavailable('temporarily-unavailable',appliesTo);
    return {
        status:'available', appliesTo,
        label:appliesTo === 'service' ? `Service ${field}` : `ICCP enquiry ${field} for this location`,
        value, href,
    };
}

/**
 * entry is a CURRENT available guest-policy projection. contactPhone must be its
 * FROZEN scoped original phone, never a live/host/alternate/private venue fallback.
 * homeSubregionId must be null unless postal evaluation confirmed inside-region.
 * originalContacts.email is frozen at publication from loader-approved value/hash.
 */
export function resolveRegionalDiscoveryContacts(entry, contactIntent = {}, {
    homeSubregionId = null, approvedFields = new Map(), enquiryContacts = new Map(),
} = {}) {
    const resolve = field => {
        const mode = contactIntent?.[`${field}Mode`] === undefined ? 'original' : contactIntent[`${field}Mode`];
        const appliesTo = mode === 'home-sr' ? 'entered-location' : 'service';
        if (mode === 'hidden') return unavailable('hidden',appliesTo);
        const key = resourceKey(entry);
        if (!key || entry.status !== 'available') return unavailable('temporarily-unavailable',appliesTo);
        if (mode === 'home-sr') {
            if (!validId(homeSubregionId)) return unavailable('needs-postal',appliesTo);
            const approved = enquiryContacts.get(homeSubregionId)?.[field];
            return available(field,approved?.value,appliesTo);
        }
        if (mode !== 'original') return unavailable('temporarily-unavailable',appliesTo);
        if (field === 'phone') return available(field,entry.contactPhone,appliesTo);
        const frozen = contactIntent?.originalContacts?.email;
        const current = approvedFields.get(key)?.email;
        if (!frozen || !current || frozen.value !== current.value || frozen.valueHash !== current.valueHash) {
            return unavailable('temporarily-unavailable',appliesTo);
        }
        return available(field,current.value,appliesTo);
    };
    return { email:resolve('email'), phone:resolve('phone') };
}
