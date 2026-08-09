import { useId } from 'react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    MAP_STUDIO_CAMERA_FIT,
    MAP_STUDIO_CAMERA_FIXED,
    MAP_STUDIO_MAP_HEIGHT_COMPACT,
    MAP_STUDIO_MAP_HEIGHT_STANDARD,
    MAP_STUDIO_MAP_HEIGHT_TALL,
    MAP_STUDIO_MODE_DESIGN,
    MAP_STUDIO_MODE_EXPLORE,
    MAP_STUDIO_PIN_STYLE_BUBBLE,
    MAP_STUDIO_PIN_STYLE_NUMBERED,
    MAP_STUDIO_RESOURCE_PANEL_BELOW,
    MAP_STUDIO_RESOURCE_PANEL_BESIDE,
    MAP_STUDIO_RESOURCE_PANEL_RESPONSIVE,
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
    PRINT_MAP_PIN_SIZE_EXTRA_LARGE,
    PRINT_MAP_PIN_SIZE_LARGE,
    PRINT_MAP_PIN_SIZE_STANDARD,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    normalizePrintMapHiddenLayerKeys,
} from '../lib/printMapState.js';

function ChoiceButton({ selected, label, onClick, disabled = false }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            disabled={disabled}
            className={`min-h-11 min-w-0 touch-manipulation rounded-xl border px-3 py-2 text-center text-xs font-bold leading-4 transition focus:outline-none focus:ring-4 focus:ring-brand-100 sm:text-sm sm:leading-5 ${
                selected
                    ? 'border-brand-600 bg-brand-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
            } disabled:cursor-not-allowed disabled:opacity-45`}
        >
            {label}
        </button>
    );
}

function DesignFieldset({ legend, description = '', children, columns = 2 }) {
    return (
        <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-sm font-black text-slate-900">{legend}</legend>
            {description ? (
                <p className="mb-2 px-1 text-xs font-medium leading-5 text-slate-500">
                    {description}
                </p>
            ) : null}
            <div
                className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
                {children}
            </div>
        </fieldset>
    );
}

export function MapStudioModeSwitch({
    mode = MAP_STUDIO_MODE_EXPLORE,
    onModeChange = null,
    disabled = false,
}) {
    const { t } = useLocale();
    const resolvedMode = mode === MAP_STUDIO_MODE_DESIGN
        ? MAP_STUDIO_MODE_DESIGN
        : MAP_STUDIO_MODE_EXPLORE;

    return (
        <div
            role="group"
            aria-label={t('mapStudioModeLabel')}
            className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5"
            data-map-studio-mode-switch="true"
        >
            <ChoiceButton
                selected={resolvedMode === MAP_STUDIO_MODE_EXPLORE}
                label={t('mapStudioExploreMode')}
                onClick={() => onModeChange?.(MAP_STUDIO_MODE_EXPLORE)}
                disabled={disabled}
            />
            <ChoiceButton
                selected={resolvedMode === MAP_STUDIO_MODE_DESIGN}
                label={t('mapStudioDesignMode')}
                onClick={() => onModeChange?.(MAP_STUDIO_MODE_DESIGN)}
                disabled={disabled}
            />
        </div>
    );
}

export default function MapStudioDesignControls({
    design,
    explorationCamera = null,
    resourceLayerCatalog = null,
    annotationLayerCatalog = [],
    onPatch = null,
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
            className="rounded-[22px] border border-brand-100 bg-white p-3 shadow-sm sm:p-4"
            aria-labelledby={headingId}
            data-map-studio-design-controls="true"
        >
            <div>
                <h3 id={headingId} className="text-base font-black text-slate-900">
                    {t('mapStudioDesignControls')}
                </h3>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                    {t('mapStudioDesignControlsHelp')}
                </p>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DesignFieldset legend={t('mapStudioMapColour')}>
                    <ChoiceButton
                        selected={value.basemap.style === 'default'}
                        label={t('mapStudioColourDefault')}
                        onClick={() => onPatch?.({ basemap: { style: 'default' } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.basemap.style === 'gray'}
                        label={t('mapStudioColourGray')}
                        onClick={() => onPatch?.({ basemap: { style: 'gray' } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioMapDetail')}>
                    <ChoiceButton
                        selected={value.basemap.detailMode === 'auto'}
                        label={t('mapStudioDetailAuto')}
                        onClick={() => onPatch?.({ basemap: { detailMode: 'auto' } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.basemap.detailMode === 'live'}
                        label={t('mapStudioDetailLive')}
                        onClick={() => onPatch?.({ basemap: { detailMode: 'live' } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioPinStyle')}>
                    <ChoiceButton
                        selected={value.pins.style === MAP_STUDIO_PIN_STYLE_BUBBLE}
                        label={t('mapStudioPinBubble')}
                        onClick={() => onPatch?.({ pins: { style: MAP_STUDIO_PIN_STYLE_BUBBLE } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.pins.style === MAP_STUDIO_PIN_STYLE_NUMBERED}
                        label={t('mapStudioPinNumbered')}
                        onClick={() => onPatch?.({ pins: { style: MAP_STUDIO_PIN_STYLE_NUMBERED } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioPinSize')} columns={3}>
                    <ChoiceButton
                        selected={value.pins.size === PRINT_MAP_PIN_SIZE_STANDARD}
                        label={t('printPinSizeStandard')}
                        onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_STANDARD } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.pins.size === PRINT_MAP_PIN_SIZE_LARGE}
                        label={t('printPinSizeLarge')}
                        onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_LARGE } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.pins.size === PRINT_MAP_PIN_SIZE_EXTRA_LARGE}
                        label={t('printPinSizeExtraLarge')}
                        onClick={() => onPatch?.({ pins: { size: PRINT_MAP_PIN_SIZE_EXTRA_LARGE } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioLabelDetail')} columns={3}>
                    {labelOptions.map((option) => (
                        <ChoiceButton
                            key={option.value}
                            selected={value.labels.detail === option.value}
                            label={option.label}
                            onClick={() => onPatch?.({ labels: { detail: option.value } })}
                            disabled={disabled}
                        />
                    ))}
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioMapHeight')} columns={3}>
                    <ChoiceButton
                        selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_COMPACT}
                        label={t('mapStudioHeightCompact')}
                        onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_COMPACT } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_STANDARD}
                        label={t('mapStudioHeightStandard')}
                        onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_STANDARD } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layout.mapHeight === MAP_STUDIO_MAP_HEIGHT_TALL}
                        label={t('mapStudioHeightTall')}
                        onClick={() => onPatch?.({ layout: { mapHeight: MAP_STUDIO_MAP_HEIGHT_TALL } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset
                    legend={t('mapStudioCamera')}
                    description={!canUseCurrentFraming ? t('mapStudioCurrentFramingUnavailable') : ''}
                >
                    <ChoiceButton
                        selected={value.camera.mode === MAP_STUDIO_CAMERA_FIT}
                        label={t('mapStudioCameraFit')}
                        onClick={() => onPatch?.({ camera: { mode: MAP_STUDIO_CAMERA_FIT, view: null } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.camera.mode === MAP_STUDIO_CAMERA_FIXED}
                        label={t('mapStudioUseCurrentFraming')}
                        onClick={() => onPatch?.({ camera: cameraCandidate })}
                        disabled={disabled || !canUseCurrentFraming}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioAnnotations')}>
                    <ChoiceButton
                        selected={value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_SHOW}
                        label={t('mapStudioAnnotationsShow')}
                        onClick={() => onPatch?.({ layers: { annotations: PRINT_MAP_ANNOTATION_LAYER_SHOW } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_HIDE}
                        label={t('mapStudioAnnotationsHide')}
                        onClick={() => onPatch?.({ layers: { annotations: PRINT_MAP_ANNOTATION_LAYER_HIDE } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioResources')}>
                    <ChoiceButton
                        selected={value.layers.resources === PRINT_MAP_RESOURCE_LAYER_SHOW}
                        label={t('mapStudioResourcesShow')}
                        onClick={() => onPatch?.({ layers: { resources: PRINT_MAP_RESOURCE_LAYER_SHOW } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layers.resources === PRINT_MAP_RESOURCE_LAYER_HIDE}
                        label={t('mapStudioResourcesHide')}
                        onClick={() => onPatch?.({ layers: { resources: PRINT_MAP_RESOURCE_LAYER_HIDE } })}
                        disabled={disabled}
                    />
                </DesignFieldset>

                <DesignFieldset legend={t('mapStudioResourcePanel')} columns={3}>
                    <ChoiceButton
                        selected={value.layout.resourcePanel === MAP_STUDIO_RESOURCE_PANEL_RESPONSIVE}
                        label={t('mapStudioResourcePanelResponsive')}
                        onClick={() => onPatch?.({ layout: { resourcePanel: MAP_STUDIO_RESOURCE_PANEL_RESPONSIVE } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layout.resourcePanel === MAP_STUDIO_RESOURCE_PANEL_BELOW}
                        label={t('mapStudioResourcePanelBelow')}
                        onClick={() => onPatch?.({ layout: { resourcePanel: MAP_STUDIO_RESOURCE_PANEL_BELOW } })}
                        disabled={disabled}
                    />
                    <ChoiceButton
                        selected={value.layout.resourcePanel === MAP_STUDIO_RESOURCE_PANEL_BESIDE}
                        label={t('mapStudioResourcePanelBeside')}
                        onClick={() => onPatch?.({ layout: { resourcePanel: MAP_STUDIO_RESOURCE_PANEL_BESIDE } })}
                        disabled={disabled}
                    />
                </DesignFieldset>
            </div>

            {resourceLayerCatalog?.groups?.length ? (
                <fieldset className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3" data-map-studio-resource-layers="true">
                    <legend className="px-1 text-sm font-black text-slate-900">{t('mapStudioResourceCategories')}</legend>
                    <p className="mb-2 px-1 text-xs font-medium leading-5 text-slate-500">
                        {t('mapStudioResourceCategoriesHelp')}
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                        {resourceLayerCatalog.groups.map((group) => (
                            <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
                                <label className="flex min-h-11 items-center gap-2 text-sm font-black text-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={!hiddenResourceLayerKeys.has(group.key)}
                                        onChange={() => toggleResourceLayer(group.key)}
                                        disabled={disabled}
                                        className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-200"
                                    />
                                    <span>{group.label} ({group.count})</span>
                                </label>
                                <div className="mt-1 space-y-1 border-t border-slate-100 pt-2">
                                    {group.categories.map((category) => (
                                        <label key={category.key} className="flex min-h-10 items-center gap-2 text-xs font-bold text-slate-600">
                                            <input
                                                type="checkbox"
                                                checked={!hiddenResourceLayerKeys.has(group.key) && !hiddenResourceLayerKeys.has(category.key)}
                                                onChange={() => toggleResourceLayer(category.key)}
                                                disabled={disabled || hiddenResourceLayerKeys.has(group.key)}
                                                className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-200"
                                            />
                                            <span>{category.label} ({category.count})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>
            ) : null}

            {annotationLayerCatalog.length ? (
                <fieldset className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3" data-map-studio-annotation-layers="true">
                    <legend className="px-1 text-sm font-black text-slate-900">{t('mapStudioAnnotationItems')}</legend>
                    <p className="mb-2 px-1 text-xs font-medium leading-5 text-slate-500">{t('mapStudioAnnotationItemsHelp')}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                        {annotationLayerCatalog.map((annotation) => (
                            <label key={annotation.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_SHOW && !hiddenAnnotationIds.has(annotation.id)}
                                    onChange={() => toggleAnnotation(annotation.id)}
                                    disabled={disabled || value.layers.annotations === PRINT_MAP_ANNOTATION_LAYER_HIDE}
                                    className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-200"
                                />
                                <span className="min-w-0 truncate">{annotation.label}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            ) : null}
        </section>
    );
}
