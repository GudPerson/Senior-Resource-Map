import { eq, inArray } from 'drizzle-orm';
import { partnerPostalCodes } from '../db/schema.js';
import { normalizePostalCode, parsePostalCodeListInput } from './postalBoundaries.js';

export async function loadPartnerBoundarySet(db, partnerUserId) {
    if (!partnerUserId) return new Set();

    const rows = await db
        .select({ postalCode: partnerPostalCodes.postalCode })
        .from(partnerPostalCodes)
        .where(eq(partnerPostalCodes.partnerUserId, partnerUserId));

    return new Set(rows.map((row) => normalizePostalCode(row.postalCode)).filter(Boolean));
}

export async function loadPartnerBoundarySets(db, partnerUserIds) {
    const ids = Array.from(new Set((partnerUserIds || []).map((value) => Number.parseInt(String(value), 10)).filter(Number.isInteger)));
    if (ids.length === 0) return new Map();

    const rows = await db
        .select({
            partnerUserId: partnerPostalCodes.partnerUserId,
            postalCode: partnerPostalCodes.postalCode,
        })
        .from(partnerPostalCodes)
        .where(inArray(partnerPostalCodes.partnerUserId, ids));

    const grouped = new Map();
    for (const id of ids) grouped.set(id, new Set());
    for (const row of rows) {
        const postalCode = normalizePostalCode(row.postalCode);
        if (!postalCode) continue;
        if (!grouped.has(row.partnerUserId)) grouped.set(row.partnerUserId, new Set());
        grouped.get(row.partnerUserId).add(postalCode);
    }
    return grouped;
}

export async function syncPartnerBoundaryPostalCodes(db, partnerUserId, rawPostalCodes) {
    const postalCodes = parsePostalCodeListInput(rawPostalCodes);
    await db.delete(partnerPostalCodes).where(eq(partnerPostalCodes.partnerUserId, partnerUserId));
    if (postalCodes.length > 0) {
        await db.insert(partnerPostalCodes).values(
            postalCodes.map((postalCode) => ({ partnerUserId, postalCode }))
        );
    }
    return postalCodes;
}

export async function resolvePartnerBoundaryMembership(db, partnerUserId, rawPostalCode) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode || !partnerUserId) return false;
    const boundarySet = await loadPartnerBoundarySet(db, partnerUserId);
    return boundarySet.has(postalCode);
}

export async function resolveStandardAudiencePartnerIds(db, user) {
    const partnerIds = new Set();
    const postalCode = normalizePostalCode(user?.postalCode);
    const managerUserId = Number.parseInt(String(user?.managerUserId ?? ''), 10);

    if (!postalCode || !Number.isInteger(managerUserId)) {
        return partnerIds;
    }

    const boundarySet = await loadPartnerBoundarySet(db, managerUserId);
    if (boundarySet.has(postalCode)) {
        partnerIds.add(managerUserId);
    }

    return partnerIds;
}
