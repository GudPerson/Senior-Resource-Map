import { and, eq, inArray, isNull } from 'drizzle-orm';
import { audienceZones, hardAssets, hardAssetStaffMemberships, partnerOrganizations, partnerStaffMemberships, softAssets, users } from '../db/schema.js';
import { normalizeRegionalDiscoverySnapshot } from './regionalDiscoveryConfig.js';
import { loadLiveAssetsByKey, isLiveMyMapAssetVisible, getVisibleMapLocationIds } from './myMapDirectory.js';
import { loadApprovedResourcePublicationFields, applyResourcePublicationPolicy } from './resourcePublicationPolicy.js';
import { loadRegionalDiscoveryCoverage, resolveRegionalDiscoveryHomeSubregion, evaluateRegionalDiscoveryRecommendations, calculateRegionalDiscoveryDistance, sortRegionalDiscoveryEntries } from './regionalDiscoveryCoverage.js';
import { resolveRegionalDiscoveryPostal } from './regionalDiscoveryPostal.js';
import { loadRegionalDiscoveryContactApprovals, resolveRegionalDiscoveryContacts } from './regionalDiscoveryContacts.js';
import { canUseAudienceZoneForHardAssetIds, canViewAudienceZone, resolveMatchedAudienceZoneIds } from './audienceZones.js';
import { buildHardAssetStaffAccessPayload } from './hardAssetStaff.js';
import { buildPartnerStaffAccessPayload } from './partnerStaff.js';
import { normalizeRegionalDiscoveryPayload } from '../../../shared/regionalDiscoveryContract.js';

const guest = {role:'guest'};
const guestContext = {allowedPartnerAudienceIds:new Set(),allowedAudienceZoneIds:new Set()};
const keyOf = ref=>`${ref.resourceType}:${ref.resourceId}`;
const ids = values=>[...new Set(values.filter(value=>Number.isSafeInteger(value)&&value>0))];

/** Private current authority; resource links never fabricate staff membership. */
export async function loadRegionalDiscoveryEffectiveCoverage(db, refs) {
    const metadata = await loadRegionalDiscoveryCoverage(db,refs);
    const configured = metadata.filter(row=>row.zoneState==='configured');
    if (!configured.length) return metadata;
    const wanted = new Set(configured.map(row=>row.entryKey));
    const hardIds = refs.filter(ref=>ref.resourceType==='hard' && wanted.has(keyOf(ref))).map(ref=>ref.resourceId);
    const softIds = refs.filter(ref=>ref.resourceType==='soft' && wanted.has(keyOf(ref))).map(ref=>ref.resourceId);
    const [hardRows,softRows,zones] = await Promise.all([
        hardIds.length ? db.query.hardAssets.findMany({columns:{id:true,partnerId:true},where:inArray(hardAssets.id,hardIds)}) : [],
        softIds.length ? db.query.softAssets.findMany({columns:{id:true,partnerId:true,assetMode:true,hostHardAssetId:true},where:inArray(softAssets.id,softIds),
            with:{parent:{columns:{id:true,partnerId:true}},locations:{columns:{hardAssetId:true}}}}) : [],
        db.select({id:audienceZones.id,hardAssetId:audienceZones.hardAssetId,partnerUserId:audienceZones.partnerUserId,sharingStatus:audienceZones.sharingStatus})
            .from(audienceZones).where(inArray(audienceZones.id,ids(configured.flatMap(row=>row.audienceZoneIds)))),
    ]);
    const resources = new Map([
        ...hardRows.map(row=>[`hard:${row.id}`,{ownerId:row.partnerId,hardIds:[row.id]}]),
        ...softRows.map(row=>[`soft:${row.id}`,{ownerId:row.assetMode==='child' ? row.parent?.partnerId : row.partnerId,
            hardIds:ids([row.hostHardAssetId,...row.locations.map(location=>location.hardAssetId)])}]),
    ]);
    const ownerIds = ids([...resources.values()].map(resource=>resource.ownerId));
    // Users has no active/deleted flag: current row existence is the canonical account-liveness boundary.
    // Only identity and role are read; no saved Home, profile or account contacts.
    const owners = ownerIds.length ? await db.select({id:users.id,role:users.role}).from(users).where(inArray(users.id,ownerIds)) : [];
    const actors = new Map(owners.map(owner=>[owner.id,{...owner}]));
    const zoneMap = new Map(zones.map(zone=>[zone.id,zone]));
    // Ask the unchanged predicates first. Shared approval, super-admin and direct
    // partner ownership do not require staff reads. Missing owners remain guests.
    const hardOwnerIds=new Set(), partnerOwnerIds=new Set(), localHardIds=new Set(), localPartnerIds=new Set();
    for (const row of configured) {
        const resource=resources.get(row.entryKey), actor=actors.get(resource?.ownerId);
        if (!actor) continue;
        for (const zoneId of row.audienceZoneIds) {
            const zone=zoneMap.get(zoneId);
            if (!zone || (canViewAudienceZone(actor,zone) && canUseAudienceZoneForHardAssetIds(actor,zone,resource.hardIds))) continue;
            if (zone.hardAssetId) { hardOwnerIds.add(actor.id); localHardIds.add(zone.hardAssetId); }
            else if (zone.partnerUserId) { partnerOwnerIds.add(actor.id); localPartnerIds.add(zone.partnerUserId); }
        }
    }
    // Request-local batches contain only real current memberships needed by these
    // predicates. No geographic scopes, names, contacts or cross-request cache.
    async function optionalMemberships(query, tableNames) {
        try { return await query; }
        catch (error) {
            if (error?.code==='42P01' && tableNames.some(name=>String(error.message).toLowerCase().includes(name))) return [];
            throw error;
        }
    }
    const [hardMemberships,partnerMemberships]=await Promise.all([
        hardOwnerIds.size ? optionalMemberships(db.select({
            userId:hardAssetStaffMemberships.userId,hardAssetId:hardAssetStaffMemberships.hardAssetId,
            staffRole:hardAssetStaffMemberships.staffRole,revokedAt:hardAssetStaffMemberships.revokedAt,hardAssetDeleted:hardAssets.isDeleted,
        }).from(hardAssetStaffMemberships).innerJoin(hardAssets,eq(hardAssetStaffMemberships.hardAssetId,hardAssets.id))
            .where(and(inArray(hardAssetStaffMemberships.userId,[...hardOwnerIds]),inArray(hardAssetStaffMemberships.hardAssetId,[...localHardIds]),isNull(hardAssetStaffMemberships.revokedAt))),['hard_asset_staff_memberships']) : [],
        partnerOwnerIds.size ? optionalMemberships(db.select({
            userId:partnerStaffMemberships.userId,organizationId:partnerOrganizations.id,legacyPartnerUserId:partnerOrganizations.legacyPartnerUserId,
            staffRole:partnerStaffMemberships.staffRole,revokedAt:partnerStaffMemberships.revokedAt,
        }).from(partnerStaffMemberships).innerJoin(partnerOrganizations,eq(partnerStaffMemberships.organizationId,partnerOrganizations.id))
            .where(and(inArray(partnerStaffMemberships.userId,[...partnerOwnerIds]),inArray(partnerOrganizations.legacyPartnerUserId,[...localPartnerIds]),isNull(partnerStaffMemberships.revokedAt))),['partner_staff_memberships','partner_organizations']) : [],
    ]);
    for (const row of hardMemberships) {
        const actor=actors.get(row.userId);
        if (actor && !row.hardAssetDeleted) (actor.hardAssetStaffAccess ||= []).push(...buildHardAssetStaffAccessPayload([row]));
    }
    for (const row of partnerMemberships) {
        const actor=actors.get(row.userId);
        if (actor) (actor.partnerStaffAccess ||= []).push(...buildPartnerStaffAccessPayload([row]));
    }
    return metadata.map(row=>{
        if (row.zoneState!=='configured') return row;
        const resource = resources.get(row.entryKey);
        const actor = actors.get(resource?.ownerId) || guest;
        const valid = row.audienceZoneIds.length>0 && row.audienceZoneIds.every(id=>{
            const zone = zoneMap.get(id);
            return zone && canViewAudienceZone(actor,zone)
                && canUseAudienceZoneForHardAssetIds(actor,zone,resource?.hardIds || []);
        });
        return {...row,zoneState:valid ? 'configured' : 'invalid'};
    });
}

function safeUrl(value) {
    if (typeof value!=='string') return null;
    try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

/** Explicit public projection; frozen catalogue never acquires uncurated live entries. */
export async function evaluateRegionalDiscoverySnapshot(db, value, {postalCode=null,fetchImpl,env} = {}) {
    void env;
    const snapshot=normalizeRegionalDiscoverySnapshot(value);
    if (postalCode!==null && (typeof postalCode!=='string' || !/^\d{6}$/.test(postalCode))) throw Object.assign(new Error('Enter a six-digit postal code.'),{status:400});
    const live = await loadLiveAssetsByKey(db,snapshot.entries);
    const visible = snapshot.entries.filter(entry=>isLiveMyMapAssetVisible(entry.resourceType,live.get(`${entry.resourceType}-${entry.resourceId}`),guest,guestContext));
    let context={status:'none',homeSubregionId:null};
    let homeLocation=null;
    if (postalCode!==null) {
        context=await resolveRegionalDiscoveryHomeSubregion(db,postalCode,snapshot.config.includedSubregionIds);
        if (context.status==='inside-region') {
            const resolved=await resolveRegionalDiscoveryPostal(postalCode,{fetchImpl});
            if (resolved.status==='resolved') homeLocation=resolved.location;
            else context={status:'postal-unresolved',homeSubregionId:null};
        }
    }
    const inside=context.status==='inside-region';
    const [publication,contacts,coverage,matched] = await Promise.all([
        loadApprovedResourcePublicationFields(db,visible,'embeds'),
        loadRegionalDiscoveryContactApprovals(db,visible,{subregionIds:inside ? [context.homeSubregionId] : []}),
        inside ? loadRegionalDiscoveryEffectiveCoverage(db,visible) : [],
        inside ? resolveMatchedAudienceZoneIds(db,postalCode) : new Set(),
    ]);
    const decisions=new Map(evaluateRegionalDiscoveryRecommendations(coverage,{homeSubregionId:inside ? context.homeSubregionId : null,matchedZoneIds:[...matched]}).map(row=>[row.entryKey,row.recommended]));
    const pinMap=new Map();
    const entries=visible.map(entry=>{
        // Check every service's current scoped venue authority BEFORE coalescing shared locations.
        const permitted=getVisibleMapLocationIds(entry.resourceType,live.get(`${entry.resourceType}-${entry.resourceId}`),guest,guestContext);
        const points=entry.points.filter(point=>permitted.has(point.placeId));
        const visiblePoints=entry.mapPlacement==='published-locations' ? points : [];
        for (const point of visiblePoints) {
            if (!pinMap.has(point.placeKey)) pinMap.set(point.placeKey,{placeKey:point.placeKey,latitude:point.latitude,longitude:point.longitude,entryKeys:[]});
            pinMap.get(point.placeKey).entryKeys.push(entry.entryKey);
        }
        const content=applyResourcePublicationPolicy({resourceType:entry.resourceType,resourceId:entry.resourceId,
            descriptor:entry.shortDescription,description:entry.description,website:entry.websiteUrl,logoUrl:entry.logoUrl},publication);
        return {entryKey:entry.entryKey,publishedOrder:entry.publishedOrder,name:entry.name,categoryKey:entry.categoryKey,categoryLabel:entry.categoryLabel,
            shortDescription:content.descriptor ?? null,description:content.description ?? null,
            addressText:points.some(point=>point.placeKey===entry.points[0]?.placeKey) ? entry.addressText : null,
            websiteUrl:safeUrl(content.website),logoUrl:safeUrl(content.logoUrl),pinPlaceKeys:visiblePoints.map(point=>point.placeKey),
            placement:entry.mapPlacement==='unplotted' ? 'intentionally-unplotted' : visiblePoints.length ? 'plotted' : 'coordinates-unavailable',
            recommended:inside && decisions.get(entry.entryKey)===true,
            distanceMeters:inside ? calculateRegionalDiscoveryDistance(entry,homeLocation,points) : null,
            contacts:resolveRegionalDiscoveryContacts({resourceType:entry.resourceType,resourceId:entry.resourceId,status:'available',contactPhone:entry.contactPhone},entry,
                {...contacts,homeSubregionId:inside ? context.homeSubregionId : null}),
        };
    });
    return normalizeRegionalDiscoveryPayload({schemaVersion:1,view:'regional-discovery',snapshotRevision:snapshot.snapshotRevision,regionExtent:[...snapshot.config.regionExtent],
        categories:[...new Map(entries.map(entry=>[entry.categoryKey,{key:entry.categoryKey,label:entry.categoryLabel}])).values()],
        entries:inside ? sortRegionalDiscoveryEntries(entries) : entries,pins:[...pinMap.values()],
        evaluation:{status:context.status,...(postalCode!==null ? {postalCode} : {})}});
}
