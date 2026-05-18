import { eq, or } from 'drizzle-orm';

import { subregionPostalCodes, subregions } from '../db/schema.js';
import { normalizePostalCode } from './postalBoundaries.js';
import { normalizeRole } from './roles.js';

const SINGAPORE_REGION_CODE = 'SIN';
const SINGAPORE_REGION_NAME = 'Singapore';

function buildOneMapPostalSearchUrl(postalCode) {
    return `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postalCode)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
}

function parseNumber(value) {
    const parsed = Number.parseFloat(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function getExactOneMapResult(payload, postalCode) {
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return results.find((result) => normalizePostalCode(result?.POSTAL) === postalCode) || null;
}

export async function validateSingaporePostalCodeWithOneMap(rawPostalCode, fetchImpl = fetch) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) {
        return { valid: false, postalCode: '', reason: 'invalid_format' };
    }

    const response = await fetchImpl(buildOneMapPostalSearchUrl(postalCode));
    if (!response?.ok) {
        const status = response?.status || 'unknown';
        throw new Error(`Could not validate Singapore postal code with OneMap (${status}).`);
    }

    const payload = await response.json();
    const result = getExactOneMapResult(payload, postalCode);
    if (!result) {
        return { valid: false, postalCode, reason: 'not_found' };
    }

    const lat = parseNumber(result.LATITUDE);
    const lng = parseNumber(result.LONGITUDE);
    if (lat === null || lng === null) {
        return { valid: false, postalCode, reason: 'missing_coordinates' };
    }

    return {
        valid: true,
        postalCode,
        address: String(result.ADDRESS || '').trim(),
        lat,
        lng,
    };
}

export function actorCanUseSingaporeFallbackRegion(actor, singaporeSubregionId) {
    const actorRole = normalizeRole(actor?.role);
    if (actorRole === 'super_admin') return true;

    const targetId = Number.parseInt(String(singaporeSubregionId), 10);
    if (!Number.isInteger(targetId)) return false;

    return Array.isArray(actor?.subregionIds)
        && actor.subregionIds.some((id) => Number.parseInt(String(id), 10) === targetId);
}

export async function loadSingaporeFallbackRegion(db) {
    const rows = await db
        .select({
            id: subregions.id,
            subregionCode: subregions.subregionCode,
            name: subregions.name,
            description: subregions.description,
        })
        .from(subregions)
        .where(or(
            eq(subregions.subregionCode, SINGAPORE_REGION_CODE),
            eq(subregions.name, SINGAPORE_REGION_NAME),
        ));

    return rows.find((row) => row.subregionCode === SINGAPORE_REGION_CODE && row.name === SINGAPORE_REGION_NAME)
        || rows.find((row) => row.subregionCode === SINGAPORE_REGION_CODE)
        || rows.find((row) => row.name === SINGAPORE_REGION_NAME)
        || null;
}

export async function cacheSingaporePostalCode(db, singaporeSubregionId, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) return false;

    await db
        .insert(subregionPostalCodes)
        .values({ subregionId: singaporeSubregionId, postalCode })
        .onConflictDoNothing();

    return true;
}

export async function resolveSingaporePostalFallback(db, rawPostalCode, actor, options = {}) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) return null;

    const singaporeRegion = await loadSingaporeFallbackRegion(db);
    if (!singaporeRegion || !actorCanUseSingaporeFallbackRegion(actor, singaporeRegion.id)) {
        return null;
    }

    const validation = await validateSingaporePostalCodeWithOneMap(postalCode, options.fetchImpl || fetch);
    if (!validation.valid) return null;

    await cacheSingaporePostalCode(db, singaporeRegion.id, postalCode);

    return {
        subregion: singaporeRegion,
        matches: [singaporeRegion],
        ambiguous: false,
        fallbackUsed: true,
        oneMapLocation: {
            lat: validation.lat,
            lng: validation.lng,
            address: validation.address,
        },
    };
}
