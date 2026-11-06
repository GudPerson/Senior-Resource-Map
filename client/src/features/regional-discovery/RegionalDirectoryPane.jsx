import React from 'react';
import { regionalDiscoveryCopy } from './regionalDiscoveryPresentation.js';

export default function RegionalDirectoryPane({ entries = [], selection, onEvent, copy: overrides, registerEntryButton, chooser = false }) {
    const copy = regionalDiscoveryCopy(overrides);
    const finePointer = event => event.pointerType !== 'touch' && globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    let lastGroup = null;
    return <div className="space-y-2 p-3">
        {entries.length === 0 && <p className="p-3">{copy.empty}</p>}
        {entries.map(entry => {
            const group = entry.recommended ? 'recommended' : 'other';
            const showGroup = group !== lastGroup;
            lastGroup = group;
            return <React.Fragment key={entry.entryKey}>
                {showGroup && <h2 className="px-1 pt-2 font-bold">{copy[group]}</h2>}
                <article className={`rounded-lg border p-3 ${selection?.entryKey === entry.entryKey ? 'border-teal-700 bg-teal-50' : 'border-slate-200'}`}
                    onPointerEnter={event => { if (!chooser && finePointer(event)) onEvent?.({type:'ROW_ENTER',entryKey:entry.entryKey,placeKeys:entry.pinPlaceKeys}); }}
                    onPointerLeave={event => { if (!chooser && finePointer(event)) onEvent?.({type:'ROW_LEAVE',entryKey:entry.entryKey}); }}>
                    <button type="button" ref={node => registerEntryButton?.(entry.entryKey, node)}
                        className="min-h-[44px] w-full rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                        aria-pressed={selection?.entryKey === entry.entryKey}
                        onClick={() => onEvent?.({type: chooser ? 'VIEW_SERVICE' : 'ROW_ACTIVATE',entryKey:entry.entryKey,placeKeys:entry.pinPlaceKeys,focusReturnKey:entry.entryKey})}>
                        <span className="block font-semibold">{entry.name}</span>
                        <span className="block text-sm text-slate-600">{entry.categoryLabel}</span>
                    </button>
                    {entry.shortDescription && <p className="text-sm">{entry.shortDescription}</p>}
                    {entry.distanceMeters !== null && <p className="text-sm">{new Intl.NumberFormat(undefined, {maximumFractionDigits:1}).format(entry.distanceMeters / 1000)} km</p>}
                    {entry.placement !== 'plotted' && <p className="text-sm text-slate-600">{entry.placement === 'intentionally-unplotted' ? copy.unplotted : copy.coordinatesUnavailable}</p>}
                    <button type="button" className="min-h-[44px] rounded px-2 text-teal-800 underline focus-visible:outline focus-visible:outline-2"
                        ref={node => registerEntryButton?.(`view:${entry.entryKey}`, node)}
                        onClick={() => onEvent?.({type:'VIEW_SERVICE',entryKey:entry.entryKey,placeKeys:entry.pinPlaceKeys,focusReturnKey:`view:${entry.entryKey}`})}>{copy.viewService}</button>
                </article>
            </React.Fragment>;
        })}
    </div>;
}
