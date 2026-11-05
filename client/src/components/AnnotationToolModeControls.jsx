import { useLocale } from '../contexts/LocaleContext.jsx';
import { getAnnotationToolMessages } from '../lib/annotationToolMessages.js';
import { formatRadiusDistance } from '../lib/mapSpatialGeometry.js';
import { mapMeasurementGeometry } from '../lib/mapMeasurement.js';

const buttonClass = 'min-h-11 min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs font-bold aria-pressed:border-brand-600 aria-pressed:bg-brand-700 aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-40';

export function AnnotationToolModeControls({ measuring, onChange, hasUnfinishedDrawing }) {
    const { locale } = useLocale();
    const m = getAnnotationToolMessages(locale);
    return <div className="my-2 flex shrink-0 gap-2" data-annotation-tool-mode>
        <button type="button" className={buttonClass} aria-pressed={!measuring}
            onClick={() => onChange(false)}>{m.draw}</button>
        <button type="button" className={buttonClass} aria-pressed={measuring}
            disabled={hasUnfinishedDrawing} title={hasUnfinishedDrawing ? m.finishDrawing : undefined}
            onClick={() => onChange(true)}>{m.measure}</button>
    </div>;
}

export function TemporaryMapMeasurementControls({ measurement, onKindChange, onClear }) {
    const { locale } = useLocale();
    const m = getAnnotationToolMessages(locale);
    const geometry = mapMeasurementGeometry(measurement);
    const instruction = geometry.complete ? m.result : measurement.kind === 'radius'
        ? measurement.points.length ? m.nextRadius : m.firstRadius
        : measurement.points.length ? m.nextDistance : m.firstDistance;
    return <div className="space-y-3 p-1" data-temporary-measurement-controls>
        <div><h3 className="text-sm font-bold text-slate-900">{m.temporary}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{m.temporaryHelp}</p></div>
        <div className="flex gap-2">
            {['distance', 'radius'].map(kind => <button key={kind} type="button"
                className={buttonClass} aria-pressed={measurement.kind === kind}
                onClick={() => onKindChange(kind)}>{m[kind]}</button>)}
        </div>
        <p className="rounded-lg bg-brand-50 p-3 text-xs font-semibold leading-5 text-brand-800" role="status">{instruction}</p>
        {geometry.complete ? <output className="block text-xl font-black text-slate-900" data-temporary-measurement-result>
            {formatRadiusDistance(geometry.meters)} <span className="text-xs font-semibold">{m[measurement.kind]}</span>
        </output> : null}
        <button type="button" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
            disabled={!measurement.points.length} onClick={onClear}>{m.clear}</button>
    </div>;
}
