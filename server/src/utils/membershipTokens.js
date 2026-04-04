import { sign, verify } from 'hono/jwt';

import { getSessionSecret } from './sessionAuth.js';

const MEMBERSHIP_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function createMembershipLinkToken(hardAssetId, c) {
    return sign({
        type: 'membership_link',
        hardAssetId,
        exp: Math.floor(Date.now() / 1000) + MEMBERSHIP_TOKEN_TTL_SECONDS,
    }, getSessionSecret(c), 'HS256');
}

export async function verifyMembershipLinkToken(token, c) {
    const payload = await verify(token, getSessionSecret(c), 'HS256');
    if (payload?.type !== 'membership_link' || !Number.isInteger(payload?.hardAssetId)) {
        const error = new Error('Invalid membership link token.');
        error.status = 400;
        throw error;
    }
    return payload;
}

