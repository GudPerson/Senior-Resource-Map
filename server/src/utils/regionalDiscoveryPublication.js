import { and, eq, inArray } from 'drizzle-orm';
import { hardAssets, softAssets, myMapShareSnapshots } from '../db/schema.js';
import { normalizeRegionalDiscoveryPublishIntent, normalizeRegionalDiscoverySnapshot, loadRegionalDiscoveryDocument, validateRegionalDiscoveryConfig, buildRegionalDiscoverySnapshot } from './regionalDiscoveryConfig.js';
import { buildMyMapDirectory, getVisibleMapLocationIds, loadLiveAssetsByKey } from './myMapDirectory.js';
import { loadRegionalDiscoveryContactApprovals } from './regionalDiscoveryContacts.js';
import { evaluateRegionalDiscoverySnapshot, loadRegionalDiscoveryEffectiveCoverage } from './regionalDiscoveryEvaluation.js';
import { applyResourcePublicationPolicy, loadApprovedResourcePublicationFields } from './resourcePublicationPolicy.js';
export { regionalDiscoveryPublishIntentSchema } from './regionalDiscoveryConfig.js';

const fail = (message,status=409)=>Object.assign(new Error(message),{status});

export async function loadPublishedRegionalDiscovery(db,map,{ignoreInvalidNamespace=false}={}) {
    if (!map.isShared || !map.shareToken) return null;
    const row=await db.query.myMapShareSnapshots.findFirst({where:and(eq(myMapShareSnapshots.mapId,map.id),eq(myMapShareSnapshots.shareToken,map.shareToken))});
    if (!row || row.shareToken!==map.shareToken) return null;
    const value=row.snapshot?.embeddedRegionalDiscovery;
    if (value===undefined) return null;
    try {
        const snapshot=normalizeRegionalDiscoverySnapshot(value);
        if (snapshot.shareToken!==map.shareToken) throw fail('Regional publication token does not match. Republish explicitly.');
        return snapshot;
    } catch (error) {
        // Only namespace validation is optional for ordinary compact publication.
        // Database failures above still propagate; regional callers stay strict.
        if (ignoreInvalidNamespace) return null;
        throw error;
    }
}

async function validatePublication(db,user,map,config) {
    await validateRegionalDiscoveryConfig(db,user,map,config);
    const coverage=await loadRegionalDiscoveryEffectiveCoverage(db,config.entries);
    if (coverage.some(row=>row.zoneState==='invalid')) throw fail('Correct the configured service coverage before publishing.',400);
    const approvals=await loadRegionalDiscoveryContactApprovals(db,config.entries,{subregionIds:config.includedSubregionIds});
    for (const field of ['email','phone']) {
        if (config.entries.some(entry=>entry[`${field}Mode`]==='home-sr')
            && config.includedSubregionIds.some(id=>!approvals.enquiryContacts.get(id)?.[field])) {
            throw fail('Every included area needs an approved replacement contact.',400);
        }
    }
    return approvals;
}

// Publication preparation is read-only and must precede every existing publisher write.
export async function prepareRegionalDiscoveryPublication(db, user, map, { embeddedView } = {}) {
    const intent=normalizeRegionalDiscoveryPublishIntent(embeddedView);
    if (intent?.mode==='compact') return null;
    if (intent===undefined) {
        // Only the existing snapshot store is consulted on legacy shared maps.
        // Retain only checked frozen intent. Live regional withdrawal is enforced
        // by evaluation, never a new availability dependency for compact callers.
        return loadPublishedRegionalDiscovery(db,map,{ignoreInvalidNamespace:true});
    }
    const document=await loadRegionalDiscoveryDocument(db,map.id);
    if (document.revision!==intent.revision || document.config.mode!=='regional-discovery') throw fail('Regional discovery changed. Reload before publishing.');
    const approvals=await validatePublication(db,user,map,document.config);
    const [projection,publication,live]=await Promise.all([
        buildMyMapDirectory(db,{map,viewerUser:{role:'guest'},visibilityUser:{role:'guest'},mode:'owner'}),
        loadApprovedResourcePublicationFields(db,document.config.entries,'embeds'),
        loadLiveAssetsByKey(db,document.config.entries),
    ]);
    // Read service content directly: the old row builder's host-logo fallback is not regional authority.
    const content=new Map();
    for (const resourceType of ['hard','soft']) {
        const resourceIds=document.config.entries.filter(ref=>ref.resourceType===resourceType).map(ref=>ref.resourceId);
        if (!resourceIds.length) continue;
        const table=resourceType==='hard' ? hardAssets : softAssets;
        const rows=await db.select({id:table.id,description:table.description,logoUrl:table.logoUrl}).from(table).where(inArray(table.id,resourceIds));
        for (const row of rows) content.set(`${resourceType}:${row.id}`,row);
    }
    const directory={assets:projection.directory.assets,places:projection.directory.places.map(place=>({...place,
        rows:place.rows.map(row=>{
            const service=content.get(`${row.resourceType}:${row.resourceId}`);
            const allowed=getVisibleMapLocationIds(row.resourceType,live.get(`${row.resourceType}-${row.resourceId}`),{role:'guest'});
            return {...row,description:service?.description ?? null,logoUrl:service?.logoUrl ?? null,
                status:row.status==='available' && !allowed.has(place.placeId) ? 'unavailable' : row.status};
        }),
    }))};
    const snapshot=buildRegionalDiscoverySnapshot(applyResourcePublicationPolicy(directory,publication),document.config,
        {publishedRevision:document.revision,originalContacts:approvals.approvedFields});
    // Validate the actual aggregate public projection before the existing publisher
    // writes. Null postal avoids any lookup or personal-context evaluation.
    await evaluateRegionalDiscoverySnapshot(db,snapshot);
    return snapshot;
}
