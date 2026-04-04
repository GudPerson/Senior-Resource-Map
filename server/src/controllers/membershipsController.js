import { and, eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';
import { hardAssets, userAssetMemberships } from '../db/schema.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import { verifyMembershipLinkToken } from '../utils/membershipTokens.js';
import { normalizeRole } from '../utils/roles.js';

export const redeemMembershipLink = async (c) => {
    try {
        const user = c.get('user');
        if (!user?.id || normalizeRole(user.role) === 'guest') {
            return c.json({ error: 'Only authenticated non-guest users can join a place.' }, 403);
        }

        const body = await c.req.json();
        if (!body?.token) {
            return c.json({ error: 'Membership token is required.' }, 400);
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);
        const payload = await verifyMembershipLinkToken(String(body.token), c);
        const hardAssetId = payload.hardAssetId;

        const place = await db.query.hardAssets.findFirst({
            where: and(
                eq(hardAssets.id, hardAssetId),
                eq(hardAssets.isDeleted, false),
            ),
            columns: {
                id: true,
                name: true,
                address: true,
                subCategory: true,
                logoUrl: true,
            },
        });

        if (!place) {
            return c.json({ error: 'This membership link is no longer valid.' }, 404);
        }

        const existing = await db.query.userAssetMemberships.findFirst({
            where: and(
                eq(userAssetMemberships.userId, user.id),
                eq(userAssetMemberships.hardAssetId, hardAssetId),
            ),
            columns: {
                id: true,
            },
        });

        if (existing) {
            await db.update(userAssetMemberships).set({
                joinMethod: 'QR_CODE',
                status: 'ACTIVE',
                updatedAt: new Date(),
            }).where(eq(userAssetMemberships.id, existing.id));
        } else {
            await db.insert(userAssetMemberships).values({
                userId: user.id,
                hardAssetId,
                joinMethod: 'QR_CODE',
                status: 'ACTIVE',
            });
        }

        return c.json({
            success: true,
            membership: {
                hardAssetId,
                joinMethod: 'QR_CODE',
                status: 'ACTIVE',
            },
            place,
        });
    } catch (err) {
        console.error('redeemMembershipLink Error:', err);
        return c.json({ error: err.message || 'Failed to link membership' }, err.status || 500);
    }
};

