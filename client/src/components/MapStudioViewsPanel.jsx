import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import {
    AlertTriangle,
    Copy,
    Layers3,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    RotateCcw,
    Save,
    Star,
    Trash2,
    X,
} from 'lucide-react';

import { useConfirmDialog } from './ConfirmDialog.jsx';
import MapStudioDesignControls from './MapStudioDesignControls.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { api } from '../lib/api.js';
import {
    acknowledgeMapStudioOwnerSave,
    createMapStudioOwnerState,
    createOwnerMapStudioView,
    createUniqueMapStudioViewId,
    deleteOwnerMapStudioView,
    discardOwnerMapStudioChanges,
    discardOwnerMapStudioDraft,
    duplicateOwnerMapStudioView,
    getMapStudioOwnerRuntimeSnapshot,
    isMapStudioOwnerStateDirty,
    prepareMapStudioOwnerSave,
    patchOwnerMapStudioDraft,
    patchOwnerMapStudioExploration,
    renameOwnerMapStudioView,
    selectOwnerMapStudioView,
    setDefaultOwnerMapStudioView,
    setOwnerMapStudioMode,
} from '../lib/mapStudioOwnerState.js';
import {
    MAP_STUDIO_MAX_VIEWS,
    MAP_STUDIO_MAX_VIEW_NAME_LENGTH,
    MAP_STUDIO_MODE_DESIGN,
} from '../lib/mapStudioState.js';
import {
    MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT,
    readMapStudioLayoutPanelSide,
    writeMapStudioLayoutPanelSide,
} from '../lib/mapStudioUiPreferences.js';

function createViewEntropy(sequence) {
    const randomId = globalThis.crypto?.randomUUID?.();
    return randomId || `${Date.now().toString(36)}-${sequence}`;
}

const MapStudioViewsPanel = forwardRef(function MapStudioViewsPanel({
    mapId,
    defaultMapStyle = 'default',
    defaultDetailMode = 'auto',
    resourceLayerCatalog = null,
    annotationLayerCatalog = [],
    onOwnerSessionChange = null,
}, ref) {
    const { t } = useLocale();
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const defaultsRef = useRef({ mapStyle: defaultMapStyle, detailMode: defaultDetailMode });
    const tRef = useRef(t);
    const viewSequenceRef = useRef(0);
    const loadRequestRef = useRef(0);
    const ownerStateMapIdRef = useRef('');
    const designSettingsPanelRef = useRef(null);
    const [ownerState, setOwnerState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [editorMode, setEditorMode] = useState(null);
    const [viewName, setViewName] = useState('');
    const [designSettingsOpen, setDesignSettingsOpen] = useState(false);
    const [designSettingsCollapsed, setDesignSettingsCollapsed] = useState(false);
    const [designSettingsSide, setDesignSettingsSide] = useState(readMapStudioLayoutPanelSide);

    const handleDesignSettingsSideChange = useCallback((nextSide) => {
        setDesignSettingsSide(writeMapStudioLayoutPanelSide(nextSide));
    }, []);

    const handleModeChange = useCallback((nextMode) => {
        if (saving || editorMode) return;
        setDesignSettingsOpen(nextMode === MAP_STUDIO_MODE_DESIGN);
        if (nextMode === MAP_STUDIO_MODE_DESIGN) setDesignSettingsCollapsed(false);
        setOwnerState((current) => (
            current ? setOwnerMapStudioMode(current, nextMode) : current
        ));
    }, [editorMode, saving]);

    const handleDesignPatch = useCallback((patch, { enterDesign = false } = {}) => {
        if (saving || editorMode) return;
        setOwnerState((current) => {
            if (!current) return current;
            let next = current;
            if (next.session.mode !== MAP_STUDIO_MODE_DESIGN) {
                if (!enterDesign) return current;
                next = setOwnerMapStudioMode(next, MAP_STUDIO_MODE_DESIGN);
            }
            return patchOwnerMapStudioDraft(next, patch);
        });
    }, [editorMode, saving]);

    const handleExplorationPatch = useCallback((patch) => {
        setOwnerState((current) => (
            current ? patchOwnerMapStudioExploration(current, patch) : current
        ));
    }, []);

    useImperativeHandle(ref, () => ({
        setMode: handleModeChange,
        openLayoutSettings: () => {
            setDesignSettingsCollapsed(false);
            handleModeChange(MAP_STUDIO_MODE_DESIGN);
        },
        patchDesign: handleDesignPatch,
        patchExploration: handleExplorationPatch,
    }), [handleDesignPatch, handleExplorationPatch, handleModeChange]);

    useEffect(() => {
        defaultsRef.current = { mapStyle: defaultMapStyle, detailMode: defaultDetailMode };
    }, [defaultDetailMode, defaultMapStyle]);

    useEffect(() => {
        tRef.current = t;
    }, [t]);

    const loadStudio = useCallback(async () => {
        if (!mapId) return;
        loadRequestRef.current += 1;
        const requestId = loadRequestRef.current;
        ownerStateMapIdRef.current = '';
        setLoading(true);
        setOwnerState(null);
        setLoadError('');
        setActionError('');
        setConflict(false);
        setEditorMode(null);
        setDesignSettingsOpen(false);
        setDesignSettingsCollapsed(false);
        try {
            const response = await api.getMyMapStudio(mapId);
            if (requestId !== loadRequestRef.current) return;
            ownerStateMapIdRef.current = String(mapId);
            setOwnerState(createMapStudioOwnerState(response?.document ?? null, defaultsRef.current));
        } catch (error) {
            if (requestId !== loadRequestRef.current) return;
            console.error('Failed to load Map Studio views:', error);
            ownerStateMapIdRef.current = '';
            setOwnerState(null);
            setLoadError(tRef.current('mapStudioLoadFailed'));
        } finally {
            if (requestId === loadRequestRef.current) setLoading(false);
        }
    }, [mapId]);

    useEffect(() => {
        loadStudio();
        return () => {
            loadRequestRef.current += 1;
            ownerStateMapIdRef.current = '';
        };
    }, [loadStudio]);

    const dirty = isMapStudioOwnerStateDirty(ownerState);
    const activeView = ownerState?.workingDocument?.views.find(
        (view) => view.id === ownerState.session.activeViewId,
    ) || null;
    const isDefaultView = activeView?.id === ownerState?.workingDocument?.defaultViewId;

    useEffect(() => {
        const snapshot = !loading
            && !loadError
            && ownerStateMapIdRef.current === String(mapId)
            ? getMapStudioOwnerRuntimeSnapshot(ownerState)
            : null;
        onOwnerSessionChange?.(snapshot);
    }, [loadError, loading, mapId, onOwnerSessionChange, ownerState]);

    useEffect(() => () => {
        onOwnerSessionChange?.(null);
    }, [onOwnerSessionChange]);

    useEffect(() => {
        if (!dirty) return undefined;
        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (!designSettingsOpen) return undefined;
        const handleDesignSettingsKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setDesignSettingsOpen(false);
        };
        window.addEventListener('keydown', handleDesignSettingsKeyDown);
        return () => window.removeEventListener('keydown', handleDesignSettingsKeyDown);
    }, [designSettingsOpen]);

    useEffect(() => {
        if (!designSettingsOpen || designSettingsCollapsed) return undefined;
        const handleDesignSettingsOutsidePointer = (event) => {
            if (designSettingsPanelRef.current?.contains(event.target)) return;
            setDesignSettingsCollapsed(true);
        };
        document.addEventListener('pointerdown', handleDesignSettingsOutsidePointer, true);
        return () => document.removeEventListener('pointerdown', handleDesignSettingsOutsidePointer, true);
    }, [designSettingsCollapsed, designSettingsOpen]);

    const closeDesignSettings = useCallback(() => {
        setDesignSettingsOpen(false);
        setDesignSettingsCollapsed(false);
    }, []);

    async function discardDesignDraftIfNeeded() {
        if (!ownerState?.session?.dirty) return ownerState;
        const confirmed = await requestConfirmation({
            title: t('mapStudioDiscardDraftTitle'),
            message: t('mapStudioDiscardDraftMessage'),
            tone: 'warning',
            confirmLabel: t('mapStudioDiscardAndContinue'),
            cancelLabel: t('cancel'),
        });
        return confirmed ? discardOwnerMapStudioDraft(ownerState) : null;
    }

    async function handleViewChange(event) {
        const nextViewId = event.target.value;
        if (!ownerState || nextViewId === ownerState.session.activeViewId) return;
        let current = ownerState;
        if (current.session.dirty) {
            const confirmed = await requestConfirmation({
                title: t('mapStudioSwitchViewTitle'),
                message: t('mapStudioSwitchViewMessage'),
                tone: 'warning',
                confirmLabel: t('mapStudioDiscardAndSwitch'),
                cancelLabel: t('cancel'),
            });
            if (!confirmed) return;
            current = discardOwnerMapStudioDraft(current);
        }
        setActionError('');
        setEditorMode(null);
        setOwnerState(selectOwnerMapStudioView(current, nextViewId));
    }

    function openCreateEditor() {
        setActionError('');
        setViewName('');
        setEditorMode('create');
    }

    function openRenameEditor() {
        if (!activeView) return;
        setActionError('');
        setViewName(activeView.name);
        setEditorMode('rename');
    }

    async function handleEditorSubmit(event) {
        event.preventDefault();
        if (!ownerState || !viewName.trim() || saving) return;
        const cleanState = await discardDesignDraftIfNeeded();
        if (!cleanState) return;
        try {
            if (editorMode === 'create') {
                viewSequenceRef.current += 1;
                const id = createUniqueMapStudioViewId(
                    cleanState.workingDocument,
                    createViewEntropy(viewSequenceRef.current),
                );
                setOwnerState(createOwnerMapStudioView(cleanState, { id, name: viewName }));
            } else if (editorMode === 'rename') {
                setOwnerState(renameOwnerMapStudioView(
                    cleanState,
                    cleanState.session.activeViewId,
                    viewName,
                ));
            }
            setEditorMode(null);
            setViewName('');
            setActionError('');
        } catch (error) {
            console.error('Failed to update Map Studio view:', error);
            setActionError(t('mapStudioActionFailed'));
        }
    }

    async function handleDuplicate() {
        if (!ownerState || !activeView) return;
        const cleanState = await discardDesignDraftIfNeeded();
        if (!cleanState) return;
        try {
            viewSequenceRef.current += 1;
            const id = createUniqueMapStudioViewId(
                cleanState.workingDocument,
                createViewEntropy(viewSequenceRef.current),
            );
            setOwnerState(duplicateOwnerMapStudioView(
                cleanState,
                cleanState.session.activeViewId,
                { id, name: t('mapStudioCopyName', { name: activeView.name }) },
            ));
            setEditorMode(null);
            setActionError('');
        } catch (error) {
            console.error('Failed to duplicate Map Studio view:', error);
            setActionError(t('mapStudioActionFailed'));
        }
    }

    async function handleSetDefault() {
        if (!ownerState || !activeView || isDefaultView) return;
        const cleanState = await discardDesignDraftIfNeeded();
        if (!cleanState) return;
        setOwnerState(setDefaultOwnerMapStudioView(cleanState, cleanState.session.activeViewId));
        setActionError('');
    }

    async function handleDelete() {
        if (!ownerState || !activeView || ownerState.workingDocument.views.length <= 1) return;
        const cleanState = await discardDesignDraftIfNeeded();
        if (!cleanState) return;
        const confirmed = await requestConfirmation({
            title: t('mapStudioDeleteViewTitle'),
            message: t('mapStudioDeleteViewMessage', { name: activeView.name }),
            tone: 'danger',
            confirmLabel: t('delete'),
            cancelLabel: t('cancel'),
        });
        if (!confirmed) return;
        try {
            setOwnerState(deleteOwnerMapStudioView(cleanState, cleanState.session.activeViewId));
            setEditorMode(null);
            setActionError('');
        } catch (error) {
            console.error('Failed to delete Map Studio view:', error);
            setActionError(t('mapStudioActionFailed'));
        }
    }

    async function handleDiscardAll() {
        if (!ownerState || !dirty) return;
        const confirmed = await requestConfirmation({
            title: t('mapStudioDiscardChangesTitle'),
            message: t('mapStudioDiscardChangesMessage'),
            tone: 'warning',
            confirmLabel: t('mapStudioDiscardChanges'),
            cancelLabel: t('cancel'),
        });
        if (!confirmed) return;
        setOwnerState(discardOwnerMapStudioChanges(ownerState));
        setEditorMode(null);
        setViewName('');
        setActionError('');
        setConflict(false);
    }

    async function handleSave() {
        if (!ownerState || !dirty || saving || editorMode) return;
        setSaving(true);
        setActionError('');
        setConflict(false);
        try {
            const prepared = prepareMapStudioOwnerSave(ownerState);
            const response = await api.updateMyMapStudio(mapId, prepared.payload);
            setOwnerState((current) => acknowledgeMapStudioOwnerSave(
                current || ownerState,
                response.document,
                {
                    ...prepared,
                    mode: current?.session?.mode ?? prepared.mode,
                    exploration: current?.session?.exploration ?? prepared.exploration,
                },
            ));
            setEditorMode(null);
        } catch (error) {
            console.error('Failed to save Map Studio views:', error);
            if (error?.status === 409) {
                setConflict(true);
                setActionError(t('mapStudioConflictMessage'));
            } else {
                setActionError(t('mapStudioSaveFailed'));
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleReloadLatest() {
        if (dirty) {
            const confirmed = await requestConfirmation({
                title: t('mapStudioReloadLatestTitle'),
                message: t('mapStudioReloadLatestMessage'),
                tone: 'warning',
                confirmLabel: t('mapStudioReloadLatest'),
                cancelLabel: t('cancel'),
            });
            if (!confirmed) return;
        }
        await loadStudio();
    }

    return (
        <>
            <section
                className={`relative rounded-[24px] border border-brand-100 bg-white px-4 py-4 shadow-sm sm:px-5 ${designSettingsOpen ? 'z-[1120]' : ''}`}
                aria-labelledby={`map-studio-title-${mapId}`}
                data-map-studio-owner-panel="true"
            >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                    <div className="flex min-w-0 items-center gap-3 xl:w-[220px] xl:flex-shrink-0">
                        <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                            <Layers3 size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 id={`map-studio-title-${mapId}`} className="text-base font-black text-slate-900">
                                {t('mapStudioTitle')}
                            </h2>
                            <p className="text-xs font-semibold text-slate-500">
                                {dirty ? t('mapStudioUnsavedChanges') : t('mapStudioNoUnsavedChanges')}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold text-slate-500">
                            <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                            {t('mapStudioLoading')}
                        </div>
                    ) : loadError || !ownerState ? (
                        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p role="alert" className="text-sm font-semibold text-red-700">{loadError}</p>
                            <button type="button" onClick={loadStudio} className="btn-ghost min-h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                <RefreshCw size={16} aria-hidden="true" />
                                {t('mapStudioRetry')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-end">
                            <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500" htmlFor={`map-studio-view-${mapId}`}>
                                {t('mapStudioView')}
                                <select
                                    id={`map-studio-view-${mapId}`}
                                    value={ownerState.session.activeViewId}
                                    onChange={handleViewChange}
                                    disabled={saving}
                                    className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                                >
                                    {ownerState.workingDocument.views.map((view) => (
                                        <option key={view.id} value={view.id}>
                                            {view.name}{view.id === ownerState.workingDocument.defaultViewId ? ` · ${t('mapStudioDefault')}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="flex flex-wrap gap-2" aria-label={t('mapStudioViewActions')}>
                                <button type="button" onClick={openCreateEditor} disabled={saving || ownerState.workingDocument.views.length >= MAP_STUDIO_MAX_VIEWS} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-3 text-xs text-slate-700 sm:flex-none sm:text-sm">
                                    <Plus size={16} aria-hidden="true" />
                                    {t('mapStudioNewView')}
                                </button>
                                <button type="button" onClick={handleDuplicate} disabled={saving || ownerState.workingDocument.views.length >= MAP_STUDIO_MAX_VIEWS} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-3 text-xs text-slate-700 sm:flex-none sm:text-sm">
                                    <Copy size={16} aria-hidden="true" />
                                    {t('mapStudioDuplicateView')}
                                </button>
                                <button type="button" onClick={openRenameEditor} disabled={saving} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-3 text-xs text-slate-700 sm:flex-none sm:text-sm">
                                    <Pencil size={16} aria-hidden="true" />
                                    {t('rename')}
                                </button>
                                <button type="button" onClick={handleSetDefault} disabled={saving || isDefaultView} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-3 text-xs text-slate-700 disabled:opacity-45 sm:flex-none sm:text-sm">
                                    <Star size={16} aria-hidden="true" />
                                    {t('mapStudioSetDefault')}
                                </button>
                                <button type="button" onClick={handleDelete} disabled={saving || ownerState.workingDocument.views.length <= 1} className="btn-ghost min-h-11 flex-1 justify-center border border-red-100 px-3 text-xs text-red-700 disabled:opacity-45 sm:flex-none sm:text-sm">
                                    <Trash2 size={16} aria-hidden="true" />
                                    {t('delete')}
                                </button>
                            </div>

                            <div className="flex gap-2 lg:ml-auto">
                                <button type="button" onClick={handleDiscardAll} disabled={!dirty || saving} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-3 text-xs text-slate-700 disabled:opacity-45 sm:text-sm lg:flex-none">
                                    <RotateCcw size={16} aria-hidden="true" />
                                    {t('mapStudioDiscardChanges')}
                                </button>
                                <button type="button" onClick={handleSave} disabled={!dirty || saving || Boolean(editorMode)} className="btn-primary min-h-11 flex-1 justify-center px-4 text-xs disabled:opacity-45 sm:text-sm lg:flex-none">
                                    {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                                    {saving ? t('saving') : t('mapStudioSaveChanges')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!loading && !loadError && ownerState
                    && ownerState.session.mode === MAP_STUDIO_MODE_DESIGN
                    && designSettingsOpen ? (
                    <div className="mt-4 border-t border-slate-100 pt-4 lg:mt-0 lg:border-0 lg:pt-0">
                        <div
                            ref={designSettingsPanelRef}
                            id={`map-studio-design-settings-${mapId}`}
                            role={designSettingsCollapsed ? 'region' : 'dialog'}
                            aria-label={t('editLayout')}
                            className={`w-full lg:absolute lg:top-[calc(100%+12px)] lg:z-20 lg:w-[420px] lg:max-w-[calc(100vw-2rem)] lg:rounded-2xl lg:bg-white lg:shadow-2xl ${
                                designSettingsCollapsed
                                    ? ''
                                    : 'lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:overscroll-contain'
                            } ${
                                designSettingsSide === MAP_STUDIO_LAYOUT_PANEL_SIDE_LEFT
                                    ? 'lg:left-4 lg:right-auto'
                                    : 'lg:right-4 lg:left-auto'
                            }`}
                            data-map-studio-design-settings-panel="true"
                            data-map-studio-design-settings-side={designSettingsSide}
                            data-map-studio-design-settings-state={designSettingsCollapsed ? 'collapsed' : 'expanded'}
                        >
                            {designSettingsCollapsed ? (
                                <div className="flex min-h-14 items-center gap-2 rounded-2xl border border-brand-200 bg-white p-2 shadow-lg">
                                    <button
                                        type="button"
                                        onClick={() => setDesignSettingsCollapsed(false)}
                                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left text-sm font-black text-slate-900 transition hover:bg-brand-50 focus:outline-none focus:ring-4 focus:ring-brand-100"
                                        aria-expanded="false"
                                        aria-controls={`map-studio-design-settings-${mapId}`}
                                    >
                                        <Layers3 size={18} className="shrink-0 text-brand-700" aria-hidden="true" />
                                        <span className="truncate">{t('editLayout')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeDesignSettings}
                                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-100"
                                        aria-label={t('mapStudioCloseDesignSettings')}
                                        title={t('mapStudioCloseDesignSettings')}
                                    >
                                        <X size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            ) : (
                                <MapStudioDesignControls
                                    design={ownerState.session.draftDesign}
                                    resourceLayerCatalog={resourceLayerCatalog}
                                    annotationLayerCatalog={annotationLayerCatalog}
                                    panelSide={designSettingsSide}
                                    onPanelSideChange={handleDesignSettingsSideChange}
                                    onPatch={handleDesignPatch}
                                    onClose={closeDesignSettings}
                                    disabled={saving || Boolean(editorMode)}
                                />
                            )}
                        </div>
                    </div>
                ) : null}

                {editorMode && ownerState ? (
                    <form onSubmit={handleEditorSubmit} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500" htmlFor={`map-studio-view-name-${mapId}`}>
                            {editorMode === 'create' ? t('mapStudioNewViewName') : t('mapStudioRenameView')}
                            <input
                                id={`map-studio-view-name-${mapId}`}
                                type="text"
                                value={viewName}
                                onChange={(event) => setViewName(event.target.value)}
                                disabled={saving}
                                maxLength={MAP_STUDIO_MAX_VIEW_NAME_LENGTH}
                                autoFocus
                                required
                                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            />
                        </label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setEditorMode(null)} disabled={saving} className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:opacity-45 sm:flex-none">
                                {t('cancel')}
                            </button>
                            <button type="submit" disabled={!viewName.trim() || saving} className="btn-primary min-h-11 flex-1 justify-center px-4 text-sm disabled:opacity-45 sm:flex-none">
                                {editorMode === 'create' ? t('mapStudioCreateView') : t('rename')}
                            </button>
                        </div>
                    </form>
                ) : null}

                {actionError ? (
                    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                            <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            {actionError}
                        </p>
                        {conflict ? (
                            <button type="button" onClick={handleReloadLatest} className="btn-ghost min-h-10 justify-center border border-amber-300 bg-white px-3 text-xs text-amber-900">
                                <RefreshCw size={15} aria-hidden="true" />
                                {t('mapStudioReloadLatest')}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </section>
            {confirmDialog}
        </>
    );
});

export default MapStudioViewsPanel;
