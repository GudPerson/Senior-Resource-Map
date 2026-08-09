import { useId } from 'react';
import { X } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    MAP_STUDIO_CAMERA_FIT,
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_MAP_HEIGHT_COMPACT,
    MAP_STUDIO_MAP_HEIGHT_STANDARD,
    MAP_STUDIO_MAP_HEIGHT_TALL,
    MAP_STUDIO_PIN_STYLE_BUBBLE,
    MAP_STUDIO_PIN_STYLE_CATEGORY_ICON,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    normalizeMapStudioDesign,
} from '../lib/mapStudioState.js';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_LAYOUT_FULL,
    PRINT_MAP_PIN_SIZE_EXTRA_LARGE,
    PRINT_MAP_PIN_SIZE_LARGE,
    PRINT_MAP_PIN_SIZE_STANDARD,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
    PRINT_MAP_WIDTH_WIDE,
    normalizePrintMapHiddenLayerKeys,
} from '../lib/printMapState.js';

function ChoiceButton({ selected, label, onClick, disabled = false }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            disabled={disabled}
            className={`min-h-11 min-w-0 touch-manipulation rounded-xl border px-2 py-2 text-center transition focus:outline-none focus:ring-4 focus:ring-brand-100 ${
                selected
                    ? 'border-brand-600 bg-brand-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
            } disabled:cursor-not-allowed disabled:opacity-45`}
        >
            <span className="block break-words text-xs font-bold leading-4 sm:text-sm sm:leading-5">{label}</span>
        </button>
    );
}

function DesignFieldset({ legend, description = '', children, columns = 2 }) {
    const gridClassName = columns === 5
        ? 'grid-cols-5'
        : columns === 3
            ? 'grid-cols-3'
            : 'grid-cols-2';
    return (
        <fieldset>
            <legend className="text-sm font-bold text-slate-800">{legend}</legend>
            {description ? (
                <p className="mt-1 text-xs font-medium leading-4 text-slate-500">
                    {description}
                </p>
            ) : null}
            <div
                className={`mt-2 grid gap-2 ${gridClassName}`}
            >
                {children}
            </div>
        </fieldset>
    );
}

export default function MapStudioDesignControls({
    design,
    explorationCamera = null,
    resourceLayerCatalog = null,
    annotationLayerCatalog = [],
    onPatch = null,
    onClose = null,
    disabled = false,
}) {
    const { t } = useLocale();
    const headingId = useId();
    const value = normalizeMapStudioDesign(design);
    const cameraCandidate = normalizeMapStudioDesign({
        ...value,
        camera: {
            mode: MAP_STUDIO_CAMERA_FIXED,
            view: explorationCamera,
        },
    }).camera;
    const canUseCurrentFraming = cameraCandidate.mode === MAP_STUDIO_CAMERA_FIXED;
    const hiddenResourceLayerKeys = new Set(normalizePrintMapHiddenLayerKeys(
        value.layers.hiddenResourceLayerKeys,
    ));
    const toggleResourceLayer = (layerKey) => {
        const nextHiddenKeys = new Set(hiddenResourceLayerKeys);
        if (nextHiddenKeys.has(layerKey)) nextHiddenKeys.delete(layerKey);
        else nextHiddenKeys.add(layerKey);
        onPatch?.({ layers: { hiddenResourceLayerKeys: [...nextHiddenKeys] } });
    };
    const hiddenAnnotationIds = new Set(normalizePrintMapHiddenLayerKeys(
        value.layers.hiddenAnnotationIds,
    ));
    const toggleAnnotation = (annotationId) => {
        const nextHiddenIds = new Set(hiddenAnnotationIds);
        if (nextHiddenIds.has(annotationId)) nextHiddenIds.delete(annotationId);
        else nextHiddenIds.add(annotationId);
        onPatch?.({ layers: { hiddenAnnotationIds: [...nextHiddenIds] } });
    };
    const labelOptions = [
        { value: PRINT_MAP_LABEL_DETAIL_NAMES, label: t('printLabelNamesOnly') },
        { value: PRINT_MAP_LABEL_DETAIL_LOGOS, label: t('printLabelNamesLogos') },
        { value: PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES, label: t('printLabelNamesAddresses') },
        { value: PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS, label: t('printLabelNamesDescriptions') },
        { value: PRINT_MAP_LABEL_DETAIL_FULL, label: t('printLabelFullDetails') },
    ];

    return (
        <section
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4"
            aria-labelledby={headingId}
            data-map-studio-design-controls="true"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 id={headingId} className="text-base font-black text-slate-900">
                        {t('mapStudioDesignControls')}
                    </h3>
                    <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:text-sm sm:leading-5">
                        {t('mapStudioDesignControlsHelp')}
                    </p>
                </div>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-100"
                        aria-label={t('mapStudioCloseDesignSettings')}
                        title={t('mapStudioCloseDesignSettings')}
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                ) : null}
            </div>

            <div className="mt-3 space-y-3">
                <DesignFieldset legend={t('mapStudioMapColour')}>
                    <ChoiceButton selected={value.basemap.style === 'default'} label={t('mapStudioColourDefault')} onClick={() => onPatch?.({ basemap: { style: 'default' } })} disabled={disabled} />
                    <ChoiceButton selected={value.basemap.style === 'gray'} label={t('mapStudioColourGray')} onClick={() => onPatch?.({ basemap: { style: 'gray' } })} disabled={disabled} />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioMapDetail')}>
                    <ChoiceButton selected={value.basemap.detailMode === 'auto'} label={t('mapStudioDetailAuto')} onClick={() => onPatch?.({ basemap: { detailMode: 'auto' } })} disabled={disabled} />
                    <ChoiceButton selected={value.basemap.detailMode === 'live'} label={t('mapStudioDetailLive')} onClick={() => onPatch?.({ basemap: { detailMode: 'live' } })} disabled={disabled} />
                </DesignFieldset>

                <div data-map-studio-resource-layer-controls="true">
                    <DesignFieldset legend={t('mapStudioResources')} description={t('printResourcePinsHelp')}>
                        <ChoiceButton selected={value.layers.resources === PRINT_MAP_RESOURCE_LAYER_SHOW} label={t('mapStudioResourcesShow')} onClick={() => onPatch?.({ layers: { resources: PRINT_MAP_RESOURCE_LAYER_SHOW } })} disabled={disabled} />
                        <ChoiceButton selected={value.layers.resources === PRINT_MAP_RESOURCE_LAYER_HIDE} label={t('mapStudioResourcesHide')} onClick={() => onPatch?.({ layers: { resources: PRINT_MAP_RESOURCE_LAYER_HIDE } })} disabled={disabled} />
                    </DesignFieldset>
                </div>

                {value.layers.resources === PRINT_MAP_RESOURCE_LAYER_SHOW ? (
                    <>
                        <DesignFieldset legend={t('mapStudioPinStyle')} columns={3}>
                            <ChoiceButton selected={value.pins.style === MAP_STUDIO_PIN_STYLE_BUBBLE} label={t('mapStudioPinBubble')} onClick={() => onPatch?.({ pins: { style: MAP_STUDIO_PIN_STYLE_BUBBLE } })} disabled={disabled} />
                            <ChoiceButton selected={value.pins.style === MAP_STUDIO_PIN_STYLE_NUMBERED} label={t('mapStudioPinNumbered')} onClick={() => onPatch?.({ pins: { style: MAP_STUDIO_PIN_STYLE_NUMBERED } })} disabled={disabled} />
                            <ChoiceButton selected={value.pins.style === MAP_STUDIO_PIN_STYLE_CATEGORY_ICON} label={t('mapStudioPinCategoryIcon')} onClick={() => onPatch?.({ pins: { style: MAP_STUDIO_PIN_STYLE_CATEGORY_ICON } })} disabled={disabled} />
                        </DesignFieldset>

                        <DesignFieldset legend={t('mapStudioPinSize')} description={t('printPinSizeHelp')} columns={3}>
                            <ChoiceButton selected={value.pins.size === PRINT_MAP_PIN_SIZE_STANDARD} label={t('printPinSizeStandard')} onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_STANDARD } })} disabled={disabled} />
                            <ChoiceButton selected={value.pins.size === PRINT_MAP_PIN_SIZE_LARGE} label={t('printPinSizeLarge')} onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_LARGE } })} disabled={disabled} />
                            <ChoiceButton selected={value.pins.size === PRINT_MAP_PIN_SIZE_EXTRA_LARGE} label={t('printPinSizeExtraLarge')} onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_EXTRA_LARGE } })} disabled={disabled} />
                        </DesignFieldset>

                        <DesignFieldset legend={t('mapStudioLabelDetail')} description={t('printLabelDetailHelp')}>
                            {labelOptions.map((option) => (
                                <ChoiceButton key={option.value} selected={value.labels.detail === option.value} label={option.label} onClick={() => onPatch?.({ labels: { detail: option.value } })} disabled={disabled} />
                            ))}
                        </DesignFieldset>

                        <DesignFieldset legend={t('printLayoutType')} description={
                            value.layout.preset === PRINT_MAP_LAYOUT_FULL
                                ? t('printPageFullMapDescription')
                                : value.layout.preset === PRINT_MAP_LAYOUT_FOCUS
                                    ? t('printLayoutMapFocusDescription')
                                    : t('printLayoutBalancedDescription')
                        } columns={3}>
                            <ChoiceButton selected={value.layout.preset === PRINT_MAP_LAYOUT_BALANCED} label={t('printLayoutBalanced')} onClick={() => onPatch?.({ layout: { preset: PRINT_MAP_LAYOUT_BALANCED } })} disabled={disabled} />
                            <ChoiceButton selected={value.layout.preset === PRINT_MAP_LAYOUT_FOCUS} label={t('printLayoutMapFocus')} onClick={() => onPatch?.({ layout: { preset: PRINT_MAP_LAYOUT_FOCUS } })} disabled={disabled} />
                            <ChoiceButton selected={value.layout.preset === PRINT_MAP_LAYOUT_FULL} label={t('printPageFullMap')} onClick={() => onPatch?.({ layout: { preset: PRINT_MAP_LAYOUT_FULL } })} disabled={disabled} />
                        </DesignFieldset>

                        {value.layout.preset === PRINT_MAP_LAYOUT_FOCUS ? (
                            <>
                                <DesignFieldset legend={t('printMapPosition')}>
                                    <ChoiceButton selected={value.layout.mapSide === PRINT_MAP_SIDE_LEFT} label={t('printMapOnLeft')} onClick={() => onPatch?.({ layout: { mapSide: PRINT_MAP_SIDE_LEFT } })} disabled={disabled} />
                                    <ChoiceButton selected={value.layout.mapSide === PRINT_MAP_SIDE_RIGHT} label={t('printMapOnRight')} onClick={() => onPatch?.({ layout: { mapSide: PRINT_MAP_SIDE_RIGHT } })} disabled={disabled} />
                                </DesignFieldset>
                                <DesignFieldset legend={t('printResourceCardColumns')} description={t('printSideResourceCardColumnsHelp')}>
                                    {[1, 2].map((count) => (
                                        <ChoiceButton key={count} selected={value.layout.sideResourceColumnCount === count} label={String(count)} onClick={() => onPatch?.({ layout: { sideResourceColumnCount: count } })} disabled={disabled} />
                                    ))}
                                </DesignFieldset>
                            </>
                        ) : null}

                        {value.layout.preset !== PRINT_MAP_LAYOUT_FULL ? (
                            <DesignFieldset legend={t('printMapWidth')}>
                                <ChoiceButton selected={value.layout.mapWidth === PRINT_MAP_WIDTH_WIDE} label={t('printMapWidthWide')} onClick={() => onPatch?.({ layout: { mapWidth: PRINT_MAP_WIDTH_WIDE } })} disabled={disabled} />
                                <ChoiceButton selected={value.layout.mapWidth === PRINT_MAP_WIDTH_EXTRA_WIDE} label={t('printMapWidthExtraWide')} onClick={() => onPatch?.({ layout: { mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE } })} disabled={disabled} />
                            </DesignFieldset>
                        ) : null}

                        {value.layout.preset === PRINT_MAP_LAYOUT_FULL ? (
                            <DesignFieldset legend={t('printResourceCardColumns')} description={t('printResourceCardColumnsHelp')} columns={5}>
                                {[2, 3, 4, 5, 6].map((count) => (
                                    <ChoiceButton key={count} selected={value.layout.resourceColumnCount === count} label={String(count)} onClick={() => onPatch?.({ layout: { resourceColumnCount: count } })} disabled={disabled} />
                                ))}
                            </DesignFieldset>
                        ) : null}

                        {resourceLayerCatalog?.groups?.length ? (
                            <fieldset className="rounded-xl border border-slate-200 bg-white p-3" data-map-studio-resource-layers="true">
                                <legend className="px-1 text-sm font-bold text-slate-800">{t('mapStudioResourceCategories')}</legend>
                                <p className="mb-2 px-1 text-xs font-medium leading-4 text-slate-500">{t('mapStudioResourceCategoriesHelp')}</p>
                                <div className="space-y-3">
                                    {resourceLayerCatalog.groups.map((group) => (
                                        <div key={group.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <label className="flex min-h-11 items-center gap-2 text-sm font-black text-slate-800">
                                                <input type="checkbox" checked={!hiddenResourceLayerKeys.has(group.key)} onChange={() => toggleResourceLayer(group.key)} disabled={disabled} className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-200" />
                                                <span>{group.label} ({group.count})</span>
                                            </label>
                                            <div className="mt-1 space-y-1 border-t border-slate-200 pt-2">
                                                {group.categories.map((category) => (
                                                    <label key={category.key} className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-600">
                                                        <input type="checkbox" checked={!hiddenResourceLayerKeys.has(group.key) && !hiddenResourceLayerKeys.has(category.key)} onChange={() => toggleResourceLayer(category.key)} disabled={disabled || hiddenResourceLayerKeys.has(group.key)} className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-200" />
                                                        <span>{category.label} ({category.count})</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </fieldset>
                        ) : null}
                    </>
                ) : null}

                <DesignFieldset legend={t('mapStudioMapHeight')} columns={3}>
                    <ChoiceButton selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_COMPACT} label={t('mapStudioHeightCompact')} onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_COMPACT } })} disabled={disabled} />
                    <ChoiceButton selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_STANDARD} label={t('mapStudioHeightStandard')} onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_STANDARD } })} disabled={disabled} />
                    <ChoiceButton selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_TALL} label={t('mapStudioHeightTall')} onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_TALL } })} disabled={disabled} />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioCamera')} description={!canUseCurrentFraming ? t('mapStudioCurrentFramingUnavailable') : ''}>
                    <ChoiceButton selected={value.camera.mode === MAP_STUDIO_CAMERA_FIT} label={t('mapStudioCameraFit')} onClick={() => onPatch?.({ camera: { mode: MAP_STUDIO_CAMERA_FIT, view: null } })} disabled={disabled} />
                    <ChoiceButton selected={value.camera.mode === MAP_STUDIO_CAMERA_FIXED} label={t('mapStudioUseCurrentFraming')} onClick={() => onPatch?.({ camera: cameraCandidate })} disabled={disabled || !canUseCurrentFraming} />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioAnnotations')}>
                    <ChoiceButton selected={value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_SHOW} label={t('mapStudioAnnotationsShow')} onClick={() => onPatch?.({ layers: { annotations: PRINT_MAP_ANNOTATION_LAYER_SHOW } })} disabled={disabled} />
                    <ChoiceButton selected={value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_HIDE} label={t('mapStudioAnnotationsHide')} onClick={() => onPatch?.({ layers: { annotations: PRINT_MAP_ANNOTATION_LAYER_HIDE } })} disabled={disabled} />
                </DesignFieldset>

                {value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_SHOW && annotationLayerCatalog.length ? (
                    <fieldset className="rounded-xl border border-slate-200 bg-white p-3" data-map-studio-annotation-layers="true">
                        <legend className="px-1 text-sm font-bold text-slate-800">{t('mapStudioAnnotationItems')}</legend>
                        <p className="mb-2 px-1 text-xs font-medium leading-4 text-slate-500">{t('mapStudioAnnotationItemsHelp')}</p>
                        <div className="space-y-2">
                            {annotationLayerCatalog.map((annotation) => (
                                <label key={annotation.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                                    <input type="checkbox" checked={!hiddenAnnotationIds.has(annotation.id)} onChange={() => toggleAnnotation(annotation.id)} disabled={disabled} className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-200" />
                                    <span className="min-w-0 truncate">{annotation.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ) : null}
            </div>
        </section>
    );
}
