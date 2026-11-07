import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { myMapAssets, myMapRegionalDiscoveryDocuments, myMaps, subregions } from '../db/schema.js';
import { buildMyMapDirectory } from './myMapDirectory.js';
import { normalizeRegionalDiscoveryText } from '../../../shared/regionalDiscoveryContract.js';

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const modes = z.enum(['original', 'hidden', 'home-sr']);
export const regionalDiscoveryPublishIntentSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('compact') }).strict(),
    z.object({ mode: z.literal('regional-discovery'), revision: z.number().int().positive().max(2147483647) }).strict(),
]);

export function normalizeRegionalDiscoveryPublishIntent(value) {
    if (value === undefined) return undefined;
    const parsed = regionalDiscoveryPublishIntentSchema.safeParse(value);
    if (!parsed.success) throw invalid('Invalid regional publication intent.');
    return parsed.data;
}
const configSchema = z.object({
    schemaVersion: z.literal(1),
    mode: z.enum(['compact', 'regional-discovery']),
    includedSubregionIds: z.array(id).max(85),
    regionExtent: z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]),
    entries: z.array(z.object({
        resourceType: z.enum(['hard', 'soft']), resourceId: id,
        mapPlacement: z.enum(['published-locations', 'unplotted']),
        distanceSource: z.enum(['published-locations', 'none']),
        emailMode: modes, phoneMode: modes,
    }).strict()).max(500),
}).strict();

function invalid(message = 'Invalid regional discovery configuration.', status = 400) {
    return Object.assign(new Error(message), { status });
}

export function normalizeRegionalDiscoveryConfig(value) {
    if (value == null) return { schemaVersion: 1, mode: 'compact', includedSubregionIds: [], regionExtent: [103.6, 1.15, 104.1, 1.5], entries: [] };
    let encoded;
    try { encoded = JSON.stringify(value); } catch { throw invalid(); }
    if (!encoded || new TextEncoder().encode(encoded).length > 65536) throw invalid();
    const parsed = configSchema.safeParse(value);
    if (!parsed.success) throw invalid();
    const config = parsed.data;
    const [west, south, east, north] = config.regionExtent;
    if (west >= east || south >= north || (config.mode === 'regional-discovery' && config.includedSubregionIds.length === 0)
        || new Set(config.includedSubregionIds).size !== config.includedSubregionIds.length
        || new Set(config.entries.map(entry => `${entry.resourceType}:${entry.resourceId}`)).size !== config.entries.length) throw invalid();
    return config;
}

export async function loadRegionalDiscoveryDocument(db, mapId) {
    let row;
    try {
        [row] = await db.select().from(myMapRegionalDiscoveryDocuments).where(eq(myMapRegionalDiscoveryDocuments.mapId, mapId)).limit(1);
    } catch (error) {
        if (error?.code !== '42P01' || !String(error.message).includes('my_map_regional_discovery_documents')) throw error;
    }
    if (!row) return { revision: 0, config: normalizeRegionalDiscoveryConfig(null) };
    if (row.schemaVersion !== 1) throw invalid('Unsupported regional discovery document version.', 409);
    return { revision: row.revision, config: normalizeRegionalDiscoveryConfig(row.config) };
}

export async function validateRegionalDiscoveryConfig(db, user, map, value) {
    const config = normalizeRegionalDiscoveryConfig(value);
    if (!Number.isSafeInteger(user?.id) || user.id <= 0 || map?.userId !== user.id) throw invalid('Only the map owner can edit regional discovery.', 403);
    // The empty compact default deliberately has no database dependency.
    if (config.mode === 'compact' && !config.entries.length && !config.includedSubregionIds.length) return config;
    const [ownedMap] = await db.select().from(myMaps).where(and(eq(myMaps.id, map.id), eq(myMaps.userId, user.id))).limit(1);
    if (!ownedMap) throw invalid('Map not found.', 404);
    if (config.includedSubregionIds.length) {
        const rows = await db.select().from(subregions).where(inArray(subregions.id, config.includedSubregionIds));
        if (rows.length !== config.includedSubregionIds.length || rows.some(row => !String(row.subregionCode || '').trim() || /^(SIN|SG|SINGAPORE|NATIONAL)$/i.test(row.subregionCode.trim()))) throw invalid('Choose configured local subregions.');
    }
    const assets = await db.select().from(myMapAssets).where(eq(myMapAssets.mapId, map.id));
    const keys = new Set(assets.map(asset => `${asset.resourceType}:${asset.resourceId}`));
    if (config.entries.some(entry => !keys.has(`${entry.resourceType}:${entry.resourceId}`))) throw invalid('Every service must already belong to this map.');
    if (config.entries.length) {
        // Guest visibility determines service publication. Owner projection keeps
        // membership independent from pin availability; no projection or suggested
        // refresh is persisted, and selected-venue scope is never widened.
        const { directory } = await buildMyMapDirectory(db, { map: { ...ownedMap, assets }, viewerUser: { role: 'guest' }, visibilityUser: { role: 'guest' }, mode: 'owner' });
        const publishable = new Set(directory.assets.filter(asset => asset.status === 'available').map(asset => `${asset.resourceType}:${asset.resourceId}`));
        if (config.entries.some(entry => !publishable.has(`${entry.resourceType}:${entry.resourceId}`))) throw invalid('Every service must currently be publishable.');
    }
    return config;
}

function publicText(nullable=false) {
    return z.unknown().transform((value,context)=>{
        try { return normalizeRegionalDiscoveryText(value,'publication',nullable); }
        catch { context.addIssue({code:z.ZodIssueCode.custom,message:'Invalid public text.'}); return z.NEVER; }
    });
}
const nullableText = publicText(true);
const requiredText = publicText();
const pointSchema = z.object({placeId:z.number().int().positive(),placeKey:requiredText,latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict();
const frozenEntrySchema = z.object({
    resourceType:z.enum(['hard','soft']),resourceId:id,entryKey:z.string(),publishedOrder:z.number().int().nonnegative(),
    name:requiredText,categoryKey:requiredText,categoryLabel:requiredText,
    shortDescription:nullableText,description:nullableText,addressText:nullableText,websiteUrl:nullableText,logoUrl:nullableText,
    contactPhone:nullableText,points:z.array(pointSchema).max(500),publishedDistancePlaceKeys:z.array(z.string()).max(500),
    mapPlacement:z.enum(['published-locations','unplotted']),distanceSource:z.enum(['published-locations','none']),
    emailMode:modes,phoneMode:modes,
    originalContacts:z.object({email:z.object({value:z.string(),valueHash:z.string()}).strict().optional()}).strict(),
}).strict();
const snapshotSchema = z.object({
    version:z.literal(1),snapshotRevision:requiredText,publishedConfigRevision:z.number().int().positive(),
    shareToken:z.string().min(1).optional(),config:configSchema,entries:z.array(frozenEntrySchema).max(500),
}).strict();

export function normalizeRegionalDiscoverySnapshot(value) {
    const parsed = snapshotSchema.safeParse(value);
    if (!parsed.success) throw invalid('Unsupported regional publication. Republish explicitly.',409);
    const snapshot = parsed.data;
    const config = normalizeRegionalDiscoveryConfig(snapshot.config);
    if (config.mode !== 'regional-discovery' || snapshot.entries.length !== config.entries.length
        || snapshot.entries.some((entry,index) => entry.entryKey !== `${config.entries[index].resourceType}:${config.entries[index].resourceId}`
            || entry.resourceType !== config.entries[index].resourceType || entry.resourceId !== config.entries[index].resourceId
            || entry.publishedOrder !== index
            || ['mapPlacement','distanceSource','emailMode','phoneMode'].some(key => entry[key] !== config.entries[index][key])
            || new Set(entry.points.map(point=>point.placeKey)).size !== entry.points.length
            || entry.publishedDistancePlaceKeys.some(key=>!entry.points.some(point=>point.placeKey===key)))) {
        throw invalid('Invalid regional publication.',409);
    }
    return snapshot;
}

/** The supplied directory is guest-visible but retains asset membership without pins. */
export function buildRegionalDiscoverySnapshot(directory, value, { publishedRevision, originalContacts = new Map() } = {}) {
    const config = normalizeRegionalDiscoveryConfig(value);
    const entries = config.entries.map((intent,publishedOrder) => {
        const entryKey = `${intent.resourceType}:${intent.resourceId}`;
        const member = directory.assets.find(asset=>asset.resourceType===intent.resourceType && asset.resourceId===intent.resourceId);
        const matches = directory.places.flatMap(place=>(place.rows || []).filter(row=>row.resourceType===intent.resourceType && row.resourceId===intent.resourceId).map(row=>({place,row})));
        if (member?.status !== 'available' || !matches.length) throw invalid('Every service must currently be publishable.');
        const row = (matches.find(match=>match.row.status==='available') || matches[0]).row;
        const points = matches.filter(({place,row})=>row.status==='available' && Number.isSafeInteger(place.placeId)
            && Number.isFinite(place.lat) && Number.isFinite(place.lng)).map(({place})=>({placeId:place.placeId,placeKey:place.placeKey,latitude:place.lat,longitude:place.lng}));
        const email = originalContacts.get(entryKey)?.email;
        return {resourceType:intent.resourceType,resourceId:intent.resourceId,entryKey,publishedOrder,
            name:row.name,categoryKey:row.iconKey || row.subCategory?.toLowerCase() || 'services',categoryLabel:row.subCategory || 'Services',
            shortDescription:row.descriptor ?? null,description:row.description ?? null,addressText:points.length ? row.address ?? null : null,
            websiteUrl:row.website ?? null,logoUrl:row.logoUrl ?? null,contactPhone:row.contactPhone ?? null,
            points,publishedDistancePlaceKeys:intent.distanceSource==='published-locations' ? points.map(point=>point.placeKey) : [],
            mapPlacement:intent.mapPlacement,distanceSource:intent.distanceSource,emailMode:intent.emailMode,phoneMode:intent.phoneMode,
            originalContacts:email ? {email:{value:email.value,valueHash:email.valueHash}} : {},
        };
    });
    return normalizeRegionalDiscoverySnapshot({version:1,snapshotRevision:crypto.randomUUID(),publishedConfigRevision:publishedRevision,config,entries});
}
