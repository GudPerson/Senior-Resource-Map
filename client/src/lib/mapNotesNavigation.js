import { getRowAssetKey } from './mapNotes.js';

export const MAP_NOTES_RECENT_PIN_LIMIT = 5;

export function rememberMapNotePin(keys, placeKey) {
    const key = String(placeKey || '').trim();
    if (!key || keys[0] === key) return keys;
    return [key, ...keys.filter(value => value !== key)].slice(0, MAP_NOTES_RECENT_PIN_LIMIT);
}

function normalizeSearch(value) {
    return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function filterMapNoteResources(rows, query) {
    const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return rows;
    return rows.filter(row => {
        const text = normalizeSearch([row.name, row.address, row.postalCode, row.postal_code,
            row.mapNoteContext, row.bucket, row.subCategory].filter(Boolean).join(' '));
        return terms.every(term => text.includes(term));
    });
}

// Resolve stored identities against the current allowed rows, never stale snapshots.
export function resolveRecentMapNotePins(pins, rows) {
    const allowed = new Map(rows.map(row => [getRowAssetKey(row), row]));
    return pins.slice(0, MAP_NOTES_RECENT_PIN_LIMIT).flatMap(pin => {
        const seen = new Set();
        const currentRows = pin.rows.flatMap(row => {
            const key = getRowAssetKey(row);
            if (seen.has(key) || !allowed.has(key)) return [];
            seen.add(key);
            return [allowed.get(key)];
        });
        return currentRows.length ? [{ ...pin, rows: currentRows }] : [];
    });
}
