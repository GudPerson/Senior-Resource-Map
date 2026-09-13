import { sql } from 'drizzle-orm';

const WRITE_LOCK_NAMESPACES = Object.freeze({
    hardAsset: 43101,
    softAsset: 43102,
});

function requirePositiveInteger(value, label) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${label} must be a positive integer.`);
    }
    return parsed;
}

/**
 * Builds a transaction-scoped PostgreSQL advisory lock for one resource.
 * The lock is the first query in a Neon HTTP batch, serialising competing
 * replace-style writes for the same resource without changing the DB driver.
 */
export function buildResourceWriteLockQuery(db, resourceType, resourceId) {
    const namespace = WRITE_LOCK_NAMESPACES[resourceType];
    if (!namespace) {
        throw new Error(`Unsupported resource write lock type: ${resourceType}`);
    }
    const id = requirePositiveInteger(resourceId, 'Resource id');
    return db
        .select({ locked: sql`pg_advisory_xact_lock(${namespace}, ${id})` })
        .from(sql`(select 1) as resource_write_lock`);
}

/**
 * Builds delete-and-recreate queries that must be included in the caller's
 * atomic batch. Empty replacements still return the delete query.
 */
export function buildReplacementQueries(db, table, whereClause, values = [], options = {}) {
    const queries = [db.delete(table).where(whereClause)];
    if (!Array.isArray(values) || values.length === 0) return queries;

    let insertQuery = db.insert(table).values(values);
    if (options.onConflictDoNothing) {
        insertQuery = insertQuery.onConflictDoNothing();
    }
    queries.push(insertQuery);
    return queries;
}

/**
 * Neon HTTP has no interactive transaction callback, but db.batch executes
 * its prepared queries in one database transaction. Never silently fall back
 * to sequential writes for integrity-sensitive operations.
 */
export async function executeAtomicBatch(db, queries, operation = 'database write') {
    const preparedQueries = (Array.isArray(queries) ? queries : []).filter(Boolean);
    if (preparedQueries.length === 0) return [];
    if (typeof db?.batch !== 'function') {
        throw new Error(`Atomic ${operation} requires database batch support.`);
    }
    return db.batch(preparedQueries);
}

const SERIAL_SEQUENCES = Object.freeze({
    governedMapEvents: 'governed_map_events_id_seq',
    governedMaps: 'governed_maps_id_seq',
    organizationAgreements: 'organization_agreements_id_seq',
    partnerOrganizations: 'partner_organizations_id_seq',
    users: 'users_id_seq',
});

/**
 * Reserves a PostgreSQL serial value before an atomic batch so later queries in
 * that batch can safely reference the same new record. Sequence gaps after a
 * failed batch are expected and contain no user or business data.
 */
export async function reserveSerialId(db, sequenceKey) {
    const sequence = SERIAL_SEQUENCES[sequenceKey];
    if (!sequence) throw new Error(`Unsupported serial sequence: ${sequenceKey}`);
    const result = await db.select({
        id: sql`nextval(${sequence}::regclass)::integer`,
    }).from(sql`(select 1) as serial_reservation`);
    const [row] = Array.isArray(result) ? result : (result?.rows || []);
    return requirePositiveInteger(row?.id, `${sequenceKey} id`);
}
