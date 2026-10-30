import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, List, Minimize2, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import './MapFirstWorkspace.css';

// A page presentation only: neither the map camera nor a saved layout lives here.
export default function MapFirstWorkspace({
    kind,
    map,
    resources,
    resourcesOpen,
    onResourcesOpenChange,
    onExit,
    toolbar = null,
    top = null,
    exitLabel = null,
}) {
    const { t } = useLocale();
    const workspaceRef = useRef(null);
    const panelRef = useRef(null);
    const drawerRef = useRef(null);
    const resourcesButtonRef = useRef(null);
    const [panelClearance, setPanelClearance] = useState(12);
    const [requestedColumns, setRequestedColumns] = useState(1);
    const [columnCapacity, setColumnCapacity] = useState(1);
    const columns = Math.min(requestedColumns, columnCapacity);

    useLayoutEffect(() => {
        const measureCapacity = () => {
            const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
            const available = window.innerWidth - 104; // Keep the right map-control column exposed.
            const phone = window.innerWidth < 640 || (window.innerHeight < 500 && window.innerWidth < 1024);
            setColumnCapacity(phone ? 1 : Math.max(1, Math.min(3, Math.floor((available - 40 + 16) / (17.5 * fontSize + 16)))));
        };
        measureCapacity();
        const observer = new ResizeObserver(measureCapacity);
        observer.observe(document.documentElement);
        // Text-size changes update a root style/class without resizing the viewport.
        const mutations = new MutationObserver(measureCapacity);
        mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
        window.addEventListener('resize', measureCapacity);
        return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener('resize', measureCapacity); };
    }, []);

    useLayoutEffect(() => {
        const measure = () => {
            const compactLandscape = window.innerHeight < 500 && window.innerWidth > window.innerHeight;
            const raised = resourcesOpen && window.innerWidth < 640 && !compactLandscape;
            setPanelClearance(raised ? Math.ceil(panelRef.current?.getBoundingClientRect().height || 0) + 56 : 12);
        };
        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        if (panelRef.current) observer?.observe(panelRef.current);
        window.addEventListener('resize', measure);
        return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
    }, [resourcesOpen]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const previousFocus = document.activeElement;
        const path = window.location.pathname;
        const restored = [];
        document.body.style.overflow = 'hidden';
        // Keep navigation and the existing owner menu available, but remove
        // covered page controls from the keyboard/accessibility tree.
        let node = workspaceRef.current;
        while (node?.parentElement && node.parentElement.tagName !== 'BODY') {
            const parent = node.parentElement;
            for (const sibling of parent.children) {
                if (sibling === node || !(sibling instanceof HTMLElement)
                    || sibling.matches('header, nav, [data-owner-map-mobile-header="true"]')
                    || sibling.querySelector('[data-owner-map-mobile-header="true"]')) continue;
                restored.push([sibling, sibling.inert]);
                sibling.inert = true;
            }
            if (parent.tagName === 'MAIN') break;
            node = parent;
        }
        return () => {
            document.body.style.overflow = previousOverflow;
            restored.forEach(([element, inert]) => { element.inert = inert; });
            if (window.location.pathname === path && previousFocus instanceof HTMLElement
                && previousFocus.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
        };
    }, []);

    useEffect(() => {
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape' || event.defaultPrevented
                || event.target?.closest?.('input, textarea, [contenteditable="true"], [role="dialog"]')) return;
            // A dialog can open before focus moves into it. Its existing Escape
            // handler owns that key even when focus is still on the opener.
            const modalOpen = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some((dialog) => (
                dialog.getAttribute('aria-hidden') !== 'true' && !dialog.closest('[inert], details:not([open])')
                && window.getComputedStyle(dialog).visibility !== 'hidden' && dialog.getClientRects().length > 0
            ));
            if (modalOpen) return;
            if (resourcesOpen) onResourcesOpenChange(false);
            else onExit();
        };
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [onExit, onResourcesOpenChange, resourcesOpen]);

    useLayoutEffect(() => {
        if (!resourcesOpen && drawerRef.current?.contains(document.activeElement)) {
            resourcesButtonRef.current?.focus({ preventScroll: true });
        }
    }, [resourcesOpen]);

    return (
        <section
            ref={workspaceRef}
            data-map-first={kind}
            data-map-first-resources-open={resourcesOpen}
            data-map-first-columns={columns}
            data-map-first-column-capacity={columnCapacity}
            aria-label={t('map')}
            className="fixed inset-x-0 bottom-0 top-[56px] z-[1140] isolate bg-slate-100 sm:top-[64px]"
            style={{ ...(top === null ? {} : { top }), marginTop: 0, marginBottom: 0, '--map-first-panel-clearance': `${panelClearance}px`, '--map-first-resource-columns': columns, '--map-first-resource-width': columns === 1 ? '440px' : `calc(${columns * 17.5}rem + ${40 + (columns - 1) * 16}px)` }}
        >
            <div className="absolute inset-0" data-map-first-map="true">{map}</div>
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[1004] flex items-start gap-2 pr-12 sm:left-4 sm:right-4">
                <button
                    ref={resourcesButtonRef}
                    type="button"
                    data-map-first-resources-toggle="true"
                    aria-label={t('resources')}
                    aria-expanded={resourcesOpen}
                    onClick={() => onResourcesOpenChange(!resourcesOpen)}
                    className="pointer-events-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-brand-700 shadow-md"
                >
                    <List size={18} aria-hidden="true" /><span className="hidden capitalize sm:inline">{t('resources')}</span>
                </button>
                {toolbar ? <div className="pointer-events-auto min-w-0 max-w-xl flex-1">{toolbar}</div> : null}
                <button
                    type="button"
                    data-map-first-exit="true"
                    aria-label={exitLabel || t('returnToMapList')}
                    title={exitLabel || t('returnToMapList')}
                    onClick={onExit}
                    className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-700 shadow-md"
                ><Minimize2 size={18} aria-hidden="true" /></button>
            </div>
            <div ref={drawerRef} className="map-first-resource-drawer" hidden={!resourcesOpen}>
            <section
                ref={panelRef}
                data-map-first-resources="true"
                aria-label={t('resources')}
                aria-hidden={!resourcesOpen}
                inert={!resourcesOpen ? '' : undefined}
                hidden={!resourcesOpen}
                style={!resourcesOpen ? { display: 'none' } : undefined}
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
            >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
                    <h2 className="text-sm font-bold capitalize text-slate-800">{t('resources')}</h2>
                    <button type="button" aria-label={t('close')} onClick={() => onResourcesOpenChange(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{resources}</div>
            </section>
            <div className="map-first-column-actions" aria-label={t('printResourceCardColumns')}>
                <button type="button" data-map-first-columns-shrink="true"
                    disabled={columns === 1} aria-label={`${t('printResourceCardColumns')}: ${Math.max(1, columns - 1)}`}
                    onClick={() => setRequestedColumns(Math.max(1, columns - 1))}>
                    <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <button type="button" data-map-first-columns-expand="true"
                    disabled={columns === columnCapacity} aria-label={`${t('printResourceCardColumns')}: ${Math.min(columnCapacity, columns + 1)}`}
                    onClick={() => setRequestedColumns(Math.min(columnCapacity, columns + 1))}>
                    <ChevronRight size={18} aria-hidden="true" />
                </button>
            </div>
            </div>
        </section>
    );
}
