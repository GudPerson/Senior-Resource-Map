import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ensureBoundarySchema, resetBoundarySchemaBootstrapForTests } from '../src/utils/boundarySchema.js';
import { ensureMapStudioSchema, verifyMapStudioSchema } from '../src/utils/mapStudioSchema.js';

const schemaSource = readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
const boundarySource = readFileSync(new URL('../src/utils/boundarySchema.js', import.meta.url), 'utf8');
const mapStudioSchemaSource = readFileSync(new URL('../src/utils/mapStudioSchema.js', import.meta.url), 'utf8');
const mapStudioBootstrapSource = readFileSync(new URL('../scripts/bootstrap_map_studio_schema.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const myMapsRoutesSource = readFileSync(new URL('../src/routes/myMaps.js', import.meta.url), 'utf8');
const sharedMapsRoutesSource = readFileSync(new URL('../src/routes/sharedMaps.js', import.meta.url), 'utf8');
const sharedMapsControllerSource = readFileSync(new URL('../src/controllers/sharedMapsController.js', import.meta.url), 'utf8');

function validVerificationResults() {
    return [
        [
            { column_name: 'map_id' },
            { column_name: 'schema_version' },
            { column_name: 'document' },
            { column_name: 'revision' },
            { column_name: 'created_at' },
            { column_name: 'updated_at' },
        ],
        [
            { constraint_type: 'PRIMARY KEY', column_name: 'map_id', delete_rule: null },
            { constraint_type: 'FOREIGN KEY', column_name: 'map_id', delete_rule: 'CASCADE' },
        ],
        [{ check_clause: '(revision > 0)' }],
    ];
}

function normalizeSql(value) {
    const text = Array.isArray(value?.queryChunks)
        ? value.queryChunks
            .map((chunk) => Array.isArray(chunk?.value) ? chunk.value.join('') : String(chunk || ''))
            .join('')
        : String(value || '');
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

test('Map Studio persistence is one additive owner document row per My Map', () => {
    assert.match(schemaSource, /export const myMapStudioDocuments = pgTable\('my_map_studio_documents'/);
    assert.match(schemaSource, /mapId: integer\('map_id'\)\.primaryKey\(\)\.references\(\(\) => myMaps\.id, \{ onDelete: 'cascade' \}\)/);
    assert.match(schemaSource, /document: jsonb\('document'\)\.notNull\(\)/);
    assert.match(schemaSource, /revisionPositive: check\('my_map_studio_documents_revision_positive'/);
    assert.match(boundarySource, /ensureMapStudioSchema\(db\)/);
    assert.match(mapStudioSchemaSource, /CONSTRAINT my_map_studio_documents_revision_positive CHECK \(revision > 0\)/);
    assert.match(mapStudioBootstrapSource, /verifyMapStudioSchema\(db\)/);
    assert.equal(
        packageJson.scripts['bootstrap:map-studio-schema'],
        'node --env-file=.env scripts/bootstrap_map_studio_schema.js',
    );
});

test('Map Studio routes are authenticated owner routes and stay absent from shared routes', () => {
    assert.match(myMapsRoutesSource, /router\.get\('\/:id\/studio', authenticateToken, getMyMapStudio\)/);
    assert.match(myMapsRoutesSource, /router\.put\('\/:id\/studio', authenticateToken, putMyMapStudio\)/);
    assert.doesNotMatch(sharedMapsRoutesSource, /studio/i);
    assert.doesNotMatch(sharedMapsControllerSource, /myMapStudioDocuments|studioDocument/);
});

test('narrow Map Studio bootstrap creates only the atomic document table', async () => {
    const statements = [];
    await ensureMapStudioSchema({
        execute: async (statement) => {
            statements.push(statement);
            return [];
        },
    });
    assert.equal(statements.length, 1);
});

test('development boundary bootstrap includes the Map Studio table without creating rows', async () => {
    resetBoundarySchemaBootstrapForTests();
    const statements = [];
    await ensureBoundarySchema({
        execute: async (statement) => {
            statements.push(normalizeSql(statement));
            return [];
        },
    }, { NODE_ENV: 'development' });

    const studioStatement = statements.find(
        (statement) => statement.includes('create table if not exists my_map_studio_documents'),
    );
    assert.ok(studioStatement);
    assert.match(studioStatement, /map_id integer primary key references my_maps\(id\) on delete cascade/);
    assert.match(studioStatement, /document jsonb not null/);
    assert.doesNotMatch(studioStatement, /insert into/);
});

test('Map Studio bootstrap verification requires columns, ownership cascade, and positive revisions', async () => {
    const results = validVerificationResults();
    const verified = await verifyMapStudioSchema({
        execute: async () => results.shift(),
    });
    assert.deepEqual(verified, {
        columns: ['map_id', 'schema_version', 'document', 'revision', 'created_at', 'updated_at'],
        mapIdPrimaryKey: true,
        mapDeleteCascade: true,
        positiveRevision: true,
    });

    const missingColumnResults = validVerificationResults();
    missingColumnResults[0] = missingColumnResults[0].filter((row) => row.column_name !== 'document');
    await assert.rejects(
        () => verifyMapStudioSchema({ execute: async () => missingColumnResults.shift() }),
        /missing document/,
    );

    const missingCascadeResults = validVerificationResults();
    missingCascadeResults[1] = missingCascadeResults[1].filter(
        (row) => row.constraint_type !== 'FOREIGN KEY',
    );
    await assert.rejects(
        () => verifyMapStudioSchema({ execute: async () => missingCascadeResults.shift() }),
        /ownership lifecycle constraint is missing/,
    );

    const missingCheckResults = validVerificationResults();
    missingCheckResults[2] = [];
    await assert.rejects(
        () => verifyMapStudioSchema({ execute: async () => missingCheckResults.shift() }),
        /positive revision constraint is missing/,
    );
});
