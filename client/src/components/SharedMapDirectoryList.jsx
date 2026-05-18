import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { appendMapReturnTo, buildCurrentAppPath, normalizeMapReturnPath } from '../lib/appNavigation.js';
import { OFFERING_ACCESS } from '../lib/eligibility.js';
import { ChevronDown, Plus, Save, StickyNote, Trash2 } from 'lucide-react';
import OfferingAccessNotice from './OfferingAccessNotice.jsx';
import ResourceRowIcon from './ResourceRowIcon.jsx';

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

function getRowAssetKey(row) {
    return row?.assetKey || `${row?.resourceType}-${row?.resourceId}`;
}

function getUniqueNoteRows(rows = []) {
    const seen = new Set();
    const uniqueRows = [];

    for (const row of rows || []) {
        const key = getRowAssetKey(row);
        if (!row || seen.has(key)) continue;
        seen.add(key);
        uniqueRows.push(row);
    }

    return uniqueRows;
}

function getNoteRowsForGroup(group) {
    if (group?.isPostalGroup) {
        return getUniqueNoteRows((group.nestedPlaces || []).flatMap((place) => place.rows || []));
    }

    return getUniqueNoteRows(group?.rows || []);
}

function normalizeNoteItems(notes) {
    if (Array.isArray(notes?.items)) {
        return notes.items
            .map((note, index) => ({
                clientId: note?.id ? `note-${note.id}` : `note-${index}`,
                id: note?.id || null,
                text: String(note?.text || '').slice(0, 1000),
                isShared: Boolean(note?.isShared),
            }))
            .filter((note) => note.text.trim());
    }

    const legacyItems = [];
    const privateNote = String(notes?.privateNote || '').trim();
    const handoffNote = String(notes?.handoffNote || '').trim();
    if (privateNote) {
        legacyItems.push({
            clientId: 'legacy-private',
            id: null,
            text: privateNote,
            isShared: false,
        });
    }
    if (handoffNote) {
        legacyItems.push({
            clientId: 'legacy-shared',
            id: null,
            text: handoffNote,
            isShared: true,
        });
    }
    return legacyItems;
}

function hasAnyOwnerNote(row) {
    return normalizeNoteItems(row?.notes).length > 0;
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
                    <p key={`${note.id || index}-${note.text}`} className="rounded-lg border border-brand-100 bg-brand-50 px-2 py-1 text-[10px] font-medium leading-4 text-brand-800">
                        <span className="font-bold">{t('sharedNote')}:</span> {note.text}
                    </p>
                ))}
            </div>
        );
    }

    return (
        <div className={`mt-2 rounded-2xl border border-brand-100 bg-brand-50 text-brand-900 ${compact ? 'px-2.5 py-2 text-[11px] leading-5' : 'px-3 py-2 text-xs leading-5'}`}>
            <p className="font-bold">{t('sharedNotes')}</p>
            <div className="mt-1 space-y-1.5">
                {items.map((note, index) => (
                    <p key={`${note.id || index}-${note.text}`} className="whitespace-pre-wrap">{note.text}</p>
                ))}
            </div>
        </div>
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

function MapResourceNotesDrawer({
    rows,
    compactInteractive = false,
    onUpdateResourceNotes,
}) {
    const { t } = useLocale();
    const noteRows = getUniqueNoteRows(rows);
    const noteSignature = noteRows.map((row) => [
        getRowAssetKey(row),
        normalizeNoteItems(row?.notes).map((note) => `${note.text}:${note.isShared}`).join(','),
    ].join(':')).join('|');
    const noteCount = noteRows.reduce((count, row) => count + normalizeNoteItems(row?.notes).length, 0);
    const [open, setOpen] = useState(false);
    const [drafts, setDrafts] = useState(() => buildNoteDrafts(noteRows));
    const [savingKey, setSavingKey] = useState('');
    const [savedKeys, setSavedKeys] = useState(() => new Set());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setDrafts(buildNoteDrafts(noteRows));
    }, [open, noteSignature]);

    if (!noteRows.length || !onUpdateResourceNotes) return null;

    function updateDraftNote(row, clientId, values) {
        const key = getRowAssetKey(row);
        setSavedKeys((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
        });
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...(current[key] || {}),
                notes: (current[key]?.notes || []).map((note) => (
                    note.clientId === clientId
                        ? { ...note, ...values, text: values.text !== undefined ? values.text.slice(0, 1000) : note.text }
                        : note
                )),
            },
        }));
    }

    function addDraftNote(row) {
        const key = getRowAssetKey(row);
        setSavedKeys((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
        });
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...(current[key] || {}),
                notes: [...(current[key]?.notes || []), createEmptyDraftNote()],
            },
        }));
    }

    function removeDraftNote(row, clientId) {
        const key = getRowAssetKey(row);
        setSavedKeys((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
        });
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...(current[key] || {}),
                notes: (() => {
                    const nextNotes = (current[key]?.notes || []).filter((note) => note.clientId !== clientId);
                    return nextNotes.length ? nextNotes : [createEmptyDraftNote()];
                })(),
            },
        }));
    }

    async function saveRow(row) {
        const key = getRowAssetKey(row);
        const draft = drafts[key] || { notes: [] };
        setSavingKey(key);
        setError('');
        try {
            await onUpdateResourceNotes(row, {
                notes: (draft.notes || []).map((note) => ({
                    id: note.id || undefined,
                    text: note.text,
                    isShared: Boolean(note.isShared),
                })),
            });
            setSavedKeys((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
            });
        } catch (err) {
            console.error(err);
            setError(err.message || t('failedSaveMapNotes'));
        } finally {
            setSavingKey('');
        }
    }

    const triggerAriaLabel = noteCount
        ? t('resourceNotesCount', { count: noteCount })
        : t('addResourceNotes');

    return (
        <div
            className={`${compactInteractive ? 'mt-1.5' : 'mt-2'} border-t border-slate-100 pt-2`}
            onClick={(event) => event.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[12px] font-bold transition ${
                    noteCount
                        ? 'text-brand-700 hover:bg-brand-50'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-brand-700'
                }`}
                aria-expanded={open}
                aria-label={triggerAriaLabel}
            >
                <StickyNote size={14} strokeWidth={2.2} />
                <span>{t('addResourceNotes')}</span>
                {noteCount ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[11px] font-black leading-none text-brand-800">
                        {noteCount}
                    </span>
                ) : null}
                <ChevronDown size={13} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open ? (
                <div className="mt-3 space-y-3 rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold leading-5 text-slate-500">
                        {t('mapNotesPrivacyHelp')}
                    </p>
                    {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                    {noteRows.map((row) => {
                        const key = getRowAssetKey(row);
                        const draft = drafts[key] || {
                            notes: [createEmptyDraftNote()],
                        };
                        const draftNotes = draft.notes?.length ? draft.notes : [createEmptyDraftNote()];
                        const saving = savingKey === key;
                        const saved = savedKeys.has(key);

                        return (
                            <div key={key} className="rounded-[18px] border border-slate-200 bg-white p-3 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold leading-snug text-slate-900">{row.name}</p>
                                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                                            {row.resourceType === 'hard' ? t('placeType') : t('offeringType')}
                                        </p>
                                    </div>
                                    {saved ? (
                                        <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">
                                            {t('saved')}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-3 grid gap-2.5">
                                    {draftNotes.map((note, index) => (
                                        <div key={note.clientId} className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                                            <div className="flex items-start gap-2">
                                                <textarea
                                                    value={note.text}
                                                    onChange={(event) => updateDraftNote(row, note.clientId, { text: event.target.value })}
                                                    maxLength={1000}
                                                    rows={2}
                                                    className="min-h-[72px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                                                    placeholder={t('mapNotePlaceholder')}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeDraftNote(row, note.clientId)}
                                                    className="mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                                    aria-label={t('removeNote')}
                                                    disabled={draftNotes.length === 1 && !note.text.trim() && index === 0}
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full px-1 text-xs font-bold text-slate-600">
                                                <input
                                                    type="checkbox"
                                                    checked={note.isShared}
                                                    onChange={(event) => updateDraftNote(row, note.clientId, { isShared: event.target.checked })}
                                                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                                                />
                                                {t('shareThisNote')}
                                            </label>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addDraftNote(row)}
                                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-dashed border-brand-200 bg-white px-3 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                                    >
                                        <Plus size={14} />
                                        {t('addAnotherNote')}
                                    </button>
                                </div>

                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => saveRow(row)}
                                        disabled={saving}
                                        className="btn-primary min-h-11 justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Save size={15} />
                                        {saving ? t('saving') : t('saveNotes')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : null}
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
    const slotClassName = compactInteractive ? 'h-[34px] w-[34px]' : 'h-[38px] w-[38px]';
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
                <p className={`${compact ? 'text-[11px]' : 'text-[12px]'} font-medium text-slate-500`}>{shortLocationLine}</p>
            ) : null}
            {distanceLabel ? (
                <span className={`inline-flex rounded-full border border-brand-200 bg-brand-50 font-bold text-brand-700 ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>
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
    allowPrintLinks = false,
    compactPrint = false,
}) {
    const detailPath = useDirectoryDetailPath(row.detailPath);
    const canOpenDetail = Boolean(detailPath) && row.status !== 'unavailable';
    const access = row?.resourceType === 'soft' ? (row.access || OFFERING_ACCESS.GRANTED) : null;
    const isAccessRestricted = row?.resourceType === 'soft' && access !== OFFERING_ACCESS.GRANTED;
    const sharedNotes = normalizeNoteItems(row?.notes);
    const rowTitleClassName = interactive
        ? (compactInteractive ? 'text-[12px]' : 'text-[14px]')
        : (compactPrint ? 'text-[11px]' : 'text-[12px]');

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
                            {canOpenDetail ? (
                                <Link to={detailPath} reloadDocument className={`block font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                                    {row.name}
                                </Link>
                            ) : (
                                <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
                            )}
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
                            {mode === 'shared' ? (
                                <SharedResourceNotes notes={sharedNotes} compact={compactInteractive} />
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
    const wrapperClassName = compactInteractive ? 'h-[42px] w-[42px]' : 'h-[46px] w-[46px]';
    const numberBadgeClassName = compactInteractive
        ? 'inset-[4px] rounded-[11px]'
        : 'inset-[4px] rounded-[13px]';
    const logoTileClassName = compactInteractive
        ? 'rounded-[15px]'
        : 'rounded-[17px]';
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
                    fontSize: String(group.number).length > 2 ? '12px' : (compactInteractive ? '16px' : '18px'),
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
}) {
    const nestedPlaceDetailPath = useDirectoryDetailPath(getGroupDetailPath(nestedPlace));
    const visibleRows = getVisibleGroupRows(nestedPlace);
    const titleClassName = compactInteractive ? 'text-[15px]' : 'text-[17px]';

    return (
        <div className={compactInteractive ? 'space-y-1.5' : 'space-y-2'}>
            <div className="min-w-0">
                {nestedPlaceDetailPath ? (
                    <Link to={nestedPlaceDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${titleClassName}`}>
                        {nestedPlace.name}
                    </Link>
                ) : (
                    <h4 className={`font-bold leading-tight text-slate-900 ${titleClassName}`}>{nestedPlace.name}</h4>
                )}
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
                                fontSize: String(group.number).length > 2 ? '11px' : (compactPrint ? '15px' : '17px'),
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
                                        <Link to={nestedPlaceDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>
                                            {nestedPlace.name}
                                        </Link>
                                    ) : (
                                        <h3 className={`font-bold leading-tight text-slate-900 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>
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
            <Link to={placeDetailPath} reloadDocument className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>
                {group.name}
            </Link>
        ) : (
            <h3 className={`font-bold leading-tight text-slate-900 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>{group.name}</h3>
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
                            fontSize: String(group.number).length > 2 ? '11px' : (compactPrint ? '15px' : '17px'),
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
                                <p className={`${compactPrint ? 'text-[10px]' : 'text-[11px]'} text-slate-500`}>{group.shortLocationLine}</p>
                            ) : null}
                            {group.distanceLabel ? (
                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
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
            <div className={`grid ${compactInteractive ? 'grid-cols-[42px_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[46px_minmax(0,1fr)] gap-x-3'}`}>
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
                            />
                        </div>
                    ) : null}
                </div>

                {trailingNestedPlaces.length ? (
                    <div className={`col-span-2 ${compactInteractive ? 'mt-3 space-y-3' : 'mt-4 space-y-4'}`}>
                        {trailingNestedPlaces.map((nestedPlace) => (
                            <div
                                key={nestedPlace.placeKey}
                                className={`grid items-start ${compactInteractive ? 'grid-cols-[42px_minmax(0,1fr)] gap-x-2.5' : 'grid-cols-[46px_minmax(0,1fr)] gap-x-3'}`}
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
                <MapResourceNotesDrawer
                    rows={getNoteRowsForGroup(group)}
                    compactInteractive={compactInteractive}
                    onUpdateResourceNotes={onUpdateResourceNotes}
                />
            </section>
        );
    }

    const interactivePlaceTitle = placeDetailPath ? (
        <Link to={placeDetailPath} reloadDocument className={`${compactInteractive ? 'text-[15px]' : 'text-[17px]'} font-bold leading-tight text-slate-900 transition hover:text-brand-700`}>
            {group.name}
        </Link>
    ) : (
        <h3 className={`${compactInteractive ? 'text-[15px]' : 'text-[17px]'} font-bold leading-tight text-slate-900`}>{group.name}</h3>
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
                    <div className={compactInteractive ? 'mt-2' : 'mt-2.5'}>
                        {interactivePlaceTitle}
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
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
            <MapResourceNotesDrawer
                rows={getNoteRowsForGroup(group)}
                compactInteractive={compactInteractive}
                onUpdateResourceNotes={onUpdateResourceNotes}
            />
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

function DirectoryUnmappedRow({ row, interactive, mode, canSaveResources, onRemoveResource, onUpdateResourceNotes }) {
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
                    <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    <div className="min-w-0 flex-1">
                        {canOpenDetail ? (
                            <Link to={detailPath} reloadDocument className="text-[12px] font-semibold leading-snug text-slate-800 transition hover:text-brand-700">
                                {row.name}
                            </Link>
                        ) : (
                            <p className="text-[12px] font-semibold leading-snug text-slate-800">{row.name}</p>
                        )}
                        {row.contextLabel ? <p className="mt-0.5 text-[10px] text-slate-500">{row.contextLabel}</p> : null}
                        {mode === 'shared' ? <SharedResourceNotes notes={sharedNotes} print /> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {row.subCategory ? (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                                    {row.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge status={row.status || 'list_only'} />
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                                {t('listOnly')}
                            </span>
                        </div>
                        {detailPath && row.status !== 'unavailable' ? (
                            <Link to={detailPath} reloadDocument className="mt-1.5 block text-base font-bold leading-snug text-slate-900 transition hover:text-brand-700">
                                {row.name}
                            </Link>
                        ) : (
                            <p className="mt-1.5 text-base font-bold leading-snug text-slate-900">{row.name}</p>
                        )}
                        {row.contextLabel ? (
                            <p className="mt-1 text-sm text-slate-500">{row.contextLabel}</p>
                        ) : null}
                        {row.locationLabel ? (
                            <p className="mt-1 text-sm text-slate-400">{row.locationLabel}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                        {row.descriptor ? (
                            <p className="mt-1.5 text-sm leading-6 text-slate-500">{row.descriptor}</p>
                        ) : null}
                        {mode === 'shared' ? (
                            <SharedResourceNotes notes={sharedNotes} />
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

                {interactive ? (
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
                <MapResourceNotesDrawer
                    rows={[row]}
                    compactInteractive
                    onUpdateResourceNotes={onUpdateResourceNotes}
                />
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
}) {
    if (!groups.length) {
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
        </div>
    );
}

function DirectoryUnmappedSection({
    rows,
    interactive,
    mode,
    canSaveResources,
    onRemoveResource,
    onUpdateResourceNotes,
}) {
    const { t } = useLocale();
    if (!rows.length) {
        return null;
    }

    return (
        <section className={`border border-slate-200 ${interactive ? 'rounded-[28px] bg-white p-5 shadow-sm sm:p-6' : 'rounded-[30px] bg-slate-50/70 p-5 shadow-none sm:p-6'}`}>
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
                        onUpdateResourceNotes={onUpdateResourceNotes}
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
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const [clusterMapping, setClusterMapping] = useState({});
    const isDesktop = useResponsiveDirectoryLayout(layout === 'responsive');
    const resolvedLayout = layout === 'responsive'
        ? (isDesktop ? 'desktop' : 'mobile')
        : layout;
    const mappedGroups = presentation?.mappedGroups || [];
    const leftGroups = presentation?.leftGroups || [];
    const rightGroups = presentation?.rightGroups || [];
    const unmappedRows = presentation?.unmappedRows || [];
    const interactive = layout !== 'print';
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
        return (
            <DirectoryReturnPathContext.Provider value={detailReturnPath}>
                <div className={`space-y-4 ${className}`}>
                    {renderMobileMap ? (
                        <div ref={mobileMapWrapperRef} className={`${mobileMapStickyClassName} disable-font-scaling`}>
                            {React.cloneElement(renderMobileMap(), { onClusterChange: setClusterMapping })}
                            <MapLegend mobile />
                        </div>
                    ) : null}

                    <DirectoryGroupColumn
                        groups={mappedGroups}
                        mode={mode}
                        interactive
                        fullCardLink={false}
                        onViewOnMap={onViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
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
                        onViewOnMap={onViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
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
                    />

                    <div
                        ref={desktopMapWrapperRef}
                        className={`${interactive ? 'lg:sticky lg:top-6' : ''} scroll-mt-[56px] sm:scroll-mt-[64px] ${desktopMapWrapperClassName}`.trim()}
                    >
                        {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                        {resolvedLayout !== 'print' && <MapLegend />}
                    </div>

                    <DirectoryGroupColumn
                        groups={rightGroups}
                        mode={mode}
                        interactive={interactive}
                        compactInteractive={compactInteractiveDesktop}
                        fullCardLink={interactive && mode !== 'owner'}
                        onViewOnMap={onViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
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
                    />
                </div>

                <DirectoryUnmappedSection
                    rows={unmappedRows}
                    interactive={interactive}
                    mode={mode}
                    canSaveResources={canSaveResources}
                    onRemoveResource={onRemoveResource}
                    onUpdateResourceNotes={onUpdateResourceNotes}
                />
            </div>
        </DirectoryReturnPathContext.Provider>
    );
}
