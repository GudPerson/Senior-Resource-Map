import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readSource(path) {
    return fs.readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('V2 schema separates private library places, categories, and map links', () => {
    const schemaSource = readSource('../src/db/schema.js');

    assert.match(schemaSource, /user_personal_place_categories/);
    assert.match(schemaSource, /user_personal_places/);
    assert.match(schemaSource, /my_map_personal_place_links/);
    assert.match(schemaSource, /shortDescriptors: jsonb\('short_descriptors'\)/);
    assert.match(schemaSource, /iconUrl: text\('icon_url'\)/);
    assert.match(schemaSource, /logoUrl: text\('logo_url'\)/);
    assert.match(schemaSource, /shortDescription: varchar\('short_description'/);
    assert.match(schemaSource, /shortDescriptor: varchar\('short_descriptor'/);
    assert.match(schemaSource, /shortDescriptorTextColor: varchar\('short_descriptor_text_color'/);
    assert.match(schemaSource, /shortDescriptorHighlightColor: varchar\('short_descriptor_highlight_color'/);
    assert.match(schemaSource, /my_map_asset_short_descriptors/);
    assert.match(schemaSource, /descriptorText: varchar\('descriptor_text'/);
    assert.match(schemaSource, /shortDescriptors: many\(myMapAssetShortDescriptors\)/);
    assert.match(schemaSource, /onDelete: 'cascade'/);
    assert.match(schemaSource, /legacyMapPersonalPlaceId/);
});

test('boundary bootstrap backfills V1 places idempotently', () => {
    const boundarySource = readSource('../src/utils/boundarySchema.js');

    assert.match(boundarySource, /INSERT INTO user_personal_places/);
    assert.match(boundarySource, /legacy_map_personal_place_id/);
    assert.match(boundarySource, /ON CONFLICT \(legacy_map_personal_place_id\) DO NOTHING/);
    assert.match(boundarySource, /INSERT INTO my_map_personal_place_links/);
    assert.match(boundarySource, /ON CONFLICT \(map_id, personal_place_id\) DO NOTHING/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS short_descriptors JSONB/);
    assert.match(boundarySource, /AND links\.short_descriptors IS NULL/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS icon_url TEXT/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS logo_url TEXT/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS short_description VARCHAR\(240\)/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS short_descriptor VARCHAR\(240\)/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS short_descriptor_text_color VARCHAR\(7\)/);
    assert.match(boundarySource, /ADD COLUMN IF NOT EXISTS short_descriptor_highlight_color VARCHAR\(7\)/);
    assert.match(boundarySource, /CREATE TABLE IF NOT EXISTS my_map_asset_short_descriptors/);
    assert.match(boundarySource, /INSERT INTO my_map_asset_short_descriptors/);
    assert.match(boundarySource, /WHERE existing\.map_asset_id = assets\.id/);
});

test('shared map directory still admits personal places only in owner mode', () => {
    const directorySource = readSource('../src/utils/myMapDirectory.js');

    assert.match(directorySource, /if \(mode === 'owner'\)/);
    assert.match(directorySource, /for \(const personalPlace of map\?\.personalPlaces \|\| \[\]\)/);
    assert.match(directorySource, /logoUrl: normalizeText\(personalPlace\?\.logoUrl\)/);
    assert.doesNotMatch(directorySource, /mode === 'shared'[\s\S]{0,200}personalPlaces/);
});

test('personal category and place image uploads are scoped to authenticated non-guest users', () => {
    const uploadSource = readSource('../src/routes/upload.js');

    assert.match(uploadSource, /personal-place-category-icon/);
    assert.match(uploadSource, /assertPersonalPlacesUser\(user\)/);
    assert.match(uploadSource, /PERSONAL_CATEGORY_ICON_MAX_BYTES/);
    assert.match(uploadSource, /personal-place-image/);
    assert.match(uploadSource, /PERSONAL_PLACE_IMAGE_MAX_BYTES/);
    assert.match(uploadSource, /personal-place-images\/\$\{user\.id\}/);
    assert.match(uploadSource, /image\/png/);
    assert.match(uploadSource, /Custom icon upload is unavailable in this environment/);
    assert.match(uploadSource, /code: 'upload_not_configured'/);
    assert.match(uploadSource, /router\.post\('\/', authenticateToken, authorizeResourceOperator\(\)/);
});
