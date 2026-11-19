import { ADDRESS_SNAPSHOT_SCAN_CAPS } from '../../../shared/addressSnapshotScanContract.js';
import { normalizeSpatialArea } from '../../../shared/addressSnapshotSpatial.js';
import { AddressSnapshotError } from './addressSnapshotClient.js';

const PAGE_SIZE = 1000;
const utf8 = new TextEncoder();
const idle = Object.freeze({ status: 'idle', progress: null, completedRows: null, error: null });
const validCount = value => Number.isSafeInteger(value) && value >= 0;
const validPin = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const incomplete = () => new AddressSnapshotError('The pinned area address result is incomplete.');

function validateRows(rows, acceptedIds) {
    const additions = new Set();
    for (const row of rows) {
        if (typeof row?.id !== 'string' || !row.id.trim()
            || typeof row.postalCode !== 'string' || !row.postalCode.trim()
            || additions.has(row.id) || acceptedIds.has(row.id)) throw incomplete();
        additions.add(row.id);
    }
}

// offset/limit are the request's values, including the advertised limit on the final page.
export function validatePinnedAreaAddressPage(page, { snapshotSha256, total, offset, limit, acceptedIds }) {
    if (!validPin(snapshotSha256) || !validPin(page?.snapshot?.sha256)) throw incomplete();
    if (page.snapshot.sha256 !== snapshotSha256) throw new AddressSnapshotError(undefined, 'ADDRESS_SNAPSHOT_CHANGED', 409);
    if (!validCount(total) || !validCount(page.snapshot.recordCount) || total > page.snapshot.recordCount
        || !validCount(offset) || offset > total || !validCount(limit) || !limit || limit > PAGE_SIZE
        || page.total !== total || page.offset !== offset || page.limit !== limit
        || !Array.isArray(page.rows) || page.rows.length !== Math.min(limit, total - offset)) throw incomplete();
    validateRows(page.rows, acceptedIds);
    return page.rows;
}

// Count the brackets once and charge separators across page boundaries.
// Commit all rows together only after the entire page fits the UTF-8 budget.
function appendRows(session, rows) {
    let bytes = session.bytes;
    for (const [i, row] of rows.entries()) {
        bytes += utf8.encode(JSON.stringify(row)).byteLength + (session.rows.length || i ? 1 : 0);
        if (bytes > ADDRESS_SNAPSHOT_SCAN_CAPS.maxRetainedBytes) throw incomplete();
    }
    for (const row of rows) {
        session.rows.push(row);
        session.ids.add(row.id);
    }
    session.bytes = bytes;
}

export function createPinnedAreaAddressCompletion({ fetchPage }) {
    const listeners = new Set();
    let view = idle;
    let session = null;

    function publish(next) {
        view = Object.freeze(next);
        for (const listener of listeners) listener();
    }
    function retire() {
        const old = session;
        session = null;
        if (old) {
            old.rows = null;
            old.ids = null;
            old.transport?.abort();
        }
    }

    function progress(current) {
        return { confirmed: current.rows.length, total: current.total };
    }
    async function collect(current, signal) {
        if (session !== current) return;
        try {
            while (session === current && current.rows.length < current.total) {
                const offset = current.rows.length;
                const { area, snapshotSha256, total } = current;
                const page = await fetchPage({ area, offset, limit: PAGE_SIZE, snapshotSha256, signal });
                if (session !== current) return;
                const rows = validatePinnedAreaAddressPage(page, { snapshotSha256, offset, total, limit: PAGE_SIZE,
                    acceptedIds: current.ids });
                if (page.snapshot.recordCount !== current.recordCount) throw incomplete();
                appendRows(current, rows);
                if (current.rows.length < total) publish({ ...idle, status: 'preparing', progress: progress(current) });
            }
            if (session !== current) return;
            current.ids = null;
            publish({ ...idle, status: 'ready', completedRows: Object.freeze(current.rows), progress: progress(current) });
        } catch (error) {
            if (session !== current) return;
            const changed = error?.code === 'ADDRESS_SNAPSHOT_CHANGED' && error?.status === 409;
            if (changed) {
                current.rows = null;
                current.ids = null;
            }
            publish({ ...idle, status: changed ? 'changed' : 'error', error, progress: changed ? null : progress(current) });
        } finally {
            current.pending = null;
            current.transport = null;
        }
    }
    function run(current) {
        const transport = new AbortController();
        current.transport = transport;
        // Install the shared promise before subscribers can re-enter start/resume.
        current.pending = Promise.resolve().then(() => collect(current, transport.signal));
        publish({ ...idle, status: 'preparing', progress: progress(current) });
        return current.pending;
    }
    function start({ area, scopeKey, snapshot, total, rows }) {
        const snapshotSha256 = snapshot?.sha256;
        const recordCount = snapshot?.recordCount;
        const normalizedArea = normalizeSpatialArea(area);
        const geometry = JSON.stringify(normalizedArea);
        if (session && session.scopeKey === scopeKey && session.geometry === geometry
            && session.snapshotSha256 === snapshotSha256 && session.recordCount === recordCount && session.total === total) {
            return session.pending ?? Promise.resolve();
        }
        retire();
        try {
            if (!normalizedArea || !validPin(snapshotSha256) || !validCount(total) || !validCount(recordCount) || total > recordCount
                || !Array.isArray(rows) || rows.length > total) throw incomplete();
            const next = { scopeKey, geometry, area: JSON.parse(geometry), snapshotSha256, recordCount, total,
                ids: new Set(), rows: [], bytes: 2 };
            validateRows(rows, next.ids);
            appendRows(next, rows);
            session = next;
            return run(next);
        } catch (error) {
            publish({ ...idle, status: 'error', error });
            return Promise.resolve();
        }
    }
    function resume() {
        if (session?.pending) return session.pending;
        if (session && view.status === 'error') return run(session);
        return Promise.resolve();
    }
    function reset() {
        retire();
        if (view !== idle) publish(idle);
    }

    return {
        start, resume, reset, getSnapshot: () => view,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
