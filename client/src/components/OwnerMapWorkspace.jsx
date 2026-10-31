import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlignLeft, ArrowLeft, CheckCircle2, Clock3, ChevronLeft, ChevronRight, Download, EyeOff, Layers3, List, ListOrdered, LoaderCircle, MapPin, MoreHorizontal, Pencil, PenLine, Plus, Printer, Share2, SlidersHorizontal, StickyNote, Trash2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import DirectorySearchBar from './DirectorySearchBar.jsx';
import DirectoryDistanceControls from './DirectoryDistanceControls.jsx';
import { getOwnerWorkspaceCapacity } from '../lib/ownerMapWorkspace.js';
import './OwnerMapWorkspace.css';

const tools = [
    ['resources', List, 'mapWorkspaceResources'], ['studio', Layers3, 'mapStudioTitle'],
    ['edit', PenLine, 'editContent'], ['notes', StickyNote, 'mapNotes'],
    ['share', Share2, 'share'], ['export', Download, 'mapWorkspaceExport'], ['more', MoreHorizontal, 'mapWorkspaceMore'],
];

export default function OwnerMapWorkspace({ map, resources, configuration: config, onOpenNotes, notesOpen, notesAvailable, top = null }) {
    const { t } = useLocale();
    const workspaceRef = useRef(null);
    const inspectorRef = useRef(null);
    const resourcesHostRef = useRef(null);
    const contextRef = useRef(null);
    const [panelTop, setPanelTop] = useState(164);
    const resourcesTriggerRef = useRef(null);
    const lastTriggerRef = useRef(null);
    const pendingStudioEntryRef = useRef(false);
    const [resourcesOpen, setResourcesOpen] = useState(true);
    const [panel, setPanel] = useState(null);
    const [requestedColumns, setRequestedColumns] = useState(1);
    const [capacity, setCapacity] = useState({ compact: true, split: false, columns: 1 });
    const activeOperation = config.annotationEditing || config.personalPlacePickerActive;
    const visiblePanel = activeOperation ? 'edit' : panel;
    const inspectorOpen = Boolean(visiblePanel);
    const effectiveResourcesOpen = resourcesOpen && (capacity.split || !inspectorOpen);
    const columns = Math.min(requestedColumns, capacity.columns);
    const studioState = config.studioState || { loading: true };
    const statusText = studioState.loading ? t('mapStudioLoading') : studioState.loadError ? t('mapStudioLoadFailed')
        : studioState.saving ? t('mapStudioAutosaveSaving') : studioState.status === 'error' ? t('mapStudioAutosaveFailed')
            : studioState.dirty ? t('mapStudioAutosavePending') : t('mapStudioAllChangesSaved');

    const saveState = studioState.loading ? 'loading' : studioState.loadError ? 'error'
        : studioState.saving ? 'saving' : studioState.status === 'error' ? 'error' : studioState.dirty ? 'pending' : 'saved';
    const SaveIcon = saveState === 'error' ? AlertTriangle : ['saving', 'loading'].includes(saveState) ? LoaderCircle
        : saveState === 'pending' ? Clock3 : CheckCircle2;
    const studioStatusLabel = `${t('mapStudioTitle')}: ${statusText}`;

    useLayoutEffect(() => {
        const measure = () => {
            setCapacity(getOwnerWorkspaceCapacity({ width: window.innerWidth, height: window.innerHeight,
                fontSize: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, inspectorOpen }));
            const context = contextRef.current?.getBoundingClientRect();
            const workspace = workspaceRef.current?.getBoundingClientRect();
            if (context && workspace) setPanelTop(Math.ceil(context.bottom - workspace.top + 12));
        };
        measure();
        const resize = new ResizeObserver(measure);
        resize.observe(document.documentElement);
        if (contextRef.current) resize.observe(contextRef.current);
        const mutation = new MutationObserver(measure);
        mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
        window.addEventListener('resize', measure);
        return () => { resize.disconnect(); mutation.disconnect(); window.removeEventListener('resize', measure); };
    }, [inspectorOpen]);

    useLayoutEffect(() => {
        if (!effectiveResourcesOpen && resourcesHostRef.current?.contains(document.activeElement)) {
            if (inspectorOpen) inspectorRef.current?.focus({ preventScroll: true });
            else resourcesTriggerRef.current?.focus({ preventScroll: true });
        }
    }, [effectiveResourcesOpen, inspectorOpen]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const restored = [];
        document.body.style.overflow = 'hidden';
        let node = workspaceRef.current;
        while (node?.parentElement && node.parentElement.tagName !== 'BODY') {
            const parent = node.parentElement;
            for (const sibling of parent.children) {
                if (sibling === node || !(sibling instanceof HTMLElement) || sibling.matches('header, nav')) continue;
                restored.push([sibling, sibling.inert]); sibling.inert = true;
            }
            if (parent.tagName === 'MAIN') break;
            node = parent;
        }
        return () => { document.body.style.overflow = previousOverflow; restored.forEach(([el, inert]) => { el.inert = inert; }); };
    }, []);

    const closeInspector = () => {
        if (activeOperation) return;
        setPanel(null);
        lastTriggerRef.current?.focus({ preventScroll: true });
    };
    useEffect(() => {
        const handleKey = event => {
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            const foreground = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(el =>
                !el.closest('[inert], [hidden], details:not([open])') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
            if (foreground || activeOperation || notesOpen) return;
            const viewActions = workspaceRef.current?.querySelector('[data-owner-workspace-view-actions][open]');
            if (viewActions && !viewActions.closest('[hidden], [inert]')) {
                event.preventDefault(); viewActions.open = false; viewActions.querySelector('summary')?.focus(); return;
            }
            if (inspectorOpen) { event.preventDefault(); closeInspector(); }
            else if (resourcesOpen) { event.preventDefault(); setResourcesOpen(false); lastTriggerRef.current?.focus({ preventScroll: true }); }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [activeOperation, inspectorOpen, notesOpen, resourcesOpen]);

    useEffect(() => {
        const closeViewActions = event => {
            const disclosure = workspaceRef.current?.querySelector('[data-owner-workspace-view-actions][open]');
            if (disclosure && !disclosure.contains(event.target)) disclosure.open = false;
        };
        document.addEventListener('pointerdown', closeViewActions);
        return () => document.removeEventListener('pointerdown', closeViewActions);
    }, []);

    const enterStudio = () => {
        pendingStudioEntryRef.current = Boolean(config.editLayoutDisabled);
        if (!config.editLayoutDisabled) config.onOpenStudio();
    };
    useEffect(() => {
        if (visiblePanel === 'studio' && pendingStudioEntryRef.current && !config.editLayoutDisabled) {
            pendingStudioEntryRef.current = false;
            config.onOpenStudio();
        }
    }, [config.editLayoutDisabled, config.onOpenStudio, visiblePanel]);

    const openTool = (name, event) => {
        lastTriggerRef.current = event.currentTarget;
        if (name === 'resources') {
            if (!capacity.split && inspectorOpen) setPanel(null);
            setResourcesOpen(!effectiveResourcesOpen);
        } else if (name === 'notes') onOpenNotes();
        else if (name === 'share') config.onOpenShare();
        else {
            setPanel(name === panel ? null : name);
            if (name === 'studio' && name !== panel) enterStudio();
        }
    };
    const command = (label, onClick, Icon, { disabled = false, active = false, danger = false, marker = null } = {}) => (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active || undefined}
            className={`owner-workspace-command ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`} data-owner-workspace-command={marker}>
            <Icon size={18} aria-hidden="true" /><span>{label}</span>
        </button>
    );
    const rightTitle = visiblePanel === 'studio' ? t('mapStudioTitle') : visiblePanel === 'edit' ? t('editContent')
        : visiblePanel === 'export' ? t('mapWorkspaceExport') : t('mapWorkspaceMore');

    return <section ref={workspaceRef} data-owner-workspace="split" data-map-first="care-map"
        data-owner-workspace-split={capacity.split} data-owner-workspace-compact={capacity.compact}
        data-map-first-columns={columns} data-map-first-column-capacity={capacity.columns}
        data-map-first-resources-open={effectiveResourcesOpen} aria-label={t('map')}
        className="owner-map-workspace" style={{ ...(top === null ? {} : { top }), '--map-first-resource-columns': columns,
            '--owner-workspace-panel-top': `${panelTop}px`,
            '--owner-workspace-resource-width': `calc(${columns * 21}rem + ${(columns - 1) * 16}px)`,
            '--map-first-panel-clearance': capacity.compact && (inspectorOpen || effectiveResourcesOpen) ? 'calc(42svh + 72px)' : '12px' }}>
        <div className="owner-workspace-map" data-map-first-map="true">{map}</div>
        <nav className="owner-workspace-rail" aria-label={t('mapOptions')}>
            {tools.map(([name, Icon, label]) => <button key={name} ref={name === 'resources' ? resourcesTriggerRef : undefined} type="button" data-owner-workspace-tool={name}
                onClick={event => openTool(name, event)} disabled={(activeOperation && name !== 'edit') || (name === 'notes' && !notesAvailable)}
                aria-label={t(label)}
                aria-expanded={['resources', 'studio', 'edit', 'export', 'more'].includes(name) ? name === 'resources' ? effectiveResourcesOpen : visiblePanel === name : undefined}
                aria-pressed={name === 'resources' ? effectiveResourcesOpen : visiblePanel === name
                    || (name === 'edit' && (config.pinVisibilityMode || config.shortDescriptionMode || config.resourceRemovalMode))
                    || (name === 'notes' && notesOpen)}>
                <Icon size={20} aria-hidden="true" /><span className={name === 'resources' ? 'owner-workspace-resources-label' : undefined}>{t(label)}</span>{name === 'resources' ? <span className="owner-workspace-list-label">{t('mapWorkspaceList')}</span> : null}
            </button>)}
        </nav>
        <div ref={contextRef} className="owner-workspace-context">
            <div className="owner-workspace-identity" data-owner-workspace-header="true">
                <h1 className="owner-workspace-title" data-owner-workspace-map-name="true" title={config.directory.name}>{config.directory.name}</h1>
                <select id={`owner-workspace-view-${config.directory.id}`} data-owner-workspace-view-select="true"
                    className="owner-workspace-view-select" aria-label={t('mapStudioView')}
                    value={studioState.activeViewId || ''}
                    disabled={activeOperation || studioState.loading || studioState.saving || !studioState.viewOptions?.length}
                    onChange={event => config.onSelectView(event.target.value)}>
                    {!studioState.viewOptions?.length ? <option value="">{t('mapStudioLoading')}</option> : null}
                    {(studioState.viewOptions || []).map(view => <option key={view.id} value={view.id}>
                        {view.name}{view.isDefault ? ` · ${t('mapStudioDefault')}` : ''}
                    </option>)}
                </select>
                <span className="owner-workspace-mode" data-owner-workspace-mode={studioState.mode || 'loading'}>
                    {studioState.mode ? t(studioState.mode === 'design' ? 'mapWorkspaceDesign' : 'mapWorkspaceExplore') : ''}
                </span>
                <button type="button" className="owner-workspace-save-indicator" data-owner-workspace-status="true"
                    data-save-status={saveState} disabled={activeOperation}
                    aria-label={`${studioStatusLabel}. ${t('mapWorkspaceReviewSave')}`} title={studioStatusLabel}
                    onClick={event => { lastTriggerRef.current = event.currentTarget; pendingStudioEntryRef.current = false; setPanel('studio'); }}>
                    <SaveIcon size={17} aria-hidden="true" className={['saving', 'loading'].includes(saveState) ? 'animate-spin motion-reduce:animate-none' : undefined} />
                    {saveState === 'error' ? <span className="owner-workspace-save-issue">{t('mapWorkspaceSaveIssue')}</span> : null}
                    <span className="sr-only" role="status" aria-live="polite">{studioStatusLabel}</span>
                </button>
            </div>
            <div className="owner-workspace-search" data-owner-workspace-search="true">
                <DirectorySearchBar value={config.query} onChange={config.onQueryChange} inputId="owner-workspace-search" placeholder={t('searchThisMap')} compact />
                <button type="button" onClick={event => { lastTriggerRef.current = event.currentTarget; setPanel('studio'); enterStudio(); }}
                    disabled={activeOperation} aria-label={t('mapWorkspaceDisplayOptions')} aria-expanded={visiblePanel === 'studio'}><SlidersHorizontal size={19} aria-hidden="true" /></button>
            </div>
        </div>
        <div ref={resourcesHostRef} className="owner-workspace-resources-host" hidden={!effectiveResourcesOpen}>
            <section className="owner-workspace-panel owner-workspace-resources" data-owner-workspace-resources="true" data-map-first-resources="true"
                aria-label={t('resources')} hidden={!effectiveResourcesOpen} inert={!effectiveResourcesOpen ? '' : undefined}>
                <header><h2>{t('mapWorkspaceResources')}</h2><button type="button" aria-label={t('close')} onClick={() => { setResourcesOpen(false); resourcesTriggerRef.current?.focus({ preventScroll: true }); }}><X size={18} aria-hidden="true" /></button></header>
                <div className="owner-workspace-scroll">
                    <div className="owner-workspace-add-actions">
                        {command(t('manageResources'), config.onAddAssets, Plus, { disabled: activeOperation })}
                        {command(t('personalPlace'), config.onAddPersonalPlace, MapPin, { disabled: activeOperation })}
                    </div>
                    {resources}
                </div>
            </section>
            <div className="owner-workspace-column-actions" aria-label={t('mapWorkspaceResourceWidth')}>
                <button type="button" data-map-first-columns-shrink="true" disabled={columns === 1} aria-label={`${t('mapWorkspaceResourceWidth')}: ${Math.max(1, columns - 1)}`} onClick={() => setRequestedColumns(Math.max(1, columns - 1))}><ChevronLeft size={18} aria-hidden="true" /></button>
                <button type="button" data-map-first-columns-expand="true" disabled={columns === capacity.columns} aria-label={`${t('mapWorkspaceResourceWidth')}: ${Math.min(capacity.columns, columns + 1)}`} onClick={() => setRequestedColumns(Math.min(capacity.columns, columns + 1))}><ChevronRight size={18} aria-hidden="true" /></button>
            </div>
        </div>
        <section ref={inspectorRef} tabIndex={-1} className="owner-workspace-panel owner-workspace-inspector" hidden={!inspectorOpen} inert={!inspectorOpen ? '' : undefined} aria-label={rightTitle}>
            <header><h2>{rightTitle}</h2><button type="button" aria-label={t('close')} disabled={activeOperation} onClick={closeInspector}><X size={18} aria-hidden="true" /></button></header>
            <div className="owner-workspace-scroll">
                <div data-owner-workspace-panel="studio" hidden={visiblePanel !== 'studio'} inert={visiblePanel !== 'studio' ? '' : undefined}>
                    {config.studioPanel}
                    <div className="owner-workspace-footer">{command(t('mapWorkspaceExplore'), config.onExplore, MapPin, { disabled: studioState.saving || !studioState.mode || studioState.mode === 'explore' })}
                        {command(t('print'), config.onOpenPrintView, Printer, { disabled: activeOperation })}</div>
                </div>
                <div data-owner-workspace-panel="edit" hidden={visiblePanel !== 'edit'} inert={visiblePanel !== 'edit' ? '' : undefined}>
                    {config.annotationEditing ? config.annotationControls : <div className="owner-workspace-command-list">
                        {config.personalPlacePickerActive ? <><p className="owner-workspace-help">{t('personalPlaceMapHint')}</p>{command(t('cancelAddPersonalPlace'), config.onAddPersonalPlace, X, { active: true })}</> : <>
                        {command(t('arrangeCategories'), config.onArrangeCategories, ListOrdered, { disabled: config.categoryCount < 1 })}
                        {command(t('hideMapPins'), config.onTogglePinVisibility, EyeOff, { active: config.pinVisibilityMode, marker: 'pin-visibility' })}
                        {command(t('addShortDescription'), config.onToggleShortDescription, AlignLeft, { active: config.shortDescriptionMode })}
                        {command(t('mapStudioAnnotate'), config.onToggleAnnotations, PenLine, { disabled: !config.canEditAnnotations || !config.annotationsReady })}
                        {command(t('removeResources'), config.onToggleResourceRemoval, Trash2, { active: config.resourceRemovalMode, danger: true, marker: 'remove-resources' })}
                        </>}
                    </div>}
                </div>
                <div data-owner-workspace-panel="export" hidden={visiblePanel !== 'export'} inert={visiblePanel !== 'export' ? '' : undefined}>
                    <p className="owner-workspace-help">{t('mapWorkspaceExportHelp')}</p>
                    <div className="owner-workspace-command-list">{command(t('print'), config.onOpenPrintView, Printer)}{config.renderPdfExportButton?.('owner-workspace-command')}</div>
                </div>
                <div data-owner-workspace-panel="more" hidden={visiblePanel !== 'more'} inert={visiblePanel !== 'more' ? '' : undefined}>
                    <div className="owner-workspace-command-list">
                        <Link to="/my-directory?section=my-maps" className="owner-workspace-command"><ArrowLeft size={18} aria-hidden="true" />{t('backToMyMaps')}</Link>
                        {command(t('editMapDetails'), config.onEditDetails, Pencil)}
                        {command(t('share'), config.onOpenShare, Share2)}
                        {command(t('mapWorkspaceExport'), () => setPanel('export'), Download)}
                        {command(t('manageResources'), config.onAddAssets, Plus)}
                        {command(t('personalPlace'), config.onAddPersonalPlace, MapPin)}
                    </div>
                    <DirectoryDistanceControls anchorState={config.anchorState} compact compactLayout="stacked" className="min-w-0" />
                    <div className="owner-workspace-footer">{command(t('mapWorkspaceCurrentLayout'), config.onCurrentLayout, ArrowLeft, { disabled: notesOpen || activeOperation || studioState.saving })}</div>
                </div>
            </div>
        </section>
        {config.actionError ? <p role="alert" className="owner-workspace-error">{config.actionError}</p> : null}
        {activeOperation ? <p className="owner-workspace-operation" role="status">{t('mapWorkspaceActiveToolHelp')}</p> : null}
    </section>;
}
