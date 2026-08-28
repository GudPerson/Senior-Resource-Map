import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { neon } from '@neondatabase/serverless';
import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';

import * as schema from '../src/db/schema.js';

function shortHash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

export function normalizeSchemaType(value) {
    const type = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/,\s+/g, ',');
    if (type === 'serial' || type === 'integer') return 'integer';
    if (type === 'boolean') return 'boolean';
    if (type === 'timestamp') return 'timestamp without time zone';
    if (type === 'timestamp with time zone') return type;
    const varchar = type.match(/^varchar\((\d+)\)$/);
    if (varchar) return `character varying(${varchar[1]})`;
    return type;
}

export function normalizePgIdentifier(value) {
    return String(value || '').slice(0, 63);
}

export function normalizePgArray(value) {
    if (Array.isArray(value)) return value;
    const text = String(value || '').trim();
    if (!text.startsWith('{') || !text.endsWith('}')) return [];
    return text.slice(1, -1).split(',').filter(Boolean);
}

function normalizeReferentialAction(value) {
    const actions = {
        a: 'no action',
        r: 'restrict',
        c: 'cascade',
        n: 'set null',
        d: 'set default',
    };
    return actions[value] || String(value || 'no action').toLowerCase();
}

function primaryKeySignature(columns) {
    return `primary:${columns.join(',')}`;
}

function uniqueSignature(columns) {
    return `unique:${columns.join(',')}`;
}

function foreignKeySignature(columns, referencedTable, referencedColumns, onDelete, onUpdate) {
    return `foreign:${columns.join(',')}->${referencedTable}(${referencedColumns.join(',')}):delete=${normalizeReferentialAction(onDelete)}:update=${normalizeReferentialAction(onUpdate)}`;
}

export function collectExpectedSchema(schemaModule = schema) {
    const tableConfigs = [];
    for (const value of Object.values(schemaModule)) {
        try {
            const config = getTableConfig(value);
            if (config?.name && config?.columns?.length) tableConfigs.push(config);
        } catch {
            // Non-table exports are expected in the schema module.
        }
    }

    const tables = [...new Map(tableConfigs.map((config) => [config.name, config])).values()]
        .map((config) => {
            const constraints = new Set();
            config.columns
                .filter((column) => column.primary)
                .forEach((column) => constraints.add(primaryKeySignature([column.name])));
            config.columns
                .filter((column) => column.isUnique)
                .forEach((column) => constraints.add(uniqueSignature([column.name])));
            config.foreignKeys.forEach((foreignKey) => {
                const reference = foreignKey.reference();
                constraints.add(foreignKeySignature(
                    reference.columns.map((column) => column.name),
                    getTableName(reference.foreignTable),
                    reference.foreignColumns.map((column) => column.name),
                    foreignKey.onDelete,
                    foreignKey.onUpdate,
                ));
            });
            config.primaryKeys.forEach((primaryKey) => {
                constraints.add(primaryKeySignature(primaryKey.columns.map((column) => column.name)));
            });
            config.uniqueConstraints.forEach((uniqueConstraint) => {
                constraints.add(uniqueSignature(uniqueConstraint.columns.map((column) => column.name)));
            });
            config.indexes
                .filter((index) => index.config?.unique && !index.config?.where)
                .forEach((index) => {
                    const columns = index.config.columns.map((column) => column.name).filter(Boolean);
                    if (columns.length === index.config.columns.length) constraints.add(uniqueSignature(columns));
                });
            config.checks.forEach((check) => constraints.add(`check:${normalizePgIdentifier(check.name)}`));

            return {
                name: config.name,
                columns: config.columns.map((column) => ({
                    name: column.name,
                    type: normalizeSchemaType(column.getSQLType()),
                    notNull: Boolean(column.notNull),
                })),
                indexes: config.indexes.map((index) => index.config?.name).filter(Boolean),
                constraints: [...constraints].filter(Boolean),
            };
        })
        .sort((left, right) => left.name.localeCompare(right.name));

    const enums = Object.values(schemaModule)
        .filter((value) => value?.enumName && Array.isArray(value.enumValues))
        .map((value) => ({ name: value.enumName, values: [...value.enumValues] }))
        .sort((left, right) => left.name.localeCompare(right.name));

    return { tables, enums };
}

function difference(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter((value) => !actualSet.has(value)).sort();
}

export function compareSchema(expected, actual) {
    const expectedTables = new Map(expected.tables.map((table) => [table.name, table]));
    const actualTables = new Map(actual.tables.map((table) => [table.name, table]));
    const missingTables = difference([...expectedTables.keys()], [...actualTables.keys()]);
    const extraTables = difference([...actualTables.keys()], [...expectedTables.keys()]);
    const missingColumns = [];
    const extraColumns = [];
    const typeMismatches = [];
    const nullabilityMismatches = [];
    const missingIndexes = [];
    const missingConstraints = [];
    const extraConstraints = [];

    for (const [tableName, expectedTable] of expectedTables) {
        const actualTable = actualTables.get(tableName);
        if (!actualTable) continue;
        const expectedColumns = new Map(expectedTable.columns.map((column) => [column.name, column]));
        const actualColumns = new Map(actualTable.columns.map((column) => [column.name, column]));

        difference([...expectedColumns.keys()], [...actualColumns.keys()])
            .forEach((column) => missingColumns.push(`${tableName}.${column}`));
        difference([...actualColumns.keys()], [...expectedColumns.keys()])
            .forEach((column) => extraColumns.push(`${tableName}.${column}`));

        for (const [columnName, expectedColumn] of expectedColumns) {
            const actualColumn = actualColumns.get(columnName);
            if (!actualColumn) continue;
            if (normalizeSchemaType(expectedColumn.type) !== normalizeSchemaType(actualColumn.type)) {
                typeMismatches.push({
                    column: `${tableName}.${columnName}`,
                    expected: normalizeSchemaType(expectedColumn.type),
                    actual: normalizeSchemaType(actualColumn.type),
                });
            }
            if (Boolean(expectedColumn.notNull) !== Boolean(actualColumn.notNull)) {
                nullabilityMismatches.push({
                    column: `${tableName}.${columnName}`,
                    expectedNotNull: Boolean(expectedColumn.notNull),
                    actualNotNull: Boolean(actualColumn.notNull),
                });
            }
        }

        difference(expectedTable.indexes, actualTable.indexes)
            .forEach((index) => missingIndexes.push(`${tableName}.${index}`));
        difference(expectedTable.constraints, actualTable.constraints)
            .forEach((constraint) => missingConstraints.push(`${tableName}.${constraint}`));
        difference(actualTable.constraints, expectedTable.constraints)
            .forEach((constraint) => extraConstraints.push(`${tableName}.${constraint}`));
    }

    const expectedEnums = new Map(expected.enums.map((item) => [item.name, item.values]));
    const actualEnums = new Map(actual.enums.map((item) => [item.name, item.values]));
    const missingEnums = difference([...expectedEnums.keys()], [...actualEnums.keys()]);
    const extraEnums = difference([...actualEnums.keys()], [...expectedEnums.keys()]);
    const enumValueMismatches = [];
    for (const [enumName, expectedValues] of expectedEnums) {
        const actualValues = actualEnums.get(enumName);
        if (!actualValues || JSON.stringify(expectedValues) === JSON.stringify(actualValues)) continue;
        enumValueMismatches.push({ name: enumName, expected: expectedValues, actual: actualValues });
    }

    const drift = {
        missingTables,
        extraTables,
        missingColumns: missingColumns.sort(),
        extraColumns: extraColumns.sort(),
        typeMismatches: typeMismatches.sort((left, right) => left.column.localeCompare(right.column)),
        nullabilityMismatches: nullabilityMismatches.sort((left, right) => left.column.localeCompare(right.column)),
        missingIndexes: missingIndexes.sort(),
        missingConstraints: missingConstraints.sort(),
        extraConstraints: extraConstraints.sort(),
        missingEnums,
        extraEnums,
        enumValueMismatches,
    };
    const issueCount = Object.values(drift).reduce((total, values) => total + values.length, 0);
    return { status: issueCount === 0 ? 'aligned' : 'drift_detected', issueCount, drift };
}

async function loadActualSchema(sql) {
    const columns = await sql`
        SELECT
            table_class.relname AS table_name,
            attribute.attname AS column_name,
            format_type(attribute.atttypid, attribute.atttypmod) AS data_type,
            attribute.attnotnull AS not_null
        FROM pg_catalog.pg_attribute attribute
        JOIN pg_catalog.pg_class table_class ON table_class.oid = attribute.attrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_class.relnamespace
        WHERE namespace.nspname = 'public'
          AND table_class.relkind IN ('r', 'p')
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
        ORDER BY table_class.relname, attribute.attnum
    `;
    const indexes = await sql`
        SELECT
            table_class.relname AS table_name,
            index_class.relname AS index_name,
            index_row.indisunique AS is_unique,
            index_row.indisprimary AS is_primary,
            index_row.indpred IS NOT NULL AS is_partial,
            COALESCE((
                SELECT json_agg(attribute.attname ORDER BY key_column.ordinality)
                FROM unnest(index_row.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
                JOIN pg_catalog.pg_attribute attribute
                  ON attribute.attrelid = table_class.oid
                 AND attribute.attnum = key_column.attnum
                WHERE key_column.attnum > 0
            ), '[]'::json) AS columns
        FROM pg_catalog.pg_index index_row
        JOIN pg_catalog.pg_class table_class ON table_class.oid = index_row.indrelid
        JOIN pg_catalog.pg_class index_class ON index_class.oid = index_row.indexrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_class.relnamespace
        WHERE namespace.nspname = 'public'
        ORDER BY table_class.relname, index_class.relname
    `;
    const constraints = await sql`
        SELECT
            table_class.relname AS table_name,
            constraint_row.conname AS constraint_name,
            constraint_row.contype AS constraint_type,
            COALESCE((
                SELECT json_agg(attribute.attname ORDER BY key_column.ordinality)
                FROM unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
                JOIN pg_catalog.pg_attribute attribute
                  ON attribute.attrelid = table_class.oid
                 AND attribute.attnum = key_column.attnum
            ), '[]'::json) AS columns,
            referenced_class.relname AS referenced_table,
            COALESCE((
                SELECT json_agg(attribute.attname ORDER BY key_column.ordinality)
                FROM unnest(constraint_row.confkey) WITH ORDINALITY AS key_column(attnum, ordinality)
                JOIN pg_catalog.pg_attribute attribute
                  ON attribute.attrelid = referenced_class.oid
                 AND attribute.attnum = key_column.attnum
            ), '[]'::json) AS referenced_columns,
            constraint_row.confdeltype AS on_delete,
            constraint_row.confupdtype AS on_update
        FROM pg_catalog.pg_constraint constraint_row
        JOIN pg_catalog.pg_class table_class ON table_class.oid = constraint_row.conrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_class.relnamespace
        LEFT JOIN pg_catalog.pg_class referenced_class ON referenced_class.oid = constraint_row.confrelid
        WHERE namespace.nspname = 'public'
        ORDER BY table_class.relname, constraint_row.conname
    `;
    const enumRows = await sql`
        SELECT enum_type.typname AS enum_name,
               array_agg(enum_value.enumlabel ORDER BY enum_value.enumsortorder) AS enum_values
        FROM pg_catalog.pg_type enum_type
        JOIN pg_catalog.pg_enum enum_value ON enum_value.enumtypid = enum_type.oid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = enum_type.typnamespace
        WHERE namespace.nspname = 'public'
        GROUP BY enum_type.typname
        ORDER BY enum_type.typname
    `;

    const tableMap = new Map();
    for (const column of columns) {
        if (!tableMap.has(column.table_name)) {
            tableMap.set(column.table_name, { name: column.table_name, columns: [], indexes: [], constraints: [] });
        }
        tableMap.get(column.table_name).columns.push({
            name: column.column_name,
            type: column.data_type,
            notNull: Boolean(column.not_null),
        });
    }
    for (const index of indexes) {
        const table = tableMap.get(index.table_name);
        if (!table) continue;
        table.indexes.push(index.index_name);
        if (index.is_unique && !index.is_primary && !index.is_partial && index.columns.length > 0) {
            table.constraints.push(uniqueSignature(index.columns));
        }
    }
    for (const constraint of constraints) {
        let signature;
        if (constraint.constraint_type === 'p') signature = primaryKeySignature(constraint.columns);
        else if (constraint.constraint_type === 'u') signature = uniqueSignature(constraint.columns);
        else if (constraint.constraint_type === 'f') {
            signature = foreignKeySignature(
                constraint.columns,
                constraint.referenced_table,
                constraint.referenced_columns,
                constraint.on_delete,
                constraint.on_update,
            );
        } else if (constraint.constraint_type === 'c') {
            signature = `check:${normalizePgIdentifier(constraint.constraint_name)}`;
        }
        if (signature) tableMap.get(constraint.table_name)?.constraints.push(signature);
    }

    return {
        tables: [...tableMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
        enums: enumRows.map((row) => ({ name: row.enum_name, values: normalizePgArray(row.enum_values) })),
    };
}

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const url = new URL(databaseUrl);
    const sql = neon(databaseUrl);
    const expected = collectExpectedSchema();
    const actual = await loadActualSchema(sql);
    const comparison = compareSchema(expected, actual);
    const expectedColumnCount = expected.tables.reduce((total, table) => total + table.columns.length, 0);
    const actualColumnCount = actual.tables.reduce((total, table) => total + table.columns.length, 0);

    console.log(JSON.stringify({
        checkedAt: new Date().toISOString(),
        databaseFingerprint: {
            hostHash: shortHash(url.hostname),
            databaseHash: shortHash(url.pathname),
            userHash: shortHash(url.username),
            sslmode: url.searchParams.get('sslmode') || null,
        },
        expectedCounts: {
            tables: expected.tables.length,
            columns: expectedColumnCount,
            explicitIndexes: expected.tables.reduce((total, table) => total + table.indexes.length, 0),
            constraints: expected.tables.reduce((total, table) => total + table.constraints.length, 0),
            enums: expected.enums.length,
        },
        actualCounts: {
            tables: actual.tables.length,
            columns: actualColumnCount,
            indexes: actual.tables.reduce((total, table) => total + table.indexes.length, 0),
            constraints: actual.tables.reduce((total, table) => total + table.constraints.length, 0),
            enums: actual.enums.length,
        },
        ...comparison,
    }, null, 2));
    if (comparison.status !== 'aligned') process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(`Schema alignment audit failed: ${error.message}`);
        process.exitCode = 1;
    });
}
