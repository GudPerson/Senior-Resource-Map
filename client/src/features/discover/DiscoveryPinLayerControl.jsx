import { useCallback, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

import pinLayerIcon from '../../assets/discovery-pin-layer.png';
import MobileBottomSheet from '../../components/mobile/MobileBottomSheet.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

function CloseButton({ onClick }) {
    const { t } = useLocale();

    return (
        <button
            type="button"
            aria-label={t('close')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            onClick={onClick}
        >
            <X size={18} aria-hidden="true" />
        </button>
    );
}

function PinLayerPanel({
    categoryOptions = [],
    onChangeCategorySelection,
    panelId,
    selectedCategoryKeys = [],
}) {
    const { t } = useLocale();
    const selectedKeys = new Set(selectedCategoryKeys);
    const allCategoriesSelected = selectedKeys.size === 0;

    const toggleCategory = (categoryKey, checked) => {
        const nextKeys = new Set(selectedKeys);
        if (checked) nextKeys.add(categoryKey);
        else nextKeys.delete(categoryKey);
        onChangeCategorySelection?.(Array.from(nextKeys).sort());
    };

    if (categoryOptions.length === 0) {
        return (
            <div
                id={panelId}
                data-discovery-pin-layer-empty="true"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center"
            >
                <img src={pinLayerIcon} alt="" className="mx-auto h-[34px] w-[30px] object-contain opacity-70" />
                <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">
                    {t('discoveryNoSavedPinsToFilter')}
                </p>
            </div>
        );
    }

    return (
        <div id={panelId} data-discovery-pin-layer-panel="true">
            <p className="text-xs leading-5 text-slate-500">
                {t('discoveryCategoryFilterHelp')}
            </p>
            <div className="mt-3 max-h-[min(52vh,28rem)] space-y-1 overflow-y-auto pr-1">
                <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                    <span className="flex min-w-0 items-center gap-3">
                        <input
                            type="checkbox"
                            checked={allCategoriesSelected}
                            onChange={(event) => {
                                if (event.target.checked) onChangeCategorySelection?.([]);
                            }}
                            className="h-4 w-4 shrink-0 rounded border-slate-300"
                            style={{ accentColor: 'var(--color-brand)' }}
                        />
                        <span className="truncate text-sm font-semibold text-slate-800">
                            {t('discoveryAllSavedPins')}
                        </span>
                    </span>
                </label>

                {categoryOptions.map((option) => (
                    <label
                        key={option.key}
                        className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 hover:bg-slate-50"
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedKeys.has(option.key)}
                                onChange={(event) => toggleCategory(option.key, event.target.checked)}
                                className="h-4 w-4 shrink-0 rounded border-slate-300"
                                style={{ accentColor: 'var(--color-brand)' }}
                            />
                            <span className="truncate text-sm font-semibold text-slate-800">
                                {option.label}
                            </span>
                        </span>
                        <span className="inline-flex min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-bold text-slate-500">
                            {option.count}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}

export default function DiscoveryPinLayerControl({
    categoryOptions = [],
    onChangeCategorySelection,
    presentation = 'popover',
    selectedCategoryKeys = [],
}) {
    const { t } = useLocale();
    const [open, setOpen] = useState(false);
    const detailsRef = useRef(null);
    const triggerRef = useRef(null);
    const reactId = useId();
    const panelId = `discovery-pin-layers-${reactId.replace(/:/g, '')}`;
    const selectedCount = selectedCategoryKeys.length;
    const selectionLabel = categoryOptions.length === 0
        ? t('discoveryNoSavedPinsToFilter')
        : selectedCount === 0
            ? t('discoveryAllSavedPins')
            : selectedCount === 1
                ? t('discoveryCategorySelected')
                : t('discoveryCategoriesSelected', { count: selectedCount });
    const controlLabel = `${t('discoveryMapPinCategories')}: ${selectionLabel}`;

    const closeAndFocusTrigger = useCallback(() => {
        setOpen(false);
        if (detailsRef.current) detailsRef.current.open = false;
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);

    const handleMobileOpenChange = useCallback((nextOpen) => {
        if (nextOpen) {
            setOpen(true);
            return;
        }
        closeAndFocusTrigger();
    }, [closeAndFocusTrigger]);

    const panelContent = (
        <PinLayerPanel
            categoryOptions={categoryOptions}
            onChangeCategorySelection={onChangeCategorySelection}
            panelId={panelId}
            selectedCategoryKeys={selectedCategoryKeys}
        />
    );

    if (presentation === 'popover') {
        return (
            <details
                ref={detailsRef}
                className="group relative shrink-0"
                data-discovery-pin-layer-control="true"
                onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    closeAndFocusTrigger();
                }}
            >
                <summary
                    ref={triggerRef}
                    aria-controls={panelId}
                    aria-haspopup="dialog"
                    aria-label={controlLabel}
                    title={controlLabel}
                    className={`relative inline-flex h-[46px] w-[46px] cursor-pointer list-none touch-manipulation items-center justify-center rounded-2xl border p-0 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 [&::-webkit-details-marker]:hidden ${selectedCount > 0
                        ? 'border-brand-500 bg-brand-50 hover:bg-brand-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                    <img src={pinLayerIcon} alt="" className="h-[30px] w-[27px] object-contain" />
                    {selectedCount > 0 ? (
                        <span
                            aria-hidden="true"
                            className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[9px] font-black leading-none text-white shadow-sm"
                        >
                            {selectedCount > 9 ? '9+' : selectedCount}
                        </span>
                    ) : null}
                </summary>

                <div
                    role="dialog"
                    aria-label={t('discoveryMapPinCategories')}
                    className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl"
                    style={{ backgroundColor: '#ffffff' }}
                >
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-base font-extrabold text-slate-900">
                                {t('discoveryMapPinCategories')}
                            </h2>
                            <p className="mt-1 truncate text-xs font-semibold text-brand-700">
                                {selectionLabel}
                            </p>
                        </div>
                        <CloseButton onClick={closeAndFocusTrigger} />
                    </div>
                    {panelContent}
                </div>
            </details>
        );
    }

    return (
        <div className="relative shrink-0" data-discovery-pin-layer-control="true">
            <button
                ref={triggerRef}
                type="button"
                aria-controls={open ? panelId : undefined}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-label={controlLabel}
                title={controlLabel}
                className={`relative inline-flex h-10 w-10 touch-manipulation items-center justify-center rounded-2xl border p-0 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${selectedCount > 0
                    ? 'border-brand-500 bg-brand-50 hover:bg-brand-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                onClick={() => setOpen((current) => !current)}
            >
                <img src={pinLayerIcon} alt="" className="h-[26px] w-[24px] object-contain" />
                {selectedCount > 0 ? (
                    <span
                        aria-hidden="true"
                        className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-[9px] font-black leading-none text-white shadow-sm"
                    >
                        {selectedCount > 9 ? '9+' : selectedCount}
                    </span>
                ) : null}
            </button>

            <MobileBottomSheet
                open={open}
                onOpenChange={handleMobileOpenChange}
                title={t('discoveryMapPinCategories')}
                description={selectionLabel}
                headerActions={<CloseButton onClick={closeAndFocusTrigger} />}
                contentClassName="border-slate-200 bg-white"
                bodyClassName="pb-2"
            >
                {panelContent}
            </MobileBottomSheet>
        </div>
    );
}
