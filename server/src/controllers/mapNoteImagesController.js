import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { myMapAssets, myMapPersonalPlaceLinks, myMaps, userPersonalPlaces } from '../db/schema.js';
import { requireMapAnnotationMediaOwner } from './mapAnnotationMediaController.js';
import { getSharedMapNoteImageDirectory } from './sharedMapsController.js';
import { createMapNoteImageRepository } from '../utils/mapNoteImages.js';
import { createPrivateMapMediaRepository, MapMediaError } from '../utils/privateMapMedia.js';
import { getDirectoryMapNoteImages } from '../../../shared/mapNoteImages.js';

const id = value => /^[1-9]\d*$/.test(value || '') && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
const missing = () => new MapMediaError('Map note image not found.', 404, 'map_media_not_found');

export function createMapNoteImageHandlers({ dbForContext = c => getDb(c.env),
    bucketForContext = c => c.env?.HELP_CMS_BUCKET,
    sharedDirectory = getSharedMapNoteImageDirectory } = {}) {
    const handler = action => async c => {
        c.header('Cache-Control', 'private, no-store');
        c.header('Vary', 'Cookie, Authorization, X-Session-Token');
        c.header('X-Content-Type-Options', 'nosniff');
        try { return await action(c); }
        catch (error) {
            return c.json({ error: error instanceof MapMediaError ? error.message : 'Map note images are unavailable. Try again later.',
                code: error instanceof MapMediaError ? error.code : 'map_media_unavailable' },
            error instanceof MapMediaError ? error.status : error?.status === 404 ? 404 : 503);
        }
    };
    async function ownedResource(c) {
        const db = dbForContext(c), user = c.get('user'), mapId = id(c.req.param('id'));
        await requireMapAnnotationMediaOwner(db, user, mapId);
        const type = c.req.param('resourceType'), resourceId = id(c.req.param('resourceId'));
        if (!['hard', 'soft', 'personal_place'].includes(type) || !Number.isSafeInteger(resourceId)) throw missing();
        const personal = type === 'personal_place';
        if (personal && !await db.query.userPersonalPlaces.findFirst({ where: and(eq(userPersonalPlaces.id, resourceId),
            eq(userPersonalPlaces.userId, user.id)), columns: { id: true } })) throw missing();
        const asset = personal
            ? await db.query.myMapPersonalPlaceLinks.findFirst({ where: and(eq(myMapPersonalPlaceLinks.mapId, mapId),
                eq(myMapPersonalPlaceLinks.personalPlaceId, resourceId)), columns: { id: true } })
            : await db.query.myMapAssets.findFirst({ where: and(eq(myMapAssets.mapId, mapId),
                eq(myMapAssets.resourceType, type), eq(myMapAssets.resourceId, resourceId)), columns: { id: true } });
        if (!asset) throw missing();
        return { mapId, membershipKey: `${personal ? 'personal' : 'asset'}:${asset.id}`, personal,
            repo: createMapNoteImageRepository(bucketForContext(c), user.id) };
    }
    return {
        read: handler(async c => {
            const { mapId, membershipKey, repo } = await ownedResource(c);
            const { document } = await repo.read(mapId);
            return c.json({ revision: document.revision, storage: await repo.getUsage(),
                updatedAt: document.updatedAt || null,
                images: document.entries.find(entry => entry.membershipKey === membershipKey)?.images || [] });
        }),
        replace: handler(async c => {
            const { mapId, membershipKey, personal, repo } = await ownedResource(c);
            let body;
            try { body = await c.req.json(); } catch { throw new MapMediaError('Choose valid note images.'); }
            if (personal && body?.images?.some(image => image?.isShared)) throw new MapMediaError('Personal place images stay private.');
            const saved = await repo.replace(mapId, membershipKey, body);
            return c.json({ ...saved, storage: await repo.getUsage() });
        }),
        sharedRead: handler(async c => {
            const db = dbForContext(c), token = c.req.param('token');
            const directory = await sharedDirectory(db, token, c.get('user'));
            const metadata = getDirectoryMapNoteImages(directory).find(image => image.isShared && image.assetId === c.req.param('assetId'));
            if (!metadata) throw missing();
            const map = await db.query.myMaps.findFirst({ where: and(eq(myMaps.shareToken, token), eq(myMaps.isShared, true)), columns: { userId: true } });
            if (!map) throw missing();
            const { object, metadata: stored } = await createPrivateMapMediaRepository(bucketForContext(c), map.userId).getAsset(metadata.assetId);
            if (stored.size !== metadata.size || stored.mimeType !== metadata.mimeType
                || stored.width !== metadata.width || stored.height !== metadata.height) throw missing();
            c.header('Content-Type', stored.mimeType);
            c.header('Content-Length', String(stored.size));
            c.header('Content-Disposition', 'inline');
            return c.body(object.body);
        }),
    };
}

export const { read: getMapNoteImages, replace: putMapNoteImages, sharedRead: getSharedMapNoteImage } = createMapNoteImageHandlers();
