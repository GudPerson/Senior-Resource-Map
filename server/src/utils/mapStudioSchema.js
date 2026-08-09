import { sql } from 'drizzle-orm';

export const MAP_STUDIO_SCHEMA_COLUMNS = Object.freeze([
    'map_id',
    'schema_version',
    'document',
    'revision',
    'created_at',
    'updated_at',
]);

function rowsFromResult(result) {
    return Array.isArray(result) ? result : (result?.rows || []);
}

export async function ensureMapStudioSchema(db) {
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS my_map_studio_documents (
            map_id INTEGER PRIMARY KEY REFERENCES my_maps(id) ON DELETE CASCADE,
            schema_version INTEGER NOT NULL DEFAULT 1,
            document JSONB NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT my_map_studio_documents_revision_positive CHECK (revision > 0)
        )
    `);
}

export async function verifyMapStudioSchema(db) {
    const columnResult = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'my_map_studio_documents'
          AND column_name IN (
              'map_id',
              'schema_version',
              'document',
              'revision',
              'created_at',
              'updated_at'
          )
    `);
    const availableColumns = new Set(
        rowsFromResult(columnResult).map((row) => String(row?.column_name || '')),
    );
    const missingColumns = MAP_STUDIO_SCHEMA_COLUMNS.filter(
        (column) => !availableColumns.has(column),
    );
    if (missingColumns.length > 0) {
        throw new Error(`Map Studio schema verification failed: missing ${missingColumns.join(', ')}`);
    }

    const constraintResult = await db.execute(sql`
        SELECT
            tc.constraint_type,
            kcu.column_name,
            rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_schema = tc.constraint_schema
         AND kcu.constraint_name = tc.constraint_name
        LEFT JOIN information_schema.referential_constraints rc
          ON rc.constraint_schema = tc.constraint_schema
         AND rc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = 'my_map_studio_documents'
          AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
    `);
    const constraintRows = rowsFromResult(constraintResult);
    const hasMapPrimaryKey = constraintRows.some((row) => (
        String(row?.constraint_type || '').toUpperCase() === 'PRIMARY KEY'
        && row?.column_name === 'map_id'
    ));
    const hasCascadeMapForeignKey = constraintRows.some((row) => (
        String(row?.constraint_type || '').toUpperCase() === 'FOREIGN KEY'
        && row?.column_name === 'map_id'
        && String(row?.delete_rule || '').toUpperCase() === 'CASCADE'
    ));
    if (!hasMapPrimaryKey || !hasCascadeMapForeignKey) {
        throw new Error('Map Studio schema verification failed: map ownership lifecycle constraint is missing');
    }

    const checkResult = await db.execute(sql`
        SELECT cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc
          ON cc.constraint_schema = tc.constraint_schema
         AND cc.constraint_name = tc.constraint_name
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = 'my_map_studio_documents'
          AND tc.constraint_type = 'CHECK'
    `);
    const hasPositiveRevision = rowsFromResult(checkResult).some((row) => {
        const clause = String(row?.check_clause || '').toLowerCase().replace(/\s+/g, ' ');
        return clause.includes('revision') && clause.includes('> 0');
    });
    if (!hasPositiveRevision) {
        throw new Error('Map Studio schema verification failed: positive revision constraint is missing');
    }

    return {
        columns: [...MAP_STUDIO_SCHEMA_COLUMNS],
        mapIdPrimaryKey: true,
        mapDeleteCascade: true,
        positiveRevision: true,
    };
}
