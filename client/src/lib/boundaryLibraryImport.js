import { assertBoundaryDrawingBatchCapacity, canonicalizeBoundaryDrawing } from '../../../shared/boundaryDrawing.js';
import { createPrintAnnotationId } from './printAnnotations.js';

export function appendBoundaryDrawingCopies(existingCanonicalAnnotations, drawings) {
    assertBoundaryDrawingBatchCapacity(existingCanonicalAnnotations, drawings);
    const copies = drawings.map(raw => {
        const drawing = canonicalizeBoundaryDrawing(raw);
        return { ...drawing, ...(drawing.type === 'polygon' && !drawing.boundarySource && !drawing.controlPoints
            ? { boundaryGeometryVersion: 1 } : {}), id: createPrintAnnotationId(), isShared: false };
    });
    return [...existingCanonicalAnnotations, ...copies];
}

/** One explicit confirmation owns one append. Retrying a failed save never imports twice. */
export function createBoundaryImportOperation({ drawings, replaceAnnotations, flushPendingChanges, isCurrent = () => true }) {
    assertBoundaryDrawingBatchCapacity([], drawings);
    const frozen = drawings.map(canonicalizeBoundaryDrawing);
    let appended = false, inFlight = null, result = null;
    const check = () => { if (!isCurrent()) throw new Error('Account or map changed. Reopen Boundary Library.'); };
    const run = async () => {
        check();
        if (!appended) {
            if (!frozen.length) return [];
            replaceAnnotations(current => {
                check();
                const next = appendBoundaryDrawingCopies(current, frozen);
                result = next.slice(current.length);
                appended = true;
                return next;
            });
            if (!appended) throw new Error('Map drawings are not ready. Reopen Boundary Library.');
        }
        if (!await flushPendingChanges()) throw new Error('Boundaries were added once. Retry saving these drawings or use Undo to remove this import.');
        check();
        return result;
    };
    return { apply() { if (!inFlight) inFlight = run().finally(() => { inFlight = null; }); return inFlight; }, get appended() { return appended; } };
}
