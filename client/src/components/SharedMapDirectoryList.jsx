import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { appendMapReturnTo, buildCurrentAppPath, normalizeMapReturnPath } from '../lib/appNavigation.js';
import { OFFERING_ACCESS } from '../lib/eligibility.js';
import {
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    normalizePrintMapLabelDetail,
    normalizePrintMapResourceColumnCount,
    normalizePrintMapSideResourceColumnCount,
    splitPrintResourceGroups,
    splitPrintSideResourceGroups,
} from '../lib/printMapState.js';
import {
    getMapShortDescriptorPrintStyle,
    normalizeMapShortDescriptorItems,
} from '../lib/mapShortDescriptorStyle.js';
import {
    buildCategoryBadgePalette,
    normalizeCategoryAccentColor,
} from '../lib/categoryBadgePalette.js';
import {
    ArrowLeft,
    Bold,
    CalendarPlus,
    ChevronRight,
    Eye,
    ExternalLink,
    Italic,
    Link2,
    List,
    ListOrdered,
    LoaderCircle,
    Maximize2,
    Minimize2,
    Pencil,
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
import {
    MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT,
    resizeTextareaToContent,
} from '../lib/adaptiveTextarea.js';
import MarkdownLiteText from './MarkdownLiteText.jsx';
import OfferingAccessNotice from './OfferingAccessNotice.jsx';
import { PersonalPlaceCategoryIcon } from '../lib/personalPlaceCategories.jsx';
import ResourceRowIcon from './ResourceRowIcon.jsx';
import CompactResourcePreviewCard, {
    COMPACT_RESOURCE_DETAIL_ACTION_CLASSNAME,
} from './CompactResourcePreviewCard.jsx';
import CategoryPinShapeBadge from './CategoryPinShapeBadge.jsx';
import MyMapResourceTable from './MyMapResourceTable.jsx';
import { getCategoryPinShape } from '../lib/categoryPinShapes.js';
import { getCategoryPinStyle } from '../lib/categoryPinStyles.js';

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

function buildDefaultPreviewNoteIds(drafts, rowKey) {
    return (drafts?.[rowKey]?.notes || []).reduce((previewIds, note) => {
        if (String(note?.text || '').trim()) {
            previewIds[note.clientId] = true;
        }
        return previewIds;
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

function MapNoteToolbarButton({ label, active = false, onClick, children, showLabel = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 items-center justify-center rounded-full border text-slate-600 transition focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                showLabel ? 'gap-1.5 px-3 text-xs font-bold' : 'w-9'
            } ${
                active
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700'
            }`}
            aria-label={label}
            title={label}
            aria-pressed={active || undefined}
        >
            {children}
            {showLabel ? <span>{label}</span> : null}
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

function normalizeBadgeFillColor(value) {
    const text = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : '#0f766e';
}

function PrintResourceNumberBadge({
    value,
    color = null,
    ringColor = '#ffffff',
    labelColor = null,
    shape = 'circle',
    compact = false,
}) {
    const label = String(value || '').replace(/^#/, '').trim();
    if (!label) return null;
    const badgeColor = normalizeBadgeFillColor(color);

    return (
        <CategoryPinShapeBadge
            shape={shape}
            color={badgeColor}
            ringColor={ringColor}
            labelColor={labelColor}
            label={label}
            compact={compact}
            className="print-color-adjust"
        />
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

function useMobileViewportScaleLock(enabled) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;
        const meta = document.querySelector('meta[name="viewport"]');
        if (!meta) return undefined;

        const previousContent = meta.getAttribute('content') || '';
        meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no');

        return () => {
            meta.setAttribute('content', previousContent);
        };
    }, [enabled]);
}

function useMobileMapOverscrollLock(enabled) {
    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return undefined;

        const root = document.documentElement;
        const previousRootOverscroll = root.style.overscrollBehaviorY;
        const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
        root.style.overscrollBehaviorY = 'none';
        document.body.style.overscrollBehaviorY = 'none';

        return () => {
            root.style.overscrollBehaviorY = previousRootOverscroll;
            document.body.style.overscrollBehaviorY = previousBodyOverscroll;
        };
    }, [enabled]);
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
    const [showSaveStatus, setShowSaveStatus] = useState(false);
    const [error, setError] = useState('');
    const [previewNoteIds, setPreviewNoteIds] = useState(() => (
        buildDefaultPreviewNoteIds(buildNoteDrafts(row ? [row] : []), rowKey)
    ));
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
        Object.values(noteTextareaRefs.current).forEach((textarea) => resizeTextareaToContent(textarea, { maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT }));
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
            setShowSaveStatus(false);
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
        if (previousRowKey !== rowKey) {
            setPreviewNoteIds(buildDefaultPreviewNoteIds(nextDrafts, rowKey));
        }
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
            setShowSaveStatus(true);
            setSaveState('pending');
        } else {
            setShowSaveStatus(false);
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
                        ? { ...note, ...values, text: values.text !== undefined ? values.text.slice(0, MAP_NOTE_MAX_LENGTH) : note.text }
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
        const nextText = result.value.slice(0, MAP_NOTE_MAX_LENGTH);
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
    const shouldShowSaveStatus = showSaveStatus && saveState !== 'idle' && !didSaveFail;
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
                                    label={isPreviewing ? t('mapNoteMarkdownEdit') : t('mapNoteMarkdownPreview')}
                                    active={isPreviewing}
                                    onClick={() => togglePreviewNote(note.clientId)}
                                    showLabel
                                >
                                    {isPreviewing ? <Pencil size={15} strokeWidth={2.3} /> : <Eye size={15} strokeWidth={2.3} />}
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
                                                    resizeTextareaToContent(element, { maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT });
                                                } else {
                                                    delete noteTextareaRefs.current[note.clientId];
                                                }
                                            }}
                                            value={note.text}
                                            onChange={(event) => {
                                                resizeTextareaToContent(event.currentTarget, { maxHeight: MAP_NOTE_TEXTAREA_FOCUSED_MAX_HEIGHT });
                                                updateDraftNote(note.clientId, { text: event.target.value });
                                            }}
                                            maxLength={MAP_NOTE_MAX_LENGTH}
                                            rows={3}
                                            className="min-h-[96px] w-full resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-base leading-7 text-slate-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 sm:text-sm sm:leading-6"
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
                            {note.id && note.text.trim() ? (
                                <Link
                                    to={`/dashboard/calendar?noteId=${note.id}`}
                                    onClick={() => {
                                        void flushDraftChanges();
                                    }}
                                    className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-full px-1 text-sm font-bold text-teal-700 hover:text-teal-900"
                                >
                                    <CalendarPlus size={16} />
                                    {t('careCalendarAdd')}
                                </Link>
                            ) : null}
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
                        onClick={() => {
                            setShowSaveStatus(true);
                            void flushDraftChanges();
                        }}
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

    function saveEditorBeforeExit() {
        if (readonly || !flushEditorRef.current) return;
        void flushEditorRef.current({ keepalive: true });
    }

    const handleClose = useCallback(() => {
        saveEditorBeforeExit();
        onClose();
    }, [onClose, readonly]);

    const handleBackToList = useCallback(() => {
        saveEditorBeforeExit();
        onBackToList();
    }, [onBackToList, readonly]);

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
            className="fixed inset-0 z-[1400] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
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
                                ? `${selectedRow.mapNoteContext || ''}${selectedRow.mapNoteContext ? ' · ' : ''}${getResourceKindLabel(selectedRow, t)}`
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
                                        categoryIconKey={row.categoryIconKey}
                                        categoryColor={row.categoryColor}
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
const MOBILE_MAP_HIDE_TOP_PX = 72;
const MOBILE_MAP_REVEAL_SCROLL_Y = 96;
const MOBILE_FULL_MAP_PULL_DISTANCE_PX = 96;
const MOBILE_FULL_MAP_EXIT_SWIPE_PX = 88;
const MOBILE_FULL_MAP_BOTTOM_EDGE_PX = 180;
const MOBILE_SCROLL_DIRECTION_EPSILON = 8;
const MOBILE_FOCUS_TRAY_SCROLL_CLEAR_GRACE_MS = 900;

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

    if (!['hard', 'soft'].includes(row?.resourceType) || !enabled || !isAuth || !row.saveEligible || row.status === 'unavailable') {
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
    if (isPersonalPlaceRow(row)) return false;
    return Boolean(normalizeLabel(group?.name)) && normalizeLabel(group?.name) === normalizeLabel(row?.name);
}

function getVisibleGroupRows(group) {
    return (group?.rows || []).filter((row) => !isRepeatedPrimaryRow(group, row));
}

function getPrimaryManagedPlaceRow(group) {
    return (group?.rows || []).find((row) => (
        row?.resourceType === 'hard' && isRepeatedPrimaryRow(group, row)
    )) || null;
}

function getPrimaryShortDescriptionRow(group) {
    return getPrimaryManagedPlaceRow(group)
        || (group?.rows || []).find((row) => isPersonalPlaceRow(row))
        || null;
}

function hasRowShortDescription(row) {
    return getRowShortDescriptionItems(row).length > 0;
}

function getRowShortDescriptionItems(row) {
    return normalizeMapShortDescriptorItems(row);
}

function isListOnlyGroupDisplayGroup(group) {
    if (!group?.isUnmappedGroup) return false;
    return (group?.rows || []).some((row) => (
        row?.resourceType === 'soft'
        && (
            row?.assetMode === 'group'
            || normalizeLabel(row?.bucket) === 'groups'
            || normalizeLabel(row?.bucket) === 'group'
            || normalizeLabel(row?.subCategory) === 'group'
            || Boolean(row?.mapFocusPlaceKeys?.length)
        )
    ));
}

function getFocusTrayMemberKeys(group) {
    return [
        ...(group?.mapFocusPlaceKeys || []),
        ...(group?.memberPlaceKeys || []),
    ]
        .filter(Boolean)
        .map((value) => String(value));
}

function resolveMobileFocusTraySelection(groups, placeKey, pins = []) {
    if (!placeKey) return null;
    const normalizedPlaceKey = String(placeKey);
    const selected = groups.find((group) => String(group?.placeKey || '') === normalizedPlaceKey)
        || groups.find((group) => matchesGroupKey(group, normalizedPlaceKey));

    if (!selected) {
        const selectedPin = pins.find((pin) => (
            String(pin?.placeKey || '') === normalizedPlaceKey
            || String(pin?.pinKey || '') === normalizedPlaceKey
        ));
        const memberKeys = new Set((selectedPin?.memberPlaceKeys || [])
            .filter(Boolean)
            .map((value) => String(value)));
        const members = groups.filter((candidate) => (
            candidate?.hasCoordinates !== false
            && candidate?.placeKey
            && memberKeys.has(String(candidate.placeKey))
        ));

        return members.length ? { type: 'pin-group', group: members[0], members } : null;
    }

    if (isListOnlyGroupDisplayGroup(selected)) {
        const memberKeys = new Set(getFocusTrayMemberKeys(selected));
        const members = groups.filter((candidate) => (
            candidate !== selected
            && candidate?.hasCoordinates !== false
            && candidate?.placeKey
            && memberKeys.has(String(candidate.placeKey))
        ));

        return members.length ? { type: 'group', group: selected, members } : null;
    }

    return { type: 'place', group: selected, members: [] };
}

function resolveGroupLocationLine(group) {
    if (group?.shortLocationLine) return group.shortLocationLine;

    const candidates = [
        ...(group?.rows || []),
        ...(group?.nestedPlaces || []).flatMap((place) => [
            place,
            ...(place?.rows || []),
        ]),
    ];

    return candidates
        .map((item) => item?.shortLocationLine || item?.locationLabel || item?.address || item?.contextLabel)
        .find((label) => label && normalizeLabel(label) !== normalizeLabel(group?.name)) || '';
}

function resolveV2CardLocationLine(group, t) {
    if (isListOnlyGroupDisplayGroup(group)) {
        return t('groupType');
    }
    return resolveGroupLocationLine(group);
}

function getPrimaryPlaceNoteRow(group) {
    const notedRows = getNoteRowsForGroup(group).filter(hasAnyOwnerNote);
    if (group?.isUnmappedGroup) {
        return notedRows[0] || null;
    }
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

function getGroupBadgeRow(group) {
    return getGroupHoverLogoRow(group)
        || (group?.rows || []).find((row) => row?.resourceType === 'hard')
        || (group?.rows || [])[0]
        || null;
}

function getNestedPlaceBadgeRow(place) {
    return getNestedPlaceLogoRow(place)
        || (place?.rows || []).find((row) => row?.resourceType === 'hard')
        || (place?.rows || [])[0]
        || null;
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

function isInteractiveCardTarget(target) {
    return Boolean(target?.closest?.('a,button,input,textarea,select,summary,[data-directory-card-action]'));
}

function isPersonalPlaceRow(row) {
    return row?.resourceType === 'personal_place';
}

function getResourceKindLabel(row, t) {
    if (isPersonalPlaceRow(row)) return t('personalPlaceType');
    return row?.resourceType === 'hard' ? t('placeType') : t('offeringType');
}

function getSecondaryCategory(row, t) {
    return row?.subCategory || row?.bucket || getResourceKindLabel(row, t);
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

function DirectoryLocationMeta({ shortLocationLine, distanceLabel, compact = false, tight = false }) {
    if (!shortLocationLine && !distanceLabel) return null;

    return (
        <div className={`flex flex-wrap items-center ${tight ? 'gap-1 leading-[1.05]' : (compact ? 'gap-1.5' : 'gap-2')}`}>
            {shortLocationLine ? (
                <p className={`${compact ? 'text-[0.6875rem]' : 'text-[0.75rem]'} font-medium text-slate-500 ${tight ? 'leading-[1.05]' : ''}`}>{shortLocationLine}</p>
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
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
    onOpenResourceNotes,
    allowPrintLinks = false,
    compactPrint = false,
}) {
    const { t } = useLocale();
    const detailPath = useDirectoryDetailPath(row.detailPath);
    const canOpenDetail = Boolean(detailPath) && row.status !== 'unavailable';
    const personalPlace = isPersonalPlaceRow(row);
    const canManagePersonalPlace = mode === 'owner' && personalPlace;
    const canRemoveMapResource = interactive
        && mode === 'owner'
        && !personalPlace
        && Boolean(onRemoveResource);
    const canManagePersonalPlaceActions = canManagePersonalPlace
        && Boolean(onEditPersonalPlace || onRemoveResource);
    const canManageShortDescription = mode === 'owner'
        && Boolean(onEditResourceShortDescription);
    const shortDescriptionItems = getRowShortDescriptionItems(row);
    const hasShortDescription = shortDescriptionItems.length > 0;
    const repeatsPlaceName = String(row?.name || '').trim().toLowerCase()
        === String(place?.name || '').trim().toLowerCase();
    const showResourceName = !repeatsPlaceName;
    const access = row?.resourceType === 'soft' ? (row.access || OFFERING_ACCESS.GRANTED) : null;
    const isAccessRestricted = row?.resourceType === 'soft' && access !== OFFERING_ACCESS.GRANTED;
    const sharedNotes = normalizeNoteItems(row?.notes);
    const rowTitleClassName = interactive
        ? (compactInteractive ? 'text-[0.75rem]' : 'text-[0.875rem]')
        : (compactPrint ? 'text-[0.6875rem]' : 'text-[0.75rem]');

    if (!interactive) {
        const printRowTitle = showResourceName && canOpenDetail && allowPrintLinks ? (
            <Link to={detailPath} reloadDocument className={`font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                {row.name}
            </Link>
        ) : showResourceName ? (
            <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
        ) : null;
        const printShortDescriptionClassName = printRowTitle
            ? rowTitleClassName
            : (compactPrint ? 'text-[0.9375rem]' : 'text-base');

        return (
            <div className="border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                {printRowTitle || hasShortDescription || row.status === 'unavailable' || canManageShortDescription || canManagePersonalPlaceActions ? (
                    <div className="flex items-start gap-1.5">
                        <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {printRowTitle}
                                <AvailabilityCountBadge row={row} compact />
                                {row.status === 'unavailable' ? <StatusBadge status={row.status} /> : null}
                            </div>
                            {hasShortDescription ? (
                                <div className={`flex items-start gap-1 ${printRowTitle ? 'mt-0.5' : ''}`}>
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        {shortDescriptionItems.map((item, index) => (
                                            <p key={item.id || `${item.text}-${index}`} className="leading-snug">
                                                <MapShortDescriptionText item={item} textClassName={printShortDescriptionClassName}>
                                                    {item.text}
                                                </MapShortDescriptionText>
                                            </p>
                                        ))}
                                    </div>
                                    {canManageShortDescription ? (
                                        <button
                                            type="button"
                                            onClick={() => onEditResourceShortDescription(row)}
                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                                            aria-label={`${t('editShortDescription')}: ${row.name}`}
                                            title={t('editShortDescription')}
                                            data-print-short-description-action="true"
                                        >
                                            <Pencil size={11} aria-hidden="true" />
                                        </button>
                                    ) : null}
                                </div>
                            ) : canManageShortDescription ? (
                                <button
                                    type="button"
                                    onClick={() => onEditResourceShortDescription(row)}
                                    className={`${printRowTitle ? 'mt-0.5' : ''} inline-flex items-center gap-1 text-[0.625rem] font-semibold leading-snug text-slate-500 transition hover:text-brand-700`}
                                    data-print-short-description-action="true"
                                >
                                    <Plus size={11} aria-hidden="true" />
                                    {t('addShortDescription')}
                                </button>
                            ) : null}
                        </div>
                        {canManagePersonalPlaceActions ? (
                            <div className="print:hidden flex shrink-0 items-center gap-0.5" data-print-personal-place-actions="true">
                                {onEditPersonalPlace ? (
                                    <button
                                        type="button"
                                        onClick={() => onEditPersonalPlace(row)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                                        aria-label={`${t('edit')}: ${row.name}`}
                                        title={t('edit')}
                                        data-print-personal-place-edit="true"
                                    >
                                        <Pencil size={12} aria-hidden="true" />
                                    </button>
                                ) : null}
                                {onRemoveResource ? (
                                    <button
                                        type="button"
                                        onClick={() => onRemoveResource(row)}
                                        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                        aria-label={`${t('remove')}: ${row.name}`}
                                        title={t('remove')}
                                        data-print-personal-place-remove="true"
                                    >
                                        <Trash2 size={12} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
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
                                    {showResourceName && canOpenDetail ? (
                                        <Link to={detailPath} className={`block font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                                            {row.name}
                                        </Link>
                                    ) : showResourceName ? (
                                        <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
                                    ) : null}
                                    {hasShortDescription ? (
                                        <div className={`flex items-start gap-1.5 ${showResourceName ? 'mt-1' : ''}`}>
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                {shortDescriptionItems.map((item, index) => (
                                                    <p
                                                        key={item.id || `${item.text}-${index}`}
                                                        className="leading-5"
                                                    >
                                                        <MapShortDescriptionText item={item} textClassName="text-xs">
                                                            {item.text}
                                                        </MapShortDescriptionText>
                                                    </p>
                                                ))}
                                            </div>
                                            {canManageShortDescription ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onEditResourceShortDescription(row)}
                                                    className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                                                    aria-label={`${t('editShortDescription')}: ${row.name}`}
                                                    title={t('editShortDescription')}
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            ) : null}
                                        </div>
                                    ) : canManageShortDescription ? (
                                        <button
                                            type="button"
                                            onClick={() => onEditResourceShortDescription(row)}
                                            className={`inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-brand-700 ${showResourceName ? 'mt-1' : ''}`}
                                        >
                                            <Plus size={13} />
                                            {t('addShortDescription')}
                                        </button>
                                    ) : null}
                                </div>
                                {!personalPlace ? (
                                    <MapNoteIconButton
                                        row={row}
                                        onOpenResourceNotes={onOpenResourceNotes}
                                        compact={compactInteractive}
                                    />
                                ) : null}
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
                {canRemoveMapResource ? (
                    <div className="ml-2 flex flex-shrink-0 items-start">
                        <OwnerMapResourceRemoveAction
                            row={row}
                            onRemoveResource={onRemoveResource}
                        />
                    </div>
                ) : null}
                {canManagePersonalPlace ? (
                    <div className="ml-2 flex flex-shrink-0 flex-wrap items-start justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => onEditPersonalPlace?.(row)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-brand-700"
                        >
                            <Pencil size={13} />
                            {t('edit')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemoveResource?.(row)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-red-600"
                        >
                            <Trash2 size={13} />
                            {t('remove')}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function OwnerMapResourceRemoveAction({
    row,
    onRemoveResource,
    card = false,
}) {
    const { t } = useLocale();
    const [removePending, setRemovePending] = useState(false);

    async function handleRemove() {
        if (!row || !onRemoveResource || removePending) return;
        setRemovePending(true);
        try {
            await onRemoveResource(row);
        } finally {
            setRemovePending(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleRemove}
            disabled={removePending}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
            aria-label={`${t('removeFromMap')}: ${row?.name || t('resource')}`}
            title={t('removeFromMap')}
            data-my-map-resource-remove="true"
            data-my-map-card-remove={card ? 'true' : undefined}
        >
            {removePending ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
            ) : (
                <Trash2 size={13} aria-hidden="true" />
            )}
            {t(removePending ? 'removingFromMap' : 'remove')}
        </button>
    );
}

function DirectoryPlaceBadge({
    group,
    clusterColorData,
    compactInteractive = false,
    badgeMode = 'number',
    badgeRow = null,
    hoverLogoRow = null,
    logoRevealed = false,
    onViewOnMap,
}) {
    const { t } = useLocale();
    const [logoFitMode, setLogoFitMode] = useState('cover');
    const isLogoMode = badgeMode === 'logo';
    const isCategoryIconMode = badgeMode === 'category-icon';
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
    const canViewOnMap = Boolean(onViewOnMap && (group?.hasCoordinates !== false || group?.mapFocusPlaceKeys?.length));
    const shellClassName = `relative flex flex-shrink-0 items-center justify-center ${wrapperClassName}`;
    const buttonProps = canViewOnMap ? {
        type: 'button',
        onClick: (e) => {
            e.stopPropagation();
            e.preventDefault();
            onViewOnMap?.(group.placeKey);
        },
        'aria-label': `${t('viewOnMap')}: ${group.name}`,
        title: t('viewOnMap'),
    } : null;

    if (isLogoMode) {
        const resolvedBadgeRow = badgeRow || hoverLogoRow || getGroupBadgeRow(group);
        const logoTileSizeClassName = compactInteractive
            ? '!h-[2.625rem] !w-[2.625rem] !rounded-[0.9375rem]'
            : '!h-[2.875rem] !w-[2.875rem] !rounded-[1.0625rem]';
        const logoContent = (
            <ResourceRowIcon
                resourceType={resolvedBadgeRow?.resourceType || 'hard'}
                bucket={resolvedBadgeRow?.bucket}
                subCategory={resolvedBadgeRow?.subCategory}
                logoUrl={resolvedBadgeRow?.logoUrl}
                categoryIconKey={resolvedBadgeRow?.categoryIconKey}
                categoryColor={resolvedBadgeRow?.categoryColor}
                alt={resolvedBadgeRow?.name ? `${resolvedBadgeRow.name} logo` : `${group.name} logo`}
                className={`${logoTileSizeClassName} border-slate-200/90 bg-white shadow-[0_16px_28px_-18px_rgba(15,23,42,0.55)] ring-1 ring-white/90`}
            />
        );

        return canViewOnMap ? (
            <button
                {...buttonProps}
                className={shellClassName}
            >
                {logoContent}
            </button>
        ) : (
            <span
                className={shellClassName}
                aria-label={group.name}
                title={group.name}
            >
                {logoContent}
            </span>
        );
    }

    if (isCategoryIconMode) {
        const categoryIconContent = (
            <DirectoryCategoryIcon
                iconUrl={group?.categoryIconUrl}
                iconKey={group?.categoryIconKey}
                color={group?.categoryColor}
            />
        );
        return canViewOnMap ? (
            <button {...buttonProps} className={shellClassName}>
                {categoryIconContent}
            </button>
        ) : (
            <span className={shellClassName} aria-label={group.name} title={group.name}>
                {categoryIconContent}
            </span>
        );
    }

    return (
        canViewOnMap ? (
            <button
                {...buttonProps}
                className={shellClassName}
            >
                <span
                    className={`absolute ${numberBadgeClassName} flex items-center justify-center font-black text-white shadow-sm transition-all duration-300 hover:opacity-90 ${numberBadgeVisibilityClassName}`}
                    style={{
                        backgroundColor: group?.categoryColor || clusterColorData?.core || '#0f766e',
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
        ) : (
            <span
                className={shellClassName}
                aria-label={group.name}
                title={group.name}
            >
            <span
                className={`absolute ${numberBadgeClassName} flex items-center justify-center font-black text-white shadow-sm transition-all duration-300 hover:opacity-90 ${numberBadgeVisibilityClassName}`}
                style={{
                    backgroundColor: group?.categoryColor || clusterColorData?.core || '#0f766e',
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
            </span>
        )
    );
}

function PrimaryMapShortDescription({
    row,
    mode,
    compact = false,
    print = false,
    onEditResourceShortDescription,
}) {
    const { t } = useLocale();
    if (!row) return null;

    const shortDescriptionItems = getRowShortDescriptionItems(row);
    const hasShortDescription = shortDescriptionItems.length > 0;
    const canManage = mode === 'owner'
        && Boolean(onEditResourceShortDescription);

    if (!hasShortDescription && !canManage) return null;

    if (print) {
        return hasShortDescription ? (
            <div className="mt-0.5 flex items-start gap-1">
                <div className="min-w-0 flex-1 space-y-0.5">
                    {shortDescriptionItems.map((item, index) => (
                        <p key={item.id || `${item.text}-${index}`} className="leading-snug">
                            <MapShortDescriptionText
                                item={item}
                                textClassName={compact ? 'text-[0.9375rem]' : 'text-base'}
                            >
                                {item.text}
                            </MapShortDescriptionText>
                        </p>
                    ))}
                </div>
                {canManage ? (
                    <button
                        type="button"
                        onClick={() => onEditResourceShortDescription(row)}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                        aria-label={`${t('editShortDescription')}: ${row.name}`}
                        title={t('editShortDescription')}
                        data-print-short-description-action="true"
                    >
                        <Pencil size={11} aria-hidden="true" />
                    </button>
                ) : null}
            </div>
        ) : (
            <button
                type="button"
                onClick={() => onEditResourceShortDescription(row)}
                className={`mt-0.5 inline-flex items-center gap-1 font-semibold leading-snug text-slate-500 transition hover:text-brand-700 ${compact ? 'text-[0.625rem]' : 'text-[0.6875rem]'}`}
                data-print-short-description-action="true"
            >
                <Plus size={11} aria-hidden="true" />
                {t('addShortDescription')}
            </button>
        );
    }

    return hasShortDescription ? (
        <div className="mt-1 flex items-start gap-1.5">
            <div className="min-w-0 flex-1 space-y-0.5">
                {shortDescriptionItems.map((item, index) => (
                    <p
                        key={item.id || `${item.text}-${index}`}
                        className="leading-5"
                    >
                        <MapShortDescriptionText
                            item={item}
                            textClassName={compact ? 'text-xs' : 'text-sm'}
                        >
                            {item.text}
                        </MapShortDescriptionText>
                    </p>
                ))}
            </div>
            {canManage ? (
                <button
                    type="button"
                    onClick={() => onEditResourceShortDescription(row)}
                    className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                    aria-label={`${t('editShortDescription')}: ${row.name}`}
                    title={t('editShortDescription')}
                >
                    <Pencil size={13} />
                </button>
            ) : null}
        </div>
    ) : (
        <button
            type="button"
            onClick={() => onEditResourceShortDescription(row)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
        >
            <Plus size={13} />
            {t('addShortDescription')}
        </button>
    );
}

function MapShortDescriptionText({
    item,
    textClassName,
    children,
}) {
    const style = getMapShortDescriptorPrintStyle(item);
    const highlighted = Boolean(style.backgroundColor);

    return (
        <span
            className={`inline font-medium ${textClassName} ${highlighted ? 'rounded px-1 py-0.5' : ''}`}
            style={style}
            data-map-short-description-text="true"
            data-print-short-description-text="true"
        >
            {children}
        </span>
    );
}

function DirectoryNestedPlaceSection({
    nestedPlace,
    mode,
    compactInteractive = false,
    canSaveResources,
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
    onOpenResourceNotes,
    labelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
}) {
    const nestedPlaceDetailPath = useDirectoryDetailPath(getGroupDetailPath(nestedPlace));
    const visibleRows = getVisibleGroupRows(nestedPlace);
    const titleClassName = compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]';
    const primaryNoteRow = getPrimaryPlaceNoteRow(nestedPlace);
    const primaryManagedPlaceRow = getPrimaryManagedPlaceRow(nestedPlace);
    const primaryShortDescriptionRow = getPrimaryShortDescriptionRow(nestedPlace);
    const canRemovePrimaryResource = mode === 'owner'
        && Boolean(primaryManagedPlaceRow && onRemoveResource);
    const normalizedLabelDetail = normalizePrintMapLabelDetail(labelDetail);
    const shortDescriptionEditing = mode === 'owner'
        && Boolean(onEditResourceShortDescription);
    const showDescriptions = shortDescriptionEditing
        || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS
        || normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showResourceRows = normalizedLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const primaryDescriptionRenderedInResourceRows = showResourceRows
        && visibleRows.includes(primaryShortDescriptionRow);

    return (
        <div className={compactInteractive ? 'space-y-1.5' : 'space-y-2'}>
            <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                    {nestedPlaceDetailPath ? (
                        <Link to={nestedPlaceDetailPath} className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${titleClassName}`}>
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

            {showDescriptions && !primaryDescriptionRenderedInResourceRows ? (
                <PrimaryMapShortDescription
                    row={primaryShortDescriptionRow}
                    mode={mode}
                    compact={compactInteractive}
                    onEditResourceShortDescription={onEditResourceShortDescription}
                />
            ) : null}

            {canRemovePrimaryResource ? (
                <div className="flex justify-end">
                    <OwnerMapResourceRemoveAction
                        row={primaryManagedPlaceRow}
                        onRemoveResource={onRemoveResource}
                        card
                    />
                </div>
            ) : null}

            {showResourceRows && visibleRows.length ? (
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
                            onEditPersonalPlace={onEditPersonalPlace}
                            onEditResourceShortDescription={onEditResourceShortDescription}
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
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
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
    cardBadgeMode = 'number',
    showPrintNumberBadge = false,
    showInteractiveNumberBadge = false,
    numberedPinShape = 'circle',
    numberedPinStyle = null,
    printNumberBadgePosition = 'end',
    printLabelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
}) {
    const { t } = useLocale();
    const placeDetailPath = useDirectoryDetailPath(getGroupDetailPath(group));
    const visibleRows = getVisibleGroupRows(group);
    const normalizedPrintLabelDetail = normalizePrintMapLabelDetail(printLabelDetail);
    const showPrintAddress = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showPrintResourceRows = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const printShortDescriptionEditing = !interactive
        && mode === 'owner'
        && Boolean(onEditResourceShortDescription);
    const showPrintShortDescriptions = printShortDescriptionEditing
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const printVisibleRows = showPrintResourceRows
        ? visibleRows
        : (showPrintShortDescriptions
            ? visibleRows.filter((row) => printShortDescriptionEditing || hasRowShortDescription(row))
            : []);
    const useCompactNamesOnlyCard = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES;
    const showInteractiveLogo = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_LOGOS
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const interactiveCardBadgeMode = showInteractiveNumberBadge && cardBadgeMode === 'number'
        ? 'logo'
        : cardBadgeMode;
    const showInteractiveIdentity = interactiveCardBadgeMode !== 'none'
        && (interactiveCardBadgeMode !== 'logo' || showInteractiveLogo);
    const showInteractiveAddress = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showInteractiveDescriptions = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS
        || normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showInteractiveResourceRows = normalizedPrintLabelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const showPrimaryCardBadge = (interactive ? interactiveCardBadgeMode : cardBadgeMode) !== 'none'
        && (!interactive || showInteractiveIdentity);
    const showSeparateNumberBadge = showPrintNumberBadge || (interactive && showInteractiveNumberBadge);
    const resourceNumberBadge = showSeparateNumberBadge ? (
        <PrintResourceNumberBadge
            value={group.number}
            color={numberedPinStyle?.fillColor || group.categoryColor || clusterColorData?.core || null}
            ringColor={numberedPinStyle?.ringColor}
            labelColor={numberedPinStyle?.labelColor}
            shape={numberedPinShape}
            compact={useCompactNamesOnlyCard}
        />
    ) : null;
    const numberBadgeAtStart = printNumberBadgePosition === 'start';
    const isPostalGroup = Boolean(group?.isPostalGroup && Array.isArray(group?.nestedPlaces) && group.nestedPlaces.length > 1);
    const printHighlightClassName = 'border-orange-400 ring-2 ring-orange-300 shadow-[0_0_0_3px_rgba(249,115,22,0.16)]';
    const primaryNoteRow = getPrimaryPlaceNoteRow(group);
    const primaryManagedPlaceRow = getPrimaryManagedPlaceRow(group);
    const primaryShortDescriptionRow = getPrimaryShortDescriptionRow(group);
    const canRemovePrimaryResource = interactive
        && mode === 'owner'
        && Boolean(primaryManagedPlaceRow && onRemoveResource);
    const interactiveShortDescriptionEditing = interactive
        && mode === 'owner'
        && Boolean(onEditResourceShortDescription);
    const showPrimaryInteractiveShortDescription = (interactiveShortDescriptionEditing || showInteractiveDescriptions)
        && !(showInteractiveResourceRows && visibleRows.includes(primaryShortDescriptionRow));
    const canFocusCardOnMap = Boolean(interactive && onViewOnMap && (group?.hasCoordinates !== false || group?.mapFocusPlaceKeys?.length));

    function handleCardClick(event) {
        if (!canFocusCardOnMap || isInteractiveCardTarget(event.target)) return;
        event.preventDefault();
        onViewOnMap?.(group.placeKey);
    }

    function handleCardKeyDown(event) {
        if (!canFocusCardOnMap || isInteractiveCardTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onViewOnMap?.(group.placeKey);
    }

    const cardInteractionProps = interactive ? {
        onMouseEnter: () => onHoverPlaceStart?.(group.placeKey),
        onMouseLeave: () => onHoverPlaceEnd?.(group.placeKey),
        ...(canFocusCardOnMap ? {
            onClick: handleCardClick,
            onKeyDown: handleCardKeyDown,
            role: 'button',
            tabIndex: 0,
            'aria-label': `${t('viewOnMap')}: ${group.name}`,
        } : {}),
    } : {};

    if (!interactive) {
        if (isPostalGroup) {
            return (
                <section
                    ref={sectionRef}
                    data-print-label-detail={normalizedPrintLabelDetail}
                    data-print-number-badge-position={showPrintNumberBadge ? printNumberBadgePosition : undefined}
                    className={`break-inside-avoid border border-slate-200/90 bg-white/90 transition ${
                        useCompactNamesOnlyCard ? 'rounded-xl px-2 py-1.5' : 'rounded-[18px] px-3 py-2.5'
                    } ${
                        highlighted ? printHighlightClassName : ''
                    }`}
                >
                    <div className={`flex ${useCompactNamesOnlyCard ? 'items-center gap-1.5' : 'items-start gap-2.5'}`}>
                        {numberBadgeAtStart ? resourceNumberBadge : null}
                        {showPrimaryCardBadge && ['logo', 'category-icon'].includes(cardBadgeMode) ? (
                            <DirectoryPlaceBadge
                                group={group}
                                clusterColorData={clusterColorData}
                                compactInteractive={compactPrint}
                                badgeMode={cardBadgeMode}
                                badgeRow={getNestedPlaceBadgeRow(group.nestedPlaces[0])}
                            />
                        ) : showPrimaryCardBadge ? (
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
                        ) : null}
                        <div className="min-w-0 flex-1">
                            <div className="space-y-3">
                                {group.nestedPlaces.map((nestedPlace) => {
                                    const nestedPlaceDetailPath = getGroupDetailPath(nestedPlace);
                                    const nestedVisibleRows = getVisibleGroupRows(nestedPlace);
                                    const nestedPrintRows = showPrintResourceRows
                                        ? nestedVisibleRows
                                        : (showPrintShortDescriptions
                                            ? nestedVisibleRows.filter((row) => (
                                                printShortDescriptionEditing || hasRowShortDescription(row)
                                            ))
                                            : []);
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
                                            {showPrintAddress && nestedPlace.shortLocationLine ? (
                                                <p
                                                    className={`${compactPrint ? 'text-[0.9375rem]' : 'text-base'} font-medium leading-tight text-slate-500`}
                                                    data-print-address-text="true"
                                                >
                                                    {nestedPlace.shortLocationLine}
                                                </p>
                                            ) : null}
                                            {showPrintShortDescriptions ? (
                                                <PrimaryMapShortDescription
                                                    row={getPrimaryManagedPlaceRow(nestedPlace)}
                                                    mode={mode}
                                                    compact={compactPrint}
                                                    print
                                                    onEditResourceShortDescription={onEditResourceShortDescription}
                                                />
                                            ) : null}
                                            {nestedPrintRows.length ? (
                                                <div className={compactPrint ? 'space-y-0.5' : 'space-y-1'}>
                                                    {nestedPrintRows.map((row) => (
                                                        <DirectoryResourceRow
                                                            key={row.rowKey}
                                                            row={row}
                                                            place={nestedPlace}
                                                            mode={mode}
                                                            interactive={false}
                                                            canSaveResources={canSaveResources}
                                                            onEditResourceShortDescription={onEditResourceShortDescription}
                                                            allowPrintLinks={allowPrintLinks}
                                                            compactPrint={compactPrint}
                                                        />
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {!numberBadgeAtStart ? resourceNumberBadge : null}
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
                data-print-label-detail={normalizedPrintLabelDetail}
                data-print-number-badge-position={showPrintNumberBadge ? printNumberBadgePosition : undefined}
                className={`break-inside-avoid border border-slate-200/90 bg-white/90 transition ${
                    useCompactNamesOnlyCard ? 'rounded-xl px-2 py-1.5' : 'rounded-[18px] px-3 py-2.5'
                } ${
                    highlighted ? printHighlightClassName : ''
                }`}
            >
                <div className={`flex ${useCompactNamesOnlyCard ? 'items-center gap-1.5' : 'items-start gap-2.5'}`}>
                    {numberBadgeAtStart ? resourceNumberBadge : null}
                    {showPrimaryCardBadge && ['logo', 'category-icon'].includes(cardBadgeMode) ? (
                        <DirectoryPlaceBadge
                            group={group}
                            clusterColorData={clusterColorData}
                            compactInteractive={compactPrint}
                            badgeMode={cardBadgeMode}
                            badgeRow={getGroupBadgeRow(group)}
                        />
                    ) : showPrimaryCardBadge ? (
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
                    ) : null}
                    <div className="min-w-0 flex-1">
                        {printPlaceTitle}
                        {showPrintAddress ? <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {group.shortLocationLine ? (
                                <p
                                    className={`${compactPrint ? 'text-[0.9375rem]' : 'text-base'} font-medium leading-tight text-slate-500`}
                                    data-print-address-text="true"
                                >
                                    {group.shortLocationLine}
                                </p>
                            ) : null}
                            {group.distanceLabel ? (
                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[0.625rem] font-bold text-brand-700">
                                    {group.distanceLabel}
                                </span>
                            ) : null}
                        </div> : null}
                        {showPrintShortDescriptions ? (
                            <PrimaryMapShortDescription
                                row={primaryManagedPlaceRow}
                                mode={mode}
                                compact={compactPrint}
                                print
                                onEditResourceShortDescription={onEditResourceShortDescription}
                            />
                        ) : null}

                        {printVisibleRows.length ? (
                            <div className={`mt-1 ${compactPrint ? 'space-y-0.5' : 'space-y-1'}`}>
                                {printVisibleRows.map((row) => (
                                    <DirectoryResourceRow
                                        key={row.rowKey}
                                        row={row}
                                        place={group}
                                        mode={mode}
                                        interactive={false}
                                        canSaveResources={canSaveResources}
                                        onEditResourceShortDescription={onEditResourceShortDescription}
                                        allowPrintLinks={allowPrintLinks}
                                        compactPrint={compactPrint}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                    {!numberBadgeAtStart ? resourceNumberBadge : null}
                </div>
            </section>
        );
    }

    if (isPostalGroup) {
        const primaryNestedPlace = group.nestedPlaces[0] || null;
        const trailingNestedPlaces = group.nestedPlaces.slice(1);
        const primaryHoverLogoRow = getNestedPlaceLogoRow(primaryNestedPlace);
        const groupedCardContent = (
            <div
                className="flex items-start gap-2.5"
                data-interactive-number-badge-position={showInteractiveNumberBadge ? printNumberBadgePosition : undefined}
            >
                {numberBadgeAtStart ? resourceNumberBadge : null}
                <div className={`grid min-w-0 flex-1 ${showInteractiveIdentity
                    ? (compactInteractive ? 'grid-cols-[2.625rem_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3')
                    : 'grid-cols-1'}`}>
                {showInteractiveIdentity ? (
                    <DirectoryPlaceBadge
                        group={group}
                        clusterColorData={clusterColorData}
                        compactInteractive={compactInteractive}
                        badgeMode={interactiveCardBadgeMode}
                        badgeRow={getNestedPlaceBadgeRow(primaryNestedPlace)}
                        hoverLogoRow={primaryHoverLogoRow}
                        logoRevealed={logoRevealed}
                        onViewOnMap={onViewOnMap}
                    />
                ) : null}
                <div className="min-w-0">
                    {showInteractiveAddress ? (
                        <DirectoryLocationMeta
                            shortLocationLine={group.shortLocationLine}
                            distanceLabel={group.distanceLabel}
                            compact={compactInteractive}
                        />
                    ) : null}
                    {primaryNestedPlace ? (
                        <div className={compactInteractive ? 'mt-2' : 'mt-2.5'}>
                            <DirectoryNestedPlaceSection
                                nestedPlace={primaryNestedPlace}
                                mode={mode}
                                compactInteractive={compactInteractive}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditPersonalPlace={onEditPersonalPlace}
                                onEditResourceShortDescription={onEditResourceShortDescription}
                                onOpenResourceNotes={onOpenResourceNotes}
                                labelDetail={normalizedPrintLabelDetail}
                            />
                        </div>
                    ) : null}
                </div>

                {trailingNestedPlaces.length ? (
                    <div className={`${showInteractiveIdentity ? 'col-span-2' : ''} ${compactInteractive ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}`}>
                        {trailingNestedPlaces.map((nestedPlace) => (
                            <div
                                key={nestedPlace.placeKey}
                                className={`grid items-start ${showInteractiveIdentity
                                    ? (compactInteractive ? 'grid-cols-[2.625rem_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[2.875rem_minmax(0,1fr)] gap-x-3')
                                    : 'grid-cols-1'}`}
                            >
                                {showInteractiveIdentity ? (
                                    <DirectoryPlaceBadge
                                        group={nestedPlace}
                                        clusterColorData={clusterColorData}
                                        compactInteractive={compactInteractive}
                                        badgeMode={interactiveCardBadgeMode}
                                        badgeRow={getNestedPlaceBadgeRow(nestedPlace)}
                                        onViewOnMap={onViewOnMap}
                                    />
                                ) : null}
                                <DirectoryNestedPlaceSection
                                    nestedPlace={nestedPlace}
                                    mode={mode}
                                    compactInteractive={compactInteractive}
                                    canSaveResources={canSaveResources}
                                    onRemoveResource={onRemoveResource}
                                    onEditPersonalPlace={onEditPersonalPlace}
                                    onEditResourceShortDescription={onEditResourceShortDescription}
                                    onOpenResourceNotes={onOpenResourceNotes}
                                    labelDetail={normalizedPrintLabelDetail}
                                />
                            </div>
                        ))}
                    </div>
                ) : null}
                </div>
                {!numberBadgeAtStart ? resourceNumberBadge : null}
            </div>
        );

        return (
            <section
                ref={sectionRef}
                data-directory-place-card="true"
                {...cardInteractionProps}
                className={`group relative overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                    highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
                } scroll-mt-[62svh] lg:scroll-mt-6`}
            >
                {groupedCardContent}
            </section>
        );
    }

    const interactivePlaceTitle = placeDetailPath ? (
        <Link to={placeDetailPath} className={`${compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]'} font-bold leading-tight text-slate-900 transition hover:text-brand-700`}>
            {group.name}
        </Link>
    ) : (
        <h3 className={`${compactInteractive ? 'text-[0.9375rem]' : 'text-[1.0625rem]'} font-bold leading-tight text-slate-900`}>{group.name}</h3>
    );
    const hoverLogoRow = showDesktopHoverLogo ? getGroupHoverLogoRow(group) : null;
    const usesV2CardLanguage = interactiveCardBadgeMode !== 'none';
    const resolvedLocationLine = resolveV2CardLocationLine(group, t);
    const hasLocationMeta = Boolean(resolvedLocationLine || group.distanceLabel);

    const cardContent = (
        <>
            <div
                className={`flex items-start ${compactInteractive ? 'gap-2.5' : 'gap-3'}`}
                data-interactive-number-badge-position={showInteractiveNumberBadge ? printNumberBadgePosition : undefined}
            >
                {numberBadgeAtStart ? resourceNumberBadge : null}
                {showInteractiveIdentity ? (
                    <DirectoryPlaceBadge
                        group={group}
                        clusterColorData={clusterColorData}
                        compactInteractive={compactInteractive}
                        badgeMode={interactiveCardBadgeMode}
                        badgeRow={getGroupBadgeRow(group)}
                        hoverLogoRow={hoverLogoRow}
                        logoRevealed={logoRevealed}
                        onViewOnMap={onViewOnMap}
                    />
                ) : null}
                <div className="min-w-0 flex-1">
                    {!usesV2CardLanguage && showInteractiveAddress ? (
                        <DirectoryLocationMeta
                            shortLocationLine={resolvedLocationLine}
                            distanceLabel={group.distanceLabel}
                            compact={compactInteractive}
                        />
                    ) : null}
                    <div className={`${usesV2CardLanguage ? '' : (compactInteractive ? 'mt-2' : 'mt-2.5')} flex items-start gap-2`}>
                        <div className="min-w-0 flex-1">
                            {interactivePlaceTitle}
                            {usesV2CardLanguage && showInteractiveAddress && hasLocationMeta ? (
                                <div className="mt-0">
                                    <DirectoryLocationMeta
                                        shortLocationLine={resolvedLocationLine}
                                        distanceLabel={group.distanceLabel}
                                        compact={compactInteractive}
                                        tight
                                    />
                                </div>
                            ) : null}
                        </div>
                        <MapNoteIconButton
                            row={primaryNoteRow}
                            onOpenResourceNotes={onOpenResourceNotes}
                            compact={compactInteractive}
                        />
                    </div>
                    {showPrimaryInteractiveShortDescription ? (
                        <PrimaryMapShortDescription
                            row={primaryShortDescriptionRow}
                            mode={mode}
                            compact={compactInteractive}
                            onEditResourceShortDescription={onEditResourceShortDescription}
                        />
                    ) : null}

                    {canRemovePrimaryResource ? (
                        <div className="flex justify-end">
                            <OwnerMapResourceRemoveAction
                                row={primaryManagedPlaceRow}
                                onRemoveResource={onRemoveResource}
                                card
                            />
                        </div>
                    ) : null}

                    {showInteractiveResourceRows && visibleRows.length ? (
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
                                    onRemoveResource={onRemoveResource}
                                    onEditPersonalPlace={onEditPersonalPlace}
                                    onEditResourceShortDescription={onEditResourceShortDescription}
                                    onOpenResourceNotes={onOpenResourceNotes}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
                {!numberBadgeAtStart ? resourceNumberBadge : null}
            </div>
        </>
    );

    if (placeDetailPath && fullCardLink && !isPostalGroup && !canFocusCardOnMap && !canRemovePrimaryResource) {
        return (
            <Link
                to={placeDetailPath}
                ref={sectionRef}
                data-directory-place-card="true"
                {...cardInteractionProps}
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
            data-directory-place-card="true"
            {...cardInteractionProps}
            className={`group relative overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
            } scroll-mt-[62svh] lg:scroll-mt-6`}
        >
            {cardContent}
        </section>
    );
}

function MobileMapFocusTrayPlaceCard({
    group,
    mode,
    onViewOnMap,
    onOpenResourceNotes,
    clusterColorData = null,
    cardBadgeMode = 'logo',
    compactFullMap = false,
    cardVariant = 'default',
    stretchToTray = false,
    labelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
}) {
    const { t } = useLocale();
    const placeDetailPath = useDirectoryDetailPath(getGroupDetailPath(group));
    const primaryNoteRow = getPrimaryPlaceNoteRow(group);
    const primaryManagedPlaceRow = getPrimaryManagedPlaceRow(group);
    const previewRow = primaryManagedPlaceRow || getGroupBadgeRow(group);
    const locationLine = resolveV2CardLocationLine(group, t);
    const canFocusOnMap = Boolean(onViewOnMap && (group?.hasCoordinates !== false || group?.mapFocusPlaceKeys?.length));

    function handleCardClick(event) {
        if (!canFocusOnMap || isInteractiveCardTarget(event.target)) return;
        event.preventDefault();
        onViewOnMap?.(group.placeKey);
    }

    function handleCardKeyDown(event) {
        if (!canFocusOnMap || isInteractiveCardTarget(event.target)) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onViewOnMap?.(group.placeKey);
    }

    if (cardVariant === 'complete-preview' && previewRow) {
        return (
            <CompactResourcePreviewCard
                data-mobile-map-focus-tray-card="true"
                group={group}
                row={previewRow}
                labelDetail={labelDetail}
                identityMode={cardBadgeMode}
                identityNumber={group.number}
                identityColor={group.categoryColor || clusterColorData?.core}
                identityIconUrl={group.categoryIconUrl}
                identityIconKey={group.categoryIconKey}
                framed
                className={`group snap-start bg-white shadow-sm transition hover:border-brand-200 ${
                    stretchToTray
                        ? 'w-full min-w-0 flex-none'
                        : compactFullMap
                            ? 'min-w-[min(18rem,78vw)] max-w-[19rem]'
                            : 'min-w-[min(18rem,78vw)]'
                }`}
                onClick={handleCardClick}
                onKeyDown={handleCardKeyDown}
                role={canFocusOnMap ? 'button' : undefined}
                tabIndex={canFocusOnMap ? 0 : undefined}
                aria-label={canFocusOnMap ? `${t('viewOnMap')}: ${group.name}` : undefined}
                detailAction={placeDetailPath && previewRow.status !== 'unavailable' ? (
                    <Link to={placeDetailPath} className={COMPACT_RESOURCE_DETAIL_ACTION_CLASSNAME}>
                        {t('embedMapOpenResource')} <ExternalLink size={12} />
                    </Link>
                ) : null}
                trailingAction={(
                    <MapNoteIconButton
                        row={primaryNoteRow}
                        onOpenResourceNotes={onOpenResourceNotes}
                        compact
                    />
                )}
            />
        );
    }

    return (
        <article
            data-mobile-map-focus-tray-card="true"
            className={`group flex snap-start items-start gap-2.5 rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm ${
                compactFullMap ? 'min-w-[min(18rem,78vw)] max-w-[19rem]' : 'min-w-[min(18rem,78vw)]'
            }`}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
            role={canFocusOnMap ? 'button' : undefined}
            tabIndex={canFocusOnMap ? 0 : undefined}
            aria-label={canFocusOnMap ? `${t('viewOnMap')}: ${group.name}` : undefined}
        >
            <DirectoryPlaceBadge
                group={group}
                clusterColorData={clusterColorData}
                compactInteractive
                badgeMode={cardBadgeMode}
                badgeRow={getGroupBadgeRow(group)}
                onViewOnMap={onViewOnMap}
            />
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0 flex-1">
                        {placeDetailPath ? (
                            <Link to={placeDetailPath} className="block text-[0.9375rem] font-bold leading-tight text-slate-900 transition hover:text-brand-700">
                                {group.name}
                            </Link>
                        ) : (
                            <h3 className="text-[0.9375rem] font-bold leading-tight text-slate-900">{group.name}</h3>
                        )}
                        {locationLine || group.distanceLabel ? (
                            <div className="mt-0.5">
                                <DirectoryLocationMeta
                                    shortLocationLine={locationLine}
                                    distanceLabel={group.distanceLabel}
                                    compact
                                    tight
                                />
                            </div>
                        ) : null}
                        <PrimaryMapShortDescription
                            row={primaryManagedPlaceRow}
                            mode={mode}
                            compact
                            print
                        />
                    </div>
                    <MapNoteIconButton
                        row={primaryNoteRow}
                        onOpenResourceNotes={onOpenResourceNotes}
                        compact
                    />
                </div>
            </div>
        </article>
    );
}

function MobileMapFocusTray({
    selection,
    mode,
    onViewOnMap,
    onOpenResourceNotes,
    clusterMapping = {},
    cardBadgeMode = 'logo',
    variant = 'default',
    cardVariant = 'default',
    labelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
}) {
    if (!selection) return null;

    const categoryGroup = selection.group;
    const trayGroups = selection.type === 'group' || selection.type === 'pin-group'
        ? selection.members
        : [selection.group];
    const isFullMap = variant === 'full-map';
    const groupContextLabel = selection.type === 'group' ? categoryGroup.name : '';
    const isCompletePreview = cardVariant === 'complete-preview';
    const stretchCompletePreview = isCompletePreview && trayGroups.length === 1;

    if (!trayGroups.length) return null;

    return (
        <section
            data-mobile-map-focus-tray="true"
            className={isCompletePreview
                ? `[overflow-anchor:none] ${isFullMap ? 'max-h-[30svh] flex-shrink-0 overflow-y-auto' : ''}`
                : `rounded-[26px] border border-brand-200 bg-brand-100/75 p-3.5 shadow-[0_22px_48px_-26px_rgba(15,118,110,0.58),0_8px_22px_-18px_rgba(15,23,42,0.32)] ring-1 ring-white/80 [overflow-anchor:none] ${
                    isFullMap ? 'max-h-[30svh] flex-shrink-0 overflow-hidden' : ''
                }`}
        >
            {!isCompletePreview ? (
                <DirectoryCategoryPill
                    label={categoryGroup.categoryLabel}
                    showUnmapped={Boolean(categoryGroup.isUnmappedGroup && !groupContextLabel)}
                    secondaryLabel={groupContextLabel}
                    color={categoryGroup.categoryColor}
                    iconUrl={categoryGroup.categoryIconUrl}
                    iconKey={categoryGroup.categoryIconKey}
                />
            ) : null}
            <div className={stretchCompletePreview ? 'flex min-w-0' : `${isCompletePreview ? '' : 'mt-2 '}flex snap-x gap-2 overflow-x-auto pb-1`}>
                {trayGroups.map((group) => (
                    <MobileMapFocusTrayPlaceCard
                        key={group.placeKey}
                        group={group}
                        mode={mode}
                        onViewOnMap={onViewOnMap}
                        onOpenResourceNotes={onOpenResourceNotes}
                        clusterColorData={clusterMapping[group.placeKey] || null}
                        cardBadgeMode={cardBadgeMode}
                        compactFullMap={isFullMap}
                        cardVariant={cardVariant}
                        stretchToTray={stretchCompletePreview}
                        labelDetail={labelDetail}
                    />
                ))}
            </div>
        </section>
    );
}

function DirectoryUnmappedRow({
    row,
    interactive,
    mode,
    canSaveResources,
    onRemoveResource,
    onEditResourceShortDescription,
    onOpenResourceNotes,
    compact = false,
}) {
    const { t } = useLocale();
    const place = useMemo(() => ({
        address: row.locationLabel || row.contextLabel || row.placeName || '',
        lat: null,
        lng: null,
    }), [row.contextLabel, row.locationLabel, row.placeName]);
    const detailPath = useDirectoryDetailPath(row.detailPath);
    const sharedNotes = normalizeNoteItems(row?.notes);
    const shortDescriptionItems = getRowShortDescriptionItems(row);
    const hasShortDescription = shortDescriptionItems.length > 0;

    if (!interactive) {
        const canOpenDetail = Boolean(detailPath) && row.status !== 'unavailable';
        const canManageShortDescription = mode === 'owner'
            && Boolean(onEditResourceShortDescription);

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
                        {row.contextLabel ? (
                            <p
                                className="mt-0.5 text-[0.75rem] font-medium leading-snug text-slate-500"
                                data-print-address-text="true"
                            >
                                {row.contextLabel}
                            </p>
                        ) : null}
                        {hasShortDescription ? (
                            <div className="mt-0.5 flex items-start gap-1">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    {shortDescriptionItems.map((item, index) => (
                                        <p key={item.id || `${item.text}-${index}`} className="leading-snug">
                                            <MapShortDescriptionText item={item} textClassName="text-[0.75rem]">
                                                {item.text}
                                            </MapShortDescriptionText>
                                        </p>
                                    ))}
                                </div>
                                {canManageShortDescription ? (
                                    <button
                                        type="button"
                                        onClick={() => onEditResourceShortDescription(row)}
                                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                                        aria-label={`${t('editShortDescription')}: ${row.name}`}
                                        title={t('editShortDescription')}
                                        data-print-short-description-action="true"
                                    >
                                        <Pencil size={11} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                        ) : canManageShortDescription ? (
                            <button
                                type="button"
                                onClick={() => onEditResourceShortDescription(row)}
                                className="mt-0.5 inline-flex items-center gap-1 text-[0.625rem] font-semibold leading-snug text-slate-500 transition hover:text-brand-700"
                                data-print-short-description-action="true"
                            >
                                <Plus size={11} aria-hidden="true" />
                                {t('addShortDescription')}
                            </button>
                        ) : null}
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
                categoryIconKey={row.categoryIconKey}
                categoryColor={row.categoryColor}
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
                                    <Link to={detailPath} className={`block font-bold leading-snug text-slate-900 transition hover:text-brand-700 ${compact ? 'text-[0.9375rem]' : 'text-base'}`}>
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
                        {hasShortDescription ? (
                            <div className="mt-1 flex items-start gap-1.5">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                    {shortDescriptionItems.map((item, index) => (
                                        <p
                                            key={item.id || `${item.text}-${index}`}
                                            className="leading-5"
                                        >
                                            <MapShortDescriptionText
                                                item={item}
                                                textClassName={compact ? 'text-xs' : 'text-sm'}
                                            >
                                                {item.text}
                                            </MapShortDescriptionText>
                                        </p>
                                    ))}
                                </div>
                                {mode === 'owner' && onEditResourceShortDescription ? (
                                    <button
                                        type="button"
                                        onClick={() => onEditResourceShortDescription(row)}
                                        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
                                        aria-label={`${t('editShortDescription')}: ${row.name}`}
                                        title={t('editShortDescription')}
                                    >
                                        <Pencil size={13} />
                                    </button>
                                ) : null}
                            </div>
                        ) : mode === 'owner' && onEditResourceShortDescription ? (
                            <button
                                type="button"
                                onClick={() => onEditResourceShortDescription(row)}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-brand-700"
                            >
                                <Plus size={13} />
                                {t('addShortDescription')}
                            </button>
                        ) : null}
                        <div className={`mt-1 flex flex-wrap gap-x-3 gap-y-1 font-semibold uppercase tracking-[0.08em] text-slate-400 ${compact ? 'text-[0.625rem]' : 'text-[0.6875rem]'}`}>
                            <span>{getResourceKindLabel(row, t)}</span>
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
                            <Link to={detailPath} className="text-brand-700 transition hover:text-brand-800">
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

function DirectoryUnmappedPill({ compact = false }) {
    const { t } = useLocale();

    return (
        <span className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 font-black uppercase tracking-[0.14em] text-slate-500 ${
            compact ? 'px-2.5 py-1 text-[0.625rem]' : 'px-3 py-1 text-[0.6875rem]'
        }`}>
            <span>{t('unmapped')}</span>
        </span>
    );
}

function getCategoryPillStyle(color) {
    const palette = buildCategoryBadgePalette(color);
    if (!palette) return undefined;

    return {
        '--directory-category-accent': palette.accentColor,
        borderColor: 'var(--directory-category-accent)',
        backgroundColor: palette.backgroundColor,
        color: palette.textColor,
    };
}

function getCategoryIconStyle(color) {
    const accentColor = normalizeCategoryAccentColor(color);
    if (!accentColor) return undefined;

    return {
        '--directory-category-accent': accentColor,
        borderColor: 'var(--directory-category-accent)',
        boxShadow: '0 0 0 2px color-mix(in srgb, var(--directory-category-accent) 16%, white), 0 10px 18px -16px rgba(15, 23, 42, 0.42)',
        color: 'var(--directory-category-accent)',
    };
}

function DirectoryCategoryIcon({ iconUrl, iconKey, color, compact = false }) {
    if (!iconUrl && !iconKey) return null;

    return (
        <span
            className={`inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white shadow-sm ${
                compact
                    ? 'h-[clamp(28px,1.75rem,32px)] w-[clamp(28px,1.75rem,32px)] p-[clamp(3px,0.175rem,4px)]'
                    : 'h-[clamp(34px,2.1rem,38px)] w-[clamp(34px,2.1rem,38px)] p-[clamp(4px,0.2625rem,5px)]'
            }`}
            style={getCategoryIconStyle(color)}
            aria-hidden="true"
        >
            {iconUrl ? (
                <img src={iconUrl} alt="" className="h-full w-full object-contain" />
            ) : (
                <PersonalPlaceCategoryIcon
                    iconKey={iconKey}
                    size={compact ? 15 : 18}
                    strokeWidth={2.4}
                />
            )}
        </span>
    );
}

function DirectoryCategoryPillLabel({ label }) {
    const labelRef = useRef(null);
    const measureRef = useRef(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const labelElement = labelRef.current;
        const measureElement = measureRef.current;
        if (!labelElement || !measureElement) return undefined;

        let frame = null;
        const measure = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const nextIsOverflowing = measureElement.scrollWidth > labelElement.clientWidth + 1;
                setIsOverflowing(nextIsOverflowing);
            });
        };

        measure();

        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(measure);
            observer.observe(labelElement);
            observer.observe(measureElement);
        }
        window.addEventListener('resize', measure);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [label]);

    return (
        <span ref={labelRef} className={`directory-category-pill-label ${isOverflowing ? 'directory-category-pill-label--marquee' : ''}`}>
            <span className="directory-category-pill-label__track">
                <span>{label}</span>
                {isOverflowing ? <span aria-hidden="true">{label}</span> : null}
            </span>
            <span ref={measureRef} className="directory-category-pill-label__measure" aria-hidden="true">{label}</span>
        </span>
    );
}

function DirectoryCategoryPill({
    label,
    compact = false,
    showUnmapped = false,
    secondaryLabel = '',
    color = null,
    iconUrl = null,
    iconKey = null,
}) {
    if (!label && !showUnmapped && !secondaryLabel) return null;
    const categoryPillStyle = getCategoryPillStyle(color);

    return (
        <div className="flex max-w-full flex-nowrap items-start gap-1.5 overflow-hidden px-1 pt-1">
            <DirectoryCategoryIcon
                iconUrl={iconUrl}
                iconKey={iconKey}
                color={color}
                compact={compact}
            />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5 overflow-hidden">
                {label ? (
                    <span className={`inline-flex w-fit max-w-full items-center overflow-hidden rounded-full border border-brand-100 bg-brand-50 font-black uppercase tracking-[0.14em] text-brand-800 ${
                        compact ? 'px-2.5 py-1 text-[0.625rem]' : 'px-3 py-1 text-[0.6875rem]'
                    }`} style={categoryPillStyle} title={label}>
                        <DirectoryCategoryPillLabel label={label} />
                    </span>
                ) : null}
                {secondaryLabel ? (
                    <span className={`inline-flex max-w-full items-center overflow-hidden rounded-full border border-slate-200 bg-white/80 font-black uppercase tracking-[0.14em] text-slate-600 ${
                        compact ? 'px-2.5 py-1 text-[0.625rem]' : 'px-3 py-1 text-[0.6875rem]'
                    }`} title={secondaryLabel}>
                        <DirectoryCategoryPillLabel label={secondaryLabel} />
                    </span>
                ) : null}
                {showUnmapped ? <DirectoryUnmappedPill compact={compact} /> : null}
            </span>
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
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
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
    cardBadgeMode = 'number',
    showCategoryPills = false,
    showPrintNumberBadges = false,
    showInteractiveNumberBadges = false,
    numberedPinShapesByCategory = {},
    numberedPinStylesByCategory = {},
    printNumberBadgePosition = 'end',
    printLabelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
    printColumnCount = 1,
    afterContent = null,
}) {
    if (!groups.length && !afterContent) {
        return preserveSlot ? <div aria-hidden="true" className="min-h-px" /> : null;
    }

    const spacingClassName = interactive
        ? (compactInteractive ? 'space-y-3' : 'space-y-4')
        : (compactPrint ? 'space-y-1.5' : 'space-y-2');
    const normalizedPrintColumnCount = interactive
        ? 1
        : normalizePrintMapSideResourceColumnCount(printColumnCount);
    const groupColumns = normalizedPrintColumnCount > 1
        ? splitPrintSideResourceGroups(groups, normalizedPrintColumnCount)
        : [groups];
    const renderGroups = (columnGroups) => columnGroups.map((group, index) => {
                const categoryKey = normalizeLabel(group.categorySortKey || group.categoryLabel);
                const categoryStatus = group.isUnmappedGroup ? 'unmapped' : 'mapped';
                const categoryRunKey = `${categoryStatus}:${categoryKey}`;
                const previousGroup = index > 0 ? columnGroups[index - 1] : null;
                const previousCategoryKey = previousGroup
                    ? normalizeLabel(previousGroup.categorySortKey || previousGroup.categoryLabel)
                    : '';
                const previousCategoryStatus = previousGroup?.isUnmappedGroup ? 'unmapped' : 'mapped';
                const previousCategoryRunKey = previousGroup ? `${previousCategoryStatus}:${previousCategoryKey}` : '';
                const shouldShowCategoryPill = Boolean(showCategoryPills && group.categoryLabel && categoryRunKey !== previousCategoryRunKey);

                return (
                    <React.Fragment key={group.placeKey}>
                        {shouldShowCategoryPill ? (
                            <DirectoryCategoryPill
                                label={group.categoryLabel}
                                compact={compactInteractive || compactPrint}
                                showUnmapped={Boolean(group.isUnmappedGroup)}
                                color={group.categoryColor}
                                iconUrl={group.categoryIconUrl}
                                iconKey={group.categoryIconKey}
                            />
                        ) : null}
                        <DirectoryPlaceGroupCard
                            group={group}
                            mode={mode}
                            interactive={interactive}
                            compactInteractive={compactInteractive}
                            fullCardLink={fullCardLink}
                            onViewOnMap={onViewOnMap}
                            onHoverPlaceStart={onHoverPlaceStart}
                            onHoverPlaceEnd={onHoverPlaceEnd}
                            onRemoveResource={onRemoveResource}
                            onEditPersonalPlace={onEditPersonalPlace}
                            onEditResourceShortDescription={onEditResourceShortDescription}
                            onUpdateResourceNotes={onUpdateResourceNotes}
                            onOpenResourceNotes={onOpenResourceNotes}
                            canSaveResources={canSaveResources}
                            highlighted={isGroupHighlighted(group, highlightPlaceKey, highlightPlaceKeys)}
                            allowPrintLinks={allowPrintLinks}
                            compactPrint={compactPrint}
                            clusterColorData={clusterMapping[group.placeKey] || null}
                            showDesktopHoverLogo={showDesktopHoverLogo}
                            logoRevealed={isGroupLogoRevealed(group, logoRevealPlaceKeys)}
                            cardBadgeMode={cardBadgeMode}
                            showPrintNumberBadge={showPrintNumberBadges}
                            showInteractiveNumberBadge={showInteractiveNumberBadges}
                            numberedPinShape={getCategoryPinShape(
                                numberedPinShapesByCategory,
                                group.categorySortKey || group.categoryLabel,
                            )}
                            numberedPinStyle={getCategoryPinStyle(
                                numberedPinStylesByCategory,
                                group.categorySortKey || group.categoryLabel,
                                group.categoryColor,
                            )}
                            printNumberBadgePosition={printNumberBadgePosition}
                            printLabelDetail={printLabelDetail}
                            sectionRef={(node) => {
                                if (node) {
                                    sectionRefs.current[group.placeKey] = node;
                                }
                            }}
                        />
                    </React.Fragment>
                );
            });

    return (
        <div
            className={normalizedPrintColumnCount > 1 ? 'grid min-w-0 gap-3' : spacingClassName}
            style={normalizedPrintColumnCount > 1
                ? { gridTemplateColumns: `repeat(${normalizedPrintColumnCount}, minmax(0, 1fr))` }
                : undefined}
            data-print-side-resource-columns={normalizedPrintColumnCount}
        >
            {groupColumns.map((columnGroups, index) => (
                normalizedPrintColumnCount > 1 ? (
                    <div key={`print-side-resource-column-${index}`} className={spacingClassName}>
                        {renderGroups(columnGroups)}
                    </div>
                ) : (
                    <React.Fragment key="print-side-resource-column-0">
                        {renderGroups(columnGroups)}
                    </React.Fragment>
                )
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
    onEditResourceShortDescription,
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
                        onEditResourceShortDescription={onEditResourceShortDescription}
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
                        onEditResourceShortDescription={onEditResourceShortDescription}
                        onOpenResourceNotes={onOpenResourceNotes}
                        compact={false}
                    />
                ))}
            </div>
        </section>
    );
}

export default function SharedMapDirectoryList({
    directory = null,
    presentation,
    mode = 'shared',
    layout = 'responsive',
    renderDesktopMap = null,
    renderMobileMap = null,
    onViewOnMap,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
    onUpdateResourceNotes,
    highlightPlaceKey = null,
    highlightPlaceKeys = [],
    canSaveResources = true,
    className = '',
    desktopGridClassName = 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)_minmax(0,1fr)]',
    desktopMapWrapperClassName = '',
    mobileMapStickyClassName = 'sticky top-3 z-20 bg-slate-50 pb-2',
    preserveMobileMapFrameInFlow = false,
    allowPrintLinks = false,
    autoScrollToHighlight = true,
    showDesktopHoverLogo = false,
    showMapLegend = true,
    cardBadgeMode = 'number',
    showPrintNumberBadges = false,
    showInteractiveNumberBadges = false,
    numberedPinShapesByCategory = {},
    numberedPinStylesByCategory = {},
    resourceDisplay = 'cards',
    printLabelDetail = PRINT_MAP_LABEL_DETAIL_FULL,
    printResourcesBelow = false,
    printResourceColumnCount = 2,
    printSideResourceColumnCount = 1,
    printResourcePageHeader = null,
    printPagePaddingClassName = 'p-10',
    desktopScrollTargetRef = null,
    selectionPlaceKey = null,
    selectionScrollRequest = 0,
    mobileFocusCardVariant = 'default',
    resourcePanelPlacement = 'responsive',
    interactiveLayoutPreset = 'balanced',
    interactiveMapSide = 'left',
    interactiveMapWidth = 'wide',
    interactiveResourceColumnCount = 2,
    interactiveSideResourceColumnCount = 1,
}) {
    const { t } = useLocale();
    const location = useLocation();
    const sectionRefs = useRef({});
    const desktopMapWrapperRef = useRef(null);
    const mobileMapFrameRef = useRef(null);
    const mobileMapWrapperRef = useRef(null);
    const mobileLastScrollYRef = useRef(0);
    const mobileMapListFocusedRef = useRef(false);
    const mobileFocusTrayPlaceKeyRef = useRef(null);
    const mobileFocusTrayScrollClearAfterRef = useRef(0);
    const mobileTopPullRef = useRef(null);
    const mobileFullMapSwipeRef = useRef(null);
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const [clusterMapping, setClusterMapping] = useState({});
    const [mobileMapListFocused, setMobileMapListFocused] = useState(false);
    const [mobileFullMapOpen, setMobileFullMapOpen] = useState(false);
    const [mobileFocusTrayPlaceKey, setMobileFocusTrayPlaceKey] = useState(null);
    const isDesktop = useResponsiveDirectoryLayout(layout === 'responsive');
    const resolvedLayout = layout === 'responsive'
        ? (isDesktop ? 'desktop' : 'mobile')
        : layout;
    const interactive = layout !== 'print';
    const isMobileMapPanelEnabled = interactive && resolvedLayout === 'mobile';
    const useAdaptiveDesktopUnmapped = interactive && resolvedLayout === 'desktop';
    const mappedGroups = presentation?.mappedGroups || [];
    const displayGroups = presentation?.displayGroups || mappedGroups;
    const mobileDisplayGroups = presentation?.mobileDisplayGroups || displayGroups;
    const leftGroups = presentation?.leftGroups || [];
    const rightGroups = presentation?.rightGroups || [];
    const mapColumnGroups = presentation?.mapColumnGroups || [];
    const unmappedRows = presentation?.unmappedRows || [];
    const shouldRenderUnmappedSections = !presentation?.integratesUnmappedRowsAsCards;
    const showCategoryPills = Boolean(presentation?.showCategoryPills);
    const desktopUnmappedPlacement = presentation?.desktopUnmappedPlacement || 'none';
    const leftUnmappedRows = presentation?.leftUnmappedRows || [];
    const rightUnmappedRows = presentation?.rightUnmappedRows || [];
    const dockedUnmappedRows = presentation?.dockedUnmappedRows || [];
    const noteResourceRows = useMemo(() => buildMapNoteResourceRows({
        ...(presentation || {}),
        mappedGroups: presentation?.noteMappedGroups || mappedGroups,
        unmappedRows: presentation?.noteUnmappedRows || unmappedRows,
    }, {
        unmappedContextLabel: t('unmappedResources'),
    }), [mappedGroups, presentation, t, unmappedRows]);
    const [notesPanel, setNotesPanel] = useState({ open: false, selectedKey: null });
    const detailReturnPath = useMemo(() => (
        interactive ? normalizeMapReturnPath(buildCurrentAppPath(location)) : ''
    ), [interactive, location.hash, location.pathname, location.search]);
    const compactPrint = !interactive && (
        displayGroups.length >= 7
        || displayGroups.reduce((count, group) => count + group.rows.length, 0) >= 10
    );
    const normalizedPrintResourceColumnCount = normalizePrintMapResourceColumnCount(printResourceColumnCount);
    const normalizedPrintSideResourceColumnCount = normalizePrintMapSideResourceColumnCount(
        printSideResourceColumnCount,
    );
    const printResourceColumns = useMemo(
        () => splitPrintResourceGroups(displayGroups, normalizedPrintResourceColumnCount),
        [displayGroups, normalizedPrintResourceColumnCount],
    );
    const interactiveRowCount = displayGroups.reduce((count, group) => count + getVisibleGroupRows(group).length, 0);
    const compactInteractiveDesktop = interactive
        && resolvedLayout === 'desktop'
        && (displayGroups.length >= 7 || interactiveRowCount >= 9);
    const logoRevealPlaceKeys = resolvedLayout === 'mobile'
        ? [selectionPlaceKey, highlightPlaceKey, ...highlightPlaceKeys].filter(Boolean)
        : (showDesktopHoverLogo
            ? (highlightPlaceKeys.length ? highlightPlaceKeys : (highlightPlaceKey ? [highlightPlaceKey] : []))
            : []);
    const mobileFocusTraySelection = useMemo(() => (
        isMobileMapPanelEnabled
            ? resolveMobileFocusTraySelection(mobileDisplayGroups, mobileFocusTrayPlaceKey, presentation?.pins || [])
            : null
    ), [isMobileMapPanelEnabled, mobileDisplayGroups, mobileFocusTrayPlaceKey, presentation?.pins]);
    const mobileFullMapFocusRequest = useMemo(() => {
        if (!mobileFullMapOpen || !mobileFocusTraySelection) {
            return { focusedPlaceKey: null, focusedPlaceKeys: [] };
        }

        if (mobileFocusTraySelection.type === 'group' || mobileFocusTraySelection.type === 'pin-group') {
            const memberKeys = (mobileFocusTraySelection.members || [])
                .map((group) => group?.placeKey)
                .filter(Boolean)
                .map((value) => String(value));

            return memberKeys.length === 1
                ? { focusedPlaceKey: `${memberKeys[0]}:zoom`, focusedPlaceKeys: [] }
                : { focusedPlaceKey: null, focusedPlaceKeys: memberKeys };
        }

        const selectedKey = mobileFocusTraySelection.group?.placeKey
            ? String(mobileFocusTraySelection.group.placeKey)
            : null;
        return selectedKey
            ? { focusedPlaceKey: `${selectedKey}:zoom`, focusedPlaceKeys: [] }
            : { focusedPlaceKey: null, focusedPlaceKeys: [] };
    }, [mobileFocusTraySelection, mobileFullMapOpen]);

    useMobileViewportScaleLock(isMobileMapPanelEnabled);
    useMobileMapOverscrollLock(isMobileMapPanelEnabled);

    function holdMobileFocusTrayDuringMapReveal() {
        mobileFocusTrayScrollClearAfterRef.current = Date.now() + MOBILE_FOCUS_TRAY_SCROLL_CLEAR_GRACE_MS;
    }

    function canClearMobileFocusTrayFromScroll() {
        return Date.now() >= mobileFocusTrayScrollClearAfterRef.current;
    }

    const handleDirectoryViewOnMap = useCallback((placeKey) => {
        if (isMobileMapPanelEnabled) {
            setMobileMapListFocused(false);
            setMobileFocusTrayPlaceKey(placeKey ? String(placeKey) : null);
            holdMobileFocusTrayDuringMapReveal();
        }
        onViewOnMap?.(placeKey);
    }, [isMobileMapPanelEnabled, onViewOnMap]);

    const handleMobileMapViewSection = useCallback((placeKey) => {
        if (isMobileMapPanelEnabled) {
            setMobileFocusTrayPlaceKey(placeKey ? String(placeKey) : null);
            holdMobileFocusTrayDuringMapReveal();
        }
        renderMobileMap?.().props?.onViewSection?.(placeKey);
    }, [isMobileMapPanelEnabled, renderMobileMap]);

    const handleMobileMapClusterSelect = useCallback((placeKeys) => {
        renderMobileMap?.().props?.onClusterSelect?.(placeKeys);
    }, [renderMobileMap]);

    const openMobileFullMap = useCallback(() => {
        if (!isMobileMapPanelEnabled) return;
        setMobileMapListFocused(false);
        setMobileFullMapOpen(true);
    }, [isMobileMapPanelEnabled]);

    const closeMobileFullMap = useCallback(() => {
        setMobileMapListFocused(false);
        setMobileFullMapOpen(false);
    }, []);

    useEffect(() => {
        mobileMapListFocusedRef.current = mobileMapListFocused;
    }, [mobileMapListFocused]);

    useEffect(() => {
        mobileFocusTrayPlaceKeyRef.current = mobileFocusTrayPlaceKey;
    }, [mobileFocusTrayPlaceKey]);

    useEffect(() => {
        if (!isMobileMapPanelEnabled) {
            setMobileMapListFocused(false);
            setMobileFullMapOpen(false);
            setMobileFocusTrayPlaceKey(null);
        }
    }, [isMobileMapPanelEnabled]);

    function shouldHideMobileMapForListFocus() {
        if (typeof window === 'undefined') return false;
        if (mobileMapListFocusedRef.current || !mobileMapFrameRef.current) return false;
        const mapRect = mobileMapFrameRef.current.getBoundingClientRect();
        return mapRect.bottom <= MOBILE_MAP_HIDE_TOP_PX && window.scrollY > MOBILE_MAP_REVEAL_SCROLL_Y;
    }

    const handleMobileScrollIntent = useCallback(function handleMobileScrollIntent() {
        if (!isMobileMapPanelEnabled || mobileFullMapOpen || typeof window === 'undefined') return;

        const nextScrollY = Math.max(window.scrollY || 0, 0);
        const deltaY = nextScrollY - mobileLastScrollYRef.current;
        mobileLastScrollYRef.current = nextScrollY;
        if (Math.abs(deltaY) < MOBILE_SCROLL_DIRECTION_EPSILON) return;

        if (deltaY > 0 && shouldHideMobileMapForListFocus()) {
            if (canClearMobileFocusTrayFromScroll()) {
                setMobileFocusTrayPlaceKey(null);
            }
            setMobileMapListFocused(true);
            return;
        }

        if (deltaY > 0 && mobileFocusTrayPlaceKeyRef.current && canClearMobileFocusTrayFromScroll()) {
            setMobileFocusTrayPlaceKey(null);
        }

        if (deltaY < 0 && mobileMapListFocusedRef.current && nextScrollY <= MOBILE_MAP_REVEAL_SCROLL_Y) {
            setMobileMapListFocused(false);
        }
    }, [isMobileMapPanelEnabled, mobileFullMapOpen]);

    function handleMobileTopPullTouchStart(event) {
        if (!isMobileMapPanelEnabled || mobileFullMapOpen || typeof window === 'undefined') {
            mobileTopPullRef.current = null;
            return;
        }
        if ((window.scrollY || 0) > MOBILE_MAP_REVEAL_SCROLL_Y) {
            mobileTopPullRef.current = null;
            return;
        }
        if (event.target?.closest?.('.leaflet-container')) {
            mobileTopPullRef.current = null;
            return;
        }
        const touch = event.touches?.[0];
        mobileTopPullRef.current = touch
            ? { startY: touch.clientY, pullY: 0 }
            : null;
    }

    function handleMobileTopPullTouchMove(event) {
        const pullState = mobileTopPullRef.current;
        const touch = event.touches?.[0];
        if (!pullState || !touch) return;
        pullState.pullY = Math.max(touch.clientY - pullState.startY, 0);
    }

    function handleMobileTopPullTouchEnd() {
        const pullState = mobileTopPullRef.current;
        mobileTopPullRef.current = null;
        if (!pullState || pullState.pullY < MOBILE_FULL_MAP_PULL_DISTANCE_PX) return;
        setMobileMapListFocused(false);
        openMobileFullMap();
    }

    const handleMobileTopPullWheel = useCallback((event) => {
        if (!isMobileMapPanelEnabled || mobileFullMapOpen || typeof window === 'undefined') return;
        if ((window.scrollY || 0) > 4) return;
        if (event.deltaY > -MOBILE_FULL_MAP_PULL_DISTANCE_PX) return;
        setMobileMapListFocused(false);
        openMobileFullMap();
    }, [isMobileMapPanelEnabled, mobileFullMapOpen, openMobileFullMap]);

    useEffect(() => {
        if (!isMobileMapPanelEnabled || typeof window === 'undefined') {
            return undefined;
        }

        mobileLastScrollYRef.current = Math.max(window.scrollY || 0, 0);
        window.addEventListener('scroll', handleMobileScrollIntent, { passive: true });
        window.addEventListener('wheel', handleMobileTopPullWheel, { passive: true });
        window.addEventListener('touchstart', handleMobileTopPullTouchStart, { passive: true });
        window.addEventListener('touchmove', handleMobileTopPullTouchMove, { passive: true });
        window.addEventListener('touchend', handleMobileTopPullTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleMobileTopPullTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleMobileScrollIntent);
            window.removeEventListener('wheel', handleMobileTopPullWheel);
            window.removeEventListener('touchstart', handleMobileTopPullTouchStart);
            window.removeEventListener('touchmove', handleMobileTopPullTouchMove);
            window.removeEventListener('touchend', handleMobileTopPullTouchEnd);
            window.removeEventListener('touchcancel', handleMobileTopPullTouchEnd);
        };
    }, [handleMobileScrollIntent, handleMobileTopPullWheel, isMobileMapPanelEnabled, mobileFullMapOpen, openMobileFullMap]);

    function handleMobileFullMapTouchStart(event) {
        const touch = event.touches?.[0];
        if (!touch || typeof window === 'undefined') {
            mobileFullMapSwipeRef.current = null;
            return;
        }
        const startsNearBottom = touch.clientY >= window.innerHeight - MOBILE_FULL_MAP_BOTTOM_EDGE_PX;
        mobileFullMapSwipeRef.current = startsNearBottom
            ? { startY: touch.clientY, deltaY: 0 }
            : null;
    }

    function handleMobileFullMapTouchMove(event) {
        const swipeState = mobileFullMapSwipeRef.current;
        const touch = event.touches?.[0];
        if (!swipeState || !touch) return;
        swipeState.deltaY = touch.clientY - swipeState.startY;
    }

    function handleMobileFullMapTouchEnd() {
        const swipeState = mobileFullMapSwipeRef.current;
        mobileFullMapSwipeRef.current = null;
        if (!swipeState || swipeState.deltaY > -MOBILE_FULL_MAP_EXIT_SWIPE_PX) return;
        closeMobileFullMap();
    }

    useEffect(() => {
        if (!isMobileMapPanelEnabled || !mobileFullMapOpen || typeof document === 'undefined') {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobileMapPanelEnabled, mobileFullMapOpen]);

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
            if (isMobileMapPanelEnabled && canClearMobileFocusTrayFromScroll()) {
                setMobileFocusTrayPlaceKey(null);
            }
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

        if (isMobileMapPanelEnabled) {
            setMobileMapListFocused(false);
            setMobileFocusTrayPlaceKey(selectionPlaceKey ? String(selectionPlaceKey) : null);
            holdMobileFocusTrayDuringMapReveal();
            window.requestAnimationFrame(() => {
                const mapFrameTop = mobileMapFrameRef.current
                    ? Math.round(mobileMapFrameRef.current.getBoundingClientRect().top + window.scrollY - MOBILE_MAP_HIDE_TOP_PX)
                    : 0;
                window.scrollTo({ top: Math.max(mapFrameTop, 0), behavior: 'smooth' });
            });
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
    }, [autoScrollToHighlight, desktopScrollTargetRef, interactive, isMobileMapPanelEnabled, resolvedLayout, selectionPlaceKey, selectionScrollRequest]);

    if (!displayGroups.length && !unmappedRows.length) {
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                    {t('noMapSearchResults')}
                </div>
            </DirectoryReturnPathContext.Provider>
        );
    }

    if (mode === 'owner' && resourceDisplay === 'table') {
        const tableMap = resolvedLayout === 'mobile' ? renderMobileMap?.() : renderDesktopMap?.();
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-5 ${className}`} data-owner-resource-display="table">
                    {tableMap ? (
                        <div className={resolvedLayout === 'mobile' ? mobileMapStickyClassName : desktopMapWrapperClassName}>
                            {tableMap}
                        </div>
                    ) : null}
                    {printResourcePageHeader}
                    <MyMapResourceTable
                        directory={directory}
                        presentation={presentation}
                        interactive={interactive}
                        onViewOnMap={handleDirectoryViewOnMap}
                        onHoverPlaceStart={onHoverPlaceStart}
                        onHoverPlaceEnd={onHoverPlaceEnd}
                        numberedPinShapesByCategory={numberedPinShapesByCategory}
                        numberedPinStylesByCategory={numberedPinStylesByCategory}
                    />
                </div>
            </DirectoryReturnPathContext.Provider>
        );
    }

    if (resolvedLayout === 'mobile') {
        const mobileMapElement = renderMobileMap?.();
        const mobileFullMapElement = mobileFullMapOpen ? renderMobileMap?.() : null;
        const mobileMapFrameClassName = mobileMapListFocused && !preserveMobileMapFrameInFlow
            ? 'hidden'
            : 'disable-font-scaling [overflow-anchor:none]';
        const mobileMapLayoutSignature = mobileMapElement?.props?.layoutSignature || 'mobile-map-normal';
        const mobileMapNotesWrapperClassName = `${mobileMapStickyClassName} [overflow-anchor:none]`;
        const mobileCardsClassName = 'space-y-4 [overflow-anchor:none]';

        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-4 ${className}`}>
                    {mobileMapElement ? (
                        <div
                            ref={mobileMapFrameRef}
                            className={mobileMapFrameClassName}
                            data-mobile-map-state={mobileMapListFocused ? 'list-focus' : 'default'}
                        >
                            <div className="relative">
                                {React.cloneElement(mobileMapElement, {
                                    onClusterChange: setClusterMapping,
                                    onViewSection: handleMobileMapViewSection,
                                    onClusterSelect: handleMobileMapClusterSelect,
                                    onFixedTownSurfaceViewportChange: mobileFullMapOpen
                                        ? undefined
                                        : mobileMapElement.props?.onFixedTownSurfaceViewportChange,
                                    mapHeightClassName: mobileMapElement.props?.mapHeightClassName,
                                    layoutSignature: preserveMobileMapFrameInFlow
                                        ? mobileMapLayoutSignature
                                        : `${mobileMapLayoutSignature}:${mobileMapListFocused ? 'list-focus' : 'default'}`,
                                })}
                                <button
                                    type="button"
                                    onClick={openMobileFullMap}
                                    className="absolute right-3 bottom-3 z-[1001] inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 shadow-md transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:right-4 sm:bottom-4"
                                    aria-label={t('openFullMap')}
                                    title={t('openFullMap')}
                                >
                                    <Maximize2 size={15} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                            </div>
                            {showMapLegend ? (
                                <MapLegend mobile />
                            ) : null}
                        </div>
                    ) : null}

                    <MobileMapFocusTray
                        selection={mobileFocusTraySelection}
                        mode={mode}
                        onViewOnMap={handleDirectoryViewOnMap}
                        onOpenResourceNotes={openResourceNotes}
                        clusterMapping={clusterMapping}
                        cardBadgeMode={cardBadgeMode}
                        cardVariant={mobileFocusCardVariant}
                        labelDetail={printLabelDetail}
                    />

                    <div ref={mobileMapWrapperRef} className={mobileMapNotesWrapperClassName}>
                        <MapNotesEntryButton
                            rows={noteResourceRows}
                            mode={mode}
                            onOpen={openResourceNotes}
                        />
                    </div>

                    <div className={mobileCardsClassName}>
                        <DirectoryGroupColumn
                            groups={mobileDisplayGroups}
                            mode={mode}
                            interactive
                            fullCardLink={false}
                            onViewOnMap={handleDirectoryViewOnMap}
                            onHoverPlaceStart={onHoverPlaceStart}
                            onHoverPlaceEnd={onHoverPlaceEnd}
                            onRemoveResource={onRemoveResource}
                            onEditPersonalPlace={onEditPersonalPlace}
                            onEditResourceShortDescription={onEditResourceShortDescription}
                            onUpdateResourceNotes={onUpdateResourceNotes}
                            onOpenResourceNotes={openResourceNotes}
                            canSaveResources={canSaveResources}
                            highlightPlaceKey={flashPlaceKey}
                            highlightPlaceKeys={highlightPlaceKeys}
                            sectionRefs={sectionRefs}
                            clusterMapping={clusterMapping}
                            showDesktopHoverLogo={showDesktopHoverLogo}
                            logoRevealPlaceKeys={logoRevealPlaceKeys}
                            cardBadgeMode={cardBadgeMode}
                            showInteractiveNumberBadges={showInteractiveNumberBadges}
                            numberedPinShapesByCategory={numberedPinShapesByCategory}
                            numberedPinStylesByCategory={numberedPinStylesByCategory}
                            showCategoryPills={showCategoryPills}
                            printNumberBadgePosition="start"
                            printLabelDetail={printLabelDetail}
                        />

                        {shouldRenderUnmappedSections ? (
                            <DirectoryUnmappedSection
                                rows={unmappedRows}
                                interactive
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditResourceShortDescription={onEditResourceShortDescription}
                                onOpenResourceNotes={openResourceNotes}
                                compact
                            />
                        ) : null}
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
                    {mobileFullMapOpen ? (
                        <div
                            className="fixed inset-x-0 bottom-0 top-[56px] z-[1150] flex flex-col gap-3 bg-[#f6f8fb] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 sm:top-[64px]"
                            onTouchStart={handleMobileFullMapTouchStart}
                            onTouchMove={handleMobileFullMapTouchMove}
                            onTouchEnd={handleMobileFullMapTouchEnd}
                            onTouchCancel={handleMobileFullMapTouchEnd}
                        >
                            <div className="relative min-h-0 flex-1 disable-font-scaling">
                                {mobileFullMapElement ? React.cloneElement(mobileFullMapElement, {
                                    onClusterChange: setClusterMapping,
                                    onViewSection: handleMobileMapViewSection,
                                    onClusterSelect: handleMobileMapClusterSelect,
                                    focusedPlaceKey: mobileFullMapFocusRequest.focusedPlaceKey || mobileFullMapElement.props?.focusedPlaceKey,
                                    focusedPlaceKeys: mobileFullMapFocusRequest.focusedPlaceKeys.length
                                        ? mobileFullMapFocusRequest.focusedPlaceKeys
                                        : mobileFullMapElement.props?.focusedPlaceKeys,
                                    mapHeightClassName: 'h-full min-h-0 max-h-none',
                                    className: mobileFullMapElement.props?.className,
                                    layoutSignature: `${mobileFullMapElement.props?.layoutSignature || 'mobile-map-normal'}:full`,
                                }) : null}
                                <button
                                    type="button"
                                    onClick={closeMobileFullMap}
                                    className="absolute right-3 bottom-3 z-[1001] inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 shadow-md transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
                                    aria-label={t('returnToMapList')}
                                    title={t('returnToMapList')}
                                >
                                    <Minimize2 size={15} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                            </div>
                            <MobileMapFocusTray
                                selection={mobileFocusTraySelection}
                                mode={mode}
                                onViewOnMap={handleDirectoryViewOnMap}
                                onOpenResourceNotes={openResourceNotes}
                                clusterMapping={clusterMapping}
                                cardBadgeMode={cardBadgeMode}
                                variant="full-map"
                                cardVariant={mobileFocusCardVariant}
                                labelDetail={printLabelDetail}
                            />
                            <MapNotesEntryButton
                                rows={noteResourceRows}
                                mode={mode}
                                onOpen={openResourceNotes}
                            />
                        </div>
                    ) : null}
                </div>
            </DirectoryReturnPathContext.Provider>
        );
    }

    if (interactive && resolvedLayout === 'desktop' && interactiveLayoutPreset === 'map-focus') {
        const sideColumnCount = normalizePrintMapSideResourceColumnCount(
            interactiveSideResourceColumnCount,
        );
        const sideColumns = splitPrintSideResourceGroups(displayGroups, sideColumnCount);
        const resourcePane = (
            <div
                className="grid min-w-0 gap-4"
                style={{ gridTemplateColumns: `repeat(${sideColumnCount}, minmax(0, 1fr))` }}
                data-map-studio-side-columns={sideColumnCount}
            >
                {sideColumns.map((columnGroups, index) => (
                    <DirectoryGroupColumn
                        key={`studio-side-column-${index}`}
                        groups={columnGroups}
                        mode={mode}
                        interactive
                        compactInteractive={compactInteractiveDesktop}
                        fullCardLink={mode !== 'owner'}
                        onViewOnMap={handleDirectoryViewOnMap}
                        onHoverPlaceStart={onHoverPlaceStart}
                        onHoverPlaceEnd={onHoverPlaceEnd}
                        onRemoveResource={onRemoveResource}
                        onEditPersonalPlace={onEditPersonalPlace}
                        onEditResourceShortDescription={onEditResourceShortDescription}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                        onOpenResourceNotes={openResourceNotes}
                        canSaveResources={canSaveResources}
                        highlightPlaceKey={flashPlaceKey}
                        highlightPlaceKeys={highlightPlaceKeys}
                        sectionRefs={sectionRefs}
                        clusterMapping={clusterMapping}
                        showDesktopHoverLogo={showDesktopHoverLogo}
                        logoRevealPlaceKeys={logoRevealPlaceKeys}
                        cardBadgeMode={cardBadgeMode}
                        showInteractiveNumberBadges={showInteractiveNumberBadges}
                        numberedPinShapesByCategory={numberedPinShapesByCategory}
                        numberedPinStylesByCategory={numberedPinStylesByCategory}
                        showCategoryPills={showCategoryPills}
                        printNumberBadgePosition={interactiveMapSide === 'right' ? 'end' : 'start'}
                        printLabelDetail={printLabelDetail}
                    />
                ))}
            </div>
        );
        const mapPane = (
            <div ref={desktopMapWrapperRef} className={`lg:sticky lg:top-6 ${desktopMapWrapperClassName}`.trim()}>
                {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                {showMapLegend ? <MapLegend /> : null}
                <MapNotesEntryButton rows={noteResourceRows} mode={mode} onOpen={openResourceNotes} />
            </div>
        );
        const mapFraction = interactiveMapWidth === 'extra-wide' ? 1.65 : 1.35;
        const resourcesMin = sideColumnCount === 2 ? 'minmax(0, 1.15fr)' : 'minmax(0, 0.78fr)';
        const mapMin = `minmax(0, ${mapFraction}fr)`;
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-5 ${className}`} data-map-studio-resource-panel="beside-map">
                    <div
                        className="grid items-start gap-5"
                        style={{
                            gridTemplateColumns: interactiveMapSide === 'right'
                                ? `${resourcesMin} ${mapMin}`
                                : `${mapMin} ${resourcesMin}`,
                        }}
                    >
                        {interactiveMapSide === 'right' ? resourcePane : mapPane}
                        {interactiveMapSide === 'right' ? mapPane : resourcePane}
                    </div>
                    {shouldRenderUnmappedSections ? (
                        <DirectoryUnmappedSection
                            rows={unmappedRows}
                            interactive
                            mode={mode}
                            canSaveResources={canSaveResources}
                            onRemoveResource={onRemoveResource}
                            onEditResourceShortDescription={onEditResourceShortDescription}
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

    if (interactive && resolvedLayout === 'desktop' && (resourcePanelPlacement === 'below-map' || interactiveLayoutPreset === 'full-map')) {
        const normalizedColumnCount = normalizePrintMapResourceColumnCount(
            interactiveResourceColumnCount,
        );
        const belowMapColumns = splitPrintResourceGroups(displayGroups, normalizedColumnCount);
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-5 ${className}`} data-map-studio-resource-panel="below-map">
                    <div ref={desktopMapWrapperRef} className={desktopMapWrapperClassName}>
                        {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                        {showMapLegend ? <MapLegend /> : null}
                        <MapNotesEntryButton
                            rows={noteResourceRows}
                            mode={mode}
                            onOpen={openResourceNotes}
                        />
                    </div>
                    <div
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${normalizedColumnCount}, minmax(0, 1fr))` }}
                        data-map-studio-resource-columns={normalizedColumnCount}
                    >
                        {belowMapColumns.map((columnGroups, index) => (
                            <DirectoryGroupColumn
                                key={`studio-below-map-column-${index}`}
                                groups={columnGroups}
                                mode={mode}
                                interactive
                                compactInteractive={compactInteractiveDesktop}
                                fullCardLink={mode !== 'owner'}
                                onViewOnMap={handleDirectoryViewOnMap}
                                onHoverPlaceStart={onHoverPlaceStart}
                                onHoverPlaceEnd={onHoverPlaceEnd}
                                onRemoveResource={onRemoveResource}
                                onEditPersonalPlace={onEditPersonalPlace}
                                onEditResourceShortDescription={onEditResourceShortDescription}
                                onUpdateResourceNotes={onUpdateResourceNotes}
                                onOpenResourceNotes={openResourceNotes}
                                canSaveResources={canSaveResources}
                                highlightPlaceKey={flashPlaceKey}
                                highlightPlaceKeys={highlightPlaceKeys}
                                sectionRefs={sectionRefs}
                                clusterMapping={clusterMapping}
                                showDesktopHoverLogo={showDesktopHoverLogo}
                                logoRevealPlaceKeys={logoRevealPlaceKeys}
                                cardBadgeMode={cardBadgeMode}
                                showInteractiveNumberBadges={showInteractiveNumberBadges}
                                numberedPinShapesByCategory={numberedPinShapesByCategory}
                                numberedPinStylesByCategory={numberedPinStylesByCategory}
                                showCategoryPills={showCategoryPills}
                                printNumberBadgePosition="start"
                                printLabelDetail={printLabelDetail}
                            />
                        ))}
                    </div>
                    {shouldRenderUnmappedSections ? (
                        <DirectoryUnmappedSection
                            rows={unmappedRows}
                            interactive
                            mode={mode}
                            canSaveResources={canSaveResources}
                            onRemoveResource={onRemoveResource}
                            onEditResourceShortDescription={onEditResourceShortDescription}
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

    if (resolvedLayout === 'print' && printResourcesBelow) {
        const renderPrintResourceColumn = (groups, badgePosition) => (
            <DirectoryGroupColumn
                groups={groups}
                mode={mode}
                interactive={false}
                compactInteractive={false}
                fullCardLink={false}
                onViewOnMap={handleDirectoryViewOnMap}
                onHoverPlaceStart={onHoverPlaceStart}
                onHoverPlaceEnd={onHoverPlaceEnd}
                onRemoveResource={onRemoveResource}
                onEditPersonalPlace={onEditPersonalPlace}
                onEditResourceShortDescription={onEditResourceShortDescription}
                onUpdateResourceNotes={onUpdateResourceNotes}
                onOpenResourceNotes={openResourceNotes}
                canSaveResources={canSaveResources}
                highlightPlaceKey={flashPlaceKey}
                highlightPlaceKeys={highlightPlaceKeys}
                sectionRefs={sectionRefs}
                allowPrintLinks={allowPrintLinks}
                compactPrint={compactPrint}
                clusterMapping={clusterMapping}
                showDesktopHoverLogo={showDesktopHoverLogo}
                logoRevealPlaceKeys={logoRevealPlaceKeys}
                cardBadgeMode={cardBadgeMode}
                showCategoryPills={showCategoryPills}
                showPrintNumberBadges={showPrintNumberBadges}
                numberedPinShapesByCategory={numberedPinShapesByCategory}
                numberedPinStylesByCategory={numberedPinStylesByCategory}
                printNumberBadgePosition={badgePosition}
                printLabelDetail={printLabelDetail}
            />
        );

        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-8 ${className}`} data-print-resources-below="true">
                    <section
                        ref={desktopMapWrapperRef}
                        className={`bg-white ${printPagePaddingClassName} ${desktopMapWrapperClassName}`.trim()}
                        data-print-full-map-page="true"
                        data-print-export-page="map"
                    >
                        {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                    </section>

                    <section
                        className={`bg-white ${printPagePaddingClassName} [break-before:page] [page-break-before:always]`}
                        data-print-resource-page="true"
                        data-print-export-page="resources"
                    >
                        {printResourcePageHeader}
                        <div
                            className={`${printResourcePageHeader ? 'mt-8' : ''} grid gap-5`}
                            style={{ gridTemplateColumns: `repeat(${normalizedPrintResourceColumnCount}, minmax(0, 1fr))` }}
                            data-print-resource-columns={normalizedPrintResourceColumnCount}
                        >
                            {printResourceColumns.map((groups, index) => (
                                <React.Fragment key={`print-resource-column-${index}`}>
                                    {renderPrintResourceColumn(groups, 'start')}
                                </React.Fragment>
                            ))}
                        </div>
                        {shouldRenderUnmappedSections ? (
                            <DirectoryUnmappedSection
                                rows={unmappedRows}
                                interactive={false}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditResourceShortDescription={onEditResourceShortDescription}
                                onOpenResourceNotes={openResourceNotes}
                            />
                        ) : null}
                    </section>
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
                        onHoverPlaceStart={onHoverPlaceStart}
                        onHoverPlaceEnd={onHoverPlaceEnd}
                        onRemoveResource={onRemoveResource}
                        onEditPersonalPlace={onEditPersonalPlace}
                        onEditResourceShortDescription={onEditResourceShortDescription}
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
                        cardBadgeMode={cardBadgeMode}
                        showInteractiveNumberBadges={showInteractiveNumberBadges}
                        numberedPinShapesByCategory={numberedPinShapesByCategory}
                        numberedPinStylesByCategory={numberedPinStylesByCategory}
                        showCategoryPills={showCategoryPills}
                        showPrintNumberBadges={showPrintNumberBadges}
                        printNumberBadgePosition="end"
                        printLabelDetail={printLabelDetail}
                        printColumnCount={normalizedPrintSideResourceColumnCount}
                        afterContent={shouldRenderUnmappedSections && useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'side-lanes' && leftUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={leftUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditResourceShortDescription={onEditResourceShortDescription}
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
                        {resolvedLayout !== 'print' && showMapLegend ? <MapLegend /> : null}
                        {resolvedLayout !== 'print' ? (
                            <MapNotesEntryButton
                                rows={noteResourceRows}
                                mode={mode}
                                onOpen={openResourceNotes}
                            />
                        ) : null}
                        {mapColumnGroups.length ? (
                            <div className={resolvedLayout !== 'print' ? 'mt-3' : ''}>
                                <DirectoryGroupColumn
                                    groups={mapColumnGroups}
                                    mode={mode}
                                    interactive={interactive}
                                    compactInteractive={compactInteractiveDesktop}
                                    fullCardLink={false}
                                    onViewOnMap={handleDirectoryViewOnMap}
                                    onHoverPlaceStart={onHoverPlaceStart}
                                    onHoverPlaceEnd={onHoverPlaceEnd}
                                    onRemoveResource={onRemoveResource}
                                    onEditPersonalPlace={onEditPersonalPlace}
                                    onEditResourceShortDescription={onEditResourceShortDescription}
                                    onUpdateResourceNotes={onUpdateResourceNotes}
                                    onOpenResourceNotes={openResourceNotes}
                                    canSaveResources={canSaveResources}
                                    highlightPlaceKey={flashPlaceKey}
                                    highlightPlaceKeys={highlightPlaceKeys}
                                    sectionRefs={sectionRefs}
                                    allowPrintLinks={allowPrintLinks}
                                    compactPrint={compactPrint}
                                    clusterMapping={clusterMapping}
                                    showDesktopHoverLogo={showDesktopHoverLogo}
                                    logoRevealPlaceKeys={logoRevealPlaceKeys}
                                    cardBadgeMode={cardBadgeMode}
                                    showInteractiveNumberBadges={showInteractiveNumberBadges}
                                    numberedPinShapesByCategory={numberedPinShapesByCategory}
                                    numberedPinStylesByCategory={numberedPinStylesByCategory}
                                    showCategoryPills={showCategoryPills}
                                    showPrintNumberBadges={showPrintNumberBadges}
                                    printNumberBadgePosition="end"
                                    printLabelDetail={printLabelDetail}
                                    afterContent={null}
                                />
                            </div>
                        ) : null}
                        {shouldRenderUnmappedSections && useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'map-column' && dockedUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={dockedUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditResourceShortDescription={onEditResourceShortDescription}
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
                        onHoverPlaceStart={onHoverPlaceStart}
                        onHoverPlaceEnd={onHoverPlaceEnd}
                        onRemoveResource={onRemoveResource}
                        onEditPersonalPlace={onEditPersonalPlace}
                        onEditResourceShortDescription={onEditResourceShortDescription}
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
                        cardBadgeMode={cardBadgeMode}
                        showInteractiveNumberBadges={showInteractiveNumberBadges}
                        numberedPinShapesByCategory={numberedPinShapesByCategory}
                        numberedPinStylesByCategory={numberedPinStylesByCategory}
                        showCategoryPills={showCategoryPills}
                        showPrintNumberBadges={showPrintNumberBadges}
                        printNumberBadgePosition="start"
                        printLabelDetail={printLabelDetail}
                        printColumnCount={normalizedPrintSideResourceColumnCount}
                        afterContent={shouldRenderUnmappedSections && useAdaptiveDesktopUnmapped && desktopUnmappedPlacement === 'side-lanes' && rightUnmappedRows.length ? (
                            <DirectoryUnmappedSection
                                rows={rightUnmappedRows}
                                interactive={interactive}
                                mode={mode}
                                canSaveResources={canSaveResources}
                                onRemoveResource={onRemoveResource}
                                onEditResourceShortDescription={onEditResourceShortDescription}
                                onOpenResourceNotes={openResourceNotes}
                                compact
                            />
                        ) : null}
                    />
                </div>

                {!interactive && shouldRenderUnmappedSections ? (
                    <DirectoryUnmappedSection
                        rows={unmappedRows}
                        interactive={interactive}
                        mode={mode}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                        onEditResourceShortDescription={onEditResourceShortDescription}
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
