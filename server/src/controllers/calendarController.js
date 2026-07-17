import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    myMapAssetNotes,
    myMapAssets,
    myMaps,
    softAssets,
    userCalendarItems,
    userCalendarScheduleStates,
    userFavorites,
} from '../db/schema.js';
import { listSavedSoftAssets } from './favoritesController.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    CALENDAR_MAX_RANGE_DAYS,
} from '../utils/calendarSchedule.js';
import { expandOfferingSchedule } from '../utils/offeringSchedule.js';
import {
    optionalOneLineTextSchema,
    parsePositiveInt,
    positiveIntValueSchema,
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import {
    createSavedAssetResolutionContext,
    resolveSavedAssetSummary,
} from '../utils/savedAssets.js';

const calendarItemBodySchema = z.discriminatedUnion('itemType', [
    z.object({
        itemType: z.literal('planned_session'),
        softAssetId: positiveIntValueSchema('Offering id'),
        sourceScheduleEntryKey: optionalOneLineTextSchema(80),
        sourceStartsAt: z.string().datetime({ offset: true }),
    }),
    z.object({
        itemType: z.literal('map_note'),
        mapAssetNoteId: positiveIntValueSchema('Map note id'),
        title: optionalOneLineTextSchema(255),
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }).nullable().optional(),
        allDay: z.boolean().optional(),
    }),
]);

const updateCalendarItemBodySchema = z.object({
    title: requiredOneLineTextSchema('Title', 255),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    allDay: z.boolean().optional(),
    status: z.enum(['planned', 'completed', 'cancelled']).optional(),
});

const acknowledgeScheduleBodySchema = z.object({
    softAssetId: positiveIntValueSchema('Offering id'),
});

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function sendCalendarError(c, error, fallback) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return c.json({
        error: status >= 500 ? fallback : (error?.message || fallback),
    }, status);
}

function parseDate(value, label) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) {
        throw createHttpError(400, `${label} must be a valid date and time.`);
    }
    return date;
}

function parseCalendarRange(c) {
    const now = new Date();
    const from = c.req.query('from')
        ? parseDate(c.req.query('from'), 'Calendar range start')
        : now;
    const to = c.req.query('to')
        ? parseDate(c.req.query('to'), 'Calendar range end')
        : new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
    if (to.getTime() <= from.getTime()) {
        throw createHttpError(400, 'Calendar range end must be later than the start.');
    }
    if (to.getTime() - from.getTime() > CALENDAR_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
        throw createHttpError(400, `Calendar ranges cannot exceed ${CALENDAR_MAX_RANGE_DAYS} days.`);
    }
    return { from, to };
}

function isUniqueConstraintViolation(error) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === '23505' || message.includes('duplicate key') || message.includes('unique');
}

function assertValidItemTimes(startsAt, endsAt) {
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
        throw createHttpError(400, 'Calendar end must be later than the start.');
    }
}

async function loadVisibleSavedOffering(db, user, softAssetId, resolutionContext = null) {
    const favorite = await db.query.userFavorites.findFirst({
        where: and(
            eq(userFavorites.userId, user.id),
            eq(userFavorites.resourceType, 'soft'),
            eq(userFavorites.resourceId, softAssetId),
        ),
    });
    if (!favorite) {
        throw createHttpError(404, 'This activity is not in your saved resources.');
    }

    const resolved = await resolveSavedAssetSummary(
        db,
        user,
        'soft',
        softAssetId,
        resolutionContext,
    );
    if (!resolved?.summary || resolved.status !== 'available') {
        throw createHttpError(404, 'This saved activity is no longer available.');
    }

    const asset = await db.query.softAssets.findFirst({
        where: eq(softAssets.id, softAssetId),
    });
    if (!asset) {
        throw createHttpError(404, 'Activity not found.');
    }

    return { asset, favorite, summary: resolved.summary };
}

async function loadOwnedMapNoteContext(db, userId, noteId) {
    const rows = await db.select({
        id: myMapAssetNotes.id,
        noteText: myMapAssetNotes.noteText,
        mapId: myMaps.id,
        mapName: myMaps.name,
        resourceType: myMapAssets.resourceType,
        resourceId: myMapAssets.resourceId,
    })
        .from(myMapAssetNotes)
        .innerJoin(myMapAssets, eq(myMapAssetNotes.mapAssetId, myMapAssets.id))
        .innerJoin(myMaps, eq(myMapAssets.mapId, myMaps.id))
        .where(and(
            eq(myMapAssetNotes.id, noteId),
            eq(myMaps.userId, userId),
        ))
        .limit(1);

    if (!rows[0]) {
        throw createHttpError(404, 'Private My Map note not found.');
    }
    return rows[0];
}

function defaultNoteTitle(context) {
    const noteText = String(context?.noteText || '').replace(/\s+/g, ' ').trim();
    if (noteText) return noteText.slice(0, 120);
    return `${context?.mapName || 'My Map'} note`;
}

function serializePersonalItem(
    row,
    sourceRevisionById = new Map(),
    lastSeenRevisionById = new Map(),
) {
    const currentSourceRevision = row.softAssetId
        ? sourceRevisionById.get(Number(row.softAssetId)) ?? null
        : null;
    const lastSeenRevision = row.softAssetId
        ? lastSeenRevisionById.get(Number(row.softAssetId)) ?? 0
        : 0;
    return {
        id: row.id,
        itemType: row.itemType,
        softAssetId: row.softAssetId,
        mapAssetNoteId: row.mapAssetNoteId,
        title: row.title,
        startsAt: new Date(row.startsAt).toISOString(),
        endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
        allDay: Boolean(row.allDay),
        status: row.status,
        sourceScheduleEntryKey: row.sourceScheduleEntryKey || null,
        sourceStartsAt: row.sourceStartsAt ? new Date(row.sourceStartsAt).toISOString() : null,
        sourceRevision: row.sourceRevision ?? null,
        needsReview: row.itemType === 'planned_session'
            && currentSourceRevision !== null
            && Number(row.sourceRevision || 0) < currentSourceRevision
            && lastSeenRevision < currentSourceRevision,
    };
}

export const getCalendar = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const { from, to } = parseCalendarRange(c);
        const savedItems = await listSavedSoftAssets(db, user);
        const savedSoftItems = savedItems.filter((item) => (
            item.status === 'available'
            && Number.isInteger(Number(item.resourceId))
        ));
        const savedById = new Map(
            savedSoftItems.map((item) => [Number(item.resourceId), item]),
        );
        const savedSoftAssetIds = [...savedById.keys()];

        const [savedSoftAssets, scheduleStates, personalItems] = await Promise.all([
            savedSoftAssetIds.length
                ? db.select().from(softAssets).where(inArray(softAssets.id, savedSoftAssetIds))
                : [],
            savedSoftAssetIds.length
                ? db.select().from(userCalendarScheduleStates).where(and(
                    eq(userCalendarScheduleStates.userId, user.id),
                    inArray(userCalendarScheduleStates.softAssetId, savedSoftAssetIds),
                ))
                : [],
            db.select().from(userCalendarItems).where(and(
                eq(userCalendarItems.userId, user.id),
                gte(userCalendarItems.startsAt, from),
                lt(userCalendarItems.startsAt, to),
            )),
        ]);

        const savedSoftAssetById = new Map(
            savedSoftAssets.map((asset) => [Number(asset.id), asset]),
        );
        const sourceRevisionById = new Map(
            savedSoftAssets.map((asset) => [
                Number(asset.id),
                Math.max(Number(asset.calendarRevision) || 0, 0),
            ]),
        );
        const lastSeenRevisionById = new Map(
            scheduleStates.map((state) => [
                Number(state.softAssetId),
                Math.max(Number(state.lastSeenRevision) || 0, 0),
                ]),
        );
        const hasChangedSinceReview = (asset, saved) => {
            if (!asset) return false;
            const currentRevision = Math.max(Number(asset.calendarRevision) || 0, 0);
            const lastSeenRevision = lastSeenRevisionById.get(Number(asset.id));
            if (lastSeenRevision !== undefined) return currentRevision > lastSeenRevision;
            const savedAt = saved?.createdAt ? new Date(saved.createdAt) : null;
            const scheduleUpdatedAt = asset.calendarUpdatedAt
                ? new Date(asset.calendarUpdatedAt)
                : null;
            return currentRevision > 1
                && scheduleUpdatedAt
                && savedAt
                && scheduleUpdatedAt.getTime() > savedAt.getTime();
        };
        const plannedByOccurrence = new Map(
            personalItems
                .filter((item) => item.itemType === 'planned_session' && item.softAssetId && item.sourceStartsAt)
                .map((item) => [
                    `${item.softAssetId}:${item.sourceScheduleEntryKey || 'legacy-primary'}:${new Date(item.sourceStartsAt).toISOString()}`,
                    item,
                ]),
        );

        const occurrences = savedSoftAssets
            .filter((asset) => asset.calendarEnabled)
            .flatMap((asset) => expandOfferingSchedule(asset, from, to))
            .map((occurrence) => {
                const saved = savedById.get(Number(occurrence.softAssetId));
                const asset = savedSoftAssetById.get(Number(occurrence.softAssetId));
                const plannedItem = plannedByOccurrence.get(
                    `${occurrence.softAssetId}:${occurrence.scheduleEntryKey || 'legacy-primary'}:${occurrence.startsAt}`,
                );

                return {
                    ...occurrence,
                    address: saved?.address || null,
                    detailPath: saved?.detailPath || `/resource/soft/${occurrence.softAssetId}`,
                    plannedItemId: plannedItem?.id || null,
                    isPlanned: Boolean(plannedItem),
                    scheduleChanged: Boolean(hasChangedSinceReview(asset, saved)),
                };
            });

        return c.json({
            timezone: 'Asia/Singapore',
            range: {
                from: from.toISOString(),
                to: to.toISOString(),
            },
            occurrences,
            personalItems: personalItems.map((item) => serializePersonalItem(
                item,
                sourceRevisionById,
                lastSeenRevisionById,
            )),
            savedWithoutSchedule: savedSoftItems
                .filter((item) => !savedSoftAssetById.get(Number(item.resourceId))?.calendarEnabled)
                .map((item) => {
                    const asset = savedSoftAssetById.get(Number(item.resourceId));
                    return {
                        softAssetId: Number(item.resourceId),
                        title: item.name,
                        address: item.address || null,
                        detailPath: item.detailPath || `/resource/soft/${item.resourceId}`,
                        scheduleChanged: hasChangedSinceReview(asset, item),
                    };
                }),
        });
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to fetch Care Calendar.');
    }
};

export const getCalendarMapNote = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const noteId = parsePositiveInt(c.req.param('noteId'), 'Map note id');
        const context = await loadOwnedMapNoteContext(db, user.id, noteId);
        return c.json({
            id: context.id,
            noteText: context.noteText,
            suggestedTitle: defaultNoteTitle(context),
            mapId: context.mapId,
            mapName: context.mapName,
            resourceType: context.resourceType,
            resourceId: context.resourceId,
        });
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to load My Map note.');
    }
};

export const createCalendarItem = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(await c.req.json(), calendarItemBodySchema, 'Calendar item');

        if (body.itemType === 'planned_session') {
            const resolutionContext = await createSavedAssetResolutionContext(db, user);
            const { asset, summary } = await loadVisibleSavedOffering(
                db,
                user,
                body.softAssetId,
                resolutionContext,
            );
            if (!asset.calendarEnabled || asset.calendarStatus !== 'active') {
                throw createHttpError(409, 'This activity does not currently have an active schedule.');
            }
            const sourceStartsAt = parseDate(body.sourceStartsAt, 'Session start');
            const matchingOccurrences = expandOfferingSchedule(
                asset,
                new Date(sourceStartsAt.getTime() - 1),
                new Date(sourceStartsAt.getTime() + 1),
            ).filter((occurrence) => occurrence.startsAt === sourceStartsAt.toISOString());
            const matchingOccurrence = body.sourceScheduleEntryKey
                ? matchingOccurrences.find((occurrence) => occurrence.scheduleEntryKey === body.sourceScheduleEntryKey)
                : (matchingOccurrences.length === 1 ? matchingOccurrences[0] : null);
            if (!matchingOccurrence) {
                throw createHttpError(409, 'This session is no longer part of the current activity schedule.');
            }
            if (matchingOccurrence.status !== 'active') {
                throw createHttpError(409, 'This session is cancelled and cannot be planned.');
            }

            const values = {
                userId: user.id,
                itemType: 'planned_session',
                softAssetId: asset.id,
                title: summary.name || asset.name || 'Saved activity',
                startsAt: sourceStartsAt,
                endsAt: matchingOccurrence.endsAt ? new Date(matchingOccurrence.endsAt) : null,
                allDay: false,
                status: 'planned',
                sourceScheduleEntryKey: matchingOccurrence.scheduleEntryKey,
                sourceStartsAt,
                sourceRevision: Math.max(Number(asset.calendarRevision) || 0, 0),
                updatedAt: new Date(),
            };
            let rows;
            try {
                rows = await db.insert(userCalendarItems).values(values).returning();
            } catch (error) {
                if (!isUniqueConstraintViolation(error)) throw error;
                rows = await db.select().from(userCalendarItems).where(and(
                    eq(userCalendarItems.userId, user.id),
                    eq(userCalendarItems.itemType, 'planned_session'),
                    eq(userCalendarItems.softAssetId, asset.id),
                    eq(userCalendarItems.sourceScheduleEntryKey, matchingOccurrence.scheduleEntryKey),
                    eq(userCalendarItems.sourceStartsAt, sourceStartsAt),
                )).limit(1);
            }
            return c.json(serializePersonalItem(rows[0], new Map([
                [asset.id, Math.max(Number(asset.calendarRevision) || 0, 0)],
            ])), 201);
        }

        const context = await loadOwnedMapNoteContext(db, user.id, body.mapAssetNoteId);
        const startsAt = parseDate(body.startsAt, 'Calendar start');
        const endsAt = body.endsAt ? parseDate(body.endsAt, 'Calendar end') : null;
        assertValidItemTimes(startsAt, endsAt);
        const rows = await db.insert(userCalendarItems).values({
            userId: user.id,
            itemType: 'map_note',
            mapAssetNoteId: context.id,
            title: body.title || defaultNoteTitle(context),
            startsAt,
            endsAt,
            allDay: Boolean(body.allDay),
            status: 'planned',
            updatedAt: new Date(),
        }).returning();
        return c.json(serializePersonalItem(rows[0]), 201);
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to add calendar item.');
    }
};

export const updateCalendarItem = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const itemId = parsePositiveInt(c.req.param('itemId'), 'Calendar item id');
        const body = validateRequestBody(await c.req.json(), updateCalendarItemBodySchema, 'Calendar item');
        const existing = await db.query.userCalendarItems.findFirst({
            where: and(
                eq(userCalendarItems.id, itemId),
                eq(userCalendarItems.userId, user.id),
            ),
        });
        if (!existing) throw createHttpError(404, 'Calendar item not found.');
        if (existing.itemType !== 'map_note') {
            throw createHttpError(409, 'Planned activity times follow the reviewed source schedule.');
        }

        const startsAt = parseDate(body.startsAt, 'Calendar start');
        const endsAt = body.endsAt ? parseDate(body.endsAt, 'Calendar end') : null;
        assertValidItemTimes(startsAt, endsAt);
        const rows = await db.update(userCalendarItems)
            .set({
                title: body.title,
                startsAt,
                endsAt,
                allDay: Boolean(body.allDay),
                status: body.status || existing.status,
                updatedAt: new Date(),
            })
            .where(and(
                eq(userCalendarItems.id, itemId),
                eq(userCalendarItems.userId, user.id),
            ))
            .returning();
        return c.json(serializePersonalItem(rows[0]));
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to update calendar item.');
    }
};

export const deleteCalendarItem = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const itemId = parsePositiveInt(c.req.param('itemId'), 'Calendar item id');
        const rows = await db.delete(userCalendarItems).where(and(
            eq(userCalendarItems.id, itemId),
            eq(userCalendarItems.userId, user.id),
        )).returning({ id: userCalendarItems.id });
        if (!rows[0]) throw createHttpError(404, 'Calendar item not found.');
        return c.json({ success: true, id: rows[0].id });
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to remove calendar item.');
    }
};

export const acknowledgeCalendarSchedule = async (c) => {
    try {
        const user = c.get('user');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const body = validateRequestBody(
            await c.req.json(),
            acknowledgeScheduleBodySchema,
            'Schedule acknowledgement',
        );
        const resolutionContext = await createSavedAssetResolutionContext(db, user);
        const { asset } = await loadVisibleSavedOffering(
            db,
            user,
            body.softAssetId,
            resolutionContext,
        );
        const lastSeenRevision = Math.max(Number(asset.calendarRevision) || 0, 0);
        const rows = await db.insert(userCalendarScheduleStates).values({
            userId: user.id,
            softAssetId: asset.id,
            lastSeenRevision,
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: [
                userCalendarScheduleStates.userId,
                userCalendarScheduleStates.softAssetId,
            ],
            set: {
                lastSeenRevision,
                updatedAt: new Date(),
            },
        }).returning();
        return c.json({
            softAssetId: rows[0].softAssetId,
            lastSeenRevision: rows[0].lastSeenRevision,
        });
    } catch (error) {
        console.error(error);
        return sendCalendarError(c, error, 'Failed to acknowledge schedule change.');
    }
};
