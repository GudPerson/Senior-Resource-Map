import { canonicalizeBoundaryDrawing } from '../../../shared/boundaryDrawing.js';

export function boundaryLibraryKey(id) {
    const key = String(id);
    if (!/^[1-9]\d*$/.test(key) || !Number.isSafeInteger(Number(key)) || Number(key) > 2147483647) {
        throw new Error('Boundary Library item is invalid.');
    }
    return key;
}
export function updateBoundaryLibrarySelection(selectedIds, visibleIds, action) {
    const selected = [...new Set(selectedIds.map(boundaryLibraryKey))];
    const visible = [...new Set(visibleIds.map(boundaryLibraryKey))];
    if (action === 'select-all-visible') return [...new Set([...selected, ...visible])];
    if (action === 'clear-visible') return selected.filter(id => !visible.includes(id));
    if (action && typeof action === 'object' && 'toggleId' in action) {
        const id = boundaryLibraryKey(action.toggleId);
        return selected.includes(id) ? selected.filter(key => key !== id) : [...selected, id];
    }
    throw new Error('Unknown Boundary Library selection action.');
}
export function resolveSelectedBoundarySnapshots(selectedIds, detailsById) {
    return [...new Set(selectedIds.map(boundaryLibraryKey))].map(key => {
        const detail = detailsById instanceof Map ? detailsById.get(key) : detailsById[key];
        if (!detail || boundaryLibraryKey(detail.id) !== key || !Number.isInteger(detail.revision) || detail.revision < 1) {
            throw new Error('A selected boundary is unavailable. Refresh the library and select it again.');
        }
        return { ...detail, id: Number(key), drawing: canonicalizeBoundaryDrawing(detail.drawing) };
    });
}
