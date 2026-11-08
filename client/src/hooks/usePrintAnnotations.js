import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../lib/api.js';
import {
    PRINT_ANNOTATION_CLIENT_CAPABILITIES, acknowledgesAnnotationFeatures, requiresExactBoundaryWrites,
} from '../../../shared/annotationWriteCompatibility.js';
import {
    annotationDraftNeedsQuarantine, clearAnnotationLocalDraft, quarantineAnnotationLocalDraft,
    readAnnotationLocalDraft, writeAnnotationLocalDraft,
} from '../lib/annotationDraftStorage.js';
import {
    PRINT_ANNOTATION_SCHEMA_VERSION,
    getAnnotationLocalDraftKey,
    normalizePrintAnnotations,
} from '../lib/printAnnotations.js';

const AUTOSAVE_DELAY_MS = 800;
const LOCAL_DRAFT_DELAY_MS = 180;
const EMPTY_DOCUMENT = Object.freeze({
    schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
    annotations: [],
    revision: 0,
    updatedAt: null,
});

function getDraftStorage() {
    try { return typeof window === 'undefined' ? null : window.localStorage; }
    catch { return null; }
}

export function usePrintAnnotations({
    mapId,
    userId,
    enabled,
    restoreLocalDraft = true,
    autosave = true,
    onDraftRecoveryNotice = null,
}) {
    const storageKey = getAnnotationLocalDraftKey(userId, mapId);
    const [document, setDocument] = useState(EMPTY_DOCUMENT);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [historyVersion, setHistoryVersion] = useState(0);
    const [loadVersion, setLoadVersion] = useState(0);
    const annotationsRef = useRef([]);
    const revisionRef = useRef(0);
    const boundarySupportRef = useRef({ capable: false, protectedDocument: false });
    const dirtyRef = useRef(false);
    const saveTimerRef = useRef(null);
    const localDraftTimerRef = useRef(null);
    const saveQueueRef = useRef(Promise.resolve(null));
    const loadingTokenRef = useRef(0);
    const pastRef = useRef([]);
    const futureRef = useRef([]);
    const protectedDraftKeysRef = useRef(new Set());
    const recoveryNoticeRef = useRef(onDraftRecoveryNotice);
    recoveryNoticeRef.current = onDraftRecoveryNotice;

    const syncDocumentState = useCallback((annotations, revision, updatedAt = null) => {
        const normalized = normalizePrintAnnotations(annotations);
        annotationsRef.current = normalized;
        revisionRef.current = Number(revision || 0);
        setDocument({
            schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
            annotations: normalized,
            revision: revisionRef.current,
            updatedAt,
        });
    }, []);

    useEffect(() => {
        if (!enabled || !mapId) return undefined;
        const token = loadingTokenRef.current + 1;
        loadingTokenRef.current = token;
        let cancelled = false;
        setStatus('loading');
        setError('');

        api.getMyMapPrintAnnotations(mapId)
            .then((loaded) => {
                if (cancelled || loadingTokenRef.current !== token) return;
                const revision = Number(loaded?.revision || 0);
                const serverAnnotations = normalizePrintAnnotations(loaded?.annotations);
                boundarySupportRef.current = { capable: loaded?.serverCapabilities?.exactBoundaryGeometry === true,
                    protectedDocument: requiresExactBoundaryWrites(loaded?.annotations) };
                const localDraft = restoreLocalDraft ? readAnnotationLocalDraft(getDraftStorage(), storageKey) : null;
                const incompatibleDraft = annotationDraftNeedsQuarantine(localDraft, serverAnnotations);
                if (incompatibleDraft) {
                    const retained = quarantineAnnotationLocalDraft(getDraftStorage(), storageKey, localDraft.raw);
                    if (retained.protectPrimary) protectedDraftKeysRef.current.add(storageKey);
                    else protectedDraftKeysRef.current.delete(storageKey);
                    recoveryNoticeRef.current?.(retained.protectPrimary
                        ? 'An earlier local drawing draft was kept in this browser because it could not be copied safely. The saved map was loaded; local draft backup is unavailable in this tab.'
                        : 'An earlier local drawing draft was kept separately because this map uses newer annotation features. The saved map was loaded.');
                }
                const canRestoreDraft = localDraft
                    && !incompatibleDraft
                    && localDraft.baseRevision === revision
                    && JSON.stringify(localDraft.annotations) !== JSON.stringify(serverAnnotations);
                syncDocumentState(
                    canRestoreDraft ? localDraft.annotations : serverAnnotations,
                    revision,
                    loaded?.updatedAt || null,
                );
                dirtyRef.current = Boolean(canRestoreDraft);
                pastRef.current = [];
                futureRef.current = [];
                setHistoryVersion((value) => value + 1);
                setStatus(canRestoreDraft ? 'unsaved' : 'saved');
            })
            .catch((loadError) => {
                if (cancelled || loadingTokenRef.current !== token) return;
                setStatus('error');
                setError(loadError?.message || 'Print annotations could not be loaded.');
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, loadVersion, mapId, restoreLocalDraft, storageKey, syncDocumentState]);

    const saveNow = useCallback(() => {
        if (!enabled || !mapId) return Promise.resolve(null);
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        const queuedSave = saveQueueRef.current.then(async () => {
            if (!dirtyRef.current) return null;
            const annotationsToSave = annotationsRef.current;
            const revisionToSave = revisionRef.current;
            setStatus('saving');
            setError('');
            try {
                if (!boundarySupportRef.current.capable && (boundarySupportRef.current.protectedDocument || requiresExactBoundaryWrites(annotationsToSave))) {
                    throw new Error('Update CareAround and reload this map to save its boundary geometry. Your drawing draft is kept.');
                }
                const saved = await api.updateMyMapPrintAnnotations(mapId, {
                    schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
                    revision: revisionToSave,
                    annotations: annotationsToSave,
                    clientCapabilities: PRINT_ANNOTATION_CLIENT_CAPABILITIES,
                });
                revisionRef.current = Number(saved?.revision || revisionToSave + 1);
                const protectedWrite = boundarySupportRef.current.protectedDocument || requiresExactBoundaryWrites(annotationsToSave);
                if ((protectedWrite && saved?.serverCapabilities?.exactBoundaryGeometry !== true)
                    || !acknowledgesAnnotationFeatures(annotationsToSave, saved?.annotations, boundarySupportRef.current.protectedDocument)) {
                    // A downlevel Worker may advance its revision while stripping
                    // groups. Retain that revision and the full intended draft so
                    // a later retry can recover without losing data or claiming Saved.
                    setDocument(current => ({ ...current, revision: revisionRef.current }));
                    const mismatch = new Error('CareAround could not confirm all annotation changes. Your drawing remains unsaved; update CareAround and retry.');
                    mismatch.code = 'ANNOTATION_ACK_MISMATCH';
                    throw mismatch;
                }
                boundarySupportRef.current = { capable: saved?.serverCapabilities?.exactBoundaryGeometry === true,
                    protectedDocument: requiresExactBoundaryWrites(saved?.annotations) };
                const stillCurrent = annotationsRef.current === annotationsToSave;
                dirtyRef.current = !stillCurrent;
                setDocument((current) => ({
                    ...current,
                    revision: revisionRef.current,
                    updatedAt: saved?.updatedAt || current.updatedAt,
                }));
                if (stillCurrent) {
                    if (localDraftTimerRef.current) {
                        window.clearTimeout(localDraftTimerRef.current);
                        localDraftTimerRef.current = null;
                    }
                    clearAnnotationLocalDraft(getDraftStorage(), storageKey, protectedDraftKeysRef.current);
                    setStatus('saved');
                } else {
                    writeAnnotationLocalDraft(getDraftStorage(), storageKey, revisionRef.current, annotationsRef.current, protectedDraftKeysRef.current);
                    setStatus('unsaved');
                }
                return saved;
            } catch (saveError) {
                dirtyRef.current = true;
                writeAnnotationLocalDraft(getDraftStorage(), storageKey, revisionRef.current, annotationsRef.current, protectedDraftKeysRef.current);
                setStatus('error');
                setError(saveError?.message || 'Print annotations could not be saved.');
                return null;
            }
        });
        saveQueueRef.current = queuedSave.catch(() => null);
        return queuedSave;
    }, [enabled, mapId, storageKey]);

    const flushPendingChanges = useCallback(async () => {
        if (!enabled || !mapId) return false;

        // A save may have started just before sharing while a final annotation
        // edit was still arriving. Allow one bounded follow-up pass so the
        // frozen snapshot never races ahead of that persisted document.
        await saveNow();
        if (dirtyRef.current) await saveNow();
        return !dirtyRef.current;
    }, [enabled, mapId, saveNow]);

    useEffect(() => {
        if (status !== 'unsaved' || !enabled || !autosave) return undefined;
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = window.setTimeout(() => {
            saveTimerRef.current = null;
            saveNow();
        }, AUTOSAVE_DELAY_MS);
        return () => {
            if (saveTimerRef.current) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, [autosave, enabled, saveNow, status, document.annotations]);

    useEffect(() => () => {
        if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
        }
        if (localDraftTimerRef.current) {
            window.clearTimeout(localDraftTimerRef.current);
            if (dirtyRef.current) {
                writeAnnotationLocalDraft(getDraftStorage(), storageKey, revisionRef.current, annotationsRef.current, protectedDraftKeysRef.current);
            }
        }
    }, [storageKey]);

    const replaceAnnotations = useCallback((nextValue, { recordHistory = true } = {}) => {
        const current = annotationsRef.current;
        const resolvedValue = typeof nextValue === 'function' ? nextValue(current) : nextValue;
        const next = normalizePrintAnnotations(resolvedValue);
        if (JSON.stringify(next) === JSON.stringify(current)) return;
        if (recordHistory) {
            pastRef.current = [...pastRef.current.slice(-49), current];
            futureRef.current = [];
        }
        annotationsRef.current = next;
        dirtyRef.current = true;
        if (localDraftTimerRef.current) window.clearTimeout(localDraftTimerRef.current);
        localDraftTimerRef.current = window.setTimeout(() => {
            localDraftTimerRef.current = null;
            writeAnnotationLocalDraft(getDraftStorage(), storageKey, revisionRef.current, annotationsRef.current, protectedDraftKeysRef.current);
        }, LOCAL_DRAFT_DELAY_MS);
        setDocument((value) => ({ ...value, annotations: next }));
        setHistoryVersion((value) => value + 1);
        setStatus('unsaved');
        setError('');
    }, [storageKey]);

    const undo = useCallback(() => {
        const previous = pastRef.current.at(-1);
        if (!previous) return;
        pastRef.current = pastRef.current.slice(0, -1);
        futureRef.current = [annotationsRef.current, ...futureRef.current.slice(0, 49)];
        replaceAnnotations(previous, { recordHistory: false });
    }, [replaceAnnotations]);

    const redo = useCallback(() => {
        const next = futureRef.current[0];
        if (!next) return;
        futureRef.current = futureRef.current.slice(1);
        pastRef.current = [...pastRef.current.slice(-49), annotationsRef.current];
        replaceAnnotations(next, { recordHistory: false });
    }, [replaceAnnotations]);

    const reload = useCallback(() => {
        setLoadVersion((value) => value + 1);
    }, []);

    return {
        annotations: document.annotations,
        revision: document.revision,
        status,
        error,
        replaceAnnotations,
        saveNow,
        flushPendingChanges,
        reload,
        undo,
        redo,
        canUndo: historyVersion >= 0 && pastRef.current.length > 0,
        canRedo: historyVersion >= 0 && futureRef.current.length > 0,
    };
}
