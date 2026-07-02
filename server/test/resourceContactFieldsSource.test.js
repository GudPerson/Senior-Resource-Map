import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readSource(path) {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function assertSourceContainsAll(source, markers, label) {
    for (const marker of markers) {
        assert.match(source, marker, `${label} should include ${marker}`);
    }
}

test('hard asset controller persists public contact email with existing contact fields', () => {
    const source = readSource('src/controllers/hardAssetsController.js');
    const sanitizePayloadSource = sourceBetween(source, 'function sanitizeHardAssetPayload(body = {})', 'function sanitizeHardAssetPatch(body = {})');
    const sanitizePatchSource = sourceBetween(source, 'function sanitizeHardAssetPatch(body = {})', 'export const getHardAssets');
    const createSource = sourceBetween(source, 'export const createHardAsset = async (c) => {', 'export const createHardAssetMembershipQr');
    const updateSource = sourceBetween(source, 'export const updateHardAsset = async (c) => {', 'export const enrichHardAssetDraft');

    assertSourceContainsAll(sanitizePayloadSource, [
        /whatsappContact: cleanOptionalOneLineText\(body\.whatsappContact, 255\)/,
        /contactEmail: cleanOptionalOneLineText\(body\.contactEmail, 255\)/,
        /socialLinks: normalizeSocialLinks\(body\.socialLinks\)/,
    ], 'hard asset payload sanitizer');
    assertSourceContainsAll(sanitizePatchSource, [
        /'whatsappContact'/,
        /'contactEmail'/,
        /'socialLinks'/,
    ], 'hard asset patch sanitizer');
    assertSourceContainsAll(createSource, [
        /contactEmail,/,
        /contactEmail: contactEmail \|\| null/,
    ], 'hard asset create');
    assertSourceContainsAll(updateSource, [
        /contactEmail: body\.contactEmail !== undefined \? \(body\.contactEmail \|\| null\) : existing\.contactEmail/,
    ], 'hard asset update');
});

test('template parent controller persists public contact and social fields', () => {
    const source = readSource('src/controllers/softAssetParentsController.js');
    const columnsSource = sourceBetween(source, 'const baseParentColumns = {', 'function canManageSoftAssetParent');
    const formatterSource = sourceBetween(source, 'function formatSoftAssetParent(parent, options = {})', 'async function attachSoftAssetParentTranslations');
    const buildPatchSource = sourceBetween(source, 'function buildParentPatch(body, existingParent, owner, audienceMode)', 'function sanitizeParentPayload');
    const sanitizePayloadSource = sourceBetween(source, 'function sanitizeParentPayload(body = {})', 'function sanitizeParentPatch');
    const sanitizePatchSource = sourceBetween(source, 'function sanitizeParentPatch(body = {})', 'async function loadParentDetail');

    assertSourceContainsAll(columnsSource, [
        /website: true/,
        /socialLinks: true/,
        /contactPhone: true/,
        /whatsappContact: true/,
        /contactEmail: true/,
    ], 'template parent columns');
    assertSourceContainsAll(formatterSource, [
        /website: parent\.website/,
        /socialLinks: normalizeSocialLinks\(parent\.socialLinks\)/,
        /contactPhone: parent\.contactPhone/,
        /whatsappContact: parent\.whatsappContact/,
        /contactEmail: parent\.contactEmail/,
    ], 'template parent formatter');
    assertSourceContainsAll(buildPatchSource, [
        /website: body\.website !== undefined \? \(body\.website \|\| null\) : existingParent\.website/,
        /socialLinks: body\.socialLinks !== undefined \? normalizeSocialLinks\(body\.socialLinks\) : normalizeSocialLinks\(existingParent\.socialLinks\)/,
        /contactPhone: body\.contactPhone !== undefined \? \(body\.contactPhone \|\| null\) : existingParent\.contactPhone/,
        /whatsappContact: body\.whatsappContact !== undefined \? \(body\.whatsappContact \|\| null\) : existingParent\.whatsappContact/,
        /contactEmail: body\.contactEmail !== undefined \? \(body\.contactEmail \|\| null\) : existingParent\.contactEmail/,
    ], 'template parent patch');
    assertSourceContainsAll(sanitizePayloadSource, [
        /website: normalizeUrlText\(body\.website, 2000\)/,
        /socialLinks: normalizeSocialLinks\(body\.socialLinks\)/,
        /contactPhone: cleanOptionalOneLineText\(body\.contactPhone, 50\)/,
        /whatsappContact: cleanOptionalOneLineText\(body\.whatsappContact, 255\)/,
        /contactEmail: cleanOptionalOneLineText\(body\.contactEmail, 255\)/,
    ], 'template parent sanitizer');
    assertSourceContainsAll(sanitizePatchSource, [
        /'website'/,
        /'socialLinks'/,
        /'contactPhone'/,
        /'whatsappContact'/,
        /'contactEmail'/,
    ], 'template parent patch sanitizer');
});

test('resource schema declares public contact columns for place and template records', () => {
    const source = readSource('src/db/schema.js');
    const hardAssetSource = sourceBetween(source, "export const hardAssets = pgTable('hard_assets'", "export const softAssetParents = pgTable('soft_asset_parents'");
    const templateParentSource = sourceBetween(source, "export const softAssetParents = pgTable('soft_asset_parents'", "export const softAssets = pgTable('soft_assets'");

    assertSourceContainsAll(hardAssetSource, [
        /whatsappContact: varchar\('whatsapp_contact'/,
        /contactEmail: varchar\('contact_email'/,
        /socialLinks: jsonb\('social_links'\)/,
    ], 'hard asset schema');
    assertSourceContainsAll(templateParentSource, [
        /website: text\('website'\)/,
        /socialLinks: jsonb\('social_links'\)/,
        /contactPhone: varchar\('contact_phone'/,
        /whatsappContact: varchar\('whatsapp_contact'/,
        /contactEmail: varchar\('contact_email'/,
    ], 'template parent schema');
});
