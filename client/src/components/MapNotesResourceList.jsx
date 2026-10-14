import React, { useId, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { filterMapNoteResources, resolveRecentMapNotePins } from '../lib/mapNotesNavigation.js';

export default function MapNotesResourceList({ rows, recentPins = [], query, onQueryChange, renderRow }) {
    const { t } = useLocale();
    const searchId = useId();
    const results = useMemo(() => filterMapNoteResources(rows, query), [rows, query]);
    const recent = useMemo(() => resolveRecentMapNotePins(recentPins, rows), [recentPins, rows]);
    const searching = Boolean(query.trim());

    return <div className="space-y-4">
        <div>
            <label htmlFor={searchId} className="mb-1.5 block text-sm font-bold text-slate-700">{t('searchMapNotesResources')}</label>
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-brand-100">
                <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
                <input id={searchId} type="search" value={query} onChange={event => onQueryChange(event.target.value)}
                    placeholder={t('searchMapNotesPlaceholder')} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
                {query ? <button type="button" onClick={() => onQueryChange('')} aria-label={t('clearMapNotesSearch')}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button> : null}
            </div>
        </div>
        {!searching && recent.length > 0 ? <section aria-label={t('mapNotesRecentPins')} className="space-y-2">
            <h3 className="text-sm font-black text-slate-900">{t('mapNotesRecentPins')}</h3>
            <p className="text-xs leading-5 text-slate-500">{t('mapNotesRecentPinsHelp')}</p>
            {recent.map(pin => <div key={pin.key} data-map-notes-recent-pin={pin.key} className="space-y-2">
                {pin.rows.length > 1 ? <p className="text-xs font-bold text-slate-600">{pin.name}</p> : null}
                {pin.rows.map(row => renderRow(row, `recent-${pin.key}`))}
            </div>)}
        </section> : null}
        <section aria-label={t('mapNotesAllResources')} className="space-y-3">
            <h3 className="text-sm font-black text-slate-900">{t('mapNotesAllResources')}</h3>
            <p role="status" className="text-xs font-semibold text-slate-500">{t('mapNotesSearchCount', { count: results.length })}</p>
            {results.length ? results.map(row => renderRow(row, 'all'))
                : <p className="py-3 text-sm text-slate-500">{t('mapNotesSearchEmpty')}</p>}
        </section>
    </div>;
}
