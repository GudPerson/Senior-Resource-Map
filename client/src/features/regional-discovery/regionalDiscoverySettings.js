const CONTACT_MODES = ['original', 'hidden', 'home-sr'];
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const revisionIsValid = value => positiveId(value) && value <= 2147483647;
function exactKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function invalid() { throw new Error('Review the regional settings before saving.'); }

/** Validate only curator intent. Membership and approvals remain server-authoritative. */
export function normalizeRegionalDiscoverySettings(value) {
    if (!exactKeys(value, ['schemaVersion', 'mode', 'includedSubregionIds', 'regionExtent', 'entries'])
        || value.schemaVersion !== 1 || !['compact', 'regional-discovery'].includes(value.mode)) invalid();
    const { includedSubregionIds: ids, regionExtent: extent, entries } = value;
    if (!Array.isArray(ids) || ids.length > 85 || !ids.every(positiveId) || new Set(ids).size !== ids.length
        || (value.mode === 'regional-discovery' && !ids.length)) invalid();
    if (!Array.isArray(extent) || extent.length !== 4 || !extent.every(Number.isFinite)
        || extent[0] < -180 || extent[2] > 180 || extent[1] < -90 || extent[3] > 90
        || extent[0] >= extent[2] || extent[1] >= extent[3]) invalid();
    if (!Array.isArray(entries) || entries.length > 500 || entries.some(entry => (
        !exactKeys(entry, ['resourceType', 'resourceId', 'mapPlacement', 'distanceSource', 'emailMode', 'phoneMode'])
        || !['hard', 'soft'].includes(entry.resourceType) || !positiveId(entry.resourceId)
        || !['published-locations', 'unplotted'].includes(entry.mapPlacement)
        || !['published-locations', 'none'].includes(entry.distanceSource)
        || !CONTACT_MODES.includes(entry.emailMode) || !CONTACT_MODES.includes(entry.phoneMode)
    )) || new Set(entries.map(entry => `${entry.resourceType}:${entry.resourceId}`)).size !== entries.length) invalid();
    if (new TextEncoder().encode(JSON.stringify(value)).length > 65536) invalid();
    return { schemaVersion: 1, mode: value.mode, includedSubregionIds: [...ids], regionExtent: [...extent], entries: entries.map(entry => ({ ...entry })) };
}

export function buildRegionalDiscoveryPublishIntent({ savedRevision, hasUnsavedChanges = false, config }) {
    if (hasUnsavedChanges) throw new Error('Save regional settings before publishing or previewing.');
    const saved = normalizeRegionalDiscoverySettings(config);
    if (saved.mode === 'compact') return { mode: 'compact' };
    if (!revisionIsValid(savedRevision)) throw new Error('Save regional settings before publishing or previewing.');
    return { mode: 'regional-discovery', revision: savedRevision };
}

/** Undefined deliberately preserves the established share path, even if settings failed to load. */
export function normalizeRegionalDiscoveryEmbeddedView(value) {
    if (value === undefined) return undefined;
    if (exactKeys(value, ['mode']) && value.mode === 'compact') return { mode: 'compact' };
    if (exactKeys(value, ['mode', 'revision']) && value.mode === 'regional-discovery' && revisionIsValid(value.revision)) {
        return { mode: value.mode, revision: value.revision };
    }
    throw new Error('Invalid regional publication choice.');
}

/** Accept only C1 publication readback; never derive a URL from a draft or share token. */
export function getPublishedRegionalDiscoveryUrl(publication) {
    return publication?.mode === 'regional-discovery' && publication.available === true
        && typeof publication.snapshotRevision === 'string' && publication.snapshotRevision.trim()
        && revisionIsValid(publication.publishedConfigRevision)
        && typeof publication.regionalUrl === 'string'
        && /^\/embed\/maps\/[A-Za-z0-9_-]+\/regional-discovery$/.test(publication.regionalUrl)
        ? publication.regionalUrl : '';
}

export function containHandledRegionalPreviewEscape(event) {
    if (event.key === 'Escape' && event.defaultPrevented) event.stopPropagation();
}
