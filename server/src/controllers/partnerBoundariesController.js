import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { partnerPostalCodes, users } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { canDirectlyManageUser } from '../utils/ownership.js';
import { normalizePostalCode, parsePostalCodeListInput } from '../utils/postalBoundaries.js';
import { normalizeRole } from '../utils/roles.js';
import {
    flexibleImportRowSchema,
    postalCodeListInputSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';

const partnerBoundaryUploadBodySchema = z.object({
    rows: z.array(flexibleImportRowSchema).max(5000, 'Boundary rows cannot contain more than 5000 rows per request.').optional(),
    postalCodes: postalCodeListInputSchema,
}).refine((body) => Array.isArray(body.rows) || body.postalCodes !== undefined, {
    message: 'Boundary upload requires rows or postalCodes.',
});

function clientError(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function loadPartner(db, partnerId) {
    const partner = await db.query.users.findFirst({
        where: eq(users.id, partnerId),
        columns: {
            id: true,
            username: true,
            email: true,
            name: true,
            role: true,
            managerUserId: true,
        },
    });

    if (!partner) return null;
    return {
        ...partner,
        role: normalizeRole(partner.role),
    };
}

function canManagePartnerBoundaries(actor, partner) {
    const actorRole = normalizeRole(actor?.role);
    if (!actor || !partner || normalizeRole(partner.role) !== 'partner') return false;
    if (actorRole === 'super_admin') return true;
    if (actorRole === 'partner') return actor.id === partner.id;
    if (actorRole === 'regional_admin') return canDirectlyManageUser(actor, partner);
    return false;
}

async function loadBoundaryPayload(db, partnerId) {
    const partner = await loadPartner(db, partnerId);
    if (!partner) return null;

    const rows = await db
        .select({ postalCode: partnerPostalCodes.postalCode })
        .from(partnerPostalCodes)
        .where(eq(partnerPostalCodes.partnerUserId, partnerId));

    const postalCodes = rows
        .map((row) => normalizePostalCode(row.postalCode))
        .filter(Boolean)
        .sort();

    return {
        partnerId: partner.id,
        partnerUsername: partner.username,
        partnerName: partner.name,
        managerUserId: partner.managerUserId ?? null,
        postalCodes,
        postalCodeCount: postalCodes.length,
    };
}

function extractPostalCodesFromRows(rows) {
    const errors = [];
    const values = [];

    rows.forEach((row, index) => {
        try {
            const rawValue = row?.postalCode ?? row?.['Postal Code'] ?? row?.postcode ?? row?.['Postcode'];
            const postalCode = normalizePostalCode(rawValue);
            if (!postalCode) {
                throw new Error('postalCode must be a valid 6-digit code.');
            }
            values.push(postalCode);
        } catch (err) {
            errors.push(`Row ${index + 2}: ${err.message}`);
        }
    });

    return {
        postalCodes: [...new Set(values)].sort(),
        errors,
    };
}

export const getPartnerBoundaries = async (c) => {
    try {
        const actor = c.get('user');
        const partnerId = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(partnerId)) {
            return c.json({ error: 'Invalid partner id.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const partner = await loadPartner(db, partnerId);
        if (!partner) {
            return c.json({ error: 'Partner not found.' }, 404);
        }
        if (!canManagePartnerBoundaries(actor, partner)) {
            return c.json({ error: 'Insufficient permissions to manage this partner boundary.' }, 403);
        }

        const payload = await loadBoundaryPayload(db, partnerId);
        return c.json(payload);
    } catch (err) {
        console.error('getPartnerBoundaries Error:', err);
        return c.json({ error: err.message || 'Failed to fetch partner boundaries.' }, err.status || 500);
    }
};

export const bulkUploadPartnerBoundaries = async (c) => {
    try {
        const actor = c.get('user');
        const partnerId = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(partnerId)) {
            return c.json({ error: 'Invalid partner id.' }, 400);
        }

        const body = validateRequestBody(await c.req.json(), partnerBoundaryUploadBodySchema, 'Partner boundary upload');
        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const partner = await loadPartner(db, partnerId);
        if (!partner || normalizeRole(partner.role) !== 'partner') {
            return c.json({ error: 'Partner not found.' }, 404);
        }
        if (!canManagePartnerBoundaries(actor, partner)) {
            return c.json({ error: 'Insufficient permissions to manage this partner boundary.' }, 403);
        }

        let postalCodes = [];
        let errors = [];

        if (Array.isArray(body?.rows)) {
            const extracted = extractPostalCodesFromRows(body.rows);
            postalCodes = extracted.postalCodes;
            errors = extracted.errors;
        } else if (body?.postalCodes !== undefined) {
            postalCodes = parsePostalCodeListInput(body.postalCodes);
        } else {
            return c.json({ error: 'Boundary upload requires rows or postalCodes.' }, 400);
        }

        if (errors.length > 0) {
            return c.json({
                successful: 0,
                failed: errors.length,
                assignedPostalCodes: 0,
                errors,
            }, 400);
        }

        await db.delete(partnerPostalCodes).where(eq(partnerPostalCodes.partnerUserId, partnerId));

        if (postalCodes.length > 0) {
            await db.insert(partnerPostalCodes).values(
                postalCodes.map((postalCode) => ({
                    partnerUserId: partnerId,
                    postalCode,
                }))
            );
        }

        return c.json({
            successful: postalCodes.length,
            failed: 0,
            assignedPostalCodes: postalCodes.length,
            partnerId,
            partnerUsername: partner.username,
        });
    } catch (err) {
        console.error('bulkUploadPartnerBoundaries Error:', err);
        return c.json({ error: err.message || 'Failed to update partner boundaries.' }, err.status || 500);
    }
};

export const exportPartnerBoundaries = async (c) => {
    try {
        const actor = c.get('user');
        const partnerId = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isInteger(partnerId)) {
            return c.json({ error: 'Invalid partner id.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const partner = await loadPartner(db, partnerId);
        if (!partner || normalizeRole(partner.role) !== 'partner') {
            return c.json({ error: 'Partner not found.' }, 404);
        }
        if (!canManagePartnerBoundaries(actor, partner)) {
            return c.json({ error: 'Insufficient permissions to export this partner boundary.' }, 403);
        }

        const payload = await loadBoundaryPayload(db, partnerId);
        return c.json({
            partnerId: payload.partnerId,
            partnerUsername: payload.partnerUsername,
            partnerName: payload.partnerName,
            rows: payload.postalCodes.map((postalCode) => ({
                partnerUsername: payload.partnerUsername,
                postalCode,
            })),
        });
    } catch (err) {
        console.error('exportPartnerBoundaries Error:', err);
        return c.json({ error: err.message || 'Failed to export partner boundaries.' }, err.status || 500);
    }
};
