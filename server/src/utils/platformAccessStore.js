import { and, eq, sql } from 'drizzle-orm';

import { platformAccessSettings } from '../db/schema.js';
import { buildAuditLogInsert } from './auditTrail.js';
import { executeAtomicBatch } from './atomicWrites.js';
import {
    DEFAULT_PLATFORM_ACCESS_SETTINGS,
    normalizePlatformAccessSettings,
} from './platformAccess.js';

function isMissingPlatformAccessTable(error) {
    return error?.code === '42P01'
        && String(error?.message || '').toLowerCase().includes('platform_access_settings');
}

async function selectSettings(db) {
    const [row] = await db.select().from(platformAccessSettings)
        .where(eq(platformAccessSettings.id, 1))
        .limit(1);
    return row || null;
}

export async function loadPlatformAccessSettings(db) {
    try {
        const row = await selectSettings(db);
        return {
            ...normalizePlatformAccessSettings(row || DEFAULT_PLATFORM_ACCESS_SETTINGS),
            schemaAvailable: true,
        };
    } catch (error) {
        if (!isMissingPlatformAccessTable(error)) throw error;
        return {
            ...DEFAULT_PLATFORM_ACCESS_SETTINGS,
            schemaAvailable: false,
        };
    }
}

function buildChangedModes(current, next) {
    return ['publicDirectoryMode', 'publicRegistrationMode', 'publicLoginMode']
        .filter((key) => current[key] !== next[key]);
}

function buildPlatformAccessRevisionGuard(db, revision) {
    const predicate = revision === 0
        ? sql`NOT EXISTS (SELECT 1 FROM ${platformAccessSettings} WHERE ${platformAccessSettings.id} = 1)`
        : sql`EXISTS (
            SELECT 1 FROM ${platformAccessSettings}
            WHERE ${platformAccessSettings.id} = 1
              AND ${platformAccessSettings.revision} = ${revision}
            FOR UPDATE
        )`;
    return db.select({
        verified: sql`jsonb_array_length(
            CASE WHEN ${predicate}
                THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'settings_changed')
            END
        )`,
    }).from(sql`(
        SELECT pg_advisory_xact_lock(43112, 1) AS locked
    ) AS platform_access_write_lock`);
}

export async function updatePlatformAccessSettings(db, actor, requested, expectedRevision) {
    const current = await loadPlatformAccessSettings(db);
    if (!current.schemaAvailable) {
        const error = new Error('Platform access controls are not installed.');
        error.status = 503;
        throw error;
    }
    if (Number(expectedRevision) !== current.revision) {
        const error = new Error('Platform access settings changed. Reload and try again.');
        error.status = 409;
        throw error;
    }

    const normalized = normalizePlatformAccessSettings({
        ...current,
        ...requested,
        revision: current.revision + 1,
    });
    const changedModes = buildChangedModes(current, normalized);
    if (changedModes.length === 0) return current;

    const timestamp = new Date();
    let rows;
    if (current.revision === 0) {
        rows = db.insert(platformAccessSettings).values({
            id: 1,
            publicDirectoryMode: normalized.publicDirectoryMode,
            publicRegistrationMode: normalized.publicRegistrationMode,
            publicLoginMode: normalized.publicLoginMode,
            revision: 1,
            updatedByUserId: actor?.id || null,
            createdAt: timestamp,
            updatedAt: timestamp,
        }).returning();
    } else {
        rows = db.update(platformAccessSettings).set({
            publicDirectoryMode: normalized.publicDirectoryMode,
            publicRegistrationMode: normalized.publicRegistrationMode,
            publicLoginMode: normalized.publicLoginMode,
            revision: current.revision + 1,
            updatedByUserId: actor?.id || null,
            updatedAt: timestamp,
        }).where(and(
            eq(platformAccessSettings.id, 1),
            eq(platformAccessSettings.revision, current.revision),
        )).returning();
    }

    const auditQuery = buildAuditLogInsert(db, actor, {
        actionType: 'platform_access_settings_updated',
        entityType: 'platform_access_settings',
        entityId: 1,
        metadata: {
            changedModes,
            previous: Object.fromEntries(changedModes.map((key) => [key, current[key]])),
            next: Object.fromEntries(changedModes.map((key) => [key, normalized[key]])),
            revision: normalized.revision,
        },
    });
    const [, updatedRows] = await executeAtomicBatch(db, [
        buildPlatformAccessRevisionGuard(db, current.revision),
        rows,
        auditQuery,
    ], 'platform access settings update');
    const [updated] = updatedRows || [];
    if (!updated) {
        const error = new Error('Platform access settings changed. Reload and try again.');
        error.status = 409;
        throw error;
    }

    return {
        ...normalizePlatformAccessSettings(updated),
        schemaAvailable: true,
    };
}
