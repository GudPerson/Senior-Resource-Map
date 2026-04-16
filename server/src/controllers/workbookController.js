import * as XLSX from 'xlsx';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import {
    audienceZones,
    hardAssets,
    softAssetLocations,
    softAssetParents,
    softAssets,
    subCategories,
    subregionPostalCodes,
    subregions,
    users,
} from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    assertManageableAudienceZones,
    getAssetAudienceZones,
    normalizeAudienceZoneIds,
    syncSoftAssetAudienceZones,
    syncSoftAssetParentAudienceZones,
} from '../utils/audienceZones.js';
import {
    buildChildPropagationPatch,
    buildChildEditablePatch,
    buildChildOverrideResetPatch,
    buildChildValuesFromParent,
    CHILD_OVERRIDE_FIELDS,
    isChildSoftAsset,
    normalizeGalleryUrls,
    normalizeTagList,
} from '../utils/softAssetHierarchy.js';
import { normalizeRole } from '../utils/roles.js';
import { actorCanManageAsset, canAssignPartnerOwner } from '../utils/ownership.js';
import { rebuildMapCache } from '../utils/cacheBuilder.js';
import { resolveSingleSubregionByPostal } from '../utils/subregionRouting.js';
import { syncAssetTags } from '../utils/tags.js';
import { buildChildExternalKey, buildDeterministicExternalKey, resolveOrCreateExternalKey } from '../utils/externalKeys.js';
import { normalizeSoftAssetBucket } from '../utils/softAssetBuckets.js';
import { determineSoftSubregion, ensureActorCanManageLinkedHardAssets, getCacheRegionId, normalizeAudienceMode } from '../utils/softAssetScope.js';

const CONTENT_TYPES = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv;charset=utf-8',
};

const XLSX_FORMAT = 'xlsx';
const CSV_FORMAT = 'csv';

const RESOURCE_TYPES = {
    'places': {
        label: 'Places',
        fileStem: 'places',
        columns: [
            ['externalKey', true, 'Stable unique identifier used for round-trip import/export.'],
            ['name', true, 'Human-readable place name.'],
            ['subCategory', false, 'Optional. Defaults to Uncategorized.'],
            ['country', true, 'Two-letter country code. Use SG for Singapore data.'],
            ['postalCode', true, '6-digit postal code used to derive the place subregion.'],
            ['address', false, 'Optional operator-facing address text. Auto-fills if empty.'],
            ['lat', false, 'Optional latitude. Skips geocoding if provided.'],
            ['lng', false, 'Optional longitude. Skips geocoding if provided.'],
            ['ownershipMode', true, 'system or partner.'],
            ['partnerUsername', false, 'Required when ownershipMode is partner unless the uploader is the partner owner.'],
            ['phone', false, 'Optional contact phone number.'],
            ['hours', false, 'Optional opening hours text.'],
            ['website', false, 'Optional absolute website URL.'],
            ['description', false, 'Optional descriptive copy.'],
            ['tags', false, 'Comma-separated tag names.'],
            ['isHidden', false, 'TRUE or FALSE.'],
            ['hideFrom', false, 'Optional ISO datetime.'],
            ['hideUntil', false, 'Optional ISO datetime.'],
            ['logoUrl', false, 'Optional absolute URL.'],
            ['bannerUrl', false, 'Optional absolute URL.'],
            ['galleryUrls', false, 'Pipe-separated list of absolute URLs.'],
        ],
    },
    'standalone-offerings': {
        label: 'Standalone Offerings',
        fileStem: 'standalone_offerings',
        columns: [
            ['externalKey', true, 'Stable unique identifier used for round-trip import/export.'],
            ['name', true, 'Human-readable offering name.'],
            ['bucket', true, 'Programmes, Services, or Promotions.'],
            ['subCategory', true, 'Must match a configured soft-asset subcategory.'],
            ['ownershipMode', true, 'system or partner.'],
            ['partnerUsername', false, 'Required when ownershipMode is partner unless the uploader is the partner owner.'],
            ['locationExternalKeys', false, 'Comma-separated linked place external keys. All linked places must be in one subregion.'],
            ['targetSubregionCode', false, 'Required for non-partner uploads when no linked places are supplied.'],
            ['audienceMode', true, 'public, partner_boundary, or audience_zones.'],
            ['audienceZoneCodes', false, 'Comma-separated audience zone codes when audienceMode is audience_zones.'],
            ['isMemberOnly', false, 'TRUE or FALSE.'],
            ['description', false, 'Optional descriptive copy.'],
            ['schedule', false, 'Optional schedule text.'],
            ['tags', false, 'Comma-separated tag names.'],
            ['contactPhone', false, 'Optional local contact phone.'],
            ['contactEmail', false, 'Optional local contact email.'],
            ['ctaLabel', false, 'Optional CTA label.'],
            ['ctaUrl', false, 'Optional CTA absolute URL.'],
            ['venueNote', false, 'Optional location-specific note.'],
            ['isHidden', false, 'TRUE or FALSE.'],
            ['hideFrom', false, 'Optional ISO datetime.'],
            ['hideUntil', false, 'Optional ISO datetime.'],
            ['logoUrl', false, 'Optional absolute URL.'],
            ['bannerUrl', false, 'Optional absolute URL.'],
            ['galleryUrls', false, 'Pipe-separated list of absolute URLs.'],
        ],
    },
    'templates': {
        label: 'Offering Templates',
        fileStem: 'templates',
        columns: [
            ['externalKey', true, 'Stable unique identifier used for round-trip import/export.'],
            ['name', true, 'Template name shared across child rollouts.'],
            ['bucket', true, 'Programmes, Services, or Promotions.'],
            ['subCategory', true, 'Must match a configured soft-asset subcategory.'],
            ['ownershipMode', true, 'system or partner.'],
            ['partnerUsername', false, 'Required when ownershipMode is partner unless the uploader is the partner owner.'],
            ['audienceMode', true, 'public, partner_boundary, or audience_zones.'],
            ['audienceZoneCodes', false, 'Comma-separated audience zone codes when audienceMode is audience_zones.'],
            ['isMemberOnly', false, 'TRUE or FALSE.'],
            ['description', false, 'Optional shared description.'],
            ['schedule', false, 'Optional default schedule.'],
            ['tags', false, 'Comma-separated tags stored on the template.'],
            ['logoUrl', false, 'Optional absolute URL.'],
            ['bannerUrl', false, 'Optional absolute URL.'],
            ['galleryUrls', false, 'Pipe-separated list of absolute URLs.'],
        ],
    },
    'template-rollouts': {
        label: 'Template Rollouts',
        fileStem: 'template_rollouts',
        columns: [
            ['templateExternalKey', true, 'Template external key.'],
            ['hostExternalKey', true, 'Host place external key.'],
            ['isHidden', false, 'TRUE or FALSE.'],
            ['schedule', false, 'Optional host-specific schedule override.'],
            ['contactPhone', false, 'Optional host-specific contact phone override.'],
            ['contactEmail', false, 'Optional host-specific contact email override.'],
            ['ctaLabel', false, 'Optional host-specific CTA label override.'],
            ['ctaUrl', false, 'Optional host-specific CTA URL override.'],
            ['venueNote', false, 'Optional host-specific venue note override.'],
            ['overrideFields', false, 'Comma-separated child override fields to keep local.'],
            ['resetFields', false, 'Comma-separated child override fields to reset back to parent.'],
        ],
    },
};

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function normalizeHeader(value) {
    return normalizeText(value).replace(/\*/g, '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function splitDelimitedList(value, delimiters = /[,\n]+/) {
    if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
    return normalizeText(value).split(delimiters).map((item) => item.trim()).filter(Boolean);
}

function splitPipeList(value) {
    return normalizeText(value).split('|').map((item) => item.trim()).filter(Boolean);
}

function normalizeChildOverrideFieldList(value, label = 'overrideFields') {
    const fields = splitDelimitedList(value).map((field) => normalizeText(field));
    const invalid = fields.filter((field) => !CHILD_OVERRIDE_FIELDS.includes(field));
    if (invalid.length > 0) {
        throw new Error(`${label} contains unsupported fields: ${invalid.join(', ')}. Allowed values: ${CHILD_OVERRIDE_FIELDS.join(', ')}.`);
    }

    return [...new Set(fields)];
}

function parseBoolean(value, fallback = false) {
    const text = normalizeText(value).toLowerCase();
    if (!text) return fallback;
    return ['1', 'true', 'yes', 'y'].includes(text);
}

function parseNullableDate(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid datetime "${value}". Use an ISO-like value such as 2026-03-14T09:00.`);
    }
    return date;
}

function encodeList(value, delimiter = ', ') {
    if (!Array.isArray(value)) return '';
    return value.filter(Boolean).join(delimiter);
}

function encodePipeList(value) {
    if (!Array.isArray(value)) return '';
    return value.filter(Boolean).join(' | ');
}

function requiredColumnNames(resourceType) {
    return RESOURCE_TYPES[resourceType].columns.filter(([, required]) => required).map(([key]) => key);
}

function getHeaderLabel(key, required) {
    return required ? `${key} *` : key;
}

function buildGuideRows(resourceType) {
    const config = RESOURCE_TYPES[resourceType];
    const required = requiredColumnNames(resourceType);
    const rows = [
        ['Section', 'Content'],
        ['Workbook', config.label],
        ['Purpose', 'Use the Data sheet for importable rows. Guide and Reference are read-only operator aids.'],
        ['Required fields', required.join(', ')],
        ['Row handling', 'Each row is an upsert keyed by the stable external key(s). Blank rows are ignored.'],
        ['Import rule', 'Header labels are case-insensitive and ignore * markers.'],
        ['Lists', 'Use comma-separated values for tags and codes. Use pipe-separated values for galleryUrls.'],
        ['Dates', 'Use ISO-like date time values such as 2026-03-14T09:00.'],
        ['Safety', 'Do not rename the Data sheet when uploading .xlsx workbooks.'],
    ];

    if (resourceType === 'places') {
        rows.push(['Upsert key', 'externalKey']);
        rows.push(['Example', 'A place row must include externalKey, name, subCategory, country, postalCode, address, and ownershipMode.']);
        rows.push(['Common error', 'Postal code does not map to exactly one configured subregion.']);
        rows.push(['Common error', 'Partner username is missing or outside the uploader scope.']);
    } else if (resourceType === 'standalone-offerings') {
        rows.push(['Upsert key', 'externalKey']);
        rows.push(['Example', 'Use locationExternalKeys to link places. If you do not link a place, provide targetSubregionCode unless the uploader is a partner.']);
        rows.push(['Common error', 'Linked places span multiple subregions.']);
        rows.push(['Common error', 'Audience mode is audience_zones but no valid audienceZoneCodes were supplied.']);
    } else if (resourceType === 'templates') {
        rows.push(['Upsert key', 'externalKey']);
        rows.push(['Example', 'Templates define canonical shared content only. Host linkage belongs in the Template Rollouts workbook.']);
        rows.push(['Common error', 'Audience mode is audience_zones but no valid audienceZoneCodes were supplied.']);
        rows.push(['Common error', 'Partner username is outside the uploader scope.']);
    } else if (resourceType === 'template-rollouts') {
        rows.push(['Upsert key', 'templateExternalKey + hostExternalKey']);
        rows.push(['Example', 'Use overrideFields to declare which child fields should remain local. Blank values only clear a field when that field is listed in overrideFields.']);
        rows.push(['Common error', 'Template or host external key does not exist.']);
        rows.push(['Common error', 'overrideFields and resetFields contain the same child field.']);
    }

    return rows;
}

function createGuideSheet(resourceType) {
    const sheet = XLSX.utils.aoa_to_sheet(buildGuideRows(resourceType));
    sheet['!cols'] = [{ wch: 20 }, { wch: 120 }];
    return sheet;
}

function createReferenceSheet(resourceType, referenceRows) {
    const config = RESOURCE_TYPES[resourceType];
    const rows = [['Type', 'Value', 'Notes']];

    config.columns.forEach(([key, required, description]) => {
        rows.push(['Field', getHeaderLabel(key, required), description]);
    });

    for (const row of referenceRows) {
        rows.push(row);
    }

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 18 }, { wch: 36 }, { wch: 100 }];
    return sheet;
}

function createDataSheet(resourceType, rows) {
    const config = RESOURCE_TYPES[resourceType];
    const headerLabels = config.columns.map(([key, required]) => getHeaderLabel(key, required));
    const dataRows = rows.map((row) => config.columns.map(([key]) => row[key] ?? ''));
    const sheet = XLSX.utils.aoa_to_sheet([headerLabels, ...dataRows]);
    sheet['!cols'] = config.columns.map(([key]) => ({ wch: Math.max(16, key.length + 4) }));

    config.columns.forEach(([key, required, description], index) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: index });
        if (sheet[cellRef]) {
            sheet[cellRef].c = [{ a: 'CareAround', t: `${description}${required ? ' Required field.' : ''}` }];
        }
    });

    return sheet;
}

function buildWorkbookBuffer(resourceType, rows, referenceRows) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, createGuideSheet(resourceType), 'Guide');
    XLSX.utils.book_append_sheet(workbook, createDataSheet(resourceType, rows), 'Data');
    XLSX.utils.book_append_sheet(workbook, createReferenceSheet(resourceType, referenceRows), 'Reference');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildCsvBuffer(resourceType, rows) {
    const sheet = createDataSheet(resourceType, rows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return new TextEncoder().encode(`\uFEFF${csv}`);
}

async function parseWorkbookRows(file, resourceType) {
    const fileName = String(file?.name || '');
    const lower = fileName.toLowerCase();
    const format = lower.endsWith('.csv') ? CSV_FORMAT : XLSX_FORMAT;
    const arrayBuffer = await file.arrayBuffer();

    let workbook;
    if (format === CSV_FORMAT) {
        const text = new TextDecoder().decode(arrayBuffer);
        workbook = XLSX.read(text, { type: 'string' });
    } else {
        workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    }

    const sheetName = workbook.Sheets.Data ? 'Data' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        throw new Error('Workbook is missing a Data sheet.');
    }

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    if (rawRows.length === 0) return [];

    const config = RESOURCE_TYPES[resourceType];
    const headerMap = new Map();
    config.columns.forEach(([key, required]) => {
        headerMap.set(normalizeHeader(key), key);
        headerMap.set(normalizeHeader(getHeaderLabel(key, required)), key);
    });

    const rawHeaders = rawRows[0];
    const canonicalHeaders = rawHeaders.map((header) => headerMap.get(normalizeHeader(header)) || null);
    const missingHeaders = requiredColumnNames(resourceType).filter((requiredKey) => !canonicalHeaders.includes(requiredKey));
    if (missingHeaders.length > 0) {
        throw new Error(`Workbook is missing required headers: ${missingHeaders.join(', ')}`);
    }

    return rawRows.slice(1).map((row, index) => {
        const mapped = { __rowNumber: index + 2 };
        canonicalHeaders.forEach((key, cellIndex) => {
            if (!key) return;
            mapped[key] = row[cellIndex];
        });
        return mapped;
    }).filter((row) => Object.entries(row).some(([key, value]) => key !== '__rowNumber' && normalizeText(value) !== ''));
}

async function loadPartnerLookup(db) {
    const partnerRows = await db.query.users.findMany({
        columns: {
            id: true,
            username: true,
            name: true,
            role: true,
            managerUserId: true,
        },
        with: {
            subregions: { columns: { subregionId: true } },
        },
    });

    const byUsername = new Map();
    partnerRows.forEach((row) => {
        if (!row.username) return;
        byUsername.set(row.username.toLowerCase(), {
            ...row,
            role: normalizeRole(row.role),
            subregionIds: row.subregions.map((entry) => entry.subregionId),
        });
    });
    return byUsername;
}

async function loadSubregionLookup(db) {
    const rows = await db.select({
        id: subregions.id,
        name: subregions.name,
        subregionCode: subregions.subregionCode,
    }).from(subregions);

    const byCode = new Map();
    rows.forEach((row) => {
        if (row.subregionCode) byCode.set(String(row.subregionCode).toLowerCase(), row);
        if (row.name) byCode.set(String(row.name).toLowerCase(), row);
    });
    return byCode;
}

async function loadAudienceZoneLookup(db) {
    const rows = await db.select({
        id: audienceZones.id,
        zoneCode: audienceZones.zoneCode,
        name: audienceZones.name,
    }).from(audienceZones);
    const byCode = new Map();
    rows.forEach((row) => {
        if (row.zoneCode) byCode.set(String(row.zoneCode).toLowerCase(), row);
        byCode.set(String(row.name).toLowerCase(), row);
    });
    return byCode;
}

async function loadHardAssetByExternalKeys(db, keys) {
    const normalized = [...new Set(keys.map((key) => normalizeText(key)).filter(Boolean))];
    if (normalized.length === 0) return [];
    return db.query.hardAssets.findMany({
        where: and(inArray(hardAssets.externalKey, normalized), eq(hardAssets.isDeleted, false)),
        with: {
            partner: { columns: { id: true, name: true, role: true, managerUserId: true } },
        },
    });
}

async function loadTemplateByExternalKey(db, externalKey) {
    return db.query.softAssetParents.findFirst({
        where: eq(softAssetParents.externalKey, externalKey),
        with: {
            partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
            audienceZones: {
                with: {
                    audienceZone: { columns: { id: true, zoneCode: true, name: true, partnerUserId: true } },
                },
            },
            children: {
                with: {
                    hostHardAsset: { columns: { id: true, externalKey: true, name: true } },
                },
            },
        },
    });
}

function buildImportReport(resourceType) {
    return {
        resourceType,
        totalRows: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
        warnings: [],
    };
}

function rowError(report, rowNumber, message) {
    report.failedCount += 1;
    report.errors.push(`Row ${rowNumber}: ${message}`);
}

function rowWarning(report, rowNumber, message) {
    report.warnings.push(`Row ${rowNumber}: ${message}`);
}

async function geocodePostalCode(postalCode, country = 'SG') {
    const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postalCode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
    const data = await response.json();
    if (data?.results?.length) {
        return {
            lat: parseFloat(data.results[0].LATITUDE),
            lng: parseFloat(data.results[0].LONGITUDE),
        };
    }

    throw new Error(`Could not geocode postal code "${postalCode}" in "${country}".`);
}

function canManageSoftAssetParent(actor, parent, ownerUser) {
    const actorRole = normalizeRole(actor?.role);
    if (!actor || !parent) return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole === 'partner') return parent.partnerId === actor.id;
    if (actorRole === 'regional_admin') {
        if (!Array.isArray(actor.subregionIds) || actor.subregionIds.length === 0) return false;
        if (parent.partnerId) {
            return ownerUser?.id === parent.partnerId && ownerUser?.managerUserId === actor.id;
        }
        return parent.createdByUserId === actor.id;
    }
    return false;
}

function resolvePartnerOwner(actor, ownershipMode, partnerUsername, partnerLookup, subregionId = null) {
    const actorRole = normalizeRole(actor?.role);
    if (ownershipMode === 'system') return null;
    if (actorRole === 'partner') return actor;

    const normalizedUsername = normalizeText(partnerUsername).toLowerCase();
    const partner = partnerLookup.get(normalizedUsername);
    if (!partner) {
        throw new Error(`Partner username "${partnerUsername}" was not found.`);
    }
    if (!canAssignPartnerOwner(actor, partner, subregionId)) {
        throw new Error(`Partner "${partner.username}" is outside your allowed scope.`);
    }
    return partner;
}

function normalizeOwnershipModeValue(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) throw new Error('ownershipMode is required.');
    if (!['system', 'partner'].includes(normalized)) {
        throw new Error('ownershipMode must be system or partner.');
    }
    return normalized;
}

function normalizeAudienceModeValue(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) throw new Error('audienceMode is required.');
    if (!['public', 'partner_boundary', 'audience_zones'].includes(normalized)) {
        throw new Error('audienceMode must be public, partner_boundary, or audience_zones.');
    }
    return normalized;
}

async function buildWorkbookReferences(db) {
    const [partners, allSubCategories, allSubregions, zones, places, templates] = await Promise.all([
        db.select({ username: users.username, name: users.name, role: users.role }).from(users),
        db.select({ name: subCategories.name, type: subCategories.type }).from(subCategories),
        db.select({ subregionCode: subregions.subregionCode, name: subregions.name }).from(subregions),
        db.select({ zoneCode: audienceZones.zoneCode, name: audienceZones.name }).from(audienceZones),
        db.select({ externalKey: hardAssets.externalKey, name: hardAssets.name }).from(hardAssets).where(eq(hardAssets.isDeleted, false)),
        db.select({ externalKey: softAssetParents.externalKey, name: softAssetParents.name }).from(softAssetParents).where(eq(softAssetParents.isDeleted, false)),
    ]);

    return {
        partners,
        hardSubCategories: allSubCategories.filter((entry) => entry.type === 'hard'),
        softSubCategories: allSubCategories.filter((entry) => entry.type === 'soft'),
        subregions: allSubregions,
        audienceZones: zones,
        places,
        templates,
    };
}

function buildReferenceRows(resourceType, references) {
    const rows = [];
    rows.push(['Allowed', 'ownershipMode', 'system, partner']);

    if (resourceType === 'places') {
        rows.push(['Allowed', 'country', 'SG is the primary supported value']);
        references.hardSubCategories.forEach((entry) => rows.push(['Hard Subcategory', entry.name, 'Configured hard-asset subcategory']));
    }

    if (resourceType === 'standalone-offerings' || resourceType === 'templates') {
        rows.push(['Allowed', 'bucket', 'Programmes, Services, Promotions']);
        rows.push(['Allowed', 'audienceMode', 'public, partner_boundary, audience_zones']);
        references.softSubCategories.forEach((entry) => rows.push(['Soft Subcategory', entry.name, 'Configured soft-asset subcategory']));
    }

    if (resourceType === 'standalone-offerings') {
        references.subregions.forEach((entry) => rows.push(['Subregion', entry.subregionCode || '', entry.name || '']));
    }

    if (resourceType === 'standalone-offerings' || resourceType === 'templates') {
        references.audienceZones.forEach((entry) => rows.push(['Audience Zone', entry.zoneCode || '', entry.name || '']));
    }

    if (resourceType === 'template-rollouts') {
        rows.push(['Allowed', 'overrideFields', CHILD_OVERRIDE_FIELDS.join(', ')]);
        rows.push(['Allowed', 'resetFields', CHILD_OVERRIDE_FIELDS.join(', ')]);
        references.templates
            .filter((entry) => entry.externalKey)
            .forEach((entry) => rows.push(['Template', entry.externalKey, entry.name || '']));
        references.places
            .filter((entry) => entry.externalKey)
            .forEach((entry) => rows.push(['Place', entry.externalKey, entry.name || '']));
    }

    if (resourceType !== 'template-rollouts') {
        references.partners
            .filter((entry) => normalizeRole(entry.role) === 'partner')
            .forEach((entry) => rows.push(['Partner', entry.username, entry.name || '']));
    }

    return rows;
}

async function exportRowsForPlaces(db, actor) {
    const assets = await db.query.hardAssets.findMany({
        where: eq(hardAssets.isDeleted, false),
        with: {
            partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
            tags: { with: { tag: true } },
        },
        orderBy: [desc(hardAssets.updatedAt)],
    });

    return assets
        .filter((asset) => actorCanManageAsset(actor, asset, asset.partner))
        .map((asset) => ({
            externalKey: asset.externalKey || '',
            name: asset.name || '',
            subCategory: asset.subCategory || '',
            country: asset.country || 'SG',
            postalCode: asset.postalCode || '',
            address: asset.address || '',
            lat: asset.lat ? String(asset.lat) : '',
            lng: asset.lng ? String(asset.lng) : '',
            ownershipMode: asset.partnerId ? 'partner' : 'system',
            partnerUsername: asset.partner?.username || '',
            phone: asset.phone || '',
            hours: asset.hours || '',
            website: asset.website || '',
            description: asset.description || '',
            tags: encodeList(asset.tags.map((entry) => entry.tag.name)),
            isHidden: asset.isHidden ? 'TRUE' : 'FALSE',
            hideFrom: asset.hideFrom ? new Date(asset.hideFrom).toISOString() : '',
            hideUntil: asset.hideUntil ? new Date(asset.hideUntil).toISOString() : '',
            logoUrl: asset.logoUrl || '',
            bannerUrl: asset.bannerUrl || '',
            galleryUrls: encodePipeList(asset.galleryUrls),
        }));
}

async function exportRowsForStandaloneOfferings(db, actor) {
    const subregionRows = await db.select({ id: subregions.id, subregionCode: subregions.subregionCode }).from(subregions);
    const subregionMap = new Map(subregionRows.map((row) => [row.id, row.subregionCode || '']));
    const assets = await db.query.softAssets.findMany({
        where: and(eq(softAssets.isDeleted, false), eq(softAssets.assetMode, 'standalone')),
        with: {
            partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
            tags: { with: { tag: true } },
            audienceZones: {
                with: {
                    audienceZone: { columns: { id: true, zoneCode: true, name: true } },
                },
            },
            locations: {
                with: {
                    hardAsset: { columns: { externalKey: true } },
                },
            },
        },
        orderBy: [desc(softAssets.updatedAt)],
    });

    return assets
        .filter((asset) => actorCanManageAsset(actor, asset, asset.partner))
        .map((asset) => ({
            externalKey: asset.externalKey || '',
            name: asset.name || '',
            bucket: asset.bucket || '',
            subCategory: asset.subCategory || '',
            ownershipMode: asset.partnerId ? 'partner' : 'system',
            partnerUsername: asset.partner?.username || '',
            locationExternalKeys: encodeList(asset.locations.map((entry) => entry.hardAsset?.externalKey).filter(Boolean)),
            targetSubregionCode: subregionMap.get(asset.subregionId) || '',
            audienceMode: asset.audienceMode || 'public',
            audienceZoneCodes: encodeList(asset.audienceZones.map((entry) => entry.audienceZone.zoneCode || entry.audienceZone.name)),
            isMemberOnly: asset.isMemberOnly ? 'TRUE' : 'FALSE',
            description: asset.description || '',
            schedule: asset.schedule || '',
            tags: encodeList(asset.tags.map((entry) => entry.tag.name)),
            contactPhone: asset.contactPhone || '',
            contactEmail: asset.contactEmail || '',
            ctaLabel: asset.ctaLabel || '',
            ctaUrl: asset.ctaUrl || '',
            venueNote: asset.venueNote || '',
            isHidden: asset.isHidden ? 'TRUE' : 'FALSE',
            hideFrom: asset.hideFrom ? new Date(asset.hideFrom).toISOString() : '',
            hideUntil: asset.hideUntil ? new Date(asset.hideUntil).toISOString() : '',
            logoUrl: asset.logoUrl || '',
            bannerUrl: asset.bannerUrl || '',
            galleryUrls: encodePipeList(asset.galleryUrls),
        }));
}

async function exportRowsForTemplates(db, actor) {
    const parents = await db.query.softAssetParents.findMany({
        where: eq(softAssetParents.isDeleted, false),
        with: {
            partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
            audienceZones: {
                with: {
                    audienceZone: { columns: { id: true, zoneCode: true, name: true } },
                },
            },
        },
        orderBy: [desc(softAssetParents.updatedAt)],
    });

    return parents
        .filter((parent) => canManageSoftAssetParent(actor, parent, parent.partner))
        .map((parent) => ({
            externalKey: parent.externalKey || '',
            name: parent.name || '',
            bucket: parent.bucket || '',
            subCategory: parent.subCategory || '',
            ownershipMode: parent.partnerId ? 'partner' : 'system',
            partnerUsername: parent.partner?.username || '',
            audienceMode: parent.audienceMode || 'public',
            audienceZoneCodes: encodeList(getAssetAudienceZones(parent).map((zone) => zone.zoneCode || zone.name)),
            isMemberOnly: parent.isMemberOnly ? 'TRUE' : 'FALSE',
            description: parent.description || '',
            schedule: parent.schedule || '',
            tags: encodeList(Array.isArray(parent.tags) ? parent.tags : []),
            logoUrl: parent.logoUrl || '',
            bannerUrl: parent.bannerUrl || '',
            galleryUrls: encodePipeList(parent.galleryUrls),
        }));
}

async function exportRowsForRollouts(db, actor) {
    const parents = await db.query.softAssetParents.findMany({
        where: eq(softAssetParents.isDeleted, false),
        with: {
            partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
            children: {
                where: eq(softAssets.isDeleted, false),
                with: {
                    hostHardAsset: { columns: { externalKey: true, name: true } },
                },
            },
        },
        orderBy: [desc(softAssetParents.updatedAt)],
    });

    const rows = [];
    parents
        .filter((parent) => canManageSoftAssetParent(actor, parent, parent.partner))
        .forEach((parent) => {
            (parent.children || []).forEach((child) => {
                if (!isChildSoftAsset(child)) return;
                rows.push({
                    templateExternalKey: parent.externalKey || '',
                    hostExternalKey: child.hostHardAsset?.externalKey || '',
                    isHidden: child.isHidden ? 'TRUE' : 'FALSE',
                    schedule: child.schedule || '',
                    contactPhone: child.contactPhone || '',
                    contactEmail: child.contactEmail || '',
                    ctaLabel: child.ctaLabel || '',
                    ctaUrl: child.ctaUrl || '',
                    venueNote: child.venueNote || '',
                    overrideFields: encodeList(child.overriddenFields || []),
                    resetFields: '',
                });
            });
        });

    return rows;
}

async function resolveTemplateExport(resourceType, db, actor) {
    if (resourceType === 'places') return exportRowsForPlaces(db, actor);
    if (resourceType === 'standalone-offerings') return exportRowsForStandaloneOfferings(db, actor);
    if (resourceType === 'templates') return exportRowsForTemplates(db, actor);
    if (resourceType === 'template-rollouts') return exportRowsForRollouts(db, actor);
    throw new Error(`Unsupported workbook resource "${resourceType}".`);
}

async function importPlaces(db, actor, rows, references, env) {
    const report = buildImportReport('places');
    const affectedSubregions = new Set();
    const payloads = [];

    // 1. Pre-process and collect keys for bulk fetching
    const uniquePostals = new Set();
    const processedRows = rows.map(row => {
        const name = normalizeText(row.name);
        const country = normalizeText(row.country);
        const postalCode = normalizeText(row.postalCode);
        const externalKey = normalizeText(row.externalKey);
        const ownershipMode = normalizeOwnershipModeValue(row.ownershipMode);
        
        if (postalCode) uniquePostals.add(postalCode);
        
        return {
            ...row,
            name,
            country,
            postalCode,
            externalKey,
            ownershipMode,
            __rowNumber: row.__rowNumber
        };
    });

    // 2. Bulk Fetch Subregions
    const subregionMap = new Map();
    if (uniquePostals.size > 0) {
        const matches = await db
            .select({
                postalCode: subregionPostalCodes.postalCode,
                subregion: {
                    id: subregions.id,
                    name: subregions.name,
                    subregionCode: subregions.subregionCode
                }
            })
            .from(subregionPostalCodes)
            .innerJoin(subregions, eq(subregionPostalCodes.subregionId, subregions.id))
            .where(inArray(subregionPostalCodes.postalCode, Array.from(uniquePostals)));
        
        matches.forEach(m => {
            if (!subregionMap.has(m.postalCode)) {
                subregionMap.set(m.postalCode, m.subregion);
            }
        });
    }

    // 3. Bulk Fetch Existing Assets (to check ownership/permissions)
    const initialKeys = processedRows.map(r => r.externalKey).filter(Boolean);
    const existingAssetMap = new Map();
    if (initialKeys.length > 0) {
        const existingAssets = await db.query.hardAssets.findMany({
            where: inArray(hardAssets.externalKey, initialKeys),
            with: { partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } } }
        });
        existingAssets.forEach(a => existingAssetMap.set(a.externalKey, a));
    }

    // 4. In-memory processing
    for (const row of processedRows) {
        report.totalRows += 1;
        const rowNumber = row.__rowNumber;

        try {
            const { name, country, postalCode, externalKey, ownershipMode } = row;
            const subCategory = normalizeText(row.subCategory) || 'Uncategorized';
            const address = normalizeText(row.address) || (`Singapore ${postalCode}`);
            const latRaw = normalizeText(row.lat);
            const lngRaw = normalizeText(row.lng);

            const missingFields = [];
            if (!name) missingFields.push('name');
            if (!country) missingFields.push('country');
            if (!postalCode) missingFields.push('postalCode');
            if (!ownershipMode) missingFields.push('ownershipMode');

            if (missingFields.length > 0) {
                throw new Error(`The following fields are required: ${missingFields.join(', ')}`);
            }

            const derivedSubregion = subregionMap.get(postalCode);
            if (!derivedSubregion) {
                throw new Error(`Postal code ${postalCode} does not match any configured subregion.`);
            }

            if (!Array.isArray(actor.subregionIds) || !actor.subregionIds.includes(derivedSubregion.id)) {
                if (normalizeRole(actor.role) !== 'super_admin') {
                    throw new Error('Derived subregion is outside your allowed scope.');
                }
            }

            const owner = resolvePartnerOwner(actor, ownershipMode, row.partnerUsername, references.partnerLookup, derivedSubregion.id);
            const existing = externalKey ? existingAssetMap.get(externalKey) : null;

            if (existing && !actorCanManageAsset(actor, existing, existing.partner)) {
                throw new Error('Existing place is outside your allowed scope.');
            }

            let coords;
            if (latRaw && lngRaw) {
                const latNum = parseFloat(latRaw);
                const lngNum = parseFloat(lngRaw);
                if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
                    coords = { lat: latNum, lng: lngNum };
                }
            }
            if (!coords) {
                coords = await geocodePostalCode(postalCode, country);
            }

            const finalKey = existing?.externalKey || externalKey || await buildDeterministicExternalKey('place', name);

            payloads.push({
                partnerId: owner?.id || null,
                createdByUserId: existing?.createdByUserId || actor.id,
                externalKey: finalKey,
                subregionId: derivedSubregion.id,
                name,
                subCategory,
                country,
                postalCode,
                address,
                phone: normalizeText(row.phone) || null,
                hours: normalizeText(row.hours) || null,
                website: normalizeText(row.website) || null,
                description: normalizeText(row.description) || null,
                logoUrl: normalizeText(row.logoUrl) || null,
                bannerUrl: normalizeText(row.bannerUrl) || null,
                galleryUrls: normalizeGalleryUrls(splitPipeList(row.galleryUrls)),
                lat: String(coords.lat),
                lng: String(coords.lng),
                isHidden: parseBoolean(row.isHidden, false),
                hideFrom: parseNullableDate(row.hideFrom),
                hideUntil: parseNullableDate(row.hideUntil),
                isDeleted: false,
                updatedAt: new Date(),
            });

            affectedSubregions.add(derivedSubregion.id);
        } catch (err) {
            report.failedCount += 1;
            report.errors.push(`Row ${rowNumber}: ${err.message}`);
        }
    }

    // 5. Final Bulk Upsert
    if (payloads.length > 0) {
        // Use onConflictUpdate to allow users to patch existing items via re-upload
        const inserted = await db.insert(hardAssets)
            .values(payloads)
            .onConflictUpdate({
                target: [hardAssets.externalKey],
                set: {
                    partnerId: sql`EXCLUDED.partner_id`,
                    subregionId: sql`EXCLUDED.subregion_id`,
                    name: sql`EXCLUDED.name`,
                    subCategory: sql`EXCLUDED.sub_category`,
                    address: sql`EXCLUDED.address`,
                    lat: sql`EXCLUDED.lat`,
                    lng: sql`EXCLUDED.lng`,
                    phone: sql`EXCLUDED.phone`,
                    hours: sql`EXCLUDED.hours`,
                    website: sql`EXCLUDED.website`,
                    description: sql`EXCLUDED.description`,
                    logoUrl: sql`EXCLUDED.logo_url`,
                    bannerUrl: sql`EXCLUDED.banner_url`,
                    galleryUrls: sql`EXCLUDED.gallery_urls`,
                    isHidden: sql`EXCLUDED.is_hidden`,
                    hideFrom: sql`EXCLUDED.hide_from`,
                    hideUntil: sql`EXCLUDED.hide_until`,
                    updatedAt: sql`EXCLUDED.updated_at`
                }
            })
            .returning({ id: hardAssets.id });
        
        report.createdCount = inserted.length;
        report.updatedCount = Number(payloads.length - inserted.length); // Approximation since Drizzle returning might vary
        report.skippedCount = 0;
    }

    for (const subregionId of affectedSubregions) {
        await rebuildMapCache(getCacheRegionId(subregionId), env);
    }

    return report;
}

async function importStandaloneOfferings(db, actor, rows, references, env) {
    const report = buildImportReport('standalone-offerings');
    const affectedSubregions = new Set();

    for (const row of rows) {
        report.totalRows += 1;
        const rowNumber = row.__rowNumber;

        try {
            const externalKey = normalizeText(row.externalKey);
            const name = normalizeText(row.name);
            const bucket = normalizeSoftAssetBucket(row.bucket, null);
            const subCategory = normalizeText(row.subCategory);
            const ownershipMode = normalizeOwnershipModeValue(row.ownershipMode);
            const audienceModeText = normalizeAudienceModeValue(row.audienceMode);

            if (!externalKey || !name || !bucket || !subCategory) {
                throw new Error('externalKey, name, bucket, subCategory, ownershipMode, and audienceMode are required.');
            }

            const locationKeys = splitDelimitedList(row.locationExternalKeys);
            const linkedHardAssets = await loadHardAssetByExternalKeys(db, locationKeys);
            if (linkedHardAssets.length !== locationKeys.length) {
                throw new Error('One or more locationExternalKeys do not map to existing places.');
            }
            ensureActorCanManageLinkedHardAssets(actor, linkedHardAssets);

            const targetSubregion = locationKeys.length === 0
                ? references.subregionLookup.get(normalizeText(row.targetSubregionCode).toLowerCase()) || null
                : null;

            const owner = resolvePartnerOwner(actor, ownershipMode, row.partnerUsername, references.partnerLookup, targetSubregion?.id || null);
            const audienceMode = normalizeAudienceMode({ audienceMode: audienceModeText }, owner);
            const audienceZoneCodes = splitDelimitedList(row.audienceZoneCodes);
            const audienceZoneIds = audienceMode === 'audience_zones'
                ? normalizeAudienceZoneIds(audienceZoneCodes.map((code) => {
                    const zone = references.audienceZoneLookup.get(code.toLowerCase());
                    if (!zone) {
                        throw new Error(`Audience zone "${code}" was not found.`);
                    }
                    return zone.id;
                }))
                : [];

            if (audienceMode === 'audience_zones') {
                if (audienceZoneIds.length === 0) {
                    throw new Error('Select at least one audience zone for audience-zone offerings.');
                }
                await assertManageableAudienceZones(db, actor, audienceZoneIds);
            }

            const body = {
                subregionId: targetSubregion?.id || null,
            };
            const finalSubregionId = determineSoftSubregion(actor, body, linkedHardAssets);
            const existing = await db.query.softAssets.findFirst({
                where: eq(softAssets.externalKey, externalKey),
                with: {
                    partner: { columns: { id: true, username: true, name: true, role: true, managerUserId: true } },
                    locations: {
                        with: { hardAsset: { with: { partner: { columns: { id: true, name: true, role: true, managerUserId: true } } } } },
                    },
                    audienceZones: { with: { audienceZone: { columns: { id: true } } } },
                },
            });

            if (existing && existing.assetMode !== 'standalone') {
                throw new Error('Only standalone offerings can be imported through this workbook.');
            }
            if (existing && !actorCanManageAsset(actor, existing, existing.partner)) {
                throw new Error('Existing offering is outside your allowed scope.');
            }

            const payload = {
                externalKey: existing?.externalKey || await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
                    requestedKey: externalKey,
                    prefix: 'offering',
                    name,
                    ignoreId: existing?.id || null,
                }),
                assetMode: 'standalone',
                partnerId: owner?.id || null,
                createdByUserId: existing?.createdByUserId || actor.id,
                subregionId: finalSubregionId,
                name,
                bucket,
                subCategory,
                description: normalizeText(row.description) || null,
                schedule: normalizeText(row.schedule) || null,
                logoUrl: normalizeText(row.logoUrl) || null,
                bannerUrl: normalizeText(row.bannerUrl) || null,
                galleryUrls: normalizeGalleryUrls(splitPipeList(row.galleryUrls)),
                audienceMode,
                isMemberOnly: parseBoolean(row.isMemberOnly, false),
                contactPhone: normalizeText(row.contactPhone) || null,
                contactEmail: normalizeText(row.contactEmail) || null,
                ctaLabel: normalizeText(row.ctaLabel) || null,
                ctaUrl: normalizeText(row.ctaUrl) || null,
                venueNote: normalizeText(row.venueNote) || null,
                isHidden: parseBoolean(row.isHidden, false),
                hideFrom: parseNullableDate(row.hideFrom),
                hideUntil: parseNullableDate(row.hideUntil),
                isDeleted: false,
                updatedAt: new Date(),
            };

            let assetId;
            if (existing) {
                await db.update(softAssets).set(payload).where(eq(softAssets.id, existing.id));
                assetId = existing.id;
                report.updatedCount += 1;
            } else {
                const [created] = await db.insert(softAssets).values(payload).returning({ id: softAssets.id });
                assetId = created.id;
                report.createdCount += 1;
            }

            await syncAssetTags(db, assetId, 'soft', splitDelimitedList(row.tags));
            await syncSoftAssetAudienceZones(db, assetId, audienceZoneIds);
            await db.delete(softAssetLocations).where(eq(softAssetLocations.softAssetId, assetId));
            for (const hardAsset of linkedHardAssets) {
                await db.insert(softAssetLocations).values({
                    softAssetId: assetId,
                    hardAssetId: hardAsset.id,
                });
            }

            affectedSubregions.add(finalSubregionId);
            if (existing?.subregionId) affectedSubregions.add(existing.subregionId);
        } catch (error) {
            rowError(report, rowNumber, error.message);
        }
    }

    for (const subregionId of affectedSubregions) {
        await rebuildMapCache(getCacheRegionId(subregionId), env);
    }

    return report;
}

async function importTemplates(db, actor, rows, references, env) {
    const report = buildImportReport('templates');
    const affectedSubregions = new Set();

    for (const row of rows) {
        report.totalRows += 1;
        const rowNumber = row.__rowNumber;

        try {
            const externalKey = normalizeText(row.externalKey);
            const name = normalizeText(row.name);
            const bucket = normalizeSoftAssetBucket(row.bucket, null);
            const subCategory = normalizeText(row.subCategory);
            const ownershipMode = normalizeOwnershipModeValue(row.ownershipMode);
            const audienceModeText = normalizeAudienceModeValue(row.audienceMode);

            if (!externalKey || !name || !bucket || !subCategory) {
                throw new Error('externalKey, name, bucket, subCategory, ownershipMode, and audienceMode are required.');
            }

            const owner = resolvePartnerOwner(actor, ownershipMode, row.partnerUsername, references.partnerLookup, null);
            const audienceMode = normalizeAudienceMode({ audienceMode: audienceModeText }, owner);
            const audienceZoneCodes = splitDelimitedList(row.audienceZoneCodes);
            const audienceZoneIds = audienceMode === 'audience_zones'
                ? normalizeAudienceZoneIds(audienceZoneCodes.map((code) => {
                    const zone = references.audienceZoneLookup.get(code.toLowerCase());
                    if (!zone) {
                        throw new Error(`Audience zone "${code}" was not found.`);
                    }
                    return zone.id;
                }))
                : [];

            if (audienceMode === 'audience_zones') {
                if (audienceZoneIds.length === 0) {
                    throw new Error('Select at least one audience zone for audience-zone templates.');
                }
                await assertManageableAudienceZones(db, actor, audienceZoneIds);
            }

            const existing = await loadTemplateByExternalKey(db, externalKey);
            if (existing && !canManageSoftAssetParent(actor, existing, existing.partner)) {
                throw new Error('Existing template is outside your allowed scope.');
            }

            const payload = {
                externalKey: existing?.externalKey || await resolveOrCreateExternalKey(db, softAssetParents, softAssetParents.externalKey, {
                    requestedKey: externalKey,
                    prefix: 'template',
                    name,
                    ignoreId: existing?.id || null,
                }),
                partnerId: owner?.id || null,
                createdByUserId: existing?.createdByUserId || actor.id,
                name,
                bucket,
                subCategory,
                description: normalizeText(row.description) || null,
                schedule: normalizeText(row.schedule) || null,
                logoUrl: normalizeText(row.logoUrl) || null,
                bannerUrl: normalizeText(row.bannerUrl) || null,
                galleryUrls: normalizeGalleryUrls(splitPipeList(row.galleryUrls)),
                audienceMode,
                isMemberOnly: parseBoolean(row.isMemberOnly, false),
                tags: normalizeTagList(splitDelimitedList(row.tags)),
                isDeleted: false,
                updatedAt: new Date(),
            };

            let parentId;
            let activeChildren = existing?.children?.filter((child) => !child.isDeleted) || [];
            if (existing) {
                await db.update(softAssetParents).set(payload).where(eq(softAssetParents.id, existing.id));
                parentId = existing.id;
                report.updatedCount += 1;
            } else {
                const [created] = await db.insert(softAssetParents).values(payload).returning({ id: softAssetParents.id });
                parentId = created.id;
                activeChildren = [];
                report.createdCount += 1;
            }

            await syncSoftAssetParentAudienceZones(db, parentId, audienceZoneIds);

            const nextParent = {
                ...existing,
                ...payload,
                id: parentId,
            };

            for (const child of activeChildren) {
                const childPatch = buildChildPropagationPatch(nextParent, child);
                await db.update(softAssets).set(childPatch).where(eq(softAssets.id, child.id));
                await syncAssetTags(db, child.id, 'soft', payload.tags || []);
                if (Number.isInteger(child.subregionId)) {
                    affectedSubregions.add(child.subregionId);
                }
            }
        } catch (error) {
            rowError(report, rowNumber, error.message);
        }
    }

    for (const subregionId of affectedSubregions) {
        await rebuildMapCache(getCacheRegionId(subregionId), env);
    }

    return report;
}

async function importTemplateRollouts(db, actor, rows, env) {
    const report = buildImportReport('template-rollouts');
    const affectedSubregions = new Set();

    for (const row of rows) {
        report.totalRows += 1;
        const rowNumber = row.__rowNumber;

        try {
            const templateExternalKey = normalizeText(row.templateExternalKey);
            const hostExternalKey = normalizeText(row.hostExternalKey);
            if (!templateExternalKey || !hostExternalKey) {
                throw new Error('templateExternalKey and hostExternalKey are required.');
            }

            const parent = await loadTemplateByExternalKey(db, templateExternalKey);
            if (!parent || parent.isDeleted) {
                throw new Error(`Template "${templateExternalKey}" was not found.`);
            }
            if (!canManageSoftAssetParent(actor, parent, parent.partner)) {
                throw new Error('Template is outside your allowed scope.');
            }

            const [host] = await loadHardAssetByExternalKeys(db, [hostExternalKey]);
            if (!host) {
                throw new Error(`Host "${hostExternalKey}" was not found.`);
            }
            ensureActorCanManageLinkedHardAssets(actor, [host]);

            if (parent.partnerId && parent.partnerId !== host.partnerId) {
                throw new Error(`Host "${host.name}" is not owned by the template partner.`);
            }

            const overrideFields = normalizeChildOverrideFieldList(row.overrideFields, 'overrideFields');
            const resetFields = normalizeChildOverrideFieldList(row.resetFields, 'resetFields');
            const conflictingFields = overrideFields.filter((field) => resetFields.includes(field));
            if (conflictingFields.length > 0) {
                throw new Error(`overrideFields and resetFields cannot both include: ${conflictingFields.join(', ')}.`);
            }

            const existing = await db.query.softAssets.findFirst({
                where: and(
                    eq(softAssets.parentSoftAssetId, parent.id),
                    eq(softAssets.hostHardAssetId, host.id),
                    eq(softAssets.assetMode, 'child')
                ),
            });

            let child = existing;
            if (!child) {
                const [created] = await db.insert(softAssets).values(
                    buildChildValuesFromParent(
                        parent,
                        host,
                        actor,
                        await resolveOrCreateExternalKey(db, softAssets, softAssets.externalKey, {
                            requestedKey: buildChildExternalKey(parent.externalKey, host.externalKey),
                            prefix: 'rollout',
                            name: `${parent.name} ${host.name}`,
                        })
                    )
                ).returning();
                await syncAssetTags(db, created.id, 'soft', Array.isArray(parent.tags) ? parent.tags : []);
                child = created;
                report.createdCount += 1;
            } else {
                report.updatedCount += 1;
            }

            const editableBody = {};
            if (normalizeText(row.isHidden)) {
                editableBody.isHidden = parseBoolean(row.isHidden, child.isHidden);
            }

            for (const field of CHILD_OVERRIDE_FIELDS) {
                const rawValue = row[field];
                if (overrideFields.includes(field) || (!existing && normalizeText(rawValue))) {
                    editableBody[field] = rawValue;
                }
            }

            if (Object.keys(editableBody).length > 0) {
                const patch = buildChildEditablePatch(editableBody, child);
                patch.isDeleted = false;
                await db.update(softAssets).set(patch).where(eq(softAssets.id, child.id));
                child = { ...child, ...patch };
            } else if (child.isDeleted) {
                await db.update(softAssets).set({ isDeleted: false, updatedAt: new Date() }).where(eq(softAssets.id, child.id));
                child = { ...child, isDeleted: false };
            }

            if (resetFields.length > 0) {
                const patch = buildChildOverrideResetPatch(parent, child, resetFields);
                patch.isDeleted = false;
                await db.update(softAssets).set(patch).where(eq(softAssets.id, child.id));
                child = { ...child, ...patch };
            }

            affectedSubregions.add(host.subregionId);
        } catch (error) {
            rowError(report, rowNumber, error.message);
        }
    }

    for (const subregionId of affectedSubregions) {
        await rebuildMapCache(getCacheRegionId(subregionId), env);
    }

    return report;
}

export async function downloadWorkbookTemplate(c) {
    const resourceType = c.req.param('resourceType');
    const format = (c.req.query('format') || XLSX_FORMAT).toLowerCase();
    const config = RESOURCE_TYPES[resourceType];
    if (!config) return c.json({ error: 'Unsupported workbook resource type.' }, 400);
    if (!CONTENT_TYPES[format]) return c.json({ error: 'Unsupported workbook format.' }, 400);

    const db = getDb(c.env);
    await ensureBoundarySchema(db, c.env);
    const references = await buildWorkbookReferences(db);
    const referenceRows = buildReferenceRows(resourceType, references);
    const body = format === XLSX_FORMAT
        ? buildWorkbookBuffer(resourceType, [], referenceRows)
        : buildCsvBuffer(resourceType, []);

    c.header('Content-Type', CONTENT_TYPES[format]);
    c.header('Content-Disposition', `attachment; filename="${config.fileStem}_template.${format}"`);
    return c.body(body);
}

export async function exportWorkbookData(c) {
    const resourceType = c.req.param('resourceType');
    const format = (c.req.query('format') || XLSX_FORMAT).toLowerCase();
    const config = RESOURCE_TYPES[resourceType];
    if (!config) return c.json({ error: 'Unsupported workbook resource type.' }, 400);
    if (!CONTENT_TYPES[format]) return c.json({ error: 'Unsupported workbook format.' }, 400);

    const actor = c.get('user');
    const db = getDb(c.env);
    await ensureBoundarySchema(db, c.env);
    const references = await buildWorkbookReferences(db);
    const rows = await resolveTemplateExport(resourceType, db, actor);
    const referenceRows = buildReferenceRows(resourceType, references);
    const body = format === XLSX_FORMAT
        ? buildWorkbookBuffer(resourceType, rows, referenceRows)
        : buildCsvBuffer(resourceType, rows);

    c.header('Content-Type', CONTENT_TYPES[format]);
    c.header('Content-Disposition', `attachment; filename="${config.fileStem}_export.${format}"`);
    return c.body(body);
}

export async function importWorkbookData(c) {
    try {
        const resourceType = c.req.param('resourceType');
        const config = RESOURCE_TYPES[resourceType];
        if (!config) return c.json({ error: 'Unsupported workbook resource type.' }, 400);

        const actor = c.get('user');
        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file.arrayBuffer !== 'function') {
            return c.json({ error: 'Upload a .xlsx or .csv file using the "file" field.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const rows = await parseWorkbookRows(file, resourceType);
        const references = {
            partnerLookup: await loadPartnerLookup(db),
            subregionLookup: await loadSubregionLookup(db),
            audienceZoneLookup: await loadAudienceZoneLookup(db),
        };

        let report;
        if (resourceType === 'places') {
            report = await importPlaces(db, actor, rows, references, c.env);
        } else if (resourceType === 'standalone-offerings') {
            report = await importStandaloneOfferings(db, actor, rows, references, c.env);
        } else if (resourceType === 'templates') {
            report = await importTemplates(db, actor, rows, references, c.env);
        } else if (resourceType === 'template-rollouts') {
            report = await importTemplateRollouts(db, actor, rows, c.env);
        } else {
            return c.json({ error: `Import for ${resourceType} is not implemented yet.` }, 501);
        }

        return c.json(report);
    } catch (error) {
        console.error('importWorkbookData error:', error);
        return c.json({ error: error.message || 'An unexpected error occurred during workbook import.' }, 500);
    }
}
