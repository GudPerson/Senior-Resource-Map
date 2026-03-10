import { eq } from 'drizzle-orm';
import { subregionPostalCodes, subregions, userSubregions } from '../db/schema.js';
import { normalizePostalCode } from './postalBoundaries.js';

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

export async function findMatchingSubregionsByPostal(db, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) {
        throw clientError('Postal code must be a valid 6-digit code.', 400);
    }

    return await db
        .select({
            id: subregions.id,
            subregionCode: subregions.subregionCode,
            name: subregions.name,
            description: subregions.description,
        })
        .from(subregionPostalCodes)
        .innerJoin(subregions, eq(subregionPostalCodes.subregionId, subregions.id))
        .where(eq(subregionPostalCodes.postalCode, postalCode));
}

export async function resolveSingleSubregionByPostal(db, rawPostalCode, entityLabel = 'Postal code') {
    const matches = await findMatchingSubregionsByPostal(db, rawPostalCode);

    if (matches.length === 0) {
        throw clientError(`${entityLabel} does not match any configured subregion boundary.`, 400);
    }

    if (matches.length > 1) {
        const labels = matches.map((match) => match.subregionCode || match.name || match.id).join(', ');
        throw clientError(`${entityLabel} matches multiple subregions: ${labels}.`, 400);
    }

    return matches[0];
}

export async function syncUserDerivedSubregion(db, userId, subregionId) {
    await db.delete(userSubregions).where(eq(userSubregions.userId, userId));
    await db.insert(userSubregions).values({ userId, subregionId });
}
