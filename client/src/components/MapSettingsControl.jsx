import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';

import { useMediaQuery } from '../hooks/useMediaQuery.js';
import MapStyleControl from './MapStyleControl.jsx';
import MobileBottomSheet from './mobile/MobileBottomSheet.jsx';

function CloseButton({ onClick }) {
    return (
        <button
            type="button"
            aria-label="Close map settings"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 lg:h-10 lg:w-10"
            onClick={onClick}
        >
            <X size={18} aria-hidden="true" />
        </button>
    );
}

function MapSettingsPanelContent({ mapModeControl, mapStyleDescription, mapStyleValue, onMapStyleChange, panelId, showMapStyleControl }) {
    return (
        <div id={panelId} className="space-y-5" data-map-settings-panel="true">
            {mapModeControl ? (
                <section aria-labelledby={`${panelId}-detail`}>
                    <h3 id={`${panelId}-detail`} className="text-sm font-extrabold text-slate-900">
                        Map detail
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        Detailed turns on automatically when you zoom in to level 15.
                    </p>
                    <div className="mt-3">{mapModeControl}</div>
                </section>
            ) : null}

            {showMapStyleControl ? (
                <section aria-labelledby={`${panelId}-colour`}>
                    <h3 id={`${panelId}-colour`} className="text-sm font-extrabold text-slate-900">
                        Map colour
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {mapStyleDescription}
                    </p>
                    <div className="mt-3">
                        <MapStyleControl variant="panel" value={mapStyleValue} onChange={onMapStyleChange} />
                    </div>
                </section>
            ) : null}
        </div>
    );
}

export default function MapSettingsControl({
    mapModeControl = null,
    mapStyleDescription = 'Your colour choice is used on every map.',
    mapStyleValue = null,
    onMapStyleChange = null,
    showMapStyleControl = true,
}) {
    const [open, setOpen] = useState(false);
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const wrapperRef = useRef(null);
    const triggerRef = useRef(null);
    const reactId = useId();
    const panelId = `map-settings-${reactId.replace(/:/g, '')}`;
    const hasSettings = Boolean(mapModeControl || showMapStyleControl);

    const closeAndFocusTrigger = useCallback(() => {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);

    useEffect(() => {
        if (!open || !isDesktop) return undefined;

        const handlePointerDown = (event) => {
            if (!wrapperRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeAndFocusTrigger();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeAndFocusTrigger, isDesktop, open]);

    if (!hasSettings) return null;

    const panelContent = (
        <MapSettingsPanelContent
            mapModeControl={mapModeControl}
            mapStyleDescription={mapStyleDescription}
            mapStyleValue={mapStyleValue}
            onMapStyleChange={onMapStyleChange}
            panelId={panelId}
            showMapStyleControl={showMapStyleControl}
        />
    );

    return (
        <div
            ref={wrapperRef}
            className="pointer-events-auto relative"
            data-map-settings-control="true"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label="Map settings"
                aria-expanded={open}
                aria-haspopup="dialog"
                className="inline-flex h-[30px] w-[30px] min-w-[30px] touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white p-0 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 lg:h-[34px] lg:w-[34px] lg:min-w-[34px] lg:rounded-[10px]"
                title="Map settings"
                onClick={() => setOpen((current) => !current)}
            >
                <Settings2 size={15} className="lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
            </button>

            {isDesktop && open ? (
                <div
                    role="dialog"
                    aria-label="Map appearance"
                    className="absolute right-0 top-full z-[1010] mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl"
                >
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-900">Map appearance</h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Choose how the map looks.</p>
                        </div>
                        <CloseButton onClick={closeAndFocusTrigger} />
                    </div>
                    {panelContent}
                </div>
            ) : null}

            {!isDesktop ? (
                <MobileBottomSheet
                    open={open}
                    onOpenChange={setOpen}
                    title="Map appearance"
                    description="Choose how the map looks."
                    headerActions={<CloseButton onClick={closeAndFocusTrigger} />}
                    contentClassName="border-slate-200 bg-white"
                    bodyClassName="pb-2"
                >
                    {panelContent}
                </MobileBottomSheet>
            ) : null}
        </div>
    );
}
