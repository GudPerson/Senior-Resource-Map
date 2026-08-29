import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Layers3, LoaderCircle, RotateCcw, X } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import CategoryPinShapeBadge from './CategoryPinShapeBadge.jsx';
import {
    CATEGORY_PIN_SHAPE_CIRCLE,
    CATEGORY_PIN_SHAPE_OPTIONS,
    getCategoryPinShape,
    normalizeCategoryPinShapes,
} from '../lib/categoryPinShapes.js';
import {
    getCategoryPinStyle,
    normalizeCategoryPinStyles,
} from '../lib/categoryPinStyles.js';
import {
    moveMyMapCategory,
    normalizeMyMapCategoryOrder,
} from '../lib/myMapCategoryOrder.js';

function sortCategoriesAlphabetically(categories) {
    return [...categories].sort((left, right) => (
        String(left?.label || '').localeCompare(String(right?.label || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
        })
    ));
}

export default function MyMapCategoryOrderModal({
    open,
    categories = [],
    initialOrder = [],
    initialCategoryShapes = {},
    initialCategoryStyles = {},
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [orderedCategories, setOrderedCategories] = useState([]);
    const [useDefaultOrder, setUseDefaultOrder] = useState(true);
    const [categoryShapes, setCategoryShapes] = useState({});
    const [categoryStyles, setCategoryStyles] = useState({});

    useEffect(() => {
        if (!open) return;
        setOrderedCategories(categories);
        setUseDefaultOrder(normalizeMyMapCategoryOrder(initialOrder).length === 0);
        setCategoryShapes(normalizeCategoryPinShapes(initialCategoryShapes));
        setCategoryStyles(normalizeCategoryPinStyles(initialCategoryStyles));
    }, [categories, initialCategoryShapes, initialCategoryStyles, initialOrder, open]);

    if (!open) return null;

    function moveCategory(fromIndex, toIndex) {
        setOrderedCategories((current) => moveMyMapCategory(current, fromIndex, toIndex));
        setUseDefaultOrder(false);
    }

    function resetOrder() {
        setOrderedCategories(sortCategoriesAlphabetically(categories));
        setUseDefaultOrder(true);
    }

    function selectCategoryShape(categoryKey, shape) {
        setCategoryShapes((current) => {
            const next = { ...current };
            if (shape === CATEGORY_PIN_SHAPE_CIRCLE) delete next[categoryKey];
            else next[categoryKey] = shape;
            return next;
        });
    }

    function updateCategoryColor(category, field, color) {
        setCategoryStyles((current) => ({
            ...current,
            [category.key]: {
                ...getCategoryPinStyle(current, category.key, category.color),
                [field]: color.toUpperCase(),
            },
        }));
    }

    function resetCategoryColors(category) {
        setCategoryStyles((current) => {
            const next = { ...current };
            delete next[category.key];
            return next;
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        await onSubmit?.({
            categoryOrder: useDefaultOrder
                ? []
                : orderedCategories.map((category) => category.key),
            categoryShapes: normalizeCategoryPinShapes(categoryShapes),
            categoryStyles: normalizeCategoryPinStyles(categoryStyles),
        });
    }

    return (
        <div className="fixed inset-0 z-[1450] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="my-map-category-order-title"
                className="flex max-h-[min(90vh,860px)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                            {t('arrangeCategories')}
                        </p>
                        <h2 id="my-map-category-order-title" className="mt-2 text-2xl font-bold text-slate-900">
                            {t('refineCategorySequence')}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {t('refineCategorySequenceHelp')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" aria-busy={submitting}>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        {error ? (
                            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                                {error}
                            </p>
                        ) : null}

                        <div className="space-y-2">
                            {orderedCategories.map((category, index) => (
                                <div key={category.key} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                                    <div className="flex min-h-11 items-center gap-3">
                                        <span
                                            aria-hidden="true"
                                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white shadow-sm"
                                            style={{ backgroundColor: category.color || '#E2E8F0' }}
                                        >
                                            {category.iconUrl ? (
                                                <img src={category.iconUrl} alt="" className="h-full w-full object-contain" />
                                            ) : (
                                                <Layers3 size={18} className="text-slate-700" />
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                                            {category.label}
                                        </span>
                                        <span className="text-xs font-semibold tabular-nums text-slate-400" aria-hidden="true">
                                            {index + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => moveCategory(index, index - 1)}
                                                disabled={submitting || index === 0}
                                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-35"
                                                aria-label={t('moveCategoryEarlier', { name: category.label })}
                                            >
                                                <ArrowUp size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => moveCategory(index, index + 1)}
                                                disabled={submitting || index === orderedCategories.length - 1}
                                                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-35"
                                                aria-label={t('moveCategoryLater', { name: category.label })}
                                            >
                                                <ArrowDown size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <fieldset className="mt-3 border-t border-slate-100 pt-3">
                                        <legend className="text-xs font-bold text-slate-600">
                                            {t('categoryNumberedPinShape')}
                                        </legend>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            {t('categoryNumberedPinShapeHelp')}
                                        </p>
                                        <div className="mt-2 grid grid-cols-5 gap-2">
                                            {CATEGORY_PIN_SHAPE_OPTIONS.map((shape) => {
                                                const selected = getCategoryPinShape(categoryShapes, category.key) === shape;
                                                const shapeLabel = t(`categoryPinShape${shape.charAt(0).toUpperCase()}${shape.slice(1)}`);
                                                return (
                                                    <label
                                                        key={shape}
                                                        title={shapeLabel}
                                                        className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 transition focus-within:outline-none focus-within:ring-4 focus-within:ring-brand-100 ${
                                                            selected
                                                                ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200'
                                                                : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/50'
                                                        } ${submitting ? 'cursor-not-allowed opacity-50' : ''}`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`category-pin-shape-${category.key}`}
                                                            value={shape}
                                                            checked={selected}
                                                            disabled={submitting}
                                                            onChange={() => selectCategoryShape(category.key, shape)}
                                                            aria-label={t('categoryPinShapeForCategory', {
                                                                shape: shapeLabel,
                                                                category: category.label,
                                                            })}
                                                            className="sr-only"
                                                        />
                                                        <CategoryPinShapeBadge
                                                            shape={shape}
                                                            color={category.color || '#0f766e'}
                                                            selected={selected}
                                                            compact
                                                        />
                                                        <span className="sr-only">{shapeLabel}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </fieldset>

                                    <fieldset className="mt-3 border-t border-slate-100 pt-3">
                                        <legend className="text-xs font-bold text-slate-600">
                                            {t('categoryNumberedPinColours')}
                                        </legend>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            {t('categoryNumberedPinColoursHelp')}
                                        </p>
                                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                            <label className="text-xs font-bold text-slate-600">
                                                <span className="mb-1 block">{t('categoryPinFillColour')}</span>
                                                <input
                                                    type="color"
                                                    value={getCategoryPinStyle(categoryStyles, category.key, category.color).fillColor}
                                                    onChange={(event) => updateCategoryColor(category, 'fillColor', event.target.value)}
                                                    disabled={submitting}
                                                    className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed"
                                                    aria-label={t('categoryPinFillColourForCategory', { category: category.label })}
                                                />
                                            </label>
                                            <label className="text-xs font-bold text-slate-600">
                                                <span className="mb-1 block">{t('categoryPinRingColour')}</span>
                                                <input
                                                    type="color"
                                                    value={getCategoryPinStyle(categoryStyles, category.key, category.color).ringColor}
                                                    onChange={(event) => updateCategoryColor(category, 'ringColor', event.target.value)}
                                                    disabled={submitting}
                                                    className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed"
                                                    aria-label={t('categoryPinRingColourForCategory', { category: category.label })}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => resetCategoryColors(category)}
                                                disabled={submitting}
                                                className="btn-ghost h-11 justify-center border border-slate-200 px-3 text-xs text-slate-700"
                                            >
                                                {t('categoryPinUseDefaultColours')}
                                            </button>
                                        </div>
                                    </fieldset>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <button
                            type="button"
                            onClick={resetOrder}
                            disabled={submitting}
                            className="btn-ghost h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700"
                        >
                            <RotateCcw size={16} />
                            {t('resetCategoryOrder')}
                        </button>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="btn-ghost h-11 flex-1 justify-center border border-slate-200 px-4 text-sm text-slate-700 sm:flex-none"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || orderedCategories.length < 1}
                                className="btn-primary h-11 flex-1 justify-center px-5 text-sm sm:flex-none"
                            >
                                {submitting ? <LoaderCircle size={17} className="animate-spin" /> : null}
                                {submitting ? t('saving') : t('applyCategoryRefinements')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
