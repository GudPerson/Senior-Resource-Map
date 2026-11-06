import { normalizeAnnotationGroupName } from '../../../shared/annotationGroups.js';
import { PRINT_MAP_MAX_HIDDEN_LAYER_KEYS } from './printMapState.js';

export function annotationLayerType(annotation) {
    return annotation.boundarySource === 'kml' ? 'boundary' : annotation.type || 'other';
}

export function filterAnnotationLayers(catalog, { query = '', type = 'all', group = 'all' } = {}) {
    const search = String(query).trim().toLocaleLowerCase();
    return catalog.filter(annotation => {
        const name = normalizeAnnotationGroupName(annotation.groupName);
        return (type === 'all' || annotationLayerType(annotation) === type)
            && (group === 'all' || (group === 'ungrouped' ? !name : group === `group:${name}`))
            && (!search || `${annotation.label || ''} ${name} ${annotationLayerType(annotation)}`.toLocaleLowerCase().includes(search));
    });
}

export function annotationVisibilitySummary(matches, hiddenIds) {
    const hidden = new Set(hiddenIds);
    const visible = matches.filter(annotation => !hidden.has(annotation.id)).length;
    return { visible, total: matches.length, checked: matches.length > 0 && visible === matches.length,
        mixed: visible > 0 && visible < matches.length };
}

export function annotationSelectionSummary(matches, selectedIds) {
    const selected = new Set(selectedIds);
    const count = matches.filter(annotation => selected.has(annotation.id)).length;
    return { selected: count, total: matches.length, checked: matches.length > 0 && count === matches.length,
        mixed: count > 0 && count < matches.length };
}

export function setAnnotationMatchesSelected(selectedIds, matches, selected) {
    const next = new Set(selectedIds);
    for (const { id } of matches) {
        if (selected) next.add(id);
        else next.delete(id);
    }
    return [...next];
}

export function reconcileAnnotationSelection(selectedIds, fullCatalog, ready) {
    if (!ready) return selectedIds;
    const active = new Set(fullCatalog.map(annotation => annotation.id));
    const next = [...new Set(selectedIds)].filter(id => active.has(id));
    return next.length === selectedIds.length && next.every((id, index) => id === selectedIds[index]) ? selectedIds : next;
}

export function selectedAnnotationLayers(fullCatalog, selectedIds) {
    const selected = new Set(selectedIds);
    return fullCatalog.filter(annotation => selected.has(annotation.id));
}

export function groupAnnotationLayers(fullCatalog) {
    const groups = new Map();
    for (const annotation of fullCatalog) {
        const name = normalizeAnnotationGroupName(annotation.groupName);
        const key = name ? `group:${name}` : 'ungrouped';
        if (!groups.has(key)) groups.set(key, { key, name, items: [] });
        groups.get(key).items.push(annotation);
    }
    return [...groups.values()].sort((left, right) => left.name && !right.name ? -1
        : !left.name && right.name ? 1 : left.name.localeCompare(right.name));
}

export function setAnnotationMatchesVisible(hiddenIds, matches, visible) {
    const next = new Set(hiddenIds);
    for (const { id } of matches) {
        if (visible) next.delete(id);
        else next.add(id);
    }
    return [...next];
}

export function planAnnotationVisibilityChange(hiddenIds, matches, visible) {
    const next = setAnnotationMatchesVisible(hiddenIds, matches, visible);
    return next.length <= PRINT_MAP_MAX_HIDDEN_LAYER_KEYS
        ? { allowed: true, hiddenIds: next }
        : { allowed: false, hiddenIds: null };
}

export function cleanOldAnnotationVisibility(hiddenIds, fullCatalog) {
    const activeIds = new Set(fullCatalog.map(annotation => annotation.id));
    return hiddenIds.filter(id => activeIds.has(id));
}

export function assignAnnotationGroup(annotations, ids, value) {
    const included = new Set(ids);
    const groupName = normalizeAnnotationGroupName(value);
    return annotations.map(annotation => {
        if (!included.has(annotation.id) || normalizeAnnotationGroupName(annotation.groupName) === groupName) return annotation;
        const { groupName: previous, ...rest } = annotation;
        void previous;
        return groupName ? { ...rest, groupName } : rest;
    });
}

export function isCurrentAnnotationGroupOperation(operation, { mapId, annotations, ownerReady }) {
    return Boolean(ownerReady && operation && operation.mapId === mapId && operation.expectedDocument
        && operation.expectedDocument === JSON.stringify(annotations));
}

export function canUndoAnnotationGroupOperation(operation, context) {
    return Boolean(context.canUndo && !operation?.reverted && isCurrentAnnotationGroupOperation(operation, context));
}

export function canRetryAnnotationGroupOperation(operation, context) {
    return Boolean(operation?.failed && isCurrentAnnotationGroupOperation(operation, context));
}
