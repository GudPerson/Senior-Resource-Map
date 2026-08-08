import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ensureMapEmbedSchema, verifyMapEmbedSchema } from '../src/utils/mapEmbedSchema.js';

const schemaSource = readFileSync(new URL('../src/db/schema.js', import.meta.url), 'utf8');
const boundarySource = readFileSync(new URL('../src/utils/boundarySchema.js', import.meta.url), 'utf8');
const mapEmbedSchemaSource = readFileSync(new URL('../src/utils/mapEmbedSchema.js', import.meta.url), 'utf8');
const mapEmbedBootstrapSource = readFileSync(new URL('../scripts/bootstrap_map_embed_schema.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const myMapsRoutesSource = readFileSync(new URL('../src/routes/myMaps.js', import.meta.url), 'utf8');
const sharedMapsRoutesSource = readFileSync(new URL('../src/routes/sharedMaps.js', import.meta.url), 'utf8');
const sharedMapsControllerSource = readFileSync(new URL('../src/controllers/sharedMapsController.js', import.meta.url), 'utf8');

test('map embed fields are additive and boundary-bootstrapped', () => {
    assert.match(schemaSource, /embedEnabled: boolean\('embed_enabled'\)\.notNull\(\)\.default\(false\)/);
    assert.match(schemaSource, /embedAllowedOrigins: jsonb\('embed_allowed_origins'\)\.notNull\(\)\.default\(\[\]\)/);
    assert.match(boundarySource, /ensureMapEmbedSchema\(db\)/);
    assert.match(mapEmbedSchemaSource, /ADD COLUMN IF NOT EXISTS embed_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
    assert.match(mapEmbedSchemaSource, /ADD COLUMN IF NOT EXISTS embed_allowed_origins JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
    assert.match(mapEmbedBootstrapSource, /verifyMapEmbedSchema\(db\)/);
    assert.equal(
        packageJson.scripts['bootstrap:map-embed-schema'],
        'node --env-file=.env scripts/bootstrap_map_embed_schema.js',
    );
});

test('map embed owner and guest routes remain separate', () => {
    assert.match(myMapsRoutesSource, /router\.patch\('\/:id\/embed', authenticateToken, patchMyMapEmbed\)/);
    assert.match(sharedMapsRoutesSource, /router\.get\('\/:token\/embed-config', getEmbeddedMapConfigRoute\)/);
    assert.match(sharedMapsRoutesSource, /router\.get\('\/:token\/embed', getEmbeddedMap\)/);
    assert.equal(
        sharedMapsControllerSource.match(/c\.header\('Cache-Control', 'no-store'\)/g)?.length,
        2,
    );
});

test('narrow map embed bootstrap executes only the two additive DDL statements', async () => {
    const statements = [];
    await ensureMapEmbedSchema({
        execute: async (statement) => {
            statements.push(statement);
            return [];
        },
    });
    assert.equal(statements.length, 2);
});

test('narrow map embed bootstrap verification requires both columns', async () => {
    const verified = await verifyMapEmbedSchema({
        execute: async () => [
            { column_name: 'embed_enabled' },
            { column_name: 'embed_allowed_origins' },
        ],
    });
    assert.deepEqual(verified.columns, ['embed_enabled', 'embed_allowed_origins']);

    await assert.rejects(
        () => verifyMapEmbedSchema({
            execute: async () => [{ column_name: 'embed_enabled' }],
        }),
        /missing embed_allowed_origins/,
    );
});
