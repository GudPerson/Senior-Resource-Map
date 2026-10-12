import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { myMaps } from '../db/schema.js';
import { assertPersonalPlacesUser } from './personalPlacesController.js';
import { resolvePersonalPlaceImportLocation } from '../utils/personalPlaceImportLookup.js';

export function createMyMapPersonalPlaceImportLookupHandler(options = {}) {
    return async (c) => {
        c.header('Cache-Control', 'no-store');
        try {
            const user = c.get('user');
            assertPersonalPlacesUser(user);
            const id = c.req.param('id');
            const mapId = Number(id);
            if (!/^[1-9]\d*$/.test(id || '') || !Number.isSafeInteger(mapId)
                || !Number.isSafeInteger(user.id) || user.id <= 0) {
                return c.json({ error: 'A valid map and account are required.' }, 400);
            }
            const postalCode = c.req.query('postalCode') || '';
            if (!/^\d{6}$/.test(postalCode)) {
                return c.json({ error: 'Postal Code must contain exactly six digits.', code: 'invalid_postal_code' }, 400);
            }
            const db = (options.dbForContext || ((context) => getDb(context.env)))(c);
            const ownedMap = await db.query.myMaps.findFirst({
                where: and(eq(myMaps.id, mapId), eq(myMaps.userId, user.id)), columns: { id: true },
            });
            if (!ownedMap) return c.json({ error: 'Map not found' }, 404);
            const location = await (options.resolveLocation || resolvePersonalPlaceImportLocation)(postalCode, { signal: c.req.raw.signal });
            return c.json({ location });
        } catch (error) {
            const status = [400, 403, 404].includes(error.status) ? error.status : 503;
            return c.json({ error: status === 503
                ? 'The location service is temporarily unavailable. We could not finish checking this postal code. Try again later.'
                : error.message,
                code: status === 503 ? 'postal_lookup_unavailable' : error.code || 'location_lookup_failed' }, status);
        }
    };
}

export const getMyMapPersonalPlaceImportLocation = createMyMapPersonalPlaceImportLookupHandler();
