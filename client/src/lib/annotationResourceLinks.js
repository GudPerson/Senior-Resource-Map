export const ANNOTATION_RESOURCE_LINK_LIMIT = 200;
export const ANNOTATION_RESOURCE_TOTAL_LINK_LIMIT = 2000;
export const ANNOTATION_RESOURCE_PULSE_MS = 1800;
const RESOURCE_TYPES = new Set(['hard', 'soft', 'personal_place']);
const BEHAVIOURS = new Set(['appear', 'pulse', 'highlight']);

export function annotationResourceKey(link) {
    return RESOURCE_TYPES.has(link?.type) && Number.isSafeInteger(link?.id) && link.id > 0
        ? `${link.type}:${link.id}` : '';
}

function uniqueResourceLinks(value, limit = Infinity) {
    const links = new Map();
    for (const link of Array.isArray(value) ? value : []) {
        const key = annotationResourceKey(link);
        if (!key || links.has(key)) continue;
        links.set(key, { type: link.type, id: link.id });
        if (links.size === limit) break;
    }
    return [...links.values()];
}

export function normalizeAnnotationResourceLinks(value) {
    return uniqueResourceLinks(value, ANNOTATION_RESOURCE_LINK_LIMIT);
}

export function getAnnotationResourceLinkBudget(annotations, annotationId) {
    const otherLinkCount = annotations.filter(annotation => annotation.id !== annotationId)
        .reduce((total, annotation) => total + normalizeAnnotationResourceLinks(annotation.resourceLinks).length, 0);
    return Math.max(0, Math.min(ANNOTATION_RESOURCE_LINK_LIMIT, ANNOTATION_RESOURCE_TOTAL_LINK_LIMIT - otherLinkCount));
}

export function normalizeAnnotationResourceBehaviour(value) {
    return BEHAVIOURS.has(value) ? value : 'highlight';
}

export function resourceLinkForRow(row) {
    const link = { type: row?.resourceType, id: row?.resourceId ?? row?.personalPlaceId };
    return annotationResourceKey(link) ? link : null;
}

export function resourceLinksForGroup(group) {
    const rows = [...(group?.rows || []), ...(group?.nestedPlaces || []).flatMap((place) => place?.rows || [])];
    return uniqueResourceLinks(rows.map(resourceLinkForRow));
}

export function resourceLinksForPlaceKey(presentation, placeKey) {
    const key = String(placeKey || '');
    if (!key) return [];
    const groups = [...(presentation?.displayGroups || []), ...(presentation?.mappedGroups || []), ...(presentation?.mobileDisplayGroups || [])];
    const candidates = groups.flatMap((group) => [group, ...(group?.nestedPlaces || [])]);
    const exact = candidates.filter((group) => String(group?.placeKey || '') === key);
    const matching = exact.length ? exact : candidates.filter((group) => (group?.memberPlaceKeys || []).some((member) => String(member) === key));
    return uniqueResourceLinks(matching.flatMap(resourceLinksForGroup));
}

// The source resource identity remains stable across card grouping, host changes,
// category ordering and map duplication. Never persist a presentation placeKey.
export function buildAnnotationResourceCatalog(directory) {
    const members = [...(directory?.assets || []), ...(directory?.personalPlaces || [])];
    const rows = (directory?.places || []).flatMap((place) => (place?.rows || []).map((row) => ({ row, placeKey: place.placeKey })));
    const allowed = new Map(members.map((row) => {
        const link = resourceLinkForRow(row);
        return [annotationResourceKey(link), link];
    }).filter(([key]) => key));
    const catalog = new Map();
    for (const { row, placeKey } of rows) {
        const link = resourceLinkForRow(row), key = annotationResourceKey(link);
        if (!allowed.has(key)) continue;
        const existing = catalog.get(key);
        if (existing) {
            if (placeKey && !existing.placeKeys.includes(placeKey)) existing.placeKeys.push(placeKey);
            continue;
        }
        catalog.set(key, { key, link, name: String(row.name || 'Saved resource'),
            kind: link.type === 'personal_place' ? 'Personal place' : link.type === 'hard' ? 'Place' : 'Programme/service',
            unavailable: row.status === 'unavailable', placeKeys: placeKey ? [placeKey] : [] });
    }
    return [...catalog.values()];
}

export function buildAnnotationLinkIndex(annotations = [], catalog = [], visibleAnnotationIds = null) {
    const resources = new Map(catalog.map((item) => [item.key, item]));
    const visible = visibleAnnotationIds === null ? null : new Set(visibleAnnotationIds);
    const byAnnotation = new Map(), byResource = new Map();
    for (const annotation of annotations) {
        if (!annotation?.id || (visible && !visible.has(annotation.id))) continue;
        const resourceLinks = normalizeAnnotationResourceLinks(annotation.resourceLinks)
            .filter((link) => resources.has(annotationResourceKey(link)));
        if (!resourceLinks.length) continue;
        byAnnotation.set(annotation.id, { annotation, resourceLinks,
            resourceBehaviour: normalizeAnnotationResourceBehaviour(annotation.resourceBehaviour) });
        for (const link of resourceLinks) {
            const key = annotationResourceKey(link);
            byResource.set(key, [...(byResource.get(key) || []), annotation.id]);
        }
    }
    return { byAnnotation, byResource, resources };
}

export function resolveAnnotationResourceActivation(index, selection) {
    if (selection?.origin === 'annotation') {
        const linked = index.byAnnotation.get(selection.annotationId);
        return linked ? { annotationIds: [selection.annotationId], resourceKeys: linked.resourceLinks.map(annotationResourceKey) }
            : { annotationIds: [], resourceKeys: [] };
    }
    const resourceKeys = uniqueResourceLinks(selection?.resourceLinks)
        .map(annotationResourceKey).filter((key) => index.byResource.has(key));
    const matchingIds = new Set(resourceKeys.flatMap((key) => index.byResource.get(key)));
    return { annotationIds: [...index.byAnnotation.keys()].filter((id) => matchingIds.has(id)), resourceKeys };
}

export function buildAnnotationResourceEffects({ annotations, index, selection, visibleAnnotationIds = null,
    enabled = true, pulseActive = false, reducedMotion = false } = {}) {
    const resolved = resolveAnnotationResourceActivation(index, enabled ? selection : null);
    const activeIds = new Set(resolved.annotationIds);
    const pulseIds = new Set(pulseActive && !reducedMotion
        ? resolved.annotationIds.filter((id) => index.byAnnotation.get(id)?.resourceBehaviour === 'pulse') : []);
    const allowed = visibleAnnotationIds === null ? null : new Set(visibleAnnotationIds);
    const visibleIds = new Set(annotations.filter((annotation) => (!allowed || allowed.has(annotation.id))
        && (index.byAnnotation.get(annotation.id)?.resourceBehaviour !== 'appear' || activeIds.has(annotation.id)))
        .map((annotation) => annotation.id));
    return { activeIds, pulseIds, visibleIds, resourceKeys: resolved.resourceKeys };
}

export function annotationResourceCardState(group, interaction) {
    const links = resourceLinksForGroup(group), keys = links.map(annotationResourceKey);
    return { links,
        canActivate: Boolean(interaction?.onActivateResources && keys.some((key) => interaction.taggedResourceKeys?.has(key))),
        active: keys.some((key) => interaction?.activeResourceKeys?.has(key)),
        pulsing: keys.some((key) => interaction?.pulsingResourceKeys?.has(key)) };
}
