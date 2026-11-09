import { inArray } from 'drizzle-orm';
import { audienceZones, hardAssets, softAssets, subregions } from '../db/schema.js';
import { getAssetAudienceZoneIds } from './audienceZones.js';
import { normalizeContextLocation } from './discoveryLocationContext.js';
import { findMatchingSubregionsByPostal } from './subregionRouting.js';

const positiveId = value => Number.isSafeInteger(value) && value > 0;
const ids = values => [...new Set((Array.isArray(values) ? values : []).filter(positiveId))].sort((a,b) => a-b);
const isNational = row => String(row?.subregionCode || '').trim().toUpperCase() === 'SIN'
    || String(row?.name || '').trim().toLowerCase() === 'singapore';

/**
 * Internal coverage only, NOT a visibility filter or public DTO.
 * refs: <=500 {resourceType:'hard'|'soft',resourceId:number}; first occurrence wins.
 * Returns [{entryKey,assignedSubregionIds:number[],zoneState:'absent'|'configured'|'invalid',audienceZoneIds:number[]}].
 * Hard canonical assignments require steward validation before activation. Soft fallback uses explicit
 * service coverage only: soft subregionId can derive from host geography or administrative scope.
 * Missing resources are omitted; DB failures throw so callers can fail closed.
 */
export async function loadRegionalDiscoveryCoverage(db, refs = []) {
    if (!Array.isArray(refs) || refs.length > 500) throw new TypeError('Expected at most 500 resource references.');
    const unique = new Map();
    for (const ref of refs) {
        if (!['hard','soft'].includes(ref?.resourceType) || !positiveId(ref?.resourceId)) {
            throw new TypeError('Invalid resource reference.');
        }
        unique.set(`${ref.resourceType}:${ref.resourceId}`, ref);
    }
    if (!unique.size) return [];
    const hardIds = [...unique.values()].filter(ref=>ref.resourceType==='hard').map(ref=>ref.resourceId);
    const softIds = [...unique.values()].filter(ref=>ref.resourceType==='soft').map(ref=>ref.resourceId);
    const [canonical, hardRows, softRows] = await Promise.all([
        db.select({id:subregions.id,subregionCode:subregions.subregionCode,name:subregions.name}).from(subregions),
        hardIds.length ? db.query.hardAssets.findMany({
            columns:{id:true,subregionId:true}, where:inArray(hardAssets.id,hardIds),
        }) : [],
        softIds.length ? db.query.softAssets.findMany({
            columns:{id:true,assetMode:true,hostHardAssetId:true,audienceMode:true},
            where:inArray(softAssets.id,softIds),
            with:{
                parent:{columns:{id:true,audienceMode:true},with:{audienceZones:{with:{audienceZone:{columns:{id:true}}}}}},
                audienceZones:{with:{audienceZone:{columns:{id:true}}}},
                locations:{columns:{hardAssetId:true}},
                regionCoverages:{columns:{subregionId:true}},
            },
        }) : [],
    ]);
    const canonicalIds = new Set(canonical.filter(row=>!isNational(row)).map(row=>row.id));
    const assigned = values => ids(values).filter(id=>canonicalIds.has(id));
    const linkedHardIds = ids([...hardIds, ...softRows.flatMap(row=>[
        row.hostHardAssetId, ...(row.locations || []).map(location=>location.hardAssetId),
    ])]);
    // Match established host/location audience-zone inheritance only. No linked SRs are loaded.
    const hostZones = linkedHardIds.length ? await db.select({
        id:audienceZones.id,hardAssetId:audienceZones.hardAssetId,
    }).from(audienceZones).where(inArray(audienceZones.hardAssetId,linkedHardIds)) : [];
    const zonesForHosts = hostIds => ids(hostZones.filter(zone=>hostIds.includes(zone.hardAssetId)).map(zone=>zone.id));
    const metadata = new Map();
    for (const row of hardRows) {
        const zoneIds = zonesForHosts([row.id]);
        const entryKey = `hard:${row.id}`;
        metadata.set(entryKey, {entryKey,assignedSubregionIds:assigned([row.subregionId]),
            zoneState:zoneIds.length ? 'configured' : 'absent',audienceZoneIds:zoneIds});
    }
    for (const row of softRows) {
        const effective = row.assetMode === 'child' ? row.parent : row;
        const ownZones = getAssetAudienceZoneIds(row);
        const inheritedZones = zonesForHosts(ids([
            row.hostHardAssetId, ...(row.locations || []).map(location=>location.hardAssetId),
        ]));
        const zoneIds = ids([...ownZones,...inheritedZones]);
        const rawZones = effective?.audienceZones || [];
        const configured = effective?.audienceMode === 'audience_zones' || rawZones.length > 0 || zoneIds.length > 0;
        const invalid = !effective || !['public','audience_zones'].includes(effective.audienceMode)
            || (configured && zoneIds.length === 0);
        const entryKey = `soft:${row.id}`;
        metadata.set(entryKey, {entryKey,
            assignedSubregionIds:assigned((row.regionCoverages || []).map(coverage=>coverage.subregionId)),
            zoneState:invalid ? 'invalid' : configured ? 'configured' : 'absent',audienceZoneIds:zoneIds});
    }
    return [...unique.keys()].map(key=>metadata.get(key)).filter(Boolean);
}

/** Exact postal membership is checked globally before checking the curated region. No coordinates involved. */
export async function resolveRegionalDiscoveryHomeSubregion(db, postalCode, includedSubregionIds) {
    const uncertain = {status:'coverage-unconfirmed',homeSubregionId:null};
    if (typeof postalCode !== 'string' || !/^\d{6}$/.test(postalCode)) {
        return {status:'postal-unresolved',homeSubregionId:null};
    }
    if (!Array.isArray(includedSubregionIds) || !includedSubregionIds.length || !includedSubregionIds.every(positiveId)) return uncertain;
    try {
        const matches = await findMatchingSubregionsByPostal(db,postalCode);
        const homeIds = ids(matches.filter(row=>!isNational(row)).map(row=>row.id));
        if (homeIds.length !== 1) return uncertain;
        const homeSubregionId = homeIds[0];
        return {status:includedSubregionIds.includes(homeSubregionId) ? 'inside-region' : 'outside-region',homeSubregionId};
    } catch {
        return uncertain;
    }
}

/** Preserves every metadata entry and order. Recommendation is service-level, independent of pins or visibility. */
export function evaluateRegionalDiscoveryRecommendations(metadata = [], {homeSubregionId,matchedZoneIds=[]} = {}) {
    const matched = new Set(ids(matchedZoneIds));
    return metadata.map(row=>({
        entryKey:row.entryKey,
        recommended:row.zoneState === 'configured'
            ? ids(row.audienceZoneIds).some(id=>matched.has(id))
            : row.zoneState === 'absent' && positiveId(homeSubregionId) && ids(row.assignedSubregionIds).includes(homeSubregionId),
    }));
}

function strictLocation(lat, lng) {
    if (![lat,lng].every(value=>(typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)))) return null;
    return normalizeContextLocation({lat:Number(lat),lng:Number(lng)});
}

/**
 * Internal-only input: {distanceSource,publishedDistancePlaceKeys:string[]} plus {lat,lng} home.
 * points must already be current permitted public projections {placeKey,latitude,longitude} of frozen scoped points.
 * Explicit distance keys are independent of display placement/pins; never fall back to host/office/other venues.
 * Returns rounded straight-line metres or null; never returns or stores residential coordinates.
 */
export function calculateRegionalDiscoveryDistance(entry, homeLocation, publishedPublicPoints = []) {
    if (entry?.distanceSource !== 'published-locations') return null;
    const allowed = new Set((Array.isArray(entry.publishedDistancePlaceKeys) ? entry.publishedDistancePlaceKeys : [])
        .filter(key=>typeof key === 'string' && key.length > 0));
    const home = strictLocation(homeLocation?.lat,homeLocation?.lng);
    if (!home || !allowed.size) return null;
    const radians = degrees => degrees*Math.PI/180;
    let nearest = Infinity;
    for (const point of publishedPublicPoints) {
        if (!allowed.has(point?.placeKey)) continue;
        const place = strictLocation(point.latitude,point.longitude);
        if (!place) continue;
        const a = Math.sin(radians(place.lat-home.lat)/2)**2
            + Math.cos(radians(home.lat))*Math.cos(radians(place.lat))*Math.sin(radians(place.lng-home.lng)/2)**2;
        nearest = Math.min(nearest,6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a))));
    }
    return Number.isFinite(nearest) ? Math.round(nearest) : null;
}

/** Recommended first; known distance ascending; equal/unknown ties retain frozen publication order. Does not mutate. */
export function sortRegionalDiscoveryEntries(entries = []) {
    const distance = row => Number.isFinite(row.distanceMeters) && row.distanceMeters >= 0 ? row.distanceMeters : Infinity;
    return entries.map((entry,index)=>({entry,index})).sort((a,b)=>{
        const group = Number(b.entry.recommended === true)-Number(a.entry.recommended === true);
        if (group) return group;
        const left = distance(a.entry), right = distance(b.entry);
        if (left !== right) return left-right;
        const order = row => Number.isSafeInteger(row.entry.publishedOrder) ? row.entry.publishedOrder : row.index;
        return order(a)-order(b) || a.index-b.index;
    }).map(row=>row.entry);
}
