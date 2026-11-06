import MapAreaResultsPanel from './MapAreaResultsPanel.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getMapAreaResourceMessages } from '../lib/mapAreaResourceMessages.js';
import { useOwnerMapEditingCanvas } from '../contexts/OwnerMapEditingCanvasContext.jsx';
import './MapAreaResourceWorkspace.css';

export default function MapAreaResourceWorkspace({ areas, selection, mapName, existingAssets, scopeKey,
    disabled, busy, onSelectArea, onDrawArea, onSaveAndAdd, onBusyChange }) {
    const { locale } = useLocale(); const m = getMapAreaResourceMessages(locale);
    const canvas = useOwnerMapEditingCanvas();
    const currentId = selection?.annotationId || '';
    return <div className="flex min-h-0 flex-1 flex-col" data-map-area-workspace>
        <div className="shrink-0 space-y-2 border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-bold text-brand-800">{mapName}</p>
            <label className="block text-sm font-semibold" htmlFor="map-area-choice">{m.chooseArea}</label>
            <div className="flex flex-wrap items-center gap-2">
                <select id="map-area-choice" data-map-area-choice value={currentId} disabled={busy || disabled}
                    onChange={event => onSelectArea(areas.find(area => area.id === event.target.value) || null)} className="input-field min-h-11 min-w-0 flex-1">
                    <option value="">{m.chooseArea}</option>
                    {selection && !areas.some(area => area.id === currentId) ? <option value={currentId}>{selection.label}</option> : null}
                    {areas.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}
                </select>
                <button type="button" className="btn-ghost min-h-11 border border-slate-200" disabled={busy || disabled} onClick={event => {
                    onDrawArea({ canvas: Boolean(canvas?.active) });
                    if (canvas?.active) canvas.openDraw?.(event);
                }}>{m.drawArea}</button>
            </div>
            <p className="text-xs leading-5 text-slate-500">{areas.length || selection ? m.chooseAreaHelp : m.noAreas}</p>
        </div>
        {selection?.area ? <MapAreaResultsPanel key={`${scopeKey}:${currentId}`} embedded initialTab="resources" area={selection.area}
            onClose={() => onSelectArea(null)} existingAssets={existingAssets} scopeKey={`${scopeKey}:${currentId}`} disabled={disabled}
            onSaveAndAdd={onSaveAndAdd} onBusyChange={onBusyChange} /> : null}
    </div>;
}
