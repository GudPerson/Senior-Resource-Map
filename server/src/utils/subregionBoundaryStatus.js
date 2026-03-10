import { inArray } from 'drizzle-orm';
import { subregionPostalCodes, subregions } from '../db/schema.js';
import { getBoundaryStatus, normalizePostalCode, parsePostalCodeListInput } from './postalBoundaries.js';
import { normalizeRole } from './roles.js';

export function boundaryChecksEnabledForRole(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'regional_admin' || normalizedRole === 'partner';
}

export async function loadScopedBoundaryContext(db, user) {
    if (!boundaryChecksEnabledForRole(user?.role)) {
        return {
            enabled: false,
            postalCodes: new Set(),
        };
    }

    const scopedSubregionIds = Array.isArray(user?.subregionIds)
        ? user.subregionIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)
        : [];

    if (scopedSubregionIds.length === 0) {
        return {
            enabled: true,
            postalCodes: new Set(),
        };
    }

    const rows = await db
        .select({ postalCode: subregionPostalCodes.postalCode })
        .from(subregionPostalCodes)
        .where(inArray(subregionPostalCodes.subregionId, scopedSubregionIds));

    const postalCodes = new Set(rows.map((row) => normalizePostalCode(row.postalCode)).filter(Boolean));

    if (postalCodes.size === 0) {
        const legacyRows = await db
            .select({
                postalPatterns: subregions.postalPatterns,
            })
            .from(subregions)
            .where(inArray(subregions.id, scopedSubregionIds));

        for (const row of legacyRows) {
            try {
                for (const postalCode of parsePostalCodeListInput(row.postalPatterns)) {
                    postalCodes.add(postalCode);
                }
            } catch {
                // Ignore legacy non-exact pattern strings during migration.
            }
        }
    }

    return {
        enabled: true,
        postalCodes,
    };
}

export function resolvePostalBoundaryStatus(postalCode, boundaryContext) {
    if (!boundaryContext?.enabled) return 'no-boundary';
    return getBoundaryStatus(postalCode, boundaryContext.postalCodes);
}

export function resolveSoftAssetBoundaryStatus(locations, boundaryContext) {
    if (!boundaryContext?.enabled) return 'no-boundary';

    const validPostalCodes = (Array.isArray(locations) ? locations : [])
        .map((location) => normalizePostalCode(location?.postalCode))
        .filter(Boolean);

    if (validPostalCodes.length === 0) {
        return Array.isArray(locations) && locations.length > 0 ? 'missing-postal' : 'no-location';
    }

    return validPostalCodes.some((postalCode) => resolvePostalBoundaryStatus(postalCode, boundaryContext) === 'inside')
        ? 'inside'
        : 'outside';
}
