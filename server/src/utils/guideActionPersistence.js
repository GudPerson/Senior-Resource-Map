import { and, eq, sql } from 'drizzle-orm';
import {
    hardAssets,
    softAssets,
    softAssetLocations,
    sensitiveAuditLogs,
    offeringScheduleVersions,
} from '../db/schema.js';
import { executeAtomicBatch } from './atomicWrites.js';
import { buildAuditLogInsert, buildResourceAuditPayload } from './auditTrail.js';
import { buildOfferingScheduleVersionRows } from './offeringSchedule.js';
import { guideActionError } from './guideActionDomain.js';

function stableValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, stableValue(value[key])]),
        );
    return value;
}
async function persistedFingerprint(rawAsset) {
    const asset = { calendarEntries: [], calendarScheduleSource: 'legacy', ...rawAsset };
    const keys = [
        'name',
        'description',
        'schedule',
        'contactPhone',
        'contactEmail',
        'isHidden',
        'audienceMode',
        'isMemberOnly',
        'partnerId',
        'subregionId',
        'assetMode',
        'bucket',
        'subCategory',
        'calendarEnabled',
        'calendarStartsAt',
        'calendarEndsAt',
        'calendarRecurrence',
        'calendarWeekdays',
        'calendarRepeatUntil',
        'calendarTimezone',
        'calendarStatus',
        'calendarRevision',
        'calendarEntries',
        'calendarScheduleSource',
        'scheduleNotes',
    ];
    const data = JSON.stringify(
        stableValue(Object.fromEntries(keys.map((key) => [key, asset[key] ?? null]))),
    );
    return Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))),
        (byte) => byte.toString(16).padStart(2, '0'),
    ).join('');
}

async function findReceipt(db, actor, context) {
    const [receipt] = await db
        .select()
        .from(sensitiveAuditLogs)
        .where(
            and(
                eq(sensitiveAuditLogs.actorUserId, actor.id),
                eq(sensitiveAuditLogs.actionType, 'resource_created'),
                eq(sensitiveAuditLogs.resourceType, 'soft'),
                sql`${sensitiveAuditLogs.metadata}->>'guideRequestId' = ${context.requestId}`,
            ),
        )
        .limit(1);
    return receipt;
}
export async function replayGuideProgramme(db, actor, context) {
    const receipt = await findReceipt(db, actor, context);
    if (!receipt) {
        const [collision] = await db
            .select({ id: softAssets.id })
            .from(softAssets)
            .where(eq(softAssets.externalKey, context.externalKey))
            .limit(1);
        if (collision)
            throw guideActionError(
                'This request already exists without a matching action receipt. Open Manage Resources to check it.',
                409,
                'GUIDE_ACTION_CONFLICT',
            );
        return null;
    }
    if (
        receipt.metadata?.draftFingerprint !== context.fingerprint ||
        receipt.metadata?.locationId !== context.locationId
    ) {
        throw guideActionError(
            'This request was used for different details. Start a new programme draft.',
            409,
            'GUIDE_ACTION_CONFLICT',
        );
    }
    const [asset] = await db.select().from(softAssets).where(eq(softAssets.id, receipt.resourceId)).limit(1);
    if (
        !asset ||
        asset.isDeleted ||
        asset.externalKey !== context.externalKey ||
        asset.createdByUserId !== actor.id
    ) {
        throw guideActionError(
            'The programme from this request is no longer available. Open Manage Resources to check it.',
            409,
            'GUIDE_ACTION_CONFLICT',
        );
    }
    if (receipt.metadata?.resourceFingerprint !== (await persistedFingerprint(asset))) {
        throw guideActionError(
            'The programme has changed since it was created. Open Manage Resources to check it.',
            409,
            'GUIDE_ACTION_CONFLICT',
        );
    }
    const links = await db
        .select()
        .from(softAssetLocations)
        .where(eq(softAssetLocations.softAssetId, asset.id));
    if (links.length !== 1 || links[0].hardAssetId !== context.locationId) {
        throw guideActionError(
            'The programme has changed since it was created. Open Manage Resources to check it.',
            409,
            'GUIDE_ACTION_CONFLICT',
        );
    }
    return asset;
}

// Guide-only integrity path. The caller has run all normal createSoftAsset validation.
// Database uniqueness serialises independent Workers; no process memory or KV lock.
export async function persistGuideProgramme(db, actor, values, linkedIds, scheduleMutation, context) {
    if (linkedIds.length !== 1 || linkedIds[0] !== context.locationId)
        throw guideActionError('One reviewed place is required.');
    const replay = await replayGuideProgramme(db, actor, context);
    if (replay) return { asset: replay, replayed: true };
    if (context.expired)
        throw guideActionError(
            'This preview expired before creation. Review the programme again.',
            409,
            'GUIDE_REVIEW_REQUIRED',
        );
    const routing = context.routing;
    if (
        !routing ||
        values.subregionId !== routing.effectiveSubregionId ||
        values.partnerId !== routing.ownerId
    ) {
        throw guideActionError(
            'The place or programme ownership changed after your preview. Review the programme again.',
            409,
            'GUIDE_REVIEW_REQUIRED',
        );
    }
    const [reservation] = await db
        .select({ id: sql`nextval('soft_assets_id_seq'::regclass)::integer` })
        .from(sql`(select 1) as guide_id`);
    const id = reservation.id;
    const versionRows = scheduleMutation?.changed
        ? buildOfferingScheduleVersionRows(id, scheduleMutation, actor.id)
        : [];
    const audit = buildResourceAuditPayload({
        action: 'created',
        resourceType: 'soft',
        resourceId: id,
        resourceName: values.name,
        changedFields: ['created'],
        metadata: {
            assetMode: 'standalone',
            visibility: values.isHidden ? 'hidden' : 'visible',
            guideRequestId: context.requestId,
            draftFingerprint: context.fingerprint,
            resourceFingerprint: await persistedFingerprint(values),
            locationId: context.locationId,
        },
    });
    // Recheck live actor/place/direct membership inside the atomic write as well as at the route.
    const guard = db
        .select({
            allowed: sql`1 / CASE WHEN EXISTS (
        SELECT 1 FROM users u JOIN hard_assets h ON h.id = ${context.locationId}
        WHERE u.id = ${actor.id} AND h.is_deleted IS NOT TRUE
        AND h.subregion_id IS NOT DISTINCT FROM ${routing.placeSubregionId}::integer AND
        (u.role = 'super_admin' OR (u.role <> 'guest' AND EXISTS (
            SELECT 1 FROM hard_asset_staff_memberships m WHERE m.user_id = u.id AND m.hard_asset_id = h.id
            AND m.revoked_at IS NULL AND m.staff_role IN ('owner','staff') FOR SHARE OF m
        ))) FOR SHARE OF u, h
    ) THEN 1 ELSE 0 END`,
        })
        .from(sql`(select 1) as guide_permission`);
    try {
        const results = await executeAtomicBatch(
            db,
            [
                guard,
                db
                    .insert(softAssets)
                    .values({ ...values, id, externalKey: context.externalKey })
                    .returning(),
                db.insert(softAssetLocations).values({ softAssetId: id, hardAssetId: context.locationId }),
                versionRows.length && db.insert(offeringScheduleVersions).values(versionRows),
                buildAuditLogInsert(db, actor, audit),
            ],
            'Guide programme creation',
        );
        return { asset: results[1][0], replayed: false };
    } catch (error) {
        // A losing unique-key transaction is rolled back in full; never delete the winning resource.
        const existing = await replayGuideProgramme(db, actor, context);
        if (existing) return { asset: existing, replayed: true };
        if (error?.code === '22012' || /division by zero/i.test(String(error?.message))) {
            const [place] = await db
                .select({ subregionId: hardAssets.subregionId })
                .from(hardAssets)
                .where(eq(hardAssets.id, context.locationId))
                .limit(1);
            if (place && (place.subregionId ?? null) !== routing.placeSubregionId) {
                throw guideActionError(
                    'The place moved to a different Region after your preview. Review the programme again.',
                    409,
                    'GUIDE_REVIEW_REQUIRED',
                );
            }
            throw guideActionError('Your access to this place changed. Select a place you can manage.', 403);
        }
        throw error;
    }
}
