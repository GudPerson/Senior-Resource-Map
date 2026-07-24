import { useEffect, useMemo, useState } from 'react';
import { MapPin, Search, Settings2, X } from 'lucide-react';

import ImageUpload from '../ImageUpload.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { api } from '../../lib/api.js';
import { searchOneMap } from '../../lib/geo.js';
import { PersonalPlaceCategoryIcon } from '../../lib/personalPlaceCategories.jsx';

function formatCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(7) : '';
}

function extractPostalCode(value) {
    return String(value || '').match(/\b(\d{6})\b/)?.[1] || '';
}

export default function PersonalPlaceEditorModal({
    open,
    draft,
    categories = [],
    submitting = false,
    error = '',
    onClose,
    onManageCategories,
    onSubmit,
}) {
    const { t } = useLocale();
    const activeCategories = useMemo(
        () => categories.filter((category) => !category.isArchived),
        [categories]
    );
    const [form, setForm] = useState({
        name: '',
        logoUrl: '',
        categoryId: '',
        address: '',
        postalCode: '',
        lat: '',
        lng: '',
        shortDescription: '',
    });
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupError, setLookupError] = useState('');

    useEffect(() => {
        if (!open) return;
        const fallbackCategory = activeCategories.find(
            (category) => category.name === draft?.categoryLabel
        );
        setForm({
            name: draft?.name || '',
            logoUrl: draft?.logoUrl || '',
            categoryId: String(draft?.categoryId || draft?.category?.id || fallbackCategory?.id || activeCategories[0]?.id || ''),
            address: draft?.address || '',
            postalCode: draft?.postalCode || '',
            lat: formatCoordinate(draft?.lat),
            lng: formatCoordinate(draft?.lng),
            shortDescription: draft?.shortDescription || draft?.note || '',
        });
        setLookupQuery(draft?.postalCode || draft?.address || '');
        setLookupError('');
    }, [activeCategories, draft, open]);

    if (!open) return null;

    const isEditing = Boolean(draft?.id);
    const selectedCategory = activeCategories.find(
        (category) => String(category.id) === String(form.categoryId)
    ) || null;
    const parsedLat = Number.parseFloat(form.lat);
    const parsedLng = Number.parseFloat(form.lng);
    const canSubmit = Boolean(form.name.trim())
        && Number.isFinite(parsedLat)
        && Number.isFinite(parsedLng)
        && !submitting;

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function handleLookup() {
        const query = String(lookupQuery || form.postalCode || form.address || '').trim();
        if (!query) return;
        setLookupBusy(true);
        setLookupError('');
        try {
            const result = await searchOneMap(query);
            if (!result) {
                setLookupError(t('personalPlaceLookupFailed'));
                return;
            }
            const nextAddress = result.address || form.address;
            setForm((current) => ({
                ...current,
                address: nextAddress,
                postalCode: result.postalCode || extractPostalCode(nextAddress) || current.postalCode,
                lat: formatCoordinate(result.lat),
                lng: formatCoordinate(result.lng),
                name: current.name || result.name || '',
            }));
        } catch (lookupFailure) {
            console.error(lookupFailure);
            setLookupError(t('personalPlaceLookupFailed'));
        } finally {
            setLookupBusy(false);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit?.({
            id: draft?.id || null,
            name: form.name.trim(),
            logoUrl: form.logoUrl.trim(),
            categoryId: selectedCategory?.id || null,
            categoryLabel: selectedCategory?.name || draft?.categoryLabel || '',
            address: form.address.trim(),
            postalCode: form.postalCode.trim(),
            lat: parsedLat,
            lng: parsedLng,
            shortDescription: form.shortDescription.trim(),
        });
    }

    return (
        <div
            className="fixed inset-0 z-[1400] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
            role="presentation"
            onClick={() => {
                if (!submitting) onClose?.();
            }}
        >
            <section
                className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]"
                role="dialog"
                aria-modal="true"
                aria-label={isEditing ? t('editPersonalPlace') : t('addPersonalPlace')}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <MapPin size={19} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-black leading-tight text-slate-900">
                            {isEditing ? t('editPersonalPlace') : t('addPersonalPlace')}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{t('personalPlacePrivateHelp')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-wait disabled:opacity-60"
                        aria-label={t('close')}
                    >
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <label htmlFor="personal-place-lookup" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                {t('personalPlaceLookupLabel')}
                            </label>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                    id="personal-place-lookup"
                                    type="text"
                                    value={lookupQuery}
                                    onChange={(event) => setLookupQuery(event.target.value)}
                                    placeholder={t('personalPlaceLookupPlaceholder')}
                                    className="input-field min-h-11 flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={handleLookup}
                                    disabled={lookupBusy}
                                    className="btn-ghost min-h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:cursor-wait disabled:opacity-60"
                                >
                                    <Search size={16} />
                                    {lookupBusy ? t('loadingPage') : t('findLocation')}
                                </button>
                            </div>
                            {lookupError ? <p className="mt-2 text-xs font-semibold text-red-600">{lookupError}</p> : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceName')}</span>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(event) => updateField('name', event.target.value)}
                                    maxLength={160}
                                    required
                                    className="input-field min-h-11"
                                    placeholder={t('personalPlaceNamePlaceholder')}
                                />
                            </label>

                            <div className="space-y-1.5 sm:col-span-2">
                                <ImageUpload
                                    label={t('personalPlaceImage')}
                                    value={form.logoUrl}
                                    onChange={(value) => updateField('logoUrl', value)}
                                    uploadFile={api.uploadPersonalPlaceImage}
                                    accept={{
                                        'image/jpeg': ['.jpg', '.jpeg'],
                                        'image/png': ['.png'],
                                        'image/webp': ['.webp'],
                                    }}
                                    maxSize={5 * 1024 * 1024}
                                />
                                <p className="text-xs leading-5 text-slate-500">{t('personalPlaceImageHelp')}</p>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceCategory')}</span>
                                <div className="flex gap-2">
                                    <div className="relative min-w-0 flex-1">
                                        {selectedCategory ? (
                                            <span
                                                className="pointer-events-none absolute left-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-white"
                                                style={{ backgroundColor: selectedCategory.color }}
                                            >
                                                <PersonalPlaceCategoryIcon
                                                    iconKey={selectedCategory.iconKey}
                                                    iconUrl={selectedCategory.iconUrl}
                                                    size={15}
                                                />
                                            </span>
                                        ) : null}
                                        <select
                                            value={form.categoryId}
                                            onChange={(event) => updateField('categoryId', event.target.value)}
                                            className={`input-field min-h-11 w-full appearance-none pr-8 ${selectedCategory ? 'pl-12' : ''}`}
                                        >
                                            <option value="">{t('personalPlaceCategoryPlaceholder')}</option>
                                            {activeCategories.map((category) => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onManageCategories}
                                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                                        aria-label="Manage personal place categories"
                                        title="Manage personal place categories"
                                    >
                                        <Settings2 size={17} />
                                    </button>
                                </div>
                            </div>

                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlacePostalCode')}</span>
                                <input
                                    type="text"
                                    value={form.postalCode}
                                    onChange={(event) => updateField('postalCode', event.target.value)}
                                    maxLength={20}
                                    inputMode="numeric"
                                    className="input-field min-h-11"
                                    placeholder="680153"
                                />
                            </label>

                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceAddress')}</span>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(event) => updateField('address', event.target.value)}
                                    maxLength={500}
                                    className="input-field min-h-11"
                                    placeholder={t('personalPlaceAddressPlaceholder')}
                                />
                            </label>

                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('latitude')}</span>
                                <input
                                    type="number"
                                    step="0.0000001"
                                    value={form.lat}
                                    onChange={(event) => updateField('lat', event.target.value)}
                                    required
                                    className="input-field min-h-11"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('longitude')}</span>
                                <input
                                    type="number"
                                    step="0.0000001"
                                    value={form.lng}
                                    onChange={(event) => updateField('lng', event.target.value)}
                                    required
                                    className="input-field min-h-11"
                                />
                            </label>

                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceShortDescription')}</span>
                                <textarea
                                    value={form.shortDescription}
                                    onChange={(event) => updateField('shortDescription', event.target.value)}
                                    maxLength={240}
                                    rows={2}
                                    className="input-field min-h-[76px] resize-y"
                                    placeholder={t('personalPlaceShortDescriptionPlaceholder')}
                                />
                            </label>
                        </div>

                        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="btn-ghost min-h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:cursor-wait disabled:opacity-60"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary min-h-11 justify-center px-4 text-sm disabled:cursor-wait disabled:opacity-60"
                            >
                                {submitting ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </form>
            </section>
        </div>
    );
}
