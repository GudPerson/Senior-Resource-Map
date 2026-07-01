import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/controllers/workbookController.js', import.meta.url), 'utf8');

function sourceBetween(startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function assertSourceContainsAll(block, markers, label) {
    for (const marker of markers) {
        assert.match(block, marker, `${label} should include ${marker}`);
    }
}

test('direct asset workbook schemas expose public contact and social link fields', () => {
    const placesConfig = sourceBetween("'places': {", "'standalone-offerings': {");
    const standaloneConfig = sourceBetween("'standalone-offerings': {", "'templates': {");
    const templateConfig = sourceBetween("'templates': {", "'template-rollouts': {");
    const rolloutConfig = sourceBetween("'template-rollouts': {", '},\n};');

    assertSourceContainsAll(placesConfig, [
        /\['contactEmail', false/,
        /\['facebookUrl', false/,
        /\['instagramUrl', false/,
        /\['tiktokUrl', false/,
        /\['youtubeUrl', false/,
        /\['linkedinUrl', false/,
    ], 'Places workbook config');
    assertSourceContainsAll(standaloneConfig, [
        /\['website', false/,
        /\['facebookUrl', false/,
        /\['instagramUrl', false/,
        /\['tiktokUrl', false/,
        /\['youtubeUrl', false/,
        /\['linkedinUrl', false/,
    ], 'Standalone offerings workbook config');
    assertSourceContainsAll(templateConfig, [
        /\['website', false/,
        /\['contactPhone', false/,
        /\['whatsappContact', false/,
        /\['contactEmail', false/,
        /\['facebookUrl', false/,
        /\['instagramUrl', false/,
        /\['tiktokUrl', false/,
        /\['youtubeUrl', false/,
        /\['linkedinUrl', false/,
    ], 'Templates workbook config');
    assert.doesNotMatch(rolloutConfig, /facebookUrl|instagramUrl|tiktokUrl|youtubeUrl|linkedinUrl|socialLinks|website/);
});

test('workbook exports serialize public social links from database rows', () => {
    const placesExport = sourceBetween('async function exportRowsForPlaces', 'async function exportRowsForStandaloneOfferings');
    const standaloneExport = sourceBetween('async function exportRowsForStandaloneOfferings', 'async function exportRowsForTemplates');
    const templateExport = sourceBetween('async function exportRowsForTemplates', 'async function exportRowsForRollouts');

    assertSourceContainsAll(placesExport, [
        /contactEmail: asset\.contactEmail \|\| ''/,
        /facebookUrl: serializeSocialLink\(asset\.socialLinks, 'facebook'\)/,
        /instagramUrl: serializeSocialLink\(asset\.socialLinks, 'instagram'\)/,
        /tiktokUrl: serializeSocialLink\(asset\.socialLinks, 'tiktok'\)/,
        /youtubeUrl: serializeSocialLink\(asset\.socialLinks, 'youtube'\)/,
        /linkedinUrl: serializeSocialLink\(asset\.socialLinks, 'linkedin'\)/,
    ], 'Places export');
    assertSourceContainsAll(standaloneExport, [
        /website: asset\.website \|\| ''/,
        /facebookUrl: serializeSocialLink\(asset\.socialLinks, 'facebook'\)/,
        /instagramUrl: serializeSocialLink\(asset\.socialLinks, 'instagram'\)/,
        /tiktokUrl: serializeSocialLink\(asset\.socialLinks, 'tiktok'\)/,
        /youtubeUrl: serializeSocialLink\(asset\.socialLinks, 'youtube'\)/,
        /linkedinUrl: serializeSocialLink\(asset\.socialLinks, 'linkedin'\)/,
    ], 'Standalone offerings export');
    assertSourceContainsAll(templateExport, [
        /website: parent\.website \|\| ''/,
        /contactPhone: parent\.contactPhone \|\| ''/,
        /whatsappContact: parent\.whatsappContact \|\| ''/,
        /contactEmail: parent\.contactEmail \|\| ''/,
        /facebookUrl: serializeSocialLink\(parent\.socialLinks, 'facebook'\)/,
        /instagramUrl: serializeSocialLink\(parent\.socialLinks, 'instagram'\)/,
        /tiktokUrl: serializeSocialLink\(parent\.socialLinks, 'tiktok'\)/,
        /youtubeUrl: serializeSocialLink\(parent\.socialLinks, 'youtube'\)/,
        /linkedinUrl: serializeSocialLink\(parent\.socialLinks, 'linkedin'\)/,
    ], 'Templates export');
});

test('workbook imports persist public social links into database payloads', () => {
    const placesImport = sourceBetween('async function importPlaces', 'async function importStandaloneOfferings');
    const standaloneImport = sourceBetween('async function importStandaloneOfferings', 'async function importTemplates');
    const templateImport = sourceBetween('async function importTemplates', 'async function importTemplateRollouts');

    assertSourceContainsAll(placesImport, [
        /contactEmail: normalizeText\(row\.contactEmail\) \|\| null/,
        /socialLinks: buildSocialLinksFromWorkbookRow\(row\)/,
        /contactEmail: sql`EXCLUDED\.contact_email`/,
        /socialLinks: sql`EXCLUDED\.social_links`/,
    ], 'Places import');
    assertSourceContainsAll(standaloneImport, [
        /website: normalizeText\(row\.website\) \|\| null/,
        /socialLinks: buildSocialLinksFromWorkbookRow\(row\)/,
    ], 'Standalone offerings import');
    assertSourceContainsAll(templateImport, [
        /website: normalizeText\(row\.website\) \|\| null/,
        /contactPhone: normalizeText\(row\.contactPhone\) \|\| null/,
        /whatsappContact: normalizeText\(row\.whatsappContact\) \|\| null/,
        /contactEmail: normalizeText\(row\.contactEmail\) \|\| null/,
        /socialLinks: buildSocialLinksFromWorkbookRow\(row\)/,
    ], 'Templates import');
});
