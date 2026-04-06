import { eq } from 'drizzle-orm';
import { subregionPostalCodes, subregions, userSubregions } from '../db/schema.js';
import { normalizePostalCode } from './postalBoundaries.js';
import { normalizeRole } from './roles.js';

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

function sortSubregionMatches(matches) {
    return [...matches].sort((left, right) => {
        const leftCode = String(left.subregionCode || '').toLowerCase();
        const rightCode = String(right.subregionCode || '').toLowerCase();
        if (leftCode !== rightCode) return leftCode.localeCompare(rightCode);

        const leftName = String(left.name || '').toLowerCase();
        const rightName = String(right.name || '').toLowerCase();
        if (leftName !== rightName) return leftName.localeCompare(rightName);

        return Number(left.id || 0) - Number(right.id || 0);
    });
}

export function selectPreferredSubregionMatch(matches, scopedSubregionIds = null) {
    const ordered = sortSubregionMatches(matches);
    if (!ordered.length) return null;

    const scopedIds = Array.isArray(scopedSubregionIds) && scopedSubregionIds.length > 0
        ? new Set(scopedSubregionIds.map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger))
        : null;

    if (!scopedIds) return ordered[0];
    return ordered.find((match) => scopedIds.has(Number(match.id))) || null;
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

export async function resolveWritableSubregionByPostal(db, rawPostalCode, actor, entityLabel = 'Postal code') {
    const matches = await findMatchingSubregionsByPostal(db, rawPostalCode);

    if (matches.length === 0) {
        throw clientError(`${entityLabel} does not match any configured subregion boundary.`, 400);
    }

    const actorRole = normalizeRole(actor?.role);
    const scopedSubregionIds = actorRole === 'super_admin'
        ? null
        : Array.isArray(actor?.subregionIds)
            ? actor.subregionIds
            : [];

    const selected = selectPreferredSubregionMatch(matches, scopedSubregionIds);
    if (!selected) {
        const labels = sortSubregionMatches(matches).map((match) => match.subregionCode || match.name || match.id).join(', ');
        throw clientError(`${entityLabel} matches multiple subregions outside your allowed scope: ${labels}.`, 403);
    }

    return {
        subregion: selected,
        matches: sortSubregionMatches(matches),
        ambiguous: matches.length > 1,
    };
}

export async function syncUserDerivedSubregion(db, userId, subregionId) {
    await db.delete(userSubregions).where(eq(userSubregions.userId, userId));
    await db.insert(userSubregions).values({ userId, subregionId });
}
