import { PRINT_ANNOTATION_SCHEMA_VERSION, normalizePrintAnnotations } from './printAnnotations.js';
import {
    PRINT_ANNOTATION_CLIENT_CAPABILITIES, requiresCurrentAnnotationWrites,
    supportsCurrentAnnotationWrites,
} from '../../../shared/annotationWriteCompatibility.js';

export function readAnnotationLocalDraft(storage, key) {
    if (!storage || !key) return null;
    try {
        const raw = storage.getItem(key);
        const parsed = JSON.parse(raw || 'null');
        if (!parsed || parsed.schemaVersion !== PRINT_ANNOTATION_SCHEMA_VERSION) return null;
        return { raw, baseRevision: Number(parsed.baseRevision || 0),
            clientCapabilities: parsed.clientCapabilities,
            annotations: normalizePrintAnnotations(parsed.annotations) };
    } catch { return null; }
}

export function annotationDraftNeedsQuarantine(draft, serverAnnotations) {
    return Boolean(draft && requiresCurrentAnnotationWrites(serverAnnotations)
        && !supportsCurrentAnnotationWrites(draft.clientCapabilities));
}

// Keep the exact original bytes, including unknown legacy fields. Never replace
// a different backup. If storage is full or another tab changes the primary,
// callers protect that primary key from all subsequent writes and cleanup.
// Loading is copy-only: the primary is never removed automatically.
export function quarantineAnnotationLocalDraft(storage, key, raw) {
    let preserved = false;
    let backupKey = null;
    if (!storage || !key || typeof raw !== 'string') return { preserved, backupKey, protectPrimary: true };
    try {
        for (let index = 0; index < 10; index += 1) {
            const candidate = `${key}:preserved-legacy-draft${index ? `:${index}` : ''}`;
            const previous = storage.getItem(candidate);
            if (previous !== null && previous !== raw) continue;
            if (previous === null) storage.setItem(candidate, raw);
            if (storage.getItem(candidate) !== raw) return { preserved, backupKey, protectPrimary: true };
            preserved = true;
            backupKey = candidate;
            if (storage.getItem(key) !== raw) return { preserved, backupKey, protectPrimary: true };
            return { preserved, backupKey, protectPrimary: false };
        }
    } catch { /* The original draft must remain available when copying fails. */ }
    return { preserved, backupKey, protectPrimary: true };
}

export function writeAnnotationLocalDraft(storage, key, baseRevision, annotations, protectedKeys) {
    if (!storage || !key || protectedKeys?.has(key)) return false;
    try {
        storage.setItem(key, JSON.stringify({ schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
            baseRevision, annotations, clientCapabilities: PRINT_ANNOTATION_CLIENT_CAPABILITIES }));
        return true;
    } catch { return false; }
}

export function clearAnnotationLocalDraft(storage, key, protectedKeys) {
    if (!storage || !key || protectedKeys?.has(key)) return false;
    try { storage.removeItem(key); return true; } catch { return false; }
}
