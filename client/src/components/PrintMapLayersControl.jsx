import {
    ArrowDown,
    ArrowUp,
    Circle,
    Eye,
    EyeOff,
    Layers3,
    MapPin,
    Minus,
    Pentagon,
    RotateCcw,
    Square,
    X,
} from 'lucide-react';
import { useState } from 'react';

import {
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
} from '../lib/printMapState.js';

const ANNOTATION_TYPE_LABELS = {
    pin: 'Pin',
    line: 'Line',
    rectangle: 'Box',
    circle: 'Circle',
    polygon: 'Boundary',
};

const ANNOTATION_TYPE_ICONS = {
    pin: MapPin,
    line: Minus,
    rectangle: Square,
    circle: Circle,
    polygon: Pentagon,
};

function IconButton({
    label,
    disabled = false,
    pressed,
    onClick,
    children,
}) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-35"
        >
            {children}
        </button>
    );
}

function VisibilityButton({
    visible,
    label,
    disabled = false,
    onClick,
}) {
    return (
        <IconButton
            label={`${visible ? 'Hide' : 'Show'} ${label}`}
            pressed={visible}
            disabled={disabled}
            onClick={onClick}
        >
            {visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </IconButton>
    );
}

function LayerLabel({ label, count, subdued = false }) {
    return (
        <div className="min-w-0 flex-1">
            <span className={`block truncate text-xs font-bold ${subdued ? 'text-slate-400' : 'text-slate-800'}`}>
                {label}
            </span>
            <span className="block text-[10px] font-semibold text-slate-400">
                {count}
            </span>
        </div>
    );
}

function getAnnotationLayerLabel(annotation, index) {
    const typeLabel = ANNOTATION_TYPE_LABELS[annotation?.type] || 'Annotation';
    const text = String(annotation?.text || '').trim();
    return text ? `${typeLabel}: ${text}` : `${typeLabel} ${index + 1}`;
}

export default function PrintMapLayersControl({
    resourceGroups = [],
    resourceLayer = PRINT_MAP_RESOURCE_LAYER_SHOW,
    annotationLayer = PRINT_MAP_ANNOTATION_LAYER_SHOW,
    hiddenResourceLayerKeys = [],
    hiddenAnnotationIds = [],
    annotations = [],
    annotationEditing = false,
    selectedAnnotationId = null,
    onResourceLayerChange,
    onResourceLayerKeyToggle,
    onAnnotationLayerChange,
    onAnnotationVisibilityToggle,
    onAnnotationSelect,
    onAnnotationMove,
    onReset,
}) {
    const [open, setOpen] = useState(false);
    const hiddenResourceKeys = new Set(hiddenResourceLayerKeys);
    const hiddenAnnotations = new Set(hiddenAnnotationIds);
    const resourcesVisible = resourceLayer === PRINT_MAP_RESOURCE_LAYER_SHOW;
    const annotationsVisible = annotationLayer === PRINT_MAP_ANNOTATION_LAYER_SHOW;
    const orderedAnnotations = [...annotations]
        .map((annotation, index) => ({ annotation, index }))
        .reverse();

    return (
        <div
            className="absolute right-[64px] top-3 z-[1005]"
            data-print-map-layers-control="true"
        >
            <button
                type="button"
                aria-label="Map layers"
                title="Map layers"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border bg-white shadow-md transition ${
                    open
                        ? 'border-brand-600 text-brand-700 ring-2 ring-brand-100'
                        : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'
                }`}
            >
                <Layers3 size={18} />
            </button>

            {open ? (
                <section
                    aria-label="Map layers"
                    className="absolute right-0 top-12 max-h-[620px] w-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                        <div>
                            <h3 className="text-sm font-black text-slate-900">Map layers</h3>
                            <p className="text-[10px] font-semibold text-slate-500">Current print session</p>
                        </div>
                        <IconButton label="Close map layers" onClick={() => setOpen(false)}>
                            <X size={16} />
                        </IconButton>
                    </div>

                    <div className="mt-3">
                        <div className="flex items-center gap-2">
                            <VisibilityButton
                                visible={resourcesVisible}
                                label="resources"
                                onClick={() => onResourceLayerChange?.(!resourcesVisible)}
                            />
                            <LayerLabel
                                label="Resources"
                                count={`${resourceGroups.reduce((total, group) => total + group.count, 0)} mapped`}
                                subdued={!resourcesVisible}
                            />
                        </div>

                        <div className="ml-4 mt-2 border-l border-slate-200 pl-3">
                            {resourceGroups.map((group) => {
                                const groupVisible = resourcesVisible && !hiddenResourceKeys.has(group.key);
                                return (
                                    <div key={group.key} className="border-b border-slate-100 py-2 last:border-b-0">
                                        <div className="flex items-center gap-2">
                                            <VisibilityButton
                                                visible={groupVisible}
                                                label={group.label}
                                                disabled={!resourcesVisible}
                                                onClick={() => onResourceLayerKeyToggle?.(group.key)}
                                            />
                                            <LayerLabel
                                                label={group.label}
                                                count={`${group.count}`}
                                                subdued={!groupVisible}
                                            />
                                        </div>
                                        <div className="ml-4 mt-1.5 space-y-1 border-l border-slate-100 pl-3">
                                            {group.categories.map((category) => {
                                                const categoryVisible = groupVisible
                                                    && !hiddenResourceKeys.has(category.key);
                                                return (
                                                    <div key={category.key} className="flex items-center gap-2 py-0.5">
                                                        <VisibilityButton
                                                            visible={categoryVisible}
                                                            label={category.label}
                                                            disabled={!groupVisible}
                                                            onClick={() => onResourceLayerKeyToggle?.(category.key)}
                                                        />
                                                        <LayerLabel
                                                            label={category.label}
                                                            count={`${category.count}`}
                                                            subdued={!categoryVisible}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3">
                        <div className="flex items-center gap-2">
                            <VisibilityButton
                                visible={annotationsVisible}
                                label="annotations"
                                onClick={() => onAnnotationLayerChange?.(!annotationsVisible)}
                            />
                            <LayerLabel
                                label="Annotations"
                                count={`${annotations.length}`}
                                subdued={!annotationsVisible}
                            />
                        </div>

                        <div className="ml-4 mt-2 border-l border-slate-200 pl-3">
                            {orderedAnnotations.length ? orderedAnnotations.map(({ annotation, index }) => {
                                const annotationVisible = annotationsVisible
                                    && !hiddenAnnotations.has(annotation.id);
                                const AnnotationIcon = ANNOTATION_TYPE_ICONS[annotation.type] || MapPin;
                                const label = getAnnotationLayerLabel(annotation, index);
                                const selected = annotation.id === selectedAnnotationId;
                                return (
                                    <div
                                        key={annotation.id}
                                        className={`flex items-center gap-1.5 border-b border-slate-100 py-1.5 last:border-b-0 ${
                                            selected ? 'bg-brand-50' : ''
                                        }`}
                                    >
                                        <VisibilityButton
                                            visible={annotationVisible}
                                            label={label}
                                            disabled={!annotationsVisible}
                                            onClick={() => onAnnotationVisibilityToggle?.(annotation.id)}
                                        />
                                        <button
                                            type="button"
                                            disabled={!annotationEditing || !annotationVisible}
                                            onClick={() => onAnnotationSelect?.(annotation.id)}
                                            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-50 disabled:cursor-default"
                                            title={label}
                                        >
                                            <AnnotationIcon size={14} className="shrink-0 text-slate-500" />
                                            <span className={`truncate text-xs font-bold ${
                                                annotationVisible ? 'text-slate-700' : 'text-slate-400'
                                            }`}>
                                                {label}
                                            </span>
                                        </button>
                                        <IconButton
                                            label={`Move ${label} up`}
                                            disabled={index >= annotations.length - 1}
                                            onClick={() => onAnnotationMove?.(annotation.id, 'forward')}
                                        >
                                            <ArrowUp size={14} />
                                        </IconButton>
                                        <IconButton
                                            label={`Move ${label} down`}
                                            disabled={index <= 0}
                                            onClick={() => onAnnotationMove?.(annotation.id, 'backward')}
                                        >
                                            <ArrowDown size={14} />
                                        </IconButton>
                                    </div>
                                );
                            }) : (
                                <p className="py-2 text-xs font-semibold text-slate-400">No annotations</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onReset}
                        className="mt-3 flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                    >
                        <RotateCcw size={14} />
                        Reset layers
                    </button>
                </section>
            ) : null}
        </div>
    );
}
