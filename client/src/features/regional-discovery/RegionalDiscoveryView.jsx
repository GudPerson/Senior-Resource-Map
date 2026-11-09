import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildRegionalDiscoveryPresentation, regionalDiscoveryCopy } from './regionalDiscoveryPresentation.js';
import useRegionalDiscoverySelection from './useRegionalDiscoverySelection.js';
import RegionalDirectoryPane from './RegionalDirectoryPane.jsx';
import RegionalServiceDetail from './RegionalServiceDetail.jsx';
import RegionalDiscoveryMap from './RegionalDiscoveryMap.jsx';
import RegionalPostalForm from './RegionalPostalForm.jsx';

/** Guest and owner-preview hosts inject the same safe DTO and postal callbacks. No request logic lives here. */
export default function RegionalDiscoveryView({ payload = null, loading = false, evaluating = false, error = '', postalInput, onPostalInputChange, onEvaluate, onClearPostal, copy: overrides, title, className = '' }) {
    const copy = regionalDiscoveryCopy(overrides);
    // Draft identity is independent from the evaluated DTO: retirement must not overwrite typing.
    const [localPostalInput, setLocalPostalInput] = useState(() => payload?.evaluation.postalCode || '');
    const currentPostalInput = postalInput === undefined ? localPostalInput : postalInput;
    function changePostalInput(value) {
        if (postalInput === undefined) setLocalPostalInput(value);
        onPostalInputChange?.(value);
    }
    const [selectedServiceKey, setSelectedServiceKey] = useState('');
    const [mobilePane, setMobilePane] = useState('list');
    const [cameraRequest, setCameraRequest] = useState(null);
    const empty = useMemo(() => ({entries:[],entriesByKey:{},pins:[],entryKeysByPlaceKey:{},serviceOptions:[],regionBounds:[]}), []);
    const presentation = useMemo(() => payload ? buildRegionalDiscoveryPresentation(payload, {selectedServiceKey}) : empty, [empty, payload, selectedServiceKey]);
    const { selection, dispatch } = useRegionalDiscoverySelection(presentation);
    const directoryRef = useRef(null);
    const headingRef = useRef(null);
    const entryButtons = useRef(new Map());
    const requestId = useRef(0);
    const previousPane = useRef('list');
    const previousLock = useRef('none');
    const lastListFocus = useRef(null);
    const filterId = useId();
    const listTabRef = useRef(null);
    const filterRef = useRef(null);
    const chooserEntryKeys = useMemo(() => [...new Set(selection.placeKeys.flatMap(key => presentation.entryKeysByPlaceKey[key] || []))], [presentation, selection.placeKeys]);
    function event(next) {
        const inList = selection.pane === 'list';
        const enriched = { ...next,
            ...(inList ? {listScrollTop:directoryRef.current?.scrollTop || 0,focusReturnKey:next.focusReturnKey || lastListFocus.current} : {}),
            ...(selection.pane === 'chooser' ? {chooserEntryKeys} : {}),
        };
        dispatch(enriched);
        if (['ROW_ACTIVATE','PIN_ACTIVATE','VIEW_SERVICE'].includes(next.type)) {
            setCameraRequest({id:++requestId.current,type:'selection',placeKeys:next.placeKeys || []});
            if (next.type === 'PIN_ACTIVATE' || next.type === 'VIEW_SERVICE') setMobilePane('list');
        }
    }
    useLayoutEffect(() => {
        const returning = selection.pane === 'list' && previousPane.current !== 'list';
        if (returning && directoryRef.current) {
            directoryRef.current.scrollTop = selection.listScrollTop;
            if (previousLock.current !== 'none') {
                const target = entryButtons.current.get(selection.focusReturnKey);
                (target || filterRef.current)?.focus({preventScroll:true});
            }
        }
        if (selection.pane !== 'list' && previousPane.current !== selection.pane && directoryRef.current) directoryRef.current.scrollTop = 0;
        previousPane.current = selection.pane;
        previousLock.current = selection.lock;
    }, [selection]);
    useEffect(() => {
        if (selection.pane !== 'list' && selection.lock !== 'none') headingRef.current?.focus({preventScroll:true});
    }, [selection.pane, selection.lock, selection.entryKey]);
    useEffect(() => {
        if (selectedServiceKey && !presentation.serviceOptions.some(option => option.key === selectedServiceKey)) setSelectedServiceKey('');
    }, [presentation.serviceOptions, selectedServiceKey]);
    const registerEntryButton = (key, node) => { if (node) entryButtons.current.set(key,node); else entryButtons.current.delete(key); };
    return <main className={`regional-discovery flex w-full min-h-0 flex-col overflow-hidden bg-white text-slate-900 ${className}`}
        style={{height:'720px',maxHeight:'100dvh',width:'100%'}}
        onKeyDown={key => { if (key.key === 'Escape' && (selection.pane !== 'list' || selection.lock !== 'none')) { key.preventDefault(); event({type:'DISMISS'}); } }}>
        <style>{`
            .regional-discovery .regional-workspace{display:grid;grid-template-columns:minmax(280px,38%) minmax(0,1fr)}
            .regional-discovery .regional-mobile-tabs{display:none}
            .regional-discovery .leaflet-control-zoom a{min-width:44px;min-height:44px;line-height:44px}
            .regional-discovery .leaflet-marker-icon:focus-visible{outline:3px solid #0f766e;outline-offset:3px}
            @media(max-width:767px){
                .regional-discovery .regional-mobile-tabs{display:flex}
                .regional-discovery .regional-workspace{display:block;position:relative}
                .regional-discovery .regional-pane{position:absolute;inset:0}
                .regional-discovery .regional-pane[data-mobile-hidden=true]{visibility:hidden;pointer-events:none}
            }
            @media(prefers-reduced-motion:reduce){.regional-discovery *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
        `}</style>
        <header className="max-h-[48%] shrink-0 space-y-3 overflow-y-auto border-b p-4">
            <h1 className="text-xl font-bold">{title || copy.title}</h1>
            <RegionalPostalForm postalInput={currentPostalInput} onPostalInputChange={changePostalInput} evaluating={evaluating} onEvaluate={onEvaluate}
                onClearPostal={() => { event({type:'DISMISS'}); onClearPostal?.(); }} copy={copy} />
            <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={filterId}>{copy.service}</label>
                <select ref={filterRef} id={filterId} value={selectedServiceKey} onChange={event => setSelectedServiceKey(event.target.value)}
                    className="min-h-[44px] max-w-full rounded border border-slate-400 px-3 focus-visible:outline focus-visible:outline-2">
                    {(presentation.serviceOptions.length ? presentation.serviceOptions : [{key:'',label:copy.allServices}]).map(option => <option key={option.key} value={option.key}>{option.key ? option.label : copy.allServices}</option>)}
                </select>
            </div>
            <p role="status" aria-live="polite" className="text-sm text-slate-600">{loading ? copy.loading : evaluating ? copy.evaluating : payload ? copy.evaluationMessages[payload.evaluation.status] : ''}</p>
            {error && <p role="alert">{error}</p>}
        </header>
        <div className="regional-mobile-tabs shrink-0 gap-2 border-b p-2" role="group" aria-label={copy.title}>
            <button ref={listTabRef} type="button" aria-pressed={mobilePane === 'list'} onClick={() => setMobilePane('list')} className="min-h-[44px] flex-1 rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.list}</button>
            <button type="button" aria-pressed={mobilePane === 'map'} onClick={() => setMobilePane('map')} className="min-h-[44px] flex-1 rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.map}</button>
        </div>
        <div className="regional-workspace min-h-0 flex-1">
            <section className="regional-pane flex h-full min-h-0 flex-col border-r" data-mobile-hidden={mobilePane !== 'list'} aria-label={copy.list}>
                <div ref={directoryRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onFocusCapture={focus => {
                    for (const [key, node] of entryButtons.current) if (node === focus.target) { lastListFocus.current = key; break; }
                }}>
                    {selection.pane === 'detail' ? <RegionalServiceDetail entry={presentation.entriesByKey[selection.entryKey]} onBack={() => event({type:'BACK'})} onDismiss={() => event({type:'DISMISS'})} headingRef={headingRef} copy={copy} />
                        : selection.pane === 'chooser' ? <>
                            <div className="p-3"><button type="button" onClick={() => event({type:'DISMISS'})} className="min-h-[44px] rounded border px-3 focus-visible:outline focus-visible:outline-2">{copy.back}</button>
                                <h2 ref={headingRef} tabIndex={-1} className="font-bold">{copy.chooser}</h2></div>
                            <RegionalDirectoryPane entries={presentation.entries.filter(entry => chooserEntryKeys.includes(entry.entryKey))} selection={selection} onEvent={event} chooser copy={copy} />
                        </> : <RegionalDirectoryPane entries={presentation.entries} selection={selection} onEvent={event} registerEntryButton={registerEntryButton} copy={copy} />}
                </div>
                <p role="status" aria-live="polite" className="sr-only">{selection.pane === 'detail' ? presentation.entriesByKey[selection.entryKey]?.name : selection.pane === 'chooser' ? copy.chooser : `${presentation.entries.length} ${copy.allServices}`}</p>
            </section>
            <div className="regional-pane h-full min-h-0 min-w-0" data-mobile-hidden={mobilePane !== 'map'}>
                {payload && <RegionalDiscoveryMap presentation={presentation} selection={selection} onEvent={event} cameraRequest={cameraRequest}
                    onResetMap={() => setCameraRequest({id:++requestId.current,type:'reset',placeKeys:[]})} copy={copy} />}
            </div>
        </div>
    </main>;
}
