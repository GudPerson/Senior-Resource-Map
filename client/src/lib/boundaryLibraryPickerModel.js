import { canonicalizeBoundaryDrawing } from '../../../shared/boundaryDrawing.js';
import { boundaryLibraryKey, resolveSelectedBoundarySnapshots } from './boundaryLibrarySelection.js';

const assertCurrent = isCurrent => { if (!isCurrent()) throw new Error('Account or map changed. Reopen Boundary Library.'); };
const assertLimit = (count, maximum) => {
    if (count > maximum) throw new Error(`Selection limit is ${maximum} boundaries. Narrow the search or select fewer boundaries.`);
};
export function createBoundaryOwnerScope(owner) {
    let value = owner, generation = 0;
    return {
        setOwner(next) { if (next !== value) { value = next; generation++; } },
        capture: () => generation,
        isCurrent: token => token === generation,
    };
}
export async function collectMatchingBoundaryIds(list, filters, { maxSelection = 256, isCurrent = () => true } = {}) {
    const ids = new Set(), cursors = new Set();
    let cursor;
    // Even malformed repeating/empty pages cannot cause unbounded metadata requests.
    for (let page = 0; page < 257; page++) {
        assertCurrent(isCurrent);
        const response = await list({ ...filters, limit: 100, ...(cursor ? { cursor } : {}) });
        assertCurrent(isCurrent);
        if (!Array.isArray(response?.items)) throw new Error('Boundary Library could not be read.');
        for (const item of response.items) ids.add(boundaryLibraryKey(item.id));
        assertLimit(ids.size, maxSelection);
        if (response.nextCursor === null || response.nextCursor === undefined) return [...ids];
        if (cursors.has(response.nextCursor)) throw new Error('Boundary Library pagination changed. Refresh and try again.');
        cursor = response.nextCursor; cursors.add(cursor);
    }
    throw new Error('Boundary Library pagination limit reached. Narrow the search.');
}
export async function loadBoundarySnapshots(selectedIds, getDetail, {
    maxSelection = 256, maxPoints = 20000, maxBytes = 2 * 1024 * 1024, isCurrent = () => true, validateBatch = null,
} = {}) {
    const keys = [...new Set(selectedIds.map(boundaryLibraryKey))];
    assertLimit(keys.length, maxSelection);
    const details = {}, loaded = [];
    let points = 0, bytes = 0;
    for (const key of keys) {
        assertCurrent(isCurrent);
        const detail = await getDetail(Number(key));
        assertCurrent(isCurrent);
        // Count raw stored arrays before cloning/canonical projection.
        points += (detail?.drawing?.points?.length || 0) + (detail?.drawing?.controlPoints?.length || 0);
        if (points > maxPoints) throw new Error('Selected boundaries exceed the batch budget. Select fewer boundaries.');
        bytes += new TextEncoder().encode(JSON.stringify(detail)).byteLength;
        if (bytes > maxBytes) throw new Error('Selected boundaries exceed the batch budget. Select fewer boundaries.');
        const [snapshot] = resolveSelectedBoundarySnapshots([key], { [key]: detail });
        details[key] = snapshot; loaded.push(snapshot);
        validateBatch?.(loaded);
    }
    return resolveSelectedBoundarySnapshots(keys, details);
}

const sourceReviewError = () => Object.assign(new Error('The saved boundary changed. Review the current saved boundary before saving a new snapshot.'),
    { code: 'BOUNDARY_SOURCE_REVIEW_REQUIRED' });
const definitiveBoundaryRefusal = error => error?.status >= 400 && error.status < 500
    && ['BOUNDARY_SOURCE_STALE', 'BOUNDARY_SOURCE_UNSUPPORTED', 'BOUNDARY_NOT_FOUND',
        'BOUNDARY_INVALID_REQUEST', 'BOUNDARY_ACCOUNT_REQUIRED', 'BOUNDARY_REQUEST_CONFLICT'].includes(error.code);

/** Explicit review reads only: it never replaces or saves the local map document. */
export async function readBoundaryLibrarySource({ source, readSavedDocument, isCurrent = () => true }) {
    assertCurrent(isCurrent);
    const saved = await readSavedDocument();
    assertCurrent(isCurrent);
    const annotation = saved?.annotations?.find(item => item.id === source.annotationId);
    if (!Number.isInteger(saved?.revision) || saved.revision < 0 || !annotation) throw sourceReviewError();
    try { return { drawing: canonicalizeBoundaryDrawing(annotation), revision: saved.revision }; }
    catch { throw sourceReviewError(); }
}

/** Freeze the accepted payload once. Unknown ACK retries use the same source revision and request ID. */
export function createBoundaryLibrarySaveOperation({ requestId, metadata, source, selectedDrawing, flushPendingChanges,
    readSavedDocument, create, isCurrent = () => true }) {
    const frozenMetadata = { name: String(metadata.name || '').trim(), groupName: String(metadata.groupName || '').trim() || null };
    const frozenSource = { mapId: source.mapId, annotationId: source.annotationId };
    const selectedSnapshot = JSON.stringify(canonicalizeBoundaryDrawing(selectedDrawing));
    let payload = null, inFlight = null, result = null, reviewError = null;
    const run = async () => {
        assertCurrent(isCurrent);
        if (result) return result;
        if (reviewError) throw reviewError;
        if (!payload) {
            if (!frozenMetadata.name) throw new Error('Enter a library name.');
            if (!await flushPendingChanges()) throw new Error('Save the map drawings successfully before saving to Boundary Library.');
            assertCurrent(isCurrent);
            const saved = await readBoundaryLibrarySource({ source: frozenSource, readSavedDocument, isCurrent });
            if (JSON.stringify(saved.drawing) !== selectedSnapshot) throw sourceReviewError();
            payload = { requestId, ...frozenMetadata, source: { ...frozenSource, revision: saved.revision } };
        }
        assertCurrent(isCurrent);
        const accepted = await create(payload);
        assertCurrent(isCurrent);
        result = accepted;
        return accepted;
    };
    return {
        save() {
            if (!inFlight) inFlight = run().catch(error => {
                if (error.code === 'BOUNDARY_SOURCE_REVIEW_REQUIRED' || definitiveBoundaryRefusal(error)) reviewError = error;
                throw error;
            }).finally(() => { inFlight = null; });
            return inFlight;
        },
        get canReviewAgain() { return Boolean(reviewError); },
        get reviewError() { return reviewError; },
    };
}
