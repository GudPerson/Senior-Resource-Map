import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle, CheckCircle2, Clock3, Download, Layers3,
    List, LoaderCircle, Maximize2, Minimize2, Pencil, Plus, Share2, X,
} from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { OwnerMapEditingCanvasContext } from '../contexts/OwnerMapEditingCanvasContext.jsx';
import useOwnerMapCanvasPresentation from '../hooks/useOwnerMapCanvasPresentation.js';
import useOwnerCanvasToolMenu from '../hooks/useOwnerCanvasToolMenu.js';
import { getOwnerMapCanvasMessages } from '../lib/ownerMapCanvasMessages.js';
import { resolveOwnerMapCanvasSaveState } from '../lib/ownerMapCanvasState.js';
import OwnerCanvasToolMenu from './OwnerCanvasToolMenu.jsx';
import './OwnerMapEditingCanvas.css';

// One owner page, one map and the original mounted editors. This component owns
// temporary chrome only; saved layouts and camera state remain with the page.
export default function OwnerMapEditingCanvas({ active, onActiveChange, configuration: config, children }) {
    const { t, locale } = useLocale();
    const messages = getOwnerMapCanvasMessages(locale);
    const rootRef = useRef(null);
    const chromeRef = useRef(null);
    const headerRef = useRef(null);
    const returnButtonRef = useRef(null);
    const entryStateRef = useRef(null);
    const lastTriggerRef = useRef(null);
    const configRef = useRef(config);
    configRef.current = config;
    const [panel, setPanel] = useState(null);
    const [notice, setNotice] = useState('');

    const closePanel = useCallback(() => {
        const current = configRef.current;
        if (current.hasUnfinishedDraft) {
            current.onCancelAnnotationDraft?.();
            return;
        }
        if (current.annotationEditing) current.onCancelAnnotationDraft?.();
        setPanel(null);
        lastTriggerRef.current?.focus({ preventScroll: true });
    }, []);
    const exit = useCallback(() => {
        setPanel(null);
        onActiveChange(false);
    }, [onActiveChange]);
    const handleEscape = useCallback(() => {
        if (configRef.current.hasUnfinishedDraft) {
            configRef.current.onCancelAnnotationDraft?.();
        } else if (configRef.current.hasTemporaryMeasurement) {
            configRef.current.onClearTemporaryMeasurement?.();
        } else if (panel) closePanel();
        else exit();
    }, [closePanel, exit, panel]);
    const { mapAvailable, foregroundOpen } = useOwnerMapCanvasPresentation({
        rootRef, chromeRef, entryStateRef, active, panel, onEscape: handleEscape,
    });
    const { menu, menuRef, closeMenu } = useOwnerCanvasToolMenu({
        active, rootRef, scopeKey: `${config.directory?.id || ''}:${config.studioState?.activeViewId || ''}`,
        bearing: config.bearing,
    });
    const context = useMemo(() => ({ active, panel, closePanel, messages }), [active, closePanel, messages, panel]);

    useEffect(() => {
        if (active && panel === 'annotations' && !config.annotationEditing) setPanel(null);
    }, [active, config.annotationEditing, panel]);
    useEffect(() => { if (!active) setNotice(''); }, [active]);
    useLayoutEffect(() => {
        if (active) returnButtonRef.current?.focus({ preventScroll: true });
    }, [active]);
    useLayoutEffect(() => {
        if (!active || !headerRef.current) return undefined;
        const measure = () => rootRef.current?.style.setProperty(
            '--owner-canvas-panel-top', `${Math.ceil(headerRef.current.getBoundingClientRect().bottom + 14)}px`,
        );
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(headerRef.current);
        window.addEventListener('resize', measure);
        return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
    }, [active]);

    const openTool = (name, event) => {
        lastTriggerRef.current = event?.currentTarget || lastTriggerRef.current;
        const keepsCurrentDraft = name === 'draw';
        if (config.hasUnfinishedDraft && !keepsCurrentDraft) {
            setNotice(messages.finishDraft);
            return;
        }
        setNotice('');
        if (name === 'share') { config.onOpenShare?.(); return; }
        const target = name === 'draw' ? 'annotations' : name;
        if (config.annotationEditing && target !== 'annotations') config.onCancelAnnotationDraft?.();
        if (target === panel && name !== 'draw') { closePanel(); return; }
        if (target === 'annotations') {
            if (!config.annotationEditing) config.onToggleAnnotations?.();
        }
        if (target === 'studio') config.onOpenStudio?.();
        setPanel(target);
    };
    const start = (event) => {
        if (!mapAvailable || config.canvasAvailable === false) return;
        entryStateRef.current = {
            focus: event?.currentTarget || document.activeElement,
            scroll: { top: window.scrollY, left: window.scrollX },
            path: window.location.pathname,
        };
        setPanel(config.annotationEditing ? 'annotations' : null);
        onActiveChange(true);
    };
    const saves = resolveOwnerMapCanvasSaveState(config.studioState, config.annotationStatus, config.annotationError);
    const statusLabel = `${t('mapStudioTitle')}: ${messages[saves.studio]}; ${messages.annotations}: ${messages[saves.annotations]}`;
    const SaveIcon = saves.combined === 'failed' ? AlertTriangle
        : ['loading', 'saving'].includes(saves.combined) ? LoaderCircle
            : saves.combined === 'pending' ? Clock3 : CheckCircle2;
    const statusError = config.studioState?.loadError || config.studioState?.actionError
        || config.annotationError || config.actionError || '';
    const activeViewName = config.studioState?.activeViewName || messages.loading;
    const tools = [
        ['content', messages.content, List],
        ['draw', messages.drawMeasure, Pencil, !config.canEditAnnotations || !config.annotationsReady],
        ['studio', t('mapStudioTitle'), Layers3, config.editLayoutDisabled],
        ['resources', messages.resources, List],
        ['export', messages.export, Download],
    ];
    const toolDisabled = (name, disabled = false) => disabled || (config.hasUnfinishedDraft
        && name !== 'draw');
    const menuItems = [...tools, ['share', t('share'), Share2]].map(([name, text, Icon, disabled]) => ({
        name, text, Icon, disabled: toolDisabled(name, disabled),
        guidance: config.hasUnfinishedDraft && toolDisabled(name, disabled) ? messages.finishDraft : '',
    }));
    const chooseMenuTool = (name) => {
        const trigger = chromeRef.current?.querySelector(`[data-owner-canvas-tool="${name}"]`);
        closeMenu(false);
        trigger?.focus({ preventScroll: true });
        openTool(name, { currentTarget: trigger });
    };
    const command = (label, action, Icon, disabled = false) => (
        <button type="button" className="owner-canvas-command" disabled={disabled}
            onClick={() => { if (!config.hasUnfinishedDraft) action?.(); }}>
            <Icon size={18} aria-hidden="true" /><span>{label}</span>
        </button>
    );

    return (
        <OwnerMapEditingCanvasContext.Provider value={context}>
            <div ref={rootRef} className="owner-editing-canvas" data-owner-editing-canvas="true"
                data-owner-canvas-active={active} data-owner-canvas-panel={panel || 'none'}
                data-owner-canvas-modal={foregroundOpen}>
                <div data-owner-canvas-page="true">{children}</div>
                <div ref={chromeRef} data-owner-canvas-chrome="true" data-care-map-gesture-ui="true">
                    <button type="button" className="owner-canvas-launch" hidden={active || !mapAvailable || config.canvasAvailable === false}
                        data-owner-canvas-enter="true" onClick={start}>
                        <Maximize2 size={17} aria-hidden="true" />{messages.expand}
                    </button>
                    {active ? <>
                        <div ref={headerRef} className="owner-canvas-header">
                            <button type="button" className="owner-canvas-identity" data-owner-canvas-context="true"
                                aria-label={`${config.directory?.name || ''}; ${messages.view}: ${activeViewName}; ${t('mapStudioTitle')}`}
                                disabled={toolDisabled('studio', config.editLayoutDisabled)}
                                title={`${config.directory?.name || ''} · ${activeViewName}`}
                                onClick={event => openTool('studio', event)}>
                                <span className="owner-canvas-map-name">{config.directory?.name}</span>
                                <span className="owner-canvas-view-name">{activeViewName}</span>
                            </button>
                            <button type="button" className={`owner-canvas-save owner-canvas-save--${saves.combined}`}
                                aria-label={statusLabel} title={statusLabel} data-owner-canvas-save={saves.combined}
                                onClick={event => openTool(saves.annotations === 'failed' ? 'draw' : 'studio', event)}>
                                <SaveIcon size={18} aria-hidden="true" />
                            </button>
                            {config.hasUnfinishedDraft ? <p className="owner-canvas-draft-note" role="status"
                                id="owner-canvas-draft-guidance">{messages.finishDraft}</p> : null}
                        </div>
                        <button ref={returnButtonRef} type="button" className="owner-canvas-exit" data-owner-canvas-exit="true" onClick={exit}>
                            <Minimize2 size={17} aria-hidden="true" /><span>{messages.exit}</span>
                        </button>
                        <nav className="owner-canvas-rail" aria-label={messages.tools}>
                            {tools.map(([name, label, Icon, disabled]) => {
                                const selected = name === 'draw' ? panel === 'annotations' : panel === name;
                                const keepsCurrentDraft = name === 'draw';
                                return <button type="button" key={name} data-owner-canvas-tool={name}
                                    aria-expanded={selected} disabled={toolDisabled(name, disabled)}
                                    title={config.hasUnfinishedDraft && !keepsCurrentDraft ? messages.finishDraft : undefined}
                                    aria-describedby={config.hasUnfinishedDraft && !keepsCurrentDraft ? 'owner-canvas-draft-guidance' : undefined}
                                    onClick={event => openTool(name, event)}>
                                    <Icon size={21} aria-hidden="true" /><span>{label}</span>
                                </button>;
                            })}
                            <button type="button" data-owner-canvas-tool="share" onClick={event => openTool('share', event)}
                                disabled={config.hasUnfinishedDraft}>
                                <Share2 size={20} aria-hidden="true" /><span>{t('share')}</span>
                            </button>
                        </nav>
                        {['content', 'export'].includes(panel) ? (
                            <aside className="owner-canvas-inspector" aria-label={messages[panel]} data-owner-canvas-inspector={panel}>
                                <div className="owner-canvas-panel-heading"><h2>{messages[panel]}</h2>
                                    <button type="button" aria-label={messages.closePanel} onClick={closePanel}><X size={18} /></button>
                                </div>
                                <div className="owner-canvas-panel-body">
                                    {panel === 'content' ? <>
                                        {command(t('personalPlace'), config.onAddPersonalPlace, Plus)}
                                        {command(t('manageResources'), config.onAddAssets, Plus)}
                                        {command(t('editMapDetails'), config.onEditDetails, Pencil)}
                                        {command(t('arrangeCategories'), config.onArrangeCategories, List, config.categoryCount < 1)}
                                        {command(t('addShortDescription'), config.onToggleShortDescription, Pencil)}
                                        {command(t('hideMapPins'), config.onTogglePinVisibility, Layers3)}
                                        {command(t('removeResources'), config.onToggleResourceRemoval, List)}
                                    </> : <>
                                        {command(t('print'), () => { onActiveChange(false); config.onOpenPrintView?.(); }, Download)}
                                        {config.renderPdfExportButton?.('owner-canvas-command')}
                                        {command(t('share'), config.onOpenShare, Share2)}
                                    </>}
                                </div>
                            </aside>
                        ) : null}
                        {(notice || statusError) ? <p className="owner-canvas-alert" role="alert">{notice || statusError}</p> : null}
                        {menu ? <OwnerCanvasToolMenu menu={menu} menuRef={menuRef} label={messages.tools}
                            items={menuItems} onChoose={chooseMenuTool} onDismiss={closeMenu} /> : null}
                    </> : null}
                </div>
            </div>
        </OwnerMapEditingCanvasContext.Provider>
    );
}
