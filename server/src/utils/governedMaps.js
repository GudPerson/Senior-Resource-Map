import {
    and,
    asc,
    desc,
    eq,
    inArray,
    isNull,
    lte,
    sql,
} from 'drizzle-orm';

import {
    governanceGroupOrganizations,
    governanceGroups,
    governedMapEvents,
    governedMapNotifications,
    governedMapPublications,
    governedMapResources,
    governedMaps,
    hardAssetStaffMemberships,
    organizationAccessMemberships,
    resourcePublicationPermissions,
    softAssetStaffMemberships,
    users,
} from '../db/schema.js';
import { buildAuditLogInsert } from './auditTrail.js';
import { executeAtomicBatch, reserveSerialId } from './atomicWrites.js';
import {
    canStewardGovernedResource,
    deriveGovernedMapCapabilities,
} from './governedMapAccess.js';
import { loadOrganizationContextsForResources } from './organizationResourceContext.js';
import {
    buildLiveMyMapAssetSnapshotFromDb,
    buildMyMapDirectory,
} from './myMapDirectory.js';
import { normalizeMapEmbedOrigins } from './mapEmbed.js';
import {
    applyResourcePublicationPolicy,
    loadApprovedResourcePublicationFields,
} from './resourcePublicationPolicy.js';
import { createShareToken } from './shareTokens.js';

const RETIREMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function httpError(status, message, code = null) {
    const error = new Error(message);
    error.status = status;
    if (code) error.code = code;
    return error;
}

function toId(value, label = 'id') {
    const id = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, `Invalid ${label}.`);
    return id;
}

function resourceKey(resourceType, resourceId) {
    return `${resourceType}:${resourceId}`;
}

function normalizeResourceRef(value = {}) {
    const resourceType = String(value.resourceType || '').trim().toLowerCase();
    if (!['hard', 'soft'].includes(resourceType)) {
        throw httpError(400, 'Resource type must be hard or soft.');
    }
    return {
        resourceType,
        resourceId: toId(value.resourceId, 'resource id'),
    };
}

function cleanText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : '';
}

function requireReason(value, label) {
    const reason = cleanText(value, 2000);
    if (reason.length < 10) {
        throw httpError(400, `${label} must explain the reason in at least 10 characters.`);
    }
    return reason;
}

function normalizeGovernedMapPresentation(value = {}) {
    return {
        version: 1,
        mapStyle: value?.mapStyle === 'gray' ? 'gray' : 'default',
        detailMode: value?.detailMode === 'live' ? 'live' : 'auto',
        pinStyle: ['numbered', 'category-icon'].includes(value?.pinStyle) ? value.pinStyle : 'category-bubble',
        pinSize: ['large', 'extra-large'].includes(value?.pinSize) ? value.pinSize : 'standard',
        pinsVisible: value?.pinsVisible !== false,
        annotationsVisible: false,
    };
}

async function loadRegionOrganizationIds(db, groupId) {
    const rows = await db.select({ organizationId: governanceGroupOrganizations.organizationId })
        .from(governanceGroupOrganizations)
        .where(and(
            eq(governanceGroupOrganizations.groupId, groupId),
            isNull(governanceGroupOrganizations.unlinkedAt),
        ));
    return [...new Set(rows.map((row) => Number(row.organizationId)).filter(Boolean))];
}

async function requireRegionGroup(db, groupId) {
    const [group] = await db.select().from(governanceGroups)
        .where(eq(governanceGroups.id, toId(groupId, 'region group id')))
        .limit(1);
    if (!group || group.groupType !== 'region' || group.archivedAt) {
        throw httpError(404, 'Region group was not found.');
    }
    return group;
}

async function enrichResourceContexts(db, resources) {
    const contexts = await loadOrganizationContextsForResources(db, resources);
    return resources.map((resource) => {
        const organizationContexts = contexts.get(resourceKey(resource.resourceType, resource.resourceId)) || [];
        return {
            ...resource,
            organizationIds: [...new Set(organizationContexts.map((entry) => Number(entry.organizationId)).filter(Boolean))],
            organizationContexts,
        };
    });
}

async function loadActiveMapResources(db, mapId) {
    const rows = await db.select().from(governedMapResources)
        .where(and(
            eq(governedMapResources.mapId, mapId),
            isNull(governedMapResources.removedAt),
        ))
        .orderBy(asc(governedMapResources.addedAt), asc(governedMapResources.id));
    return enrichResourceContexts(db, rows);
}

async function loadActivePublication(db, mapId) {
    const [publication] = await db.select().from(governedMapPublications)
        .where(and(
            eq(governedMapPublications.mapId, mapId),
            isNull(governedMapPublications.revokedAt),
        ))
        .limit(1);
    return publication || null;
}

async function loadGovernedMapRecord(db, mapId) {
    const [map] = await db.select().from(governedMaps)
        .where(eq(governedMaps.id, toId(mapId, 'map id')))
        .limit(1);
    if (!map) throw httpError(404, 'Governed Care Map was not found.');
    const [resources, regionOrganizationIds, publication] = await Promise.all([
        loadActiveMapResources(db, map.id),
        loadRegionOrganizationIds(db, map.regionGroupId),
        loadActivePublication(db, map.id),
    ]);
    return { ...map, resources, regionOrganizationIds, publication };
}

function capabilitiesFor(user, map, candidateResources = []) {
    return deriveGovernedMapCapabilities({
        user,
        regionOrganizationIds: map.regionOrganizationIds,
        resources: map.resources,
        candidateResources,
        lifecycleStatus: map.lifecycleStatus,
    });
}

function publicMapSummary(map, capabilities) {
    return {
        id: map.id,
        regionGroupId: map.regionGroupId,
        name: map.name,
        description: map.description || null,
        lifecycleStatus: map.lifecycleStatus,
        revision: map.revision,
        presentation: normalizeGovernedMapPresentation(map.presentation),
        retirementReason: map.retirementReason || null,
        retirementRequestedAt: map.retirementRequestedAt || null,
        retirementEligibleAt: map.retirementEligibleAt || null,
        archivedAt: map.archivedAt || null,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
        resources: map.resources.map((resource) => ({
            id: resource.id,
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            name: resource.snapshot?.name || 'Resource',
            snapshot: resource.snapshot,
            organizationIds: resource.organizationIds,
            addedAt: resource.addedAt,
        })),
        publication: map.publication ? {
            shareToken: map.publication.shareToken,
            sharePath: `/governed/maps/${map.publication.shareToken}`,
            embedPath: `/embed/governed-maps/${map.publication.shareToken}`,
            allowedOrigins: map.publication.allowedOrigins || [],
            revision: map.publication.revision,
            publishedAt: map.publication.publishedAt,
        } : null,
        capabilities,
    };
}

async function requireGovernedMapAccess(db, user, mapId, capability) {
    const map = await loadGovernedMapRecord(db, mapId);
    const capabilities = capabilitiesFor(user, map);
    if (!capabilities[capability]) {
        throw httpError(403, 'Your current resource or organisation access does not allow this action.', 'governed_map_access_denied');
    }
    return { map, capabilities };
}

export async function loadRegionCandidateResources(db, groupId) {
    const group = await requireRegionGroup(db, groupId);
    const organizationIds = await loadRegionOrganizationIds(db, group.id);
    const permissionRows = organizationIds.length
        ? await db.select({
            organizationId: resourcePublicationPermissions.organizationId,
            resourceType: resourcePublicationPermissions.resourceType,
            resourceId: resourcePublicationPermissions.resourceId,
        }).from(resourcePublicationPermissions).where(and(
            inArray(resourcePublicationPermissions.organizationId, organizationIds),
            eq(resourcePublicationPermissions.status, 'publishing_approved'),
            isNull(resourcePublicationPermissions.withdrawnAt),
        ))
        : [];
    const permittedOrganizationsByResource = new Map();
    for (const row of permissionRows) {
        const key = resourceKey(row.resourceType, row.resourceId);
        const ids = permittedOrganizationsByResource.get(key) || new Set();
        ids.add(Number(row.organizationId));
        permittedOrganizationsByResource.set(key, ids);
    }
    const enriched = await enrichResourceContexts(db, [...permittedOrganizationsByResource.keys()].map((key) => {
        const [resourceType, resourceId] = key.split(':');
        return { resourceType, resourceId: Number(resourceId) };
    }));
    const [sharedApprovals, embedApprovals] = await Promise.all([
        loadApprovedResourcePublicationFields(db, enriched, 'sharedMaps'),
        loadApprovedResourcePublicationFields(db, enriched, 'embeds'),
    ]);
    const regionOrganizationSet = new Set(organizationIds);
    const candidates = [];
    for (const resource of enriched) {
        const key = resourceKey(resource.resourceType, resource.resourceId);
        if (!sharedApprovals.has(key) && !embedApprovals.has(key)) continue;
        const permittedOrganizationIds = permittedOrganizationsByResource.get(key) || new Set();
        const organizationContexts = resource.organizationContexts
            .filter((entry) => (
                regionOrganizationSet.has(Number(entry.organizationId))
                && permittedOrganizationIds.has(Number(entry.organizationId))
            ));
        if (organizationContexts.length === 0) continue;
        const snapshot = await buildLiveMyMapAssetSnapshotFromDb(db, resource.resourceType, resource.resourceId);
        if (!snapshot) continue;
        candidates.push({
            resourceType: resource.resourceType,
            resourceId: resource.resourceId,
            name: snapshot.name,
            snapshot,
            organizationIds: [...new Set(organizationContexts.map((entry) => Number(entry.organizationId)))],
            organizationContexts,
        });
    }
    return { group, organizationIds, candidates };
}

export async function listGovernedMapRegions(db, user) {
    const groups = await db.select().from(governanceGroups)
        .where(and(
            eq(governanceGroups.groupType, 'region'),
            isNull(governanceGroups.archivedAt),
        ))
        .orderBy(asc(governanceGroups.name));
    const visible = [];
    for (const group of groups) {
        const context = await loadRegionCandidateResources(db, group.id);
        const capabilities = deriveGovernedMapCapabilities({
            user,
            regionOrganizationIds: context.organizationIds,
            candidateResources: context.candidates,
        });
        if (!capabilities.canCreate) continue;
        visible.push({
            id: group.id,
            name: group.name,
            description: group.description || null,
            subregionId: group.subregionId || null,
            organizations: context.organizationIds,
            resources: context.candidates.map((resource) => ({
                resourceType: resource.resourceType,
                resourceId: resource.resourceId,
                name: resource.name,
                organizationIds: resource.organizationIds,
            })),
        });
    }
    return visible;
}

export async function listGovernedMaps(db, user) {
    const rows = await db.select().from(governedMaps).orderBy(desc(governedMaps.updatedAt), desc(governedMaps.id));
    const visible = [];
    for (const row of rows) {
        const map = await loadGovernedMapRecord(db, row.id);
        const capabilities = capabilitiesFor(user, map);
        if (capabilities.canView) visible.push(publicMapSummary(map, capabilities));
    }
    return visible;
}

export async function getGovernedMap(db, user, mapId) {
    const { map, capabilities } = await requireGovernedMapAccess(db, user, mapId, 'canView');
    const events = await db.select().from(governedMapEvents)
        .where(eq(governedMapEvents.mapId, map.id))
        .orderBy(desc(governedMapEvents.createdAt), desc(governedMapEvents.id))
        .limit(50);
    return { ...publicMapSummary(map, capabilities), events };
}

async function participantUserIds(db, resources) {
    const hardIds = resources.filter((item) => item.resourceType === 'hard').map((item) => item.resourceId);
    const softIds = resources.filter((item) => item.resourceType === 'soft').map((item) => item.resourceId);
    const organizationIds = [...new Set(resources.flatMap((item) => item.organizationIds || []).map(Number).filter(Boolean))];
    const [hardRows, softRows, organizationRows] = await Promise.all([
        hardIds.length ? db.select({ userId: hardAssetStaffMemberships.userId }).from(hardAssetStaffMemberships)
            .where(and(inArray(hardAssetStaffMemberships.hardAssetId, hardIds), isNull(hardAssetStaffMemberships.revokedAt))) : [],
        softIds.length ? db.select({ userId: softAssetStaffMemberships.userId }).from(softAssetStaffMemberships)
            .where(and(inArray(softAssetStaffMemberships.softAssetId, softIds), isNull(softAssetStaffMemberships.revokedAt))) : [],
        organizationIds.length ? db.select({ userId: organizationAccessMemberships.userId }).from(organizationAccessMemberships)
            .where(and(
                inArray(organizationAccessMemberships.organizationId, organizationIds),
                eq(organizationAccessMemberships.accessRole, 'admin'),
                isNull(organizationAccessMemberships.revokedAt),
            )) : [],
    ]);
    return [...new Set([...hardRows, ...softRows, ...organizationRows]
        .map((row) => Number(row.userId)).filter(Boolean))];
}

function buildMapMutationGuard(db, map) {
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM ${governedMaps}
                    WHERE ${governedMaps.id} = ${map.id}
                      AND ${governedMaps.revision} = ${map.revision}
                      AND ${governedMaps.lifecycleStatus} = ${map.lifecycleStatus}
                    FOR UPDATE
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'map_changed')
            END
        )`,
    }).from(sql`(
        SELECT pg_advisory_xact_lock(43120, ${map.id}) AS locked
    ) AS governed_map_write_lock`);
}

async function buildGovernedMapEventQueries(db, actor, map, actionType, {
    reason = null,
    resource = null,
    resourcesForNotifications = map.resources,
    metadata = {},
} = {}) {
    const [eventId, recipients] = await Promise.all([
        reserveSerialId(db, 'governedMapEvents'),
        participantUserIds(db, resourcesForNotifications),
    ]);
    const queries = [db.insert(governedMapEvents).values({
        id: eventId,
        mapId: map.id,
        actorUserId: actor?.id || null,
        actionType,
        resourceType: resource?.resourceType || null,
        resourceId: resource?.resourceId || null,
        reason,
        metadata,
    })];
    if (recipients.length) {
        queries.push(db.insert(governedMapNotifications).values(recipients.map((userId) => ({
            mapId: map.id,
            eventId,
            userId,
        }))));
    }
    queries.push(buildAuditLogInsert(db, actor, {
        actionType: `governed_map_${actionType}`,
        entityType: 'governed_map',
        entityId: map.id,
        resourceType: resource?.resourceType || null,
        resourceId: resource?.resourceId || null,
        metadata: {
            mapName: map.name,
            reason,
            ...metadata,
        },
    }));
    return queries;
}

export async function createGovernedMap(db, user, input) {
    const context = await loadRegionCandidateResources(db, input.regionGroupId);
    const capabilities = deriveGovernedMapCapabilities({
        user,
        regionOrganizationIds: context.organizationIds,
        candidateResources: context.candidates,
    });
    if (!capabilities.canCreate) {
        throw httpError(403, 'You need current stewardship in this region group to create a Governed Care Map.');
    }
    const name = cleanText(input.name, 160);
    if (!name) throw httpError(400, 'Map name is required.');
    const mapId = await reserveSerialId(db, 'governedMaps');
    const created = {
        id: mapId,
        regionGroupId: context.group.id,
        name,
        description: cleanText(input.description, 2000) || null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        resources: [],
        regionOrganizationIds: context.organizationIds,
        lifecycleStatus: 'draft',
        revision: 1,
    };
    const eventQueries = await buildGovernedMapEventQueries(db, user, created, 'created', {
        metadata: { regionGroupId: created.regionGroupId },
    });
    await executeAtomicBatch(db, [
        db.insert(governedMaps).values({
            id: created.id,
            regionGroupId: created.regionGroupId,
            name: created.name,
            description: created.description,
            createdByUserId: user.id,
            updatedByUserId: user.id,
        }),
        ...eventQueries,
    ], 'Governed Care Map creation');
    const map = await loadGovernedMapRecord(db, created.id);
    return publicMapSummary(map, capabilitiesFor(user, map));
}

export async function updateGovernedMap(db, user, mapId, input) {
    const { map } = await requireGovernedMapAccess(db, user, mapId, 'canEditMetadata');
    if (Number(input.expectedRevision) !== map.revision) {
        throw httpError(409, 'This map changed. Reload it and try again.');
    }
    const name = cleanText(input.name, 160);
    if (!name) throw httpError(400, 'Map name is required.');
    const patch = {
        name,
        description: cleanText(input.description, 2000) || null,
        presentation: normalizeGovernedMapPresentation(input.presentation || map.presentation),
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: new Date(),
    };
    const eventMap = { ...map, ...patch };
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'updated');
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        db.update(governedMaps).set(patch)
            .where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        ...eventQueries,
    ], 'Governed Care Map update');
    const nextMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(nextMap, capabilitiesFor(user, nextMap));
}

export async function addGovernedMapResource(db, user, mapId, value) {
    const ref = normalizeResourceRef(value);
    const { map } = await requireGovernedMapAccess(db, user, mapId, 'canAddResource');
    const context = await loadRegionCandidateResources(db, map.regionGroupId);
    const candidate = context.candidates.find((item) => resourceKey(item.resourceType, item.resourceId) === resourceKey(ref.resourceType, ref.resourceId));
    if (!candidate) throw httpError(409, 'This resource is not currently available to the region group.');
    if (map.resources.some((item) => resourceKey(item.resourceType, item.resourceId) === resourceKey(ref.resourceType, ref.resourceId))) {
        throw httpError(409, 'This resource is already on the map.');
    }
    const addedResource = {
        ...candidate,
        organizationIdAtAdd: candidate.organizationIds[0] || null,
    };
    const eventMap = {
        ...map,
        revision: map.revision + 1,
        resources: [...map.resources, addedResource],
    };
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'resource_added', { resource: ref });
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        db.insert(governedMapResources).values({
        mapId: map.id,
        resourceType: ref.resourceType,
        resourceId: ref.resourceId,
        organizationIdAtAdd: candidate.organizationIds[0] || null,
        snapshot: candidate.snapshot,
        addedByUserId: user.id,
        }),
        db.update(governedMaps).set({
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: new Date(),
        }).where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        ...eventQueries,
    ], 'Governed Care Map resource addition');
    const nextMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(nextMap, capabilitiesFor(user, nextMap));
}

function sanitizePublishedDirectory(value) {
    if (Array.isArray(value)) return value.map(sanitizePublishedDirectory);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (key === 'detailPath') return [key, null];
        if (key === 'saveEligible') return [key, false];
        return [key, sanitizePublishedDirectory(item)];
    }));
}

async function buildPublicationSnapshot(db, map, shareToken) {
    const { directory } = await buildMyMapDirectory(db, {
        map: {
            id: map.id,
            userId: null,
            name: map.name,
            description: map.description,
            assets: map.resources,
            categoryOrder: [],
            isShared: true,
            shareToken,
            shareUpdatedAt: new Date(),
        },
        viewerUser: { role: 'guest' },
        visibilityUser: { role: 'guest' },
        resolutionContext: {
            allowedPartnerAudienceIds: new Set(),
            allowedAudienceZoneIds: new Set(),
        },
        mode: 'shared',
    });
    const sanitized = sanitizePublishedDirectory(directory);
    return {
        ...sanitized,
        governedMap: true,
        lifecycleStatus: 'published',
        embeddedPresentation: normalizeGovernedMapPresentation(map.presentation),
        share: {
            isShared: true,
            shareToken,
            sharePath: `/governed/maps/${shareToken}`,
            embedPath: `/embed/governed-maps/${shareToken}`,
        },
        viewer: {
            isAuthenticated: false,
            isOwner: false,
            canSaveCopy: false,
            canSaveResources: false,
            copyDefaultName: null,
        },
    };
}

async function assertPublicationCoverage(db, map, publicUses = ['sharedMaps']) {
    const blocked = [];
    for (const publicUse of publicUses) {
        const approvals = await loadApprovedResourcePublicationFields(db, map.resources, publicUse);
        for (const resource of map.resources) {
            if (!approvals.has(resourceKey(resource.resourceType, resource.resourceId))) {
                blocked.push(`${resource.snapshot?.name || resourceKey(resource.resourceType, resource.resourceId)} (${publicUse})`);
            }
        }
    }
    if (blocked.length) {
        throw httpError(409, `Publication is blocked until current resource permissions cover: ${blocked.join(', ')}.`, 'governed_map_permission_required');
    }
}

async function buildActivePublicationRefreshQuery(db, map, actor, allowedOrigins = null) {
    const publication = map.publication;
    if (!publication) return { query: null, revision: null };
    const snapshot = await buildPublicationSnapshot(db, map, publication.shareToken);
    const normalizedOrigins = allowedOrigins === null
        ? publication.allowedOrigins
        : normalizeMapEmbedOrigins(allowedOrigins);
    const revision = publication.revision + 1;
    const query = db.update(governedMapPublications).set({
        snapshot,
        allowedOrigins: normalizedOrigins,
        revision,
        publishedByUserId: actor?.id || publication.publishedByUserId,
        publishedAt: new Date(),
    }).where(and(
        eq(governedMapPublications.id, publication.id),
        eq(governedMapPublications.revision, publication.revision),
        isNull(governedMapPublications.revokedAt),
    ));
    return { query, revision };
}

export async function publishGovernedMap(db, user, mapId, input = {}) {
    const { map } = await requireGovernedMapAccess(db, user, mapId, 'canPublish');
    const allowedOrigins = normalizeMapEmbedOrigins(input.allowedOrigins || []);
    await assertPublicationCoverage(db, map, [
        'sharedMaps',
        ...(allowedOrigins.length ? ['embeds'] : []),
    ]);
    let publicationQuery;
    let publicationRevision;
    if (map.publication) {
        const refresh = await buildActivePublicationRefreshQuery(db, map, user, allowedOrigins);
        publicationQuery = refresh.query;
        publicationRevision = refresh.revision;
    } else {
        const shareToken = createShareToken();
        const snapshot = await buildPublicationSnapshot(db, map, shareToken);
        publicationRevision = 1;
        publicationQuery = db.insert(governedMapPublications).values({
            mapId: map.id,
            shareToken,
            snapshot,
            allowedOrigins,
            publishedByUserId: user.id,
        });
    }
    const mapPatch = {
        lifecycleStatus: 'published',
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: new Date(),
    };
    const eventMap = { ...map, ...mapPatch };
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'published', {
        metadata: { publicationRevision },
    });
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        publicationQuery,
        db.update(governedMaps).set(mapPatch)
            .where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        ...eventQueries,
    ], 'Governed Care Map publication');
    const nextMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(nextMap, capabilitiesFor(user, nextMap));
}

export async function withdrawGovernedMapResource(db, user, mapId, value) {
    const ref = normalizeResourceRef(value);
    const reason = requireReason(value.reason, 'Removal reason');
    const { map, capabilities } = await requireGovernedMapAccess(db, user, mapId, 'canView');
    if (!capabilities.removableResourceKeys.includes(resourceKey(ref.resourceType, ref.resourceId))) {
        throw httpError(403, 'Only current staff, owners or organisation admins for this resource can remove it.');
    }
    const resource = map.resources.find((item) => resourceKey(item.resourceType, item.resourceId) === resourceKey(ref.resourceType, ref.resourceId));
    if (!resource) throw httpError(404, 'Resource is not on this map.');
    const withdrawnAt = new Date();
    const remainingResources = map.resources.filter((item) => item.id !== resource.id);
    const mapPatch = {
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: withdrawnAt,
    };
    const eventMap = { ...map, ...mapPatch, resources: remainingResources };
    const publicationRefresh = map.publication && map.lifecycleStatus === 'published'
        ? await buildActivePublicationRefreshQuery(db, eventMap, user)
        : { query: null };
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'resource_withdrawn', {
        reason,
        resource: ref,
        resourcesForNotifications: map.resources,
    });
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        db.update(governedMapResources).set({
        removedByUserId: user.id,
        removedAt: withdrawnAt,
        removalReason: reason,
        }).where(and(eq(governedMapResources.id, resource.id), isNull(governedMapResources.removedAt))),
        db.update(governedMaps).set(mapPatch)
            .where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        publicationRefresh.query,
        ...eventQueries,
    ], 'Governed Care Map resource withdrawal');
    const finalMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(finalMap, capabilitiesFor(user, finalMap));
}

export async function requestGovernedMapRetirement(db, user, mapId, value) {
    const reason = requireReason(value.reason, 'Retirement reason');
    const { map } = await requireGovernedMapAccess(db, user, mapId, 'canRequestRetirement');
    const requestedAt = new Date();
    const mapPatch = {
        lifecycleStatus: 'retirement_pending',
        retirementRequestedByUserId: user.id,
        retirementReason: reason,
        retirementRequestedAt: requestedAt,
        retirementEligibleAt: new Date(requestedAt.getTime() + RETIREMENT_WINDOW_MS),
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: requestedAt,
    };
    const eventMap = { ...map, ...mapPatch };
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'retirement_requested', { reason });
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        db.update(governedMaps).set(mapPatch)
            .where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        ...eventQueries,
    ], 'Governed Care Map retirement request');
    const nextMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(nextMap, capabilitiesFor(user, nextMap));
}

export async function restoreGovernedMap(db, user, mapId, value) {
    const reason = requireReason(value.reason, 'Restore reason');
    const { map } = await requireGovernedMapAccess(db, user, mapId, 'canRestore');
    if (!map.retirementEligibleAt || new Date(map.retirementEligibleAt).getTime() <= Date.now()) {
        throw httpError(409, 'The 30-day restoration window has ended.');
    }
    if (!map.resources.length || !map.publication) {
        throw httpError(409, 'A map needs an active resource and an existing publication before restoration.');
    }
    await assertPublicationCoverage(db, map, [
        'sharedMaps',
        ...((map.publication.allowedOrigins || []).length ? ['embeds'] : []),
    ]);
    const mapPatch = {
        lifecycleStatus: 'published',
        retirementRequestedByUserId: null,
        retirementReason: null,
        retirementRequestedAt: null,
        retirementEligibleAt: null,
        revision: map.revision + 1,
        updatedByUserId: user.id,
        updatedAt: new Date(),
    };
    const eventMap = { ...map, ...mapPatch };
    const publicationRefresh = await buildActivePublicationRefreshQuery(db, eventMap, user);
    const eventQueries = await buildGovernedMapEventQueries(db, user, eventMap, 'restored', { reason });
    await executeAtomicBatch(db, [
        buildMapMutationGuard(db, map),
        publicationRefresh.query,
        db.update(governedMaps).set(mapPatch)
            .where(and(eq(governedMaps.id, map.id), eq(governedMaps.revision, map.revision))),
        ...eventQueries,
    ], 'Governed Care Map restoration');
    const nextMap = await loadGovernedMapRecord(db, map.id);
    return publicMapSummary(nextMap, capabilitiesFor(user, nextMap));
}

export async function getPublishedGovernedMap(db, token, publicUse = 'sharedMaps') {
    const cleanToken = cleanText(token, 128);
    if (!cleanToken) throw httpError(404, 'Published map was not found.');
    const [row] = await db.select({ publication: governedMapPublications, map: governedMaps })
        .from(governedMapPublications)
        .innerJoin(governedMaps, eq(governedMapPublications.mapId, governedMaps.id))
        .where(and(
            eq(governedMapPublications.shareToken, cleanToken),
            isNull(governedMapPublications.revokedAt),
            eq(governedMaps.lifecycleStatus, 'published'),
        ))
        .limit(1);
    if (!row) throw httpError(404, 'Published map was not found.');
    let snapshot = row.publication.snapshot;
    if (publicUse) {
        const approvals = await loadApprovedResourcePublicationFields(db, snapshot, publicUse);
        snapshot = applyResourcePublicationPolicy(snapshot, approvals);
    }
    return { snapshot, publication: row.publication, map: row.map };
}

export async function listGovernedMapNotifications(db, user) {
    const rows = await db.select({ notification: governedMapNotifications, event: governedMapEvents, map: governedMaps, actorName: users.name })
        .from(governedMapNotifications)
        .innerJoin(governedMapEvents, eq(governedMapNotifications.eventId, governedMapEvents.id))
        .innerJoin(governedMaps, eq(governedMapNotifications.mapId, governedMaps.id))
        .leftJoin(users, eq(governedMapEvents.actorUserId, users.id))
        .where(eq(governedMapNotifications.userId, user.id))
        .orderBy(desc(governedMapNotifications.createdAt), desc(governedMapNotifications.id))
        .limit(100);
    return rows.map(({ notification, event, map, actorName }) => ({
        id: notification.id,
        mapId: map.id,
        mapName: map.name,
        actionType: event.actionType,
        actorName: actorName || null,
        reason: event.reason || null,
        resourceType: event.resourceType || null,
        resourceId: event.resourceId || null,
        readAt: notification.readAt || null,
        createdAt: notification.createdAt,
    }));
}

export async function markGovernedMapNotificationRead(db, user, notificationId) {
    const [updated] = await db.update(governedMapNotifications).set({ readAt: new Date() })
        .where(and(
            eq(governedMapNotifications.id, toId(notificationId, 'notification id')),
            eq(governedMapNotifications.userId, user.id),
        )).returning();
    if (!updated) throw httpError(404, 'Notification was not found.');
    return updated;
}

export async function archiveDueGovernedMaps(db, now = new Date()) {
    const due = await db.select().from(governedMaps).where(and(
        eq(governedMaps.lifecycleStatus, 'retirement_pending'),
        lte(governedMaps.retirementEligibleAt, now),
    )).orderBy(asc(governedMaps.retirementEligibleAt)).limit(100);
    let archived = 0;
    let failed = 0;
    for (const row of due) {
        try {
        const map = await loadGovernedMapRecord(db, row.id);
        const mapPatch = {
            lifecycleStatus: 'archived',
            archivedAt: now,
            revision: map.revision + 1,
            updatedAt: now,
        };
        const archivedMap = { ...map, ...mapPatch };
        const eventQueries = await buildGovernedMapEventQueries(db, null, archivedMap, 'archived', {
            reason: map.retirementReason,
            resourcesForNotifications: map.resources,
        });
        await executeAtomicBatch(db, [
            buildMapMutationGuard(db, map),
            db.update(governedMaps).set(mapPatch).where(and(
                eq(governedMaps.id, map.id),
                eq(governedMaps.revision, map.revision),
                eq(governedMaps.lifecycleStatus, 'retirement_pending'),
            )),
            db.update(governedMapPublications).set({ revokedAt: now })
                .where(and(eq(governedMapPublications.mapId, map.id), isNull(governedMapPublications.revokedAt))),
            ...eventQueries,
        ], 'Governed Care Map archival');
        archived += 1;
        } catch (error) {
            failed += 1;
            console.error('Governed Care Map archival failed:', error);
        }
    }
    return { scanned: due.length, archived, failed };
}

export function canWithdrawGovernedMapResource(user, resource) {
    return canStewardGovernedResource(user, resource);
}
