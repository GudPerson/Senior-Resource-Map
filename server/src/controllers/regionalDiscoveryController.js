import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { myMaps, myMapRegionalDiscoveryDocuments, subregions } from '../db/schema.js';
import { loadRegionalDiscoveryDocument, validateRegionalDiscoveryConfig } from '../utils/regionalDiscoveryConfig.js';
import { prepareRegionalDiscoveryPublication, loadPublishedRegionalDiscovery } from '../utils/regionalDiscoveryPublication.js';
import { evaluateRegionalDiscoverySnapshot } from '../utils/regionalDiscoveryEvaluation.js';
import { buildMyMapDirectory } from '../utils/myMapDirectory.js';
import { loadRegionalDiscoveryContactApprovals } from '../utils/regionalDiscoveryContacts.js';
import { normalizeMapEmbedOrigins } from '../utils/mapEmbed.js';
import { requireEmbeddedMap } from './sharedMapsController.js';
import { normalizeRegionalDiscoveryPayload } from '../../../shared/regionalDiscoveryContract.js';
import { normalizeRole } from '../utils/roles.js';

const revision=z.number().int().nonnegative().max(2147483646);
const putSchema=z.object({revision,config:z.unknown()}).strict();
const previewSchema=z.object({revision,postalCode:z.string().regex(/^\d{6}$/).optional()}).strict();
const fail=(status,message)=>Object.assign(new Error(message),{status});
function parse(schema,body) { const result=schema.safeParse(body); if (!result.success) throw fail(400,'Invalid regional discovery request.'); return result.data; }

async function ownedMap(db,user,mapId) {
    if (!Number.isSafeInteger(user?.id) || user.id<=0 || normalizeRole(user.role)==='guest') throw fail(403,'Only authenticated map owners can manage regional discovery.');
    if (!Number.isSafeInteger(mapId) || mapId<=0) throw fail(400,'Invalid map id.');
    const map=await db.query.myMaps.findFirst({where:and(eq(myMaps.id,mapId),eq(myMaps.userId,user.id)),with:{assets:true}});
    if (!map) throw fail(404,'Map not found.');
    return map;
}

export async function getRegionalDiscoveryDocument(db,user,mapId) {
    const map=await ownedMap(db,user,mapId);
    const [document,directory,areas,frozen]=await Promise.all([
        loadRegionalDiscoveryDocument(db,mapId),
        buildMyMapDirectory(db,{map,viewerUser:{role:'guest'},visibilityUser:{role:'guest'},mode:'owner'}),
        db.select({id:subregions.id,name:subregions.name,subregionCode:subregions.subregionCode}).from(subregions),
        loadPublishedRegionalDiscovery(db,map),
    ]);
    const refs=directory.directory.assets.filter(asset=>asset.status==='available').map(asset=>({resourceType:asset.resourceType,resourceId:asset.resourceId}));
    const approvals=await loadRegionalDiscoveryContactApprovals(db,refs,{subregionIds:document.config.includedSubregionIds});
    let origins=[];
    try { origins=normalizeMapEmbedOrigins(map.embedAllowedOrigins); } catch { /* invalid framing configuration disables availability */ }
    const available=Boolean(frozen && map.embedEnabled && origins.length && origins.every(origin=>origin.startsWith('https://')));
    return {...document,options:{
        subregions:areas.filter(area=>area.subregionCode?.trim() && !/^(SIN|SG|SINGAPORE|NATIONAL)$/i.test(area.subregionCode.trim())).map(area=>({id:area.id,name:area.name})),
        serviceOptions:refs.map(ref=>{
            const row=directory.directory.places.flatMap(place=>place.rows).find(row=>row.resourceType===ref.resourceType && row.resourceId===ref.resourceId);
            return {...ref,name:row?.name || 'Service'};
        }),
        contactAvailability:{originalEmail:refs.map(ref=>({...ref,available:approvals.approvedFields.has(`${ref.resourceType}:${ref.resourceId}`)})),
            replacements:document.config.includedSubregionIds.map(id=>({subregionId:id,email:Boolean(approvals.enquiryContacts.get(id)?.email),phone:Boolean(approvals.enquiryContacts.get(id)?.phone)}))},
    },publication:{mode:frozen ? 'regional-discovery' : 'compact',available,snapshotRevision:frozen?.snapshotRevision ?? null,
        publishedConfigRevision:frozen?.publishedConfigRevision ?? null,regionalUrl:available ? `/embed/maps/${encodeURIComponent(map.shareToken)}/regional-discovery` : null}};
}

export async function replaceRegionalDiscoveryDocument(db,user,mapId,body) {
    const map=await ownedMap(db,user,mapId);
    const input=parse(putSchema,body);
    const config=await validateRegionalDiscoveryConfig(db,user,map,input.config);
    const values={schemaVersion:1,config,revision:input.revision+1,updatedByUserId:user.id,updatedAt:new Date()};
    const rows=input.revision===0
        ? await db.insert(myMapRegionalDiscoveryDocuments).values({...values,mapId}).onConflictDoNothing({target:myMapRegionalDiscoveryDocuments.mapId}).returning()
        : await db.update(myMapRegionalDiscoveryDocuments).set(values).where(and(eq(myMapRegionalDiscoveryDocuments.mapId,mapId),eq(myMapRegionalDiscoveryDocuments.revision,input.revision))).returning();
    if (!rows.length) throw fail(409,'Regional discovery changed. Reload and try again.');
    return {revision:rows[0].revision,config:rows[0].config};
}

export async function previewRegionalDiscovery(db,user,mapId,body,options={}) {
    const map=await ownedMap(db,user,mapId);
    const input=parse(previewSchema,body);
    const snapshot=await prepareRegionalDiscoveryPublication(db,user,map,{embeddedView:{mode:'regional-discovery',revision:input.revision}});
    return evaluateRegionalDiscoverySnapshot(db,snapshot,{...options,postalCode:input.postalCode ?? null});
}

function handler(operation,body=false) {
    return async c=>{
        c.header('Cache-Control','no-store');
        try {
            const mapId=/^[1-9]\d*$/.test(c.req.param('id')) ? Number(c.req.param('id')) : NaN;
            const input=body ? await c.req.json() : undefined;
            return c.json(await operation(getDb(c.env),c.get('user'),mapId,input,{env:c.env}));
        } catch (error) { return c.json({error:error.status ? error.message : 'Regional discovery is unavailable.'},error.status || (error instanceof SyntaxError ? 400 : 500)); }
    };
}
export const getMyMapRegionalDiscovery=handler(getRegionalDiscoveryDocument);
export const putMyMapRegionalDiscovery=handler(replaceRegionalDiscoveryDocument,true);
export const postMyMapRegionalDiscoveryPreview=handler(previewRegionalDiscovery,true);


// Public callers never supply a principal; cookies and account state cannot broaden visibility.
async function requirePublishedRegionalDiscovery(db, token) {
    const unavailable = () => fail(404, 'This regional directory is no longer available.');
    const { map, allowedOrigins } = await requireEmbeddedMap(db, token);
    if (!allowedOrigins.every(origin => origin.startsWith('https://'))) throw unavailable();
    let snapshot;
    try { snapshot = await loadPublishedRegionalDiscovery(db, map); }
    catch (error) { if (error.status || error instanceof TypeError || error instanceof z.ZodError) throw unavailable(); throw error; }
    if (!snapshot) throw unavailable();
    return { snapshot, allowedOrigins };
}

export async function getPublishedRegionalDiscoveryDirectory(db, token, {postalCode=null,env,fetchImpl}={}) {
    const { snapshot } = await requirePublishedRegionalDiscovery(db, token);
    return normalizeRegionalDiscoveryPayload(await evaluateRegionalDiscoverySnapshot(db, snapshot, {postalCode,env,fetchImpl}));
}

export async function getPublishedRegionalDiscoveryConfig(db, token) {
    const { allowedOrigins } = await requirePublishedRegionalDiscovery(db, token);
    return {schemaVersion:1,view:'regional-discovery',allowedOrigins};
}

// Injection is limited to infrastructure for disposable integration fixtures, never authority.
export function createRegionalDiscoveryGuestHandlers({getDatabase=getDb,fetchImpl}={}) {
    const evaluateSchema=z.object({postalCode:z.string().regex(/^\d{6}$/)}).strict();
    const handle=operation=>async c=>{
        c.header('Cache-Control','no-store');
        try { return c.json(await operation(c,getDatabase(c.env))); }
        catch (error) {
            const status=error.status || (error instanceof SyntaxError ? 400 : 500);
            return c.json({error:status===400 ? 'Enter a six-digit postal code only.' : 'This regional directory is unavailable.'},status);
        }
    };
    return {
        get:handle((c,db)=>getPublishedRegionalDiscoveryDirectory(db,c.req.param('token'),{env:c.env,fetchImpl})),
        config:handle((c,db)=>getPublishedRegionalDiscoveryConfig(db,c.req.param('token'))),
        evaluate:handle(async(c,db)=>{
            const input=parse(evaluateSchema,await c.req.json());
            return getPublishedRegionalDiscoveryDirectory(db,c.req.param('token'),{postalCode:input.postalCode,env:c.env,fetchImpl});
        }),
    };
}
const guestHandlers=createRegionalDiscoveryGuestHandlers();
export const getSharedRegionalDiscovery=guestHandlers.get;
export const getSharedRegionalDiscoveryConfig=guestHandlers.config;
export const postSharedRegionalDiscoveryEvaluate=guestHandlers.evaluate;
