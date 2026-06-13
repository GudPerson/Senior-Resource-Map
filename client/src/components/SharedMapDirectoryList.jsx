import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { appendMapReturnTo, buildCurrentAppPath, normalizeMapReturnPath } from '../lib/appNavigation.js';
import { OFFERING_ACCESS } from '../lib/eligibility.js';
import {
    ArrowLeft,
    Bold,
    ChevronRight,
    Eye,
    Italic,
    Link2,
    List,
    ListOrdered,
    Plus,
    RefreshCw,
    StickyNote,
    Trash2,
    X,
} from 'lucide-react';
import {
    buildMapNoteResourceRows,
    buildMapNoteRowBadgeParts,
    buildMapNoteSummaryParts,
    getMapNoteResourceSummary,
    getNoteRowsForGroup,
    getRowAssetKey,
    hasAnyOwnerNote,
    normalizeNoteItems,
} from '../lib/mapNotes.js';
import {
    MAP_NOTE_MAX_LENGTH,
    buildMapNotesAutosaveSignature,
    buildMapNotesSavePayload,
    mergeRemoteNotesWithStableDrafts,
    shouldResetDraftsFromRemote,
} from '../lib/mapNotesAutosave.js';
import { applyMapNoteMarkdownAction } from '../lib/mapNoteMarkdownToolbar.js';
import { resizeTextareaToContent } from '../lib/adaptiveTextarea.js';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import OfferingAccessNotice from './OfferingAccessNotice.jsx';
import ResourceRowIcon from './ResourceRowIcon.jsx';
import {
    MOBILE_MAP_PANEL_STATES,
    getMobileMapPanelActionForScroll,
    getMobileMapPanelStateAfterBadgeActivation,
    shouldExpandMobileMapPanelFromTopPull,
} from '../lib/mobileMapPanelBehavior.js';

const DirectoryReturnPathContext = React.createContext('');

function useDirectoryDetailPath(path) {
    const returnTo = React.useContext(DirectoryReturnPathContext);
    return useMemo(() => appendMapReturnTo(path, returnTo), [path, returnTo]);
}

function StatusBadge({ status }) {
    const { t } = useLocale();
    if (status === 'unavailable') {
        return (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {t('noLongerAvailable')}
            </span>
        );
    }

    if (status === 'list_only') {
        return (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {t('notShownOnMap')}
            </span>
        );
    }

    return null;
}

function AvailabilityCountBadge({ row, compact = false }) {
    if (row?.resourceType !== 'soft' || !row?.availabilityEnabled) {
        return null;
    }

    return (
        <span
            className={`inline-flex rounded-full border font-bold text-brand-700 ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
            style={{
                borderColor: 'var(--color-brand-light)',
                backgroundColor: 'color-mix(in srgb, var(--color-brand-light) 50%, white)',
            }}
        >
            {formatAvailabilityLabel(
                normalizeAvailabilityCount(row.availabilityCount),
                normalizeAvailabilityUnit(row.availabilityUnit),
            )}
        </span>
    );
}

function MapLegend({ mobile = false }) {
    const { t } = useLocale();
    return (
        <div className={`flex items-center justify-between border border-slate-200 bg-white px-4 py-2 text-[16px] font-bold text-slate-600 isolate ${
            mobile
                ? 'rounded-b-xl mt-0'
                : 'rounded-xl mt-4 shadow-sm backdrop-blur-sm'
        }`}>
            <div className="flex items-center gap-1.5">
                <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-[#0f766e] shadow-sm" />
                <span>{t('legendSingle')}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="flex h-[1.1em] w-[1.1em] items-center justify-center rounded-lg bg-[#0f766e] text-[0.7em] font-black text-white shadow-sm">1</div>
                <span>{t('legendResourceNumber')}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-blue-500 shadow-sm" />
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-pink-500 shadow-sm" />
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-orange-500 shadow-sm" />
                </div>
                <span>{t('legendClusters')}</span>
            </div>
        </div>
    );
}

function buildNoteDrafts(rows) {
    return rows.reduce((drafts, row) => {
        const items = normalizeNoteItems(row?.notes);
        drafts[getRowAssetKey(row)] = {
            notes: items.length ? items : [createEmptyDraftNote()],
        };
        return drafts;
    }, {});
}

function SharedResourceNotes({ notes, compact = false, print = false }) {
    const { t } = useLocale();
    const items = (notes || []).filter((note) => String(note?.text || '').trim());
    if (!items.length) return null;

    if (print) {
        return (
            <div className="mt-1 space-y-1">
                {items.map((note, index) => (
                    <div key={`${note.id || index}-${note.text}`} className="rounded-lg border border-brand-100 bg-brand-50 px-2 py-1 text-[10px] font-medium leading-4 text-brand-800">
                        <span className="font-bold">{t('sharedNote')}:</span>
                        <MarkdownLiteText
                            text={note.text}
                            compact
                            className="mt-0.5 text-[10px] leading-4 text-brand-800"
                            linkClassName="text-brand-700 underline break-all"
                        />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`mt-2 rounded-2xl border border-brand-100 bg-brand-50 text-brand-900 ${compact ? 'px-2.5 py-2 text-[11px] leading-5' : 'px-3 py-2 text-xs leading-5'}`}>
            <p className="font-bold">{t('sharedNotes')}</p>
            <div className="mt-1 space-y-1.5">
                {items.map((note, index) => (
                    <MarkdownLiteText
                        key={`${note.id || index}-${note.text}`}
                        text={note.text}
                        compact
                        className="text-brand-900"
                        linkClassName="text-brand-700 underline break-all"
                    />
                ))}
            </div>
        </div>
    );
}

function MapNoteToolbarButton({ label, active = false, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-slate-600 transition focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                active
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700'
            }`}
            aria-label={label}
            title={label}
            aria-pressed={active || undefined}
        >
            {children}
        </button>
    );
}

function createEmptyDraftNote() {
    return {
        clientId: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        id: null,
        text: '',
        isShared: false,
    };
}

function formatMapNotesSummary(summary, mode, t) {
    const labelKeys = {
        resources: 'mapNotesSummaryResourcePart',
        notes: 'mapNotesSummaryNotePart',
        shared: 'mapNotesSummarySharedPart',
    };

    return buildMapNoteSummaryParts(summary, { mode })
        .map((part) => t(labelKeys[part.key], { count: part.count }))
        .join(' · ');
}

function NoteCountPill({ count, tone = 'brand' }) {
    if (!count) return null;
    const className = tone === 'slate'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-brand-100 bg-brand-50 text-brand-700';

    return (
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-2 text-[11px] font-black leading-none ${className}`}>
            {count}
        </span>
    );
}

function MapNoteIconButton({ row, onOpenResourceNotes, compact = false }) {
    const { t } = useLocale();
    const noteCount = normalizeNoteItems(row?.notes).length;

    if (!noteCount || !onOpenResourceNotes) return null;

    return (
        <button
            type="button"
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenResourceNotes(row);
            }}
            className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-brand-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                compact ? 'h-8 min-w-8 px-2' : 'h-9 min-w-9 px-2.5'
            }`}
            aria-label={t('viewResourceNotesFor', { name: row?.name || t('resource') })}
            title={t('viewResourceNotesFor', { name: row?.name || t('resource') })}
        >
            <StickyNote size={compact ? 13 : 14} strokeWidth={2.25} />
            <span className="ml-1 text-[11px] font-black leading-none">{noteCount}</span>
        </button>
    );
}

function MapNotesEntryButton({ rows, mode, onOpen }) {
    const { t } = useLocale();
    const summary = getMapNoteResourceSummary(rows);
    const canOpen = rows.length > 0 && (mode === 'owner' || summary.noteCount > 0);

    if (!canOpen) return null;

    return (
        <button
            type="button"
            onClick={() => onOpen(null)}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label={t('openMapNotes')}
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <StickyNote size={18} strokeWidth={2.25} />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-black leading-tight text-slate-900">{t('mapNotes')}</span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-500">
                        {formatMapNotesSummary(summary, mode, t)}
                    </span>
                </span>
            </span>
            <ChevronRight size={18} className="flex-shrink-0 text-slate-400" />
        </button>
    );
}

function ResourceNotesEditor({
    row,
    onUpdateResourceNotes,
    onRegisterFlush,
}) {
    const { t } = useLocale();
    const rowKey = getRowAssetKey(row);
    const remoteSignature = buildMapNotesAutosaveSignature(normalizeNoteItems(row?.notes));
    const [drafts, setDrafts] = useState(() => buildNoteDrafts(row ? [row] : []));
    const [saveState, setSaveState] = useState('idle');
    const [error, setError] = useState('');
    const [previewNoteIds, setPreviewNoteIds] = useState({});
    const activeRowKeyRef = useRef(rowKey);
    const draftsRef = useRef(drafts);
    const rowRef = useRef(row);
    const onUpdateResourceNotesRef = useRef(onUpdateResourceNotes);
    const noteTextareaRefs = useRef({});
    const saveInFlightRef = useRef(false);
    const queuedSaveRef = useRef(false);
    const draftChangedRef = useRef(false);
    const immediateSaveRef = useRef(false);
    const hasUnsavedDraftRef = useRef(false);
    const latestDraftSignatureRef = useRef(remoteSignature);
    const savePromiseRef = useRef(null);

    rowRef.current = row;
    onUpdateResourceNotesRef.current = onUpdateResourceNotes;

    function getCurrentDraftNotes() {
        const activeRowKey = activeRowKeyRef.current;
        const activeDraft = draftsRef.current[activeRowKey] || { notes: [] };
        return activeDraft.notes || [];
    }

    const flushDraftChanges = useCallback(async (options = {}) => {
        if (!rowRef.current || !onUpdateResourceNotesRef.current) return true;
        const { keepalive = false } = options;

        if (saveInFlightRef.current) {
            queuedSaveRef.current = true;
            try {
                await savePromiseRef.current;
            } catch {
                // The active saver will surface the error in the editor.
            }
            return flushDraftChanges(options);
        }

        const saveRowRef = rowRef.current;
        const payload = buildMapNotesSavePayload(getCurrentDraftNotes());
        const saveSignature = buildMapNotesAutosaveSignature(payload);
        if (!hasUnsavedDraftRef.current && latestDraftSignatureRef.current === saveSignature) {
            return true;
        }

        queuedSaveRef.current = false;
        saveInFlightRef.current = true;
        setSaveState('saving');
        setError('');

        try {
            const savePromise = onUpdateResourceNotesRef.current(saveRowRef, payload, { keepalive });
            savePromiseRef.current = savePromise;
            await savePromise;
            const hasNewerDraft = latestDraftSignatureRef.current !== saveSignature;
            const shouldSaveAgain = queuedSaveRef.current || hasNewerDraft;
            if (shouldSaveAgain) {
                hasUnsavedDraftRef.current = true;
                return flushDraftChanges(options);
            }
            hasUnsavedDraftRef.current = false;
            setSaveState('saved');
            return true;
        } catch (err) {
            console.error(err);
            hasUnsavedDraftRef.current = true;
            queuedSaveRef.current = false;
            setSaveState('error');
            setError(err.message || t('failedSaveMapNotes'));
            return false;
        } finally {
            saveInFlightRef.current = false;
            savePromiseRef.current = null;
        }
    }, [t]);

    useEffect(() => {
        draftsRef.current = drafts;
        Object.values(noteTextareaRefs.current).forEach((textarea) => resizeTextareaToContent(textarea));
        if (!draftChangedRef.current) return;

        draftChangedRef.current = false;
        const payload = buildMapNotesSavePayload(getCurrentDraftNotes());
        latestDraftSignatureRef.current = buildMapNotesAutosaveSignature(payload);
        hasUnsavedDraftRef.current = true;
        const shouldSaveImmediately = immediateSaveRef.current;
        immediateSaveRef.current = false;
        if (shouldSaveImmediately) {
            void flushDraftChanges();
        }
    }, [drafts]);

    useEffect(() => {
        const previousRowKey = activeRowKeyRef.current;
        const localDraftNotes = getCurrentDraftNotes();
        const localSignature = buildMapNotesAutosaveSignature(buildMapNotesSavePayload(localDraftNotes));
        const shouldReset = shouldResetDraftsFromRemote({
            previousRowKey,
            nextRowKey: rowKey,
            localSignature,
            remoteSignature,
            hasPendingSave: hasUnsavedDraftRef.current,
            isSaving: saveInFlightRef.current,
        });

        activeRowKeyRef.current = rowKey;
        latestDraftSignatureRef.current = shouldReset ? remoteSignature : latestDraftSignatureRef.current;

        if (!shouldReset) return;

        if (previousRowKey !== rowKey) {
            queuedSaveRef.current = false;
            hasUnsavedDraftRef.current = false;
            setSaveState('idle');
            setError('');
        }

        const nextDrafts = buildNoteDrafts(row ? [row] : []);
        if (previousRowKey === rowKey && nextDrafts[rowKey]) {
            nextDrafts[rowKey] = {
                ...nextDrafts[rowKey],
                notes: mergeRemoteNotesWithStableDrafts(localDraftNotes, nextDrafts[rowKey].notes),
            };
        }
        draftsRef.current = nextDrafts;
        setDrafts(nextDrafts);
    }, [rowKey, remoteSignature]);

    useEffect(() => {
        onRegisterFlush?.(flushDraftChanges);
        return () => onRegisterFlush?.(null);
    }, [flushDraftChanges, onRegisterFlush]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

        function flushForPageExit() {
            if (!hasUnsavedDraftRef.current) return;
            void flushDraftChanges({ keepalive: true });
        }

        function handleVisibilityChange() {
            if (document.visibilityState === 'hidden') {
                flushForPageExit();
            }
        }

        window.addEventListener('pagehide', flushForPageExit);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('pagehide', flushForPageExit);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [flushDraftChanges]);

    if (!row || !onUpdateResourceNotes) return null;

    function markDraftChanged({ immediate = false } = {}) {
        draftChangedRef.current = true;
        immediateSaveRef.current = immediateSaveRef.current || immediate;
        if (immediate) {
            setSaveState('pending');
        } else {
            setSaveState((current) => (current === 'saved' ? 'idle' : current));
        }
        setError('');
    }

    function updateDraftNote(clientId, values, options = {}) {
        markDraftChanged(options);
        setDrafts((current) => ({
            ...current,
            [rowKey]: {
                ...(current[rowKey] || {}),
                notes: (current[rowKey]?.notes || []).map((note) => (
                    note.clientId === clientId
                        ? { ...note, ...values, text: values.text !== undefined ? values.text.slice(0, 1000) : note.text }
                        : note
                )),
            },
        }));
    }

    function addDraftNote() {
        setDrafts((current) => ({
            ...current,
            [rowKey]: {
                ...(current[rowKey] || {}),
                notes: [...(current[rowKey]?.notes || []), createEmptyDraftNote()],
            },
        }));
    }

    function removeDraftNote(clientId) {
        markDraftChanged({ immediate: true });
        setDrafts((current) => ({
            ...current,
            [rowKey]: {
                ...(current[rowKey] || {}),
                notes: (() => {
                    const nextNotes = (current[rowKey]?.notes || []).filter((note) => note.clientId !== clientId);
                    return nextNotes.length ? nextNotes : [createEmptyDraftNote()];
                })(),
            },
        }));
    }

    function restoreTextareaSelection(clientId, selectionStart, selectionEnd) {
        const restore = () => {
            const textarea = noteTextareaRefs.current[clientId];
            if (!textarea) return;
            textarea.focus();
            textarea.setSelectionRange(selectionStart, selectionEnd);
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(restore);
            return;
        }

        setTimeout(restore, 0);
    }

    function applyMarkdownToDraftNote(note, action) {
        const textarea = noteTextareaRefs.current[note.clientId];
        const text = String(note.text || '');
        const result = applyMapNoteMarkdownAction({
            value: text,
            selectionStart: textarea?.selectionStart ?? text.length,
            selectionEnd: textarea?.selectionEnd ?? text.length,
            action,
        });
        const nextText = result.value.slice(0, 1000);
        updateDraftNote(note.clientId, { text: nextText });
        restoreTextareaSelection(
            note.clientId,
            Math.min(result.selectionStart, nextText.length),
            Math.min(result.selectionEnd, nextText.length),
        );
    }

    function togglePreviewNote(clientId) {
        setPreviewNoteIds((current) => ({
            ...current,
            [clientId]: !current[clientId],
        }));
    }

    const draft = drafts[rowKey] || {
        notes: [createEmptyDraftNote()],
    };
    const draftNotes = draft.notes?.length ? draft.notes : [createEmptyDraftNote()];
    const isSaving = saveState === 'saving' || saveState === 'pending';
    const isSaved = saveState === 'saved';
    const didSaveFail = saveState === 'error';
    const shouldShowSaveStatus = saveState !== 'idle' && !didSaveFail;
    const markdownToolbarActions = [
        { action: 'bold', label: t('mapNoteMarkdownBold'), icon: Bold },
        { action: 'italic', label: t('mapNoteMarkdownItalic'), icon: Italic },
        { action: 'bullet-list', label: t('mapNoteMarkdownBulletList'), icon: List },
        { action: 'numbered-list', label: t('mapNoteMarkdownNumberedList'), icon: ListOrdered },
        { action: 'link', label: t('mapNoteMarkdownLink'), icon: Link2 },
    ];

    return (
        <div className="space-y-3">
            <p className="rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold leading-5 text-brand-800">
                {t('mapNotesPrivacyHelp')}
            </p>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

            <div className="grid gap-2.5">
                {draftNotes.map((note, index) => {
                    const isPreviewing = Boolean(previewNoteIds[note.clientId]);
                    const noteLength = note.text.length;
                    const hasReachedNoteLimit = noteLength >= MAP_NOTE_MAX_LENGTH;

                    return (
                        <div key={note.clientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1">
                                    {markdownToolbarActions.map(({ action, label, icon: Icon }) => (
                                        <MapNoteToolbarButton
                                            key={action}
                                            label={label}
                                            onClick={() => applyMarkdownToDraftNote(note, action)}
                                        >
                                            <Icon size={15} strokeWidth={2.3} />
                                        </MapNoteToolbarButton>
                                    ))}
                                </div>
                                <MapNoteToolbarButton
                                    label={t('mapNoteMarkdownPreview')}
                                    active={isPreviewing}
                                    onClick={() => togglePreviewNote(note.clientId)}
                                >
                                    <Eye size={15} strokeWidth={2.3} />
                                </MapNoteToolbarButton>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    {isPreviewing ? (
                                        <div className="min-h-[96px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-base leading-7 text-slate-800 sm:text-sm sm:leading-6">
                                            {note.text.trim() ? (
                                                <MarkdownLiteText
                                                    text={note.text}
                                                    compact
                                                    className="text-slate-700"
                                                />
                                            ) : (
                                                <p className="text-slate-400">{t('mapNotePlaceholder')}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <textarea
                                            ref={(element) => {
                                                if (element) {
                                                    noteTextareaRefs.current[note.clientId] = element;
                                                    resizeTextareaToContent(element);
                                                } else {
                                                    delete noteTextareaRefs.current[note.clientId];
                                                }
                                            }}
                                            value={note.text}
                                            onChange={(event) => {
                                                resizeTextareaToContent(event.currentTarget);
                                                updateDraftNote(note.clientId, { text: event.target.value });
                                            }}
                                            maxLength={MAP_NOTE_MAX_LENGTH}
                                            rows={3}
                                            className="min-h-[96px] w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-base leading-7 text-slate-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 sm:text-sm sm:leading-6"
                                            placeholder={t('mapNotePlaceholder')}
                                        />
                                    )}
                                    <p className={`mt-1 text-right text-[11px] font-bold ${
                                        hasReachedNoteLimit ? 'text-amber-700' : 'text-slate-400'
                                    }`}>
                                        {hasReachedNoteLimit
                                            ? t('mapNoteLimitReached', { count: noteLength, limit: MAP_NOTE_MAX_LENGTH })
                                            : t('mapNoteCharacterCount', { count: noteLength, limit: MAP_NOTE_MAX_LENGTH })}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeDraftNote(note.clientId)}
                                    className="mt-1 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={t('removeNote')}
                                    disabled={draftNotes.length === 1 && !note.text.trim() && index === 0}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-1 text-sm font-bold text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={note.isShared}
                                    onChange={(event) => updateDraftNote(note.clientId, { isShared: event.target.checked }, { immediate: true })}
                                    className="h-5 w-5 rounded border-slate-300 accent-brand-600"
                                />
                                {t('shareThisNote')}
                            </label>
                        </div>
                    );
                })}
                <button
                    type="button"
                    onClick={addDraftNote}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-dashed border-brand-200 bg-white px-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                    <Plus size={16} />
                    {t('addAnotherNote')}
                </button>
            </div>

            <div className="flex min-h-10 flex-wrap items-center justify-end gap-3" aria-live="polite" aria-atomic="true">
                {shouldShowSaveStatus ? (
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        isSaving
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-brand-50 text-brand-700'
                    }`}>
                        {isSaving || !isSaved ? t('saving') : t('saved')}
                    </span>
                ) : null}
                {didSaveFail ? (
                    <button
                        type="button"
                        onClick={() => void flushDraftChanges()}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-3 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100"
                    >
                        <RefreshCw size={15} />
                        {t('saveNotes')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function ResourceNotesReadOnly({ row }) {
    const { t } = useLocale();
    const notes = normalizeNoteItems(row?.notes);

    if (!notes.length) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                {t('noSharedNotes')}
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {notes.map((note, index) => (
                <div key={`${note.id || index}-${note.text}`} className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
                    <MarkdownLiteText
                        text={note.text}
                        compact
                        className="text-sm leading-6 text-brand-900"
                        linkClassName="text-brand-700 underline break-all"
                    />
                </div>
            ))}
        </div>
    );
}

function MapNotesOverlay({
    open,
    rows,
    selectedKey,
    mode,
    onSelectResource,
    onBackToList,
    onClose,
    onUpdateResourceNotes,
}) {
    const { t } = useLocale();
    const visibleRows = mode === 'shared'
        ? rows.filter(hasAnyOwnerNote)
        : rows;
    const selectedRow = selectedKey
        ? visibleRows.find((row) => getRowAssetKey(row) === selectedKey) || null
        : null;
    const summary = getMapNoteResourceSummary(visibleRows);
    const readonly = mode !== 'owner';
    const flushEditorRef = useRef(null);

    const registerEditorFlush = useCallback((flush) => {
        flushEditorRef.current = typeof flush === 'function' ? flush : null;
    }, []);

    const flushEditorBeforeExit = useCallback(async () => {
        if (readonly || !flushEditorRef.current) return true;
        return flushEditorRef.current();
    }, [readonly]);

    const handleClose = useCallback(async () => {
        if (await flushEditorBeforeExit()) {
            onClose();
        }
    }, [flushEditorBeforeExit, onClose]);

    const handleBackToList = useCallback(async () => {
        if (await flushEditorBeforeExit()) {
            onBackToList();
        }
    }, [flushEditorBeforeExit, onBackToList]);

    useEffect(() => {
        if (!open || typeof window === 'undefined') return undefined;
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                void handleClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose, open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
            onClick={() => void handleClose()}
            role="presentation"
        >
            <section
                className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[86vh] sm:max-w-3xl sm:rounded-[28px]"
                role="dialog"
                aria-modal="true"
                aria-label={selectedRow ? t('viewResourceNotesFor', { name: selectedRow.name }) : t('openMapNotes')}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    {selectedRow ? (
                        <button
                            type="button"
                            onClick={() => void handleBackToList()}
                            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-100"
                            aria-label={t('backToMapNotesList')}
                        >
                            <ArrowLeft size={19} />
                        </button>
                    ) : (
                        <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                            <StickyNote size={19} strokeWidth={2.2} />
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
                        <p className="text-base font-black leading-tight text-slate-900">
                            {selectedRow ? selectedRow.name : t('mapNotes')}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-semibold leading-5 text-slate-500">
                            {selectedRow
                                ? `${selectedRow.mapNoteContext || ''}${selectedRow.mapNoteContext ? ' · ' : ''}${selectedRow.resourceType === 'hard' ? t('placeType') : t('offeringType')}`
                                : formatMapNotesSummary(summary, mode, t)}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleClose()}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        aria-label={t('closeMapNotes')}
                    >
                        <X size={19} />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    {selectedRow ? (
                        readonly ? (
                            <ResourceNotesReadOnly row={selectedRow} />
                        ) : (
                            <ResourceNotesEditor
                                row={selectedRow}
                                onUpdateResourceNotes={onUpdateResourceNotes}
                                onRegisterFlush={registerEditorFlush}
                            />
                        )
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">
                                {readonly ? t('mapNotesSharedListHelp') : t('mapNotesResourceListHelp')}
                            </p>
                            {visibleRows.map((row) => (
                                <button
                                    type="button"
                                    key={getRowAssetKey(row)}
                                    onClick={() => onSelectResource(row)}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                >
                                    <ResourceRowIcon
                                        resourceType={row.resourceType}
                                        bucket={row.bucket}
                                        subCategory={row.subCategory}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-black leading-tight text-slate-900">{row.name}</span>
                                        <span className="mt-1 block truncate text-xs font-semibold leading-5 text-slate-500">
                                            {row.mapNoteContext || (row.mapNoteSource === 'unmapped' ? t('unmappedResources') : '')}
                                        </span>
                                    </span>
                                    <span className="flex flex-shrink-0 items-center gap-1.5">
                                        {buildMapNoteRowBadgeParts(row, { mode }).map((part) => (
                                            <NoteCountPill key={part.key} count={part.count} tone={part.tone} />
                                        ))}
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

const DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH = 1280;

function useResponsiveDirectoryLayout(enabled) {
    const [isDesktop, setIsDesktop] = useState(() => (
        typeof window !== 'undefined'
            ? window.matchMedia(`(min-width: ${DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH}px)`).matches
            : true
    ));

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(`(min-width: ${DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH}px)`);
        const handleChange = (event) => setIsDesktop(event.matches);

        setIsDesktop(mediaQuery.matches);
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, [enabled]);

    return isDesktop;
}

function SaveResourceAction({ row, place, enabled = true }) {
    const { isAuth } = useAuth();
    const { isSaved, isSavedAssetPending, toggleSavedAsset } = useSavedAssets();
    const { t } = useLocale();

    if (!enabled || !isAuth || !row.saveEligible || row.status === 'unavailable') {
        return null;
    }

    const saved = isSaved(row.resourceType, row.resourceId);
    const pending = isSavedAssetPending(row.resourceType, row.resourceId);

    async function handleClick() {
        if (saved || pending) return;
        try {
            await toggleSavedAsset(row.resourceType, row.resourceId, {
                name: row.name,
                subCategory: row.subCategory,
                address: place.address,
                lat: place.lat,
                lng: place.lng,
                detailPath: row.detailPath,
            });
        } catch (error) {
            console.error(error);
        }
    }

    if (saved) {
        return <span className="text-sm font-semibold text-brand-700">{t('saved')}</span>;
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            className="text-sm font-semibold text-brand-700 transition hover:text-brand-800 disabled:cursor-wait disabled:opacity-60"
        >
            {pending ? t('saving') : t('save')}
        </button>
    );
}

function getGroupDetailPath(group) {
    if (Number.isInteger(group?.placeId) && group.placeId > 0) {
        return `/resource/hard/${group.placeId}`;
    }

    return group?.rows?.find((row) => row.detailPath && row.status !== 'unavailable')?.detailPath || null;
}

function normalizeLabel(value) {
    return String(value || '').trim().toLowerCase();
}

function isRepeatedPrimaryRow(group, row) {
    return Boolean(normalizeLabel(group?.name)) && normalizeLabel(group?.name) === normalizeLabel(row?.name);
}

function getVisibleGroupRows(group) {
    return (group?.rows || []).filter((row) => !isRepeatedPrimaryRow(group, row));
}

function getPrimaryPlaceNoteRow(group) {
    const notedRows = getNoteRowsForGroup(group).filter(hasAnyOwnerNote);
    return notedRows.find((row) => row?.resourceType === 'hard' && isRepeatedPrimaryRow(group, row))
        || notedRows.find((row) => row?.resourceType === 'hard')
        || null;
}

function getGroupHoverLogoRow(group) {
    return (group?.rows || []).find((row) => row?.logoUrl);
}

function getNestedPlaceLogoRow(place) {
    return (place?.rows || []).find((row) => row?.logoUrl) || null;
}

function getGroupKeys(group) {
    return [group?.placeKey, ...(group?.memberPlaceKeys || [])]
        .filter(Boolean)
        .map((value) => String(value));
}

function matchesGroupKey(group, candidateKey) {
    if (!candidateKey) return false;
    const normalizedCandidate = String(candidateKey);
    return getGroupKeys(group).includes(normalizedCandidate);
}

function isGroupHighlighted(group, highlightPlaceKey, highlightPlaceKeys = []) {
    return matchesGroupKey(group, highlightPlaceKey)
        || (highlightPlaceKeys || []).some((value) => matchesGroupKey(group, value));
}

function isGroupLogoRevealed(group, logoRevealPlaceKeys = []) {
    return (logoRevealPlaceKeys || []).some((value) => matchesGroupKey(group, value));
}

function getSecondaryCategory(row, t) {
    return row?.subCategory || row?.bucket || (row?.resourceType === 'hard' ? t('placeType') : t('offeringType'));
}

function HiddenLogoSlot({ logoRow, revealed = false, compactInteractive = false }) {
    const { t } = useLocale();
    const [logoFitMode, setLogoFitMode] = useState('cover');
    const slotClassName = compactInteractive ? 'h-[2.125rem] w-[2.125rem]' : 'h-[2.375rem] w-[2.375rem]';
    const imageClassName = logoFitMode === 'contain'
        ? 'h-full w-full rounded-[inherit] object-contain p-[2px]'
        : 'h-full w-full rounded-[inherit] object-cover';
    const visibilityClassName = revealed
        ? 'opacity-100 scale-100'
        : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100';

    return (
        <span
            aria-hidden="true"
            className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_22px_-18px_rgba(15,23,42,0.55)] ring-1 ring-white/90 transition-all duration-300 ${slotClassName} ${visibilityClassName}`}
        >
            {logoRow?.logoUrl ? (
                <img
                    src={logoRow.logoUrl}
                    alt={logoRow.name || t('assetLogoAlt')}
                    className={imageClassName}
                    onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget;
                        if (!naturalWidth || !naturalHeight) return;
                        const aspectRatio = naturalWidth / naturalHeight;
                        setLogoFitMode(aspectRatio > 1.2 || aspectRatio < 0.84 ? 'contain' : 'cover');
                    }}
                />
            ) : null}
        </span>
    );
}

function DirectoryLocationMeta({ shortLocationLine, distanceLabel, compact = false }) {
    if (!shortLocationLine && !distanceLabel) return null;

    return (
        <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
            {shortLocationLine ? (
                <p className={`${compact ? 'text-[0.6875rem]' : 'text-[0.75rem]'} font-medium text-slate-500`}>{shortLocationLine}</p>
            ) : null}
            {distanceLabel ? (
                <span className={`inline-flex rounded-full border border-brand-200 bg-brand-50 font-bold text-brand-700 ${compact ? 'px-1.5 py-0.5 text-[0.5625rem]' : 'px-2 py-0.5 text-[0.625rem]'}`}>
                    {distanceLabel}
                </span>
            ) : null}
        </div>
    );
}

function DirectoryResourceRow({
    row,
    place,
    mode,
    interactive,
    compactInteractive = false,
    showDivider = false,
    canSaveResources,
    onOpenResourceNotes,
    allowPrintLinks = false,
    compactPrint = false,
}) {
    const detailPath = useDirectoryDetailPath(row.detailPath);
    const canOpenDetail = Boolean(detailPath) && row.status !== 'unavailable';
    const access = row?.resourceType === 'soft' ? (row.access || OFFERING_ACCESS.GRANTED) : null;
    const isAccessRestricted = row?.resourceType === 'soft' && access !== OFFERING_ACCESS.GRANTED;
    const sharedNotes = normalizeNoteItems(row?.notes);
    const rowTitleClassName = interactive
        ? (compactInteractive ? 'text-[0.75rem]' : 'text-[0.875rem]')
        : (compactPrint ? 'text-[0.6875rem]' : 'text-[0.75rem]');

    if (!interactive) {
        const printRowTitle = canOpenDetail && allowPrintLinks ? (
            <Link to={detailPath} reloadDocument className={`font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                {row.name}
            </Link>
        ) : (
            <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
        );

        return (
            <div className="border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-1.5">
                        {printRowTitle}
                        <AvailabilityCountBadge row={row} compact />
                        {row.status === 'unavailable' ? <StatusBadge status={row.status} /> : null}
                    </div>
                </div>
                {mode === 'shared' ? <SharedResourceNotes notes={sharedNotes} print /> : null}
            </div>
        );
    }

    return (
        <div className={showDivider ? 'border-t border-slate-100 pt-1.5' : ''} style={{ opacity: isAccessRestricted ? 0.82 : 1 }}>
            <div className={`flex items-start justify-between ${mode === 'shared' ? (compactInteractive ? 'gap-2' : 'gap-3') : ''}`}>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
                        <span className="mt-[0.6em] h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                    {canOpenDetail ? (
                                        <Link to={detailPath} reloadDocument className={`block font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                                            {row.name}
                                        </Link>
                                    ) : (
                                        <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
                                    )}
                                </div>
                                <MapNoteIconButton
                                    row={row}
                                    onOpenResourceNotes={onOpenResourceNotes}
                                    compact={compactInteractive}
                                />
                            </div>
                            {row.resourceType === 'soft' && row.availabilityEnabled ? (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <AvailabilityCountBadge row={row} compact={compactInteractive} />
                                </div>
                            ) : null}
                            {row.resourceType === 'soft' ? (
                                <OfferingAccessNotice
                                    access={access}
                                    missingProfileFields={row.missingProfileFields}
                                    compact
                                    className="mt-2"
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
                {mode === 'shared' ? (
                    <div className="ml-2 flex flex-shrink-0 items-start">
                        <SaveResourceAction row={row} place={place} enabled={canSaveResources} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function DirectoryPlaceBadge({
    group,
    clusterColorData,
    compactInteractive = false,
    hoverLogoRow = null,
    logoRevealed = false,
    onViewOnMap,
}) {
    const { t } = useLocale();
    const [logoFitMode, setLogoFitMode] = useState('cover');
    const hasHoverLogo = Boolean(hoverLogoRow?.logoUrl);
    const wrapperClassName = compactInteractive ? 'h-[2.625rem] w-[2.625rem]' : 'h-[2.875rem] w-[2.875rem]';
    const numberBadgeClassName = compactInteractive
        ? 'inset-[0.25rem] rounded-[0.6875rem]'
        : 'inset-[0.25rem] rounded-[0.8125rem]';
    const logoTileClassName = compactInteractive
        ? 'rounded-[0.9375rem]'
        : 'rounded-[1.0625rem]';
    const numberBadgeVisibilityClassName = hasHoverLogo
        ? (logoRevealed
            ? 'opacity-0 scale-[0.82]'
            : 'opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-[0.82]')
        : 'opacity-100 scale-100';
    const logoVisibilityClassName = logoRevealed
        ? 'opacity-100 scale-100'
        : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100';
    const logoImageClassName = logoFitMode === 'contain'
        ? 'h-full w-full rounded-[inherit] object-contain p-[2px]'
        : 'h-full w-full rounded-[inherit] object-cover';

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onViewOnMap?.(group.placeKey);
            }}
            className={`relative flex flex-shrink-0 items-center justify-center ${wrapperClassName}`}
            aria-label={`${t('viewOnMap')}: ${group.name}`}
            title={t('viewOnMap')}
        >
            <span
                className={`absolute ${numberBadgeClassName} flex items-center justify-center font-black text-white shadow-sm transition-all duration-300 hover:opacity-90 ${numberBadgeVisibilityClassName}`}
                style={{
                    backgroundColor: clusterColorData ? clusterColorData.core : '#0f766e',
                    fontSize: String(group.number).length > 2 ? '0.75rem' : (compactInteractive ? '1rem' : '1.125rem'),
                    fontFamily: 'var(--font-heading)',
                    lineHeight: 1,
                }}
            >
                {group.number}
            </span>

            {hasHoverLogo ? (
                <span
                    className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden border border-slate-200/90 bg-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.55)] ring-1 ring-white/90 transition-all duration-300 ${logoTileClassName} ${logoVisibilityClassName}`}
                    aria-hidden="true"
                >
                    <img
                        src={hoverLogoRow.logoUrl}
                        alt={hoverLogoRow.name || group.name}
                        className={logoImageClassName}
                        onLoad={(event) => {
                            const { naturalWidth, naturalHeight } = event.currentTarget;
                            if (!naturalWidth || !naturalHeight) return;
                            const aspectRatio = naturalWidth / naturalHeight;
                            setLogoFitMode(aspectRatio > 1.2 || aspectRatio < 0.84 ? 'contain' : 'cover');
                        }}
                    />
                </span>
            ) : null}
        </button>
    );
}

function DirectoryNestedPlaceSection({
    nestedPlace,
    mode,
    compactInteractive = false,
    canSaveResources,
    onRemoveResource,
    onOpenResourceNotes,
}) {
    const nestedPlaceDetailPath = useDirectoryDetailPath(getGroupDetailPath(nestedPlace));
    const visibleRows = getVisibleGroupRows(nestedPlace);
    const titleClassName = compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]';
    const primaryNoteRow = getPrimaryPlaceNoteRow(nestedPlace);

    return (
        <div className={compactInteractive ? 'space-y-1.5' : 'space-y-2'}>
            <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                    {nestedPlaceDetailPath ? (
                        <Link to={nestedPlaceDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${titleClassName}`}>
                            {nestedPlace.name}
                        </Link>
                    ) : (
                        <h4 className={`font-bold leading-tight text-slate-900 ${titleClassName}`}>{nestedPlace.name}</h4>
                    )}
                </div>
                <MapNoteIconButton
                    row={primaryNoteRow}
                    onOpenResourceNotes={onOpenResourceNotes}
                    compact={compactInteractive}
                />
            </div>

            {visibleRows.length ? (
                <div className={`border-l border-slate-100 ${compactInteractive ? 'space-y-1.5 pl-2.5' : 'space-y-2.5 pl-3.5'}`}>
                    {visibleRows.map((row, index) => (
                        <DirectoryResourceRow
                            key={row.rowKey}
                            row={row}
                            place={nestedPlace}
                            mode={mode}
                            interactive
                            compactInteractive={compactInteractive}
                            showDivider={compactInteractive && index > 0}
                            canSaveResources={canSaveResources}
                            onRemoveResource={onRemoveResource}
                            onOpenResourceNotes={onOpenResourceNotes}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function DirectoryPlaceGroupCard({
    group,
    mode,
    interactive,
    compactInteractive = false,
    fullCardLink = false,
    onViewOnMap,
    onRemoveResource,
    onUpdateResourceNotes,
    onOpenResourceNotes,
    canSaveResources,
    highlighted,
    sectionRef,
    allowPrintLinks = false,
    compactPrint = false,
    clusterColorData = null,
    showDesktopHoverLogo = false,
    logoRevealed = false,
}) {
    const placeDetailPath = useDirectoryDetailPath(getGroupDetailPath(group));
    const visibleRows = getVisibleGroupRows(group);
    const isPostalGroup = Boolean(group?.isPostalGroup && Array.isArray(group?.nestedPlaces) && group.nestedPlaces.length > 1);
    const printHighlightClassName = 'border-orange-400 ring-2 ring-orange-300 shadow-[0_0_0_3px_rgba(249,115,22,0.16)]';
    const primaryNoteRow = getPrimaryPlaceNoteRow(group);

    if (!interactive) {
        if (isPostalGroup) {
            return (
                <section
                    ref={sectionRef}
                    className={`break-inside-avoid rounded-[18px] border border-slate-200/90 bg-white/90 px-3 py-2.5 transition ${
                        highlighted ? printHighlightClassName : ''
                    }`}
                >
                    <div className="flex items-start gap-2.5">
                        <div
                            className={`flex flex-shrink-0 items-center justify-center rounded-lg font-black text-white ${compactPrint ? 'h-7 w-7' : 'h-8 w-8'}`}
                            style={{
                                backgroundColor: clusterColorData ? clusterColorData.core : '#0f766e',
                                fontSize: String(group.number).length > 2 ? '0.6875rem' : (compactPrint ? '0.9375rem' : '1.0625rem'),
                                fontFamily: 'var(--font-heading)',
                                lineHeight: 1,
                            }}
                        >
                            {group.number}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="space-y-3">
                                {group.nestedPlaces.map((nestedPlace) => {
                                    const nestedPlaceDetailPath = getGroupDetailPath(nestedPlace);
                                    const nestedPlaceTitle = nestedPlaceDetailPath && allowPrintLinks ? (
                                        <Link to={nestedPlaceDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${compactPrint ? 'text-[0.9375rem]' : 'text-base'}`}>
                                            {nestedPlace.name}
                                        </Link>
                                    ) : (
                                        <h3 className={`font-bold leading-tight text-slate-900 ${compactPrint ? 'text-[0.9375rem]' : 'text-base'}`}>
                                            {nestedPlace.name}
                                        </h3>
                                    );

                                    return (
                                        <div key={nestedPlace.placeKey} className="space-y-1.5">
                                            {nestedPlaceTitle}
                                            <div className={compactPrint ? 'space-y-0.5' : 'space-y-1'}>
                                                {getVisibleGroupRows(nestedPlace).map((row) => (
                                                    <DirectoryResourceRow
                                                        key={row.rowKey}
                                                        row={row}
                                                        place={nestedPlace}
                                                        mode={mode}
                                                        interactive={false}
                                                        canSaveResources={canSaveResources}
                                                        allowPrintLinks={allowPrintLinks}
                                                        compactPrint={compactPrint}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>
            );
        }

        const printPlaceTitle = placeDetailPath && allowPrintLinks ? (
            <Link to={placeDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${compactPrint ? 'text-[0.9375rem]' : 'text-base'}`}>
                {group.name}
            </Link>
        ) : (
            <h3 className={`font-bold leading-tight text-slate-900 ${compactPrint ? 'text-[0.9375rem]' : 'text-base'}`}>{group.name}</h3>
        );

        return (
            <section
                ref={sectionRef}
                className={`break-inside-avoid rounded-[18px] border border-slate-200/90 bg-white/90 px-3 py-2.5 transition ${
                    highlighted ? printHighlightClassName : ''
                }`}
            >
                <div className="flex items-start gap-2.5">
                    <div 
                        className={`flex flex-shrink-0 items-center justify-center rounded-lg font-black text-white ${compactPrint ? 'h-7 w-7' : 'h-8 w-8'}`}
                        style={{ 
                            backgroundColor: clusterColorData ? clusterColorData.core : '#0f766e',
                            fontSize: String(group.number).length > 2 ? '0.6875rem' : (compactPrint ? '0.9375rem' : '1.0625rem'),
                            fontFamily: 'var(--font-heading)',
                            lineHeight: 1,
                        }}
                    >
                        {group.number}
                    </div>
                    <div className="min-w-0 flex-1">
                        {printPlaceTitle}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {group.shortLocationLine ? (
                                <p className={`${compactPrint ? 'text-[0.625rem]' : 'text-[0.6875rem]'} text-slate-500`}>{group.shortLocationLine}</p>
                            ) : null}
                            {group.distanceLabel ? (
                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.625rem] font-bold text-brand-700">
                                    {group.distanceLabel}
                                </span>
                            ) : null}
                        </div>

                        {visibleRows.length ? (
                            <div className={`mt-1 ${compactPrint ? 'space-y-0.5' : 'space-y-1'}`}>
                                {visibleRows.map((row) => (
                                    <DirectoryResourceRow
                                        key={row.rowKey}
                                        row={row}
                                        place={group}
                                        mode={mode}
                                        interactive={false}
                                        canSaveResources={canSaveResources}
                                        allowPrintLinks={allowPrintLinks}
                                        compactPrint={compactPrint}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    if (isPostalGroup) {
        const primaryNestedPlace = group.nestedPlaces[0] || null;
        const trailingNestedPlaces = group.nestedPlaces.slice(1);
        const primaryHoverLogoRow = getNestedPlaceLogoRow(primaryNestedPlace);
        const groupedCardContent = (
            <div className={`grid ${compactInteractive ? 'grid-cols-[2.625rem_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3'}`}>
                <DirectoryPlaceBadge
                    group={group}
                    clusterColorData={clusterColorData}
                    compactInteractive={compactInteractive}
                    hoverLogoRow={primaryHoverLogoRow}
                    logoRevealed={logoRevealed}
                    onViewOnMap={onViewOnMap}
                />
                <div className="min-w-0">
                    <DirectoryLocationMeta
                        shortLocationLine={group.shortLocationLine}
                        distanceLabel={group.distanceLabel}
                        compact={compactInteractive}
                    />
                    {primaryNestedPlace ? (
                        <div className={compactInteractive ? 'mt-2' : 'mt-2.5'}>
                            <DirectoryNestedPlaceSection
                                nestedPlace={primaryNestedPlace}
                                mode={mode}
                                compactInteractive={compactInteractive}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onOpenResourceNotes={onOpenResourceNotes}
                            />
                        </div>
                    ) : null}
                </div>

                {trailingNestedPlaces.length ? (
                    <div className={`col-span-2 ${compactInteractive ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}`}>
                        {trailingNestedPlaces.map((nestedPlace) => (
                            <div
                                key={nestedPlace.placeKey}
                                className={`grid items-start ${compactInteractive ? 'grid-cols-[2.625rem_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3'}`}
                            >
                                <HiddenLogoSlot
                                    logoRow={getNestedPlaceLogoRow(nestedPlace)}
                                    revealed={logoRevealed}
                                    compactInteractive={compactInteractive}
                                />
                                <DirectoryNestedPlaceSection
                                    nestedPlace={nestedPlace}
                                    mode={mode}
                                    compactInteractive={compactInteractive}
                                    canSaveResources={canSaveResources}
                                    onRemoveResource={onRemoveResource}
                                    onOpenResourceNotes={onOpenResourceNotes}
                                />
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );

        return (
            <section
                ref={sectionRef}
                className={`group relative overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                    highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
                } scroll-mt-[62svh] lg:scroll-mt-6`}
            >
                {groupedCardContent}
            </section>
        );
    }

    const interactivePlaceTitle = placeDetailPath ? (
        <Link to={placeDetailPath} reloadDocument className={`${compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]'} font-bold leading-tight text-slate-900 transition hover:text-brand-700`}>
            {group.name}
        </Link>
    ) : (
        <h3 className={`${compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]'} font-bold leading-tight text-slate-900`}>{group.name}</h3>
    );
    const hoverLogoRow = showDesktopHoverLogo ? getGroupHoverLogoRow(group) : null;

    const cardContent = (
        <>
            <div className={`flex items-start ${compactInteractive ? 'gap-2.5' : 'gap-3'}`}>
                <DirectoryPlaceBadge
                    group={group}
                    clusterColorData={clusterColorData}
                    compactInteractive={compactInteractive}
                    hoverLogoRow={hoverLogoRow}
                    logoRevealed={logoRevealed}
                    onViewOnMap={onViewOnMap}
                />
                <div className="min-w-0 flex-1">
                    <DirectoryLocationMeta
                        shortLocationLine={group.shortLocationLine}
                        distanceLabel={group.distanceLabel}
                        compact={compactInteractive}
                    />
                    <div className={`${compactInteractive ? 'mt-2' : 'mt-2.5'} flex items-start gap-2`}>
                        <div className="min-w-0 flex-1">
                            {interactivePlaceTitle}
                        </div>
                        <MapNoteIconButton
                            row={primaryNoteRow}
                            onOpenResourceNotes={onOpenResourceNotes}
                            compact={compactInteractive}
                        />
                    </div>

                    {visibleRows.length ? (
                        <div className={`border-t border-l border-slate-100 ${compactInteractive ? 'mt-2 space-y-1.5 pl-2.5 pt-2' : 'mt-3 space-y-2.5 pl-3.5 pt-3'}`}>
                            {visibleRows.map((row, index) => (
                                <DirectoryResourceRow
                                    key={row.rowKey}
                                    row={row}
                                    place={group}
                                    mode={mode}
                                    interactive
                                    compactInteractive={compactInteractive}
                                    showDivider={compactInteractive && index > 0}
                                    canSaveResources={canSaveResources}
                                    onOpenResourceNotes={onOpenResourceNotes}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );

    if (placeDetailPath && fullCardLink && !isPostalGroup) {
        return (
            <Link
                to={placeDetailPath}
                reloadDocument
                ref={sectionRef}
                className={`group relative block overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                    highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
                } scroll-mt-[62svh] lg:scroll-mt-6`}
            >
                {cardContent}
            </Link>
        );
    }

    return (
        <section
            ref={sectionRef}
            className={`group relative overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
            } scroll-mt-[62svh] lg:scroll-mt-6`}
        >
            {cardContent}
        </section>
    );
}

function DirectoryUnmappedRow({ row, interactive, mode, canSaveResources, onRemoveResource, onOpenResourceNotes, compact = false }) {
    const { t } = useLocale();
    const place = useMemo(() => ({
        address: row.locationLabel || row.contextLabel || row.placeName || '',
        lat: null,
        lng: null,
    }), [row.contextLabel, row.locationLabel, row.placeName]);
    const detailPath = useDirectoryDetailPath(row.detailPath);
    const sharedNotes = normalizeNoteItems(row?.notes);

    if (!interactive) {
        const canOpenDetail = Boolean(detailPath) && row.status !== 'unavailable';

        return (
            <div className="border-b border-slate-200/80 pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-start gap-2">
                    <span className="mt-[0.3125rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    <div className="min-w-0 flex-1">
                        {canOpenDetail ? (
                            <Link to={detailPath} reloadDocument className="text-[0.75rem] font-semibold leading-snug text-slate-800 transition hover:text-brand-700">
                                {row.name}
                            </Link>
                        ) : (
                            <p className="text-[0.75rem] font-semibold leading-snug text-slate-800">{row.name}</p>
                        )}
                        {row.contextLabel ? <p className="mt-0.5 text-[0.625rem] text-slate-500">{row.contextLabel}</p> : null}
                        {mode === 'shared' ? <SharedResourceNotes notes={sharedNotes} print /> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white shadow-sm ${compact ? 'p-3' : 'p-4'}`}>
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
                logoUrl={row.logoUrl}
                alt={row.name ? `${row.name} logo` : ''}
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {row.subCategory ? (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-900">
                                    {row.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge status={row.status || 'list_only'} />
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-900">
                                {t('listOnly')}
                            </span>
                        </div>
                        <div className="mt-1.5 flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                {detailPath && row.status !== 'unavailable' ? (
                                    <Link to={detailPath} reloadDocument className={`block font-bold leading-snug text-slate-900 transition hover:text-brand-700 ${compact ? 'text-[0.9375rem]' : 'text-base'}`}>
                                        {row.name}
                                    </Link>
                                ) : (
                                    <p className={`font-bold leading-snug text-slate-900 ${compact ? 'text-[0.9375rem]' : 'text-base'}`}>{row.name}</p>
                                )}
                            </div>
                            <MapNoteIconButton row={row} onOpenResourceNotes={onOpenResourceNotes} />
                        </div>
                        {!compact && row.contextLabel ? (
                            <p className="mt-1 text-sm text-slate-500">{row.contextLabel}</p>
                        ) : null}
                        {row.locationLabel ? (
                            <p className={`mt-1 text-slate-400 ${compact ? 'line-clamp-1 text-xs' : 'text-sm'}`}>{row.locationLabel}</p>
                        ) : null}
                        <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 font-semibold uppercase tracking-[0.08em] text-slate-400 ${compact ? 'text-[0.625rem]' : 'text-[0.6875rem]'}`}>
                            <span>{row.resourceType === 'hard' ? t('placeType') : t('offeringType')}</span>
                            {row.bucket ? <span>{row.bucket}</span> : null}
                            {row.resourceType === 'soft' && row.availabilityEnabled ? (
                                <span className="normal-case tracking-normal text-brand-700">
                                    {formatAvailabilityLabel(
                                        normalizeAvailabilityCount(row.availabilityCount),
                                        normalizeAvailabilityUnit(row.availabilityUnit),
                                    )}
                                </span>
                            ) : null}
                        </div>
                        {row.descriptor && !compact ? (
                            <p className="mt-1.5 text-sm leading-6 text-slate-500">{row.descriptor}</p>
                        ) : null}
                    </div>

                    {interactive ? (
                        <div className="flex items-center gap-3">
                            {mode === 'shared' ? <SaveResourceAction row={row} place={place} enabled={canSaveResources} /> : null}
                            {mode === 'owner' ? (
                                <button
                                    type="button"
                                    onClick={() => onRemoveResource?.(row)}
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-red-600"
                                >
                                    <Trash2 size={15} />
                                    {t('remove')}
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {interactive && !compact ? (
                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                        {detailPath && row.status !== 'unavailable' ? (
                            <Link to={detailPath} reloadDocument className="text-brand-700 transition hover:text-brand-800">
                                {t('viewDetails')}
                            </Link>
                        ) : (
                            <span className="text-slate-400">{t('viewDetailsUnavailable')}</span>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function DirectoryGroupColumn({
    groups,
    mode,
    interactive,
    compactInteractive = false,
    fullCardLink = false,
    onViewOnMap,
    onRemoveResource,
    onUpdateResourceNotes,
    onOpenResourceNotes,
    canSaveResources,
    highlightPlaceKey,
    highlightPlaceKeys = [],
    sectionRefs,
    preserveSlot = false,
    allowPrintLinks = false,
    compactPrint = false,
    clusterMapping = {},
    showDesktopHoverLogo = false,
    logoRevealPlaceKeys = [],
    afterContent = null,
}) {
    if (!groups.length && !afterContent) {
        return preserveSlot ? <div aria-hidden="true" className="min-h-px" /> : null;
    }

    return (
        <div className={interactive ? (compactInteractive ? 'space-y-3' : 'space-y-4') : (compactPrint ? 'space-y-1.5' : 'space-y-2')}>
            {groups.map((group) => (
                <DirectoryPlaceGroupCard
                    key={group.placeKey}
                    group={group}
                    mode={mode}
                    interactive={interactive}
                    compactInteractive={compactInteractive}
                    fullCardLink={fullCardLink}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    onUpdateResourceNotes={onUpdateResourceNotes}
                    onOpenResourceNotes={onOpenResourceNotes}
                    canSaveResources={canSaveResources}
                    highlighted={isGroupHighlighted(group, highlightPlaceKey, highlightPlaceKeys)}
                    allowPrintLinks={allowPrintLinks}
                    compactPrint={compactPrint}
                    clusterColorData={clusterMapping[group.placeKey] || null}
                    showDesktopHoverLogo={showDesktopHoverLogo}
                    logoRevealed={isGroupLogoRevealed(group, logoRevealPlaceKeys)}
                    sectionRef={(node) => {
                        if (node) {
                            sectionRefs.current[group.placeKey] = node;
                        }
                    }}
                />
            ))}
            {afterContent}
        </div>
    );
}

function DirectoryUnmappedSection({
    rows,
    interactive,
    mode,
    canSaveResources,
    onRemoveResource,
    onOpenResourceNotes,
    compact = false,
    className = '',
}) {
    const { t } = useLocale();
    if (!rows.length) {
        return null;
    }

    if (compact) {
        return (
            <section className={`space-y-3 ${className}`.trim()}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('resourcesNotShownOnMap')}</p>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.6875rem] font-bold text-slate-600">
                        {rows.length}
                    </span>
                </div>
                {rows.map((row) => (
                    <DirectoryUnmappedRow
                        key={row.rowKey}
                        row={row}
                        interactive={interactive}
                        mode={mode}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                        onOpenResourceNotes={onOpenResourceNotes}
                        compact
                    />
                ))}
            </section>
        );
    }

    return (
        <section className={`border border-slate-200 ${interactive ? 'rounded-[28px] bg-white p-5 shadow-sm sm:p-6' : 'rounded-[30px] bg-slate-50/70 p-5 shadow-none sm:p-6'} ${className}`.trim()}>
            <div className={`border-b ${interactive ? 'border-slate-100 pb-4' : 'border-slate-200/80 pb-3'}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('unmappedResources')}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{t('resourcesNotShownOnMap')}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                    {t('unmappedResourcesDescription')}
                </p>
            </div>

            <div className={`mt-4 ${interactive ? 'space-y-3' : 'space-y-2.5'}`}>
                {rows.map((row) => (
                    <DirectoryUnmappedRow
                        key={row.rowKey}
                        row={row}
                        interactive={interactive}
                        mode={mode}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                        onOpenResourceNotes={onOpenResourceNotes}
                        compact={false}
                    />
                ))}
            </div>
        </section>
    );
}

export default function SharedMapDirectoryList({
    presentation,
    mode = 'shared',
    layout = 'responsive',
    renderDesktopMap = null,
    renderMobileMap = null,
    onViewOnMap,
    onRemoveResource,
    onUpdateResourceNotes,
    highlightPlaceKey = null,
    highlightPlaceKeys = [],
    canSaveResources = true,
    className = '',
    desktopGridClassName = 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)_minmax(0,1fr)]',
    desktopMapWrapperClassName = '',
    mobileMapStickyClassName = 'sticky top-3 z-20 bg-slate-50 pb-2',
    allowPrintLinks = false,
    autoScrollToHighlight = true,
    showDesktopHoverLogo = false,
    desktopScrollTargetRef = null,
    selectionPlaceKey = null,
    selectionScrollRequest = 0,
}) {
    const { t } = useLocale();
    const location = useLocation();
    const sectionRefs = useRef({});
    const desktopMapWrapperRef = useRef(null);
    const mobileMapWrapperRef = useRef(null);
    const mobileMapPullStartYRef = useRef(null);
    const mobileMapScrollTopRef = useRef(0);
    const mobileMapSuppressCollapseUntilRef = useRef(0);
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const [clusterMapping, setClusterMapping] = useState({});
    const [mobileMapPanelState, setMobileMapPanelState] = useState(MOBILE_MAP_PANEL_STATES.EXPANDED);
    const isDesktop = useResponsiveDirectoryLayout(layout === 'responsive');
    const resolvedLayout = layout === 'responsive'
        ? (isDesktop ? 'desktop' : 'mobile')
        : layout;
    const interactive = layout !== 'print';
    const isMobileMapPanelEnabled = interactive && resolvedLayout === 'mobile';
    const isMobileMapCollapsed = isMobileMapPanelEnabled
        && mobileMapPanelState === MOBILE_MAP_PANEL_STATES.COLLAPSED;
    const useAdaptiveDesktopUnmapped = interactive && resolvedLayout === 'desktop';
    const mappedGroups = presentation?.mappedGroups || [];
    const leftGroups = presentation?.leftGroups || [];
    const rightGroups = presentation?.rightGroups || [];
    const unmappedRows = presentation?.unmappedRows || [];
    const desktopUnmappedPlacement = presentation?.desktopUnmappedPlacement || 'none';
    const leftUnmappedRows = presentation?.leftUnmappedRows || [];
    const rightUnmappedRows = presentation?.rightUnmappedRows || [];
    const dockedUnmappedRows = presentation?.dockedUnmappedRows || [];
    const noteResourceRows = useMemo(() => buildMapNoteResourceRows(presentation, {
        unmappedContextLabel: t('unmappedResources'),
    }), [presentation, t]);
    const [notesPanel, setNotesPanel] = useState({ open: false, selectedKey: null });
    const detailReturnPath = useMemo(() => (
        interactive ? normalizeMapReturnPath(buildCurrentAppPath(location)) : ''
    ), [interactive, location.hash, location.pathname, location.search]);
    const compactPrint = !interactive && (
        mappedGroups.length >= 7
        || mappedGroups.reduce((count, group) => count + group.rows.length, 0) >= 10
    );
    const interactiveRowCount = mappedGroups.reduce((count, group) => count + getVisibleGroupRows(group).length, 0);
    const compactInteractiveDesktop = interactive
        && resolvedLayout === 'desktop'
        && (mappedGroups.length >= 7 || interactiveRowCount >= 9);
    const logoRevealPlaceKeys = resolvedLayout === 'mobile'
        ? [selectionPlaceKey, highlightPlaceKey, ...highlightPlaceKeys].filter(Boolean)
        : (showDesktopHoverLogo
            ? (highlightPlaceKeys.length ? highlightPlaceKeys : (highlightPlaceKey ? [highlightPlaceKey] : []))
            : []);

    const getMobileScrollTop = useCallback(() => {
        if (typeof window === 'undefined') return 0;
        return Math.max(0, Math.round(window.scrollY || document.documentElement?.scrollTop || 0));
    }, []);

    const getMobileMapPanelStateForAction = useCallback((current, action) => {
        if (action === 'collapse' && Date.now() < mobileMapSuppressCollapseUntilRef.current) {
            return current;
        }

        if (action === 'collapse') {
            return MOBILE_MAP_PANEL_STATES.COLLAPSED;
        }

        if (action === 'expand') {
            return MOBILE_MAP_PANEL_STATES.EXPANDED;
        }

        return current;
    }, []);

    const expandMobileMapForFocus = useCallback(() => {
        if (!isMobileMapPanelEnabled) return;
        mobileMapSuppressCollapseUntilRef.current = Date.now() + 900;
        setMobileMapPanelState((current) => getMobileMapPanelStateAfterBadgeActivation({
            isMobile: true,
            mapPanelState: current,
        }));
    }, [isMobileMapPanelEnabled]);

    const handleDirectoryViewOnMap = useCallback((placeKey) => {
        expandMobileMapForFocus();
        onViewOnMap?.(placeKey);
    }, [expandMobileMapForFocus, onViewOnMap]);

    const handleMobileMapViewSection = useCallback((placeKey) => {
        expandMobileMapForFocus();
        renderMobileMap?.().props?.onViewSection?.(placeKey);
    }, [expandMobileMapForFocus, renderMobileMap]);

    const handleMobileMapClusterSelect = useCallback((placeKeys) => {
        expandMobileMapForFocus();
        renderMobileMap?.().props?.onClusterSelect?.(placeKeys);
    }, [expandMobileMapForFocus, renderMobileMap]);

    const handleMobileCardsWheel = useCallback((event) => {
        if (!isMobileMapPanelEnabled) return;

        const scrollTop = getMobileScrollTop();
        setMobileMapPanelState((current) => {
            if (shouldExpandMobileMapPanelFromTopPull({
                isMobile: true,
                mapPanelState: current,
                scrollTop,
                deltaY: event.deltaY,
            })) {
                return MOBILE_MAP_PANEL_STATES.EXPANDED;
            }

            const action = getMobileMapPanelActionForScroll({
                isMobile: true,
                mapPanelState: current,
                nextScrollTop: Math.max(0, scrollTop + event.deltaY),
                previousScrollTop: scrollTop,
            });
            return getMobileMapPanelStateForAction(current, action);
        });
    }, [getMobileMapPanelStateForAction, getMobileScrollTop, isMobileMapPanelEnabled]);

    const handleMobileCardsTouchStart = useCallback((event) => {
        if (!isMobileMapPanelEnabled) return;
        mobileMapPullStartYRef.current = event.touches?.[0]?.clientY ?? null;
    }, [isMobileMapPanelEnabled]);

    const handleMobileCardsTouchMove = useCallback((event) => {
        if (!isMobileMapPanelEnabled) return;
        const startY = mobileMapPullStartYRef.current;
        const currentY = event.touches?.[0]?.clientY;
        if (startY === null || currentY === undefined) return;

        const scrollTop = getMobileScrollTop();
        const pullDistance = currentY - startY;
        const gestureScrollTop = Math.max(0, scrollTop + Math.max(0, startY - currentY));

        setMobileMapPanelState((current) => {
            if (shouldExpandMobileMapPanelFromTopPull({
                isMobile: true,
                mapPanelState: current,
                scrollTop,
                pullDistance,
            })) {
                mobileMapPullStartYRef.current = currentY;
                return MOBILE_MAP_PANEL_STATES.EXPANDED;
            }

            const action = getMobileMapPanelActionForScroll({
                isMobile: true,
                mapPanelState: current,
                nextScrollTop: gestureScrollTop,
                previousScrollTop: scrollTop,
            });
            return getMobileMapPanelStateForAction(current, action);
        });
    }, [getMobileMapPanelStateForAction, getMobileScrollTop, isMobileMapPanelEnabled]);

    const handleMobileCardsTouchEnd = useCallback(() => {
        mobileMapPullStartYRef.current = null;
    }, []);

    useEffect(() => {
        if (resolvedLayout !== 'mobile') {
            setMobileMapPanelState(MOBILE_MAP_PANEL_STATES.EXPANDED);
        }
    }, [resolvedLayout]);

    useEffect(() => {
        if (!isMobileMapPanelEnabled || typeof window === 'undefined') {
            return undefined;
        }

        mobileMapScrollTopRef.current = getMobileScrollTop();

        const handleWindowScroll = () => {
            const nextScrollTop = getMobileScrollTop();
            const previousScrollTop = mobileMapScrollTopRef.current;
            mobileMapScrollTopRef.current = nextScrollTop;

            setMobileMapPanelState((current) => {
                const action = getMobileMapPanelActionForScroll({
                    isMobile: true,
                    mapPanelState: current,
                    nextScrollTop,
                    previousScrollTop,
                });
                return getMobileMapPanelStateForAction(current, action);
            });
        };

        window.addEventListener('scroll', handleWindowScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, [getMobileMapPanelStateForAction, getMobileScrollTop, isMobileMapPanelEnabled]);

    function openResourceNotes(row = null) {
        if (!interactive || !noteResourceRows.length) return;
        setNotesPanel({
            open: true,
            selectedKey: row ? getRowAssetKey(row) : null,
        });
    }

    function selectResourceNotes(row) {
        setNotesPanel({
            open: true,
            selectedKey: row ? getRowAssetKey(row) : null,
        });
    }

    function closeResourceNotes() {
        setNotesPanel({ open: false, selectedKey: null });
    }

    function backToNotesList() {
        setNotesPanel((current) => ({ ...current, selectedKey: null }));
    }

    useEffect(() => {
        if (!notesPanel.open || !notesPanel.selectedKey) return;
        const hasSelectedRow = noteResourceRows.some((row) => getRowAssetKey(row) === notesPanel.selectedKey);
        if (!hasSelectedRow) {
            backToNotesList();
        }
    }, [noteResourceRows, notesPanel.open, notesPanel.selectedKey]);

    useEffect(() => {
        if (!interactive) return undefined;

        if (!selectionPlaceKey) {
            setFlashPlaceKey(null);
            return undefined;
        }

        setFlashPlaceKey(selectionPlaceKey);
        if (!autoScrollToHighlight) return undefined;

        if (resolvedLayout === 'desktop') {
            const desktopScrollTarget = desktopScrollTargetRef?.current || desktopMapWrapperRef.current;
            if (desktopScrollTarget) {
                window.requestAnimationFrame(() => {
                    desktopScrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }
            return undefined;
        }

        const node = sectionRefs.current[selectionPlaceKey];
        if (node) {
            window.requestAnimationFrame(() => {
                const stickyMapRect = mobileMapWrapperRef.current?.getBoundingClientRect() || null;
                const stickyOffset = stickyMapRect
                    ? Math.min(
                        Math.max(Math.round(stickyMapRect.bottom + 16), 160),
                        Math.round(window.innerHeight * 0.82),
                    )
                    : Math.round(window.innerHeight * 0.42);
                const targetTop = Math.max(
                    Math.round(node.getBoundingClientRect().top + window.scrollY - stickyOffset),
                    0,
                );

                window.scrollTo({ top: targetTop, behavior: 'smooth' });
            });
        }
        // No timeout — flashPlaceKey stays set permanently until the next selection.
    }, [autoScrollToHighlight, desktopScrollTargetRef, interactive, resolvedLayout, selectionPlaceKey, selectionScrollRequest]);

    if (!mappedGroups.length && !unmappedRows.length) {
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                    {t('noMapSearchResults')}
                </div>
            </DirectoryReturnPathContext.Provider>
        );
    }

    if (resolvedLayout === 'mobile') {
        const mobileMapElement = renderMobileMap?.();
        const mobileMapHeightClassName = isMobileMapCollapsed
            ? 'h-[128px] min-h-[128px] max-h-[128px] transition-[height] duration-300 ease-out'
            : `${mobileMapElement?.props?.mapHeightClassName || 'h-[32svh] min-h-[240px] max-h-[360px]'} transition-[height] duration-300 ease-out`;

        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-4 ${className}`}>
                    {mobileMapElement ? (
                        <div ref={mobileMapWrapperRef} className={`${mobileMapStickyClassName} disable-font-scaling`}>
                            {React.cloneElement(mobileMapElement, {
                                onClusterChange: setClusterMapping,
                                onViewSection: handleMobileMapViewSection,
                                onClusterSelect: handleMobileMapClusterSelect,
                                mapHeightClassName: mobileMapHeightClassName,
                                layoutSignature: `mobile-map-${mobileMapPanelState}`,
                            })}
                            <MapLegend mobile />
                            <MapNotesEntryButton
                                rows={noteResourceRows}
                                mode={mode}
                                onOpen={openResourceNotes}
                            />
                        </div>
                    ) : null}

                    <div
                        className="space-y-4"
                        onWheel={handleMobileCardsWheel}
                        onTouchStart={handleMobileCardsTouchStart}
                        onTouchMove={handleMobileCardsTouchMove}
                        onTouchEnd={handleMobileCardsTouchEnd}
                        onTouchCancel={handleMobileCardsTouchEnd}
                    >
                        <DirectoryGroupColumn
                            groups={mappedGroups}
                            mode={mode}
                            interactive
                            fullCardLink={false}
                            onViewOnMap={handleDirectoryViewOnMap}
                            onRemoveResource={onRemoveResource}
                            onUpdateResourceNotes={onUpdateResourceNotes}
                            onOpenResourceNotes={openResourceNotes}
                            canSaveResources={canSaveResources}
                            highlightPlaceKey={flashPlaceKey}
                            highlightPlaceKeys={highlightPlaceKeys}
                            sectionRefs={sectionRefs}
                            clusterMapping={clusterMapping}
                            showDesktopHoverLogo={showDesktopHoverLogo}
                            logoRevealPlaceKeys={logoRevealPlaceKeys}
                        />

                        <DirectoryUnmappedSection
                            rows={unmappedRows}
                            interactive
                            mode={mode}
                            canSaveResources={canSaveResources}
                            onRemoveResource={onRemoveResource}
                            onOpenResourceNotes={openResourceNotes}
                            compact
                        />
                    </div>
                    <MapNotesOverlay
                        open={notesPanel.open}
                        rows={noteResourceRows}
                        selectedKey={notesPanel.selectedKey}
                        mode={mode}
                        onSelectResource={selectResourceNotes}
                        onBackToList={backToNotesList}
                        onClose={closeResourceNotes}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                    />
                </div>
            </DirectoryReturnPathContext.Provider>
        );
    }

    return (
        <DirectoryReturnPathContext.Provider value={detailReturnPath}>
            <div className={`space-y-6 ${className}`}>
                <div className={`grid gap-5 ${desktopGridClassName}`}>
                    <DirectoryGroupColumn
                        groups={leftGroups}
                        mode={mode}
                        interactive={interactive}
                        compactInteractive={compactInteractiveDesktop}
                        fullCardLink={interactive && mode !== 'owner'}
                        onViewOnMap={handleDirectoryViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                        onOpenResourceNotes={openResourceNotes}
                        canSaveResources={canSaveResources}
                        highlightPlaceKey={flashPlaceKey}
                        highlightPlaceKeys={highlightPlaceKeys}
                        sectionRefs={sectionRefs}
                        preserveSlot
                        allowPrintLinks={allowPrintLinks}
                        compactPrint={compactPrint}
                        clusterMapping={clusterMapping}
                        showDesktopHoverLogo={showDesktopHoverLogo}
                        logoRevealPlaceKeys={logoRevealPlaceKeys}
                        afterContent={useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'side-lanes' && leftUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={leftUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onOpenResourceNotes={openResourceNotes}
                                compact
                            />
                        ) : null}
                    />

                    <div
                        ref={desktopMapWrapperRef}
                        className={`${interactive ? 'lg:sticky lg:top-6' : ''} scroll-mt-[56px] sm:scroll-mt-[64px] ${desktopMapWrapperClassName}`.trim()}
                    >
                        {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                        {resolvedLayout !== 'print' && <MapLegend />}
                        {resolvedLayout !== 'print' ? (
                            <MapNotesEntryButton
                                rows={noteResourceRows}
                                mode={mode}
                                onOpen={openResourceNotes}
                            />
                        ) : null}
                        {useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'map-column' && dockedUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={dockedUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onOpenResourceNotes={openResourceNotes}
                                compact
                                className={resolvedLayout !== 'print' ? 'mt-4' : ''}
                            />
                        ) : null}
                    </div>

                    <DirectoryGroupColumn
                        groups={rightGroups}
                        mode={mode}
                        interactive={interactive}
                        compactInteractive={compactInteractiveDesktop}
                        fullCardLink={interactive && mode !== 'owner'}
                        onViewOnMap={handleDirectoryViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                        onOpenResourceNotes={openResourceNotes}
                        canSaveResources={canSaveResources}
                        highlightPlaceKey={flashPlaceKey}
                        highlightPlaceKeys={highlightPlaceKeys}
                        sectionRefs={sectionRefs}
                        preserveSlot
                        allowPrintLinks={allowPrintLinks}
                        compactPrint={compactPrint}
                        clusterMapping={clusterMapping}
                        showDesktopHoverLogo={showDesktopHoverLogo}
                        logoRevealPlaceKeys={logoRevealPlaceKeys}
                        afterContent={useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'side-lanes' && rightUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={rightUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onOpenResourceNotes={openResourceNotes}
                                compact
                            />
                        ) : null}
                    />
                </div>

                {!interactive ? (
                    <DirectoryUnmappedSection
                        rows={unmappedRows}
                        interactive={interactive}
                        mode={mode}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                        onOpenResourceNotes={openResourceNotes}
                    />
                ) : null}
                <MapNotesOverlay
                    open={notesPanel.open}
                    rows={noteResourceRows}
                    selectedKey={notesPanel.selectedKey}
                    mode={mode}
                    onSelectResource={selectResourceNotes}
                    onBackToList={backToNotesList}
                    onClose={closeResourceNotes}
                    onUpdateResourceNotes={onUpdateResourceNotes}
                />
            </div>
        </DirectoryReturnPathContext.Provider>
    );
}
