import { and, eq } from 'drizzle-orm';
import { myMapAssets, myMapPersonalPlaceLinks, myMapPrintAnnotationDocuments } from '../db/schema.js';

export const PRINT_ANNOTATION_MAX_RESOURCE_LINKS = 200;
export const PRINT_ANNOTATION_MAX_TOTAL_RESOURCE_LINKS = 2000;

const key = (link) => `${link?.type}:${link?.id}`;

export async function loadMapAnnotationResourceKeys(db, userId, mapId) {
    const [assets, places] = await Promise.all([
        db.query.myMapAssets.findMany({ where: eq(myMapAssets.mapId, mapId), columns: { resourceType: true, resourceId: true } }),
        db.query.myMapPersonalPlaceLinks.findMany({ where: eq(myMapPersonalPlaceLinks.mapId, mapId),
            with: { personalPlace: { columns: { id: true, userId: true } } } }),
    ]);
    return new Set([
        ...assets.filter((asset) => ['hard', 'soft'].includes(asset.resourceType)).map((asset) => `${asset.resourceType}:${asset.resourceId}`),
        ...places.filter((link) => link.personalPlace?.userId === userId).map((link) => `personal_place:${link.personalPlaceId}`),
    ]);
}

export function detachInvalidAnnotationResourceLinks(annotations, allowedKeys) {
    return annotations.map((annotation) => {
        if (!Array.isArray(annotation.resourceLinks)) {
            if (annotation.resourceGlowColor === undefined) return annotation;
            const { resourceGlowColor, ...rest } = annotation;
            void resourceGlowColor;
            return rest;
        }
        const resourceLinks = annotation.resourceLinks.filter((link) => allowedKeys.has(key(link)));
        if (resourceLinks.length === annotation.resourceLinks.length && resourceLinks.length) return annotation;
        const { resourceLinks: unusedLinks, resourceBehaviour, resourceGlowColor, ...rest } = annotation;
        void unusedLinks;
        return resourceLinks.length ? { ...rest, resourceLinks, ...(resourceBehaviour ? { resourceBehaviour } : {}),
            ...(resourceGlowColor ? { resourceGlowColor } : {}) } : rest;
    });
}

// Resource removal must never overwrite an annotation edit from another window.
// A competing edit wins; the next owner read still projects stale links out.
export async function detachAnnotationResourceFromMap(db, mapId, type, id) {
    const document = await db.query.myMapPrintAnnotationDocuments.findFirst({ where: eq(myMapPrintAnnotationDocuments.mapId, mapId) });
    if (!Array.isArray(document?.annotations) || !document.annotations.some((annotation) =>
        annotation.resourceLinks?.some((link) => link.type === type && link.id === id))) return;
    const annotations = document.annotations.map((annotation) => {
        if (!Array.isArray(annotation.resourceLinks)) return annotation;
        const allowedKeys = new Set(annotation.resourceLinks.filter((link) => link.type !== type || link.id !== id).map(key));
        return detachInvalidAnnotationResourceLinks([annotation], allowedKeys)[0];
    });
    await db.update(myMapPrintAnnotationDocuments).set({ annotations, revision: Number(document.revision) + 1, updatedAt: new Date() })
        .where(and(eq(myMapPrintAnnotationDocuments.mapId, mapId), eq(myMapPrintAnnotationDocuments.revision, document.revision)));
}
