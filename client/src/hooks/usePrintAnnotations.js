import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../lib/api.js';
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

function readLocalDraft(storageKey) {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
        if (!parsed || parsed.schemaVersion !== PRINT_ANNOTATION_SCHEMA_VERSION) return null;
        return {
            baseRevision: Number(parsed.baseRevision || 0),
            annotations: normalizePrintAnnotations(parsed.annotations),
        };
    } catch {
        return null;
    }
}

function writeLocalDraft(storageKey, baseRevision, annotations) {
    if (!storageKey || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, JSON.stringify({
            schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
            baseRevision,
            annotations,
        }));
    } catch {
        // Server persistence remains authoritative when browser storage is unavailable.
    }
}

function clearLocalDraft(storageKey) {
    if (!storageKey || typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(storageKey);
    } catch {
        // Ignore browser storage cleanup failures.
    }
}

export function usePrintAnnotations({
    mapId,
    userId,
    enabled,
    restoreLocalDraft = true,
    autosave = true,
}) {
    const storageKey = getAnnotationLocalDraftKey(userId, mapId);
    const [document, setDocument] = useState(EMPTY_DOCUMENT);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [historyVersion, setHistoryVersion] = useState(0);
    const [loadVersion, setLoadVersion] = useState(0);
    const annotationsRef = useRef([]);
    const revisionRef = useRef(0);
    const dirtyRef = useRef(false);
    const saveTimerRef = useRef(null);
    const localDraftTimerRef = useRef(null);
    const saveQueueRef = useRef(Promise.resolve(null));
    const loadingTokenRef = useRef(0);
    const pastRef = useRef([]);
    const futureRef = useRef([]);

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
                const localDraft = restoreLocalDraft ? readLocalDraft(storageKey) : null;
                const canRestoreDraft = localDraft
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
                const saved = await api.updateMyMapPrintAnnotations(mapId, {
                    schemaVersion: PRINT_ANNOTATION_SCHEMA_VERSION,
                    revision: revisionToSave,
                    annotations: annotationsToSave,
                });
                revisionRef.current = Number(saved?.revision || revisionToSave + 1);
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
                    clearLocalDraft(storageKey);
                    setStatus('saved');
                } else {
                    writeLocalDraft(storageKey, revisionRef.current, annotationsRef.current);
                    setStatus('unsaved');
                }
                return saved;
            } catch (saveError) {
                dirtyRef.current = true;
                writeLocalDraft(storageKey, revisionRef.current, annotationsRef.current);
                setStatus('error');
                setError(saveError?.message || 'Print annotations could not be saved.');
                return null;
            }
        });
        saveQueueRef.current = queuedSave.catch(() => null);
        return queuedSave;
    }, [enabled, mapId, storageKey]);

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
                writeLocalDraft(storageKey, revisionRef.current, annotationsRef.current);
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
            writeLocalDraft(storageKey, revisionRef.current, annotationsRef.current);
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
        reload,
        undo,
        redo,
        canUndo: historyVersion >= 0 && pastRef.current.length > 0,
        canRedo: historyVersion >= 0 && futureRef.current.length > 0,
    };
}
