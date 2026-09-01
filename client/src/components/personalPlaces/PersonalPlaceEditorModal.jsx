import { useEffect, useMemo, useRef, useState } from 'react';
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

function getPersonalPlaceDraftKey(open, draft) {
    if (!open) return '';
    if (draft?.id) return `place:${draft.id}`;
    return `new:${formatCoordinate(draft?.lat)}:${formatCoordinate(draft?.lng)}`;
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
        locationMode: 'addressed',
        lat: '',
        lng: '',
    });
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [locationVerified, setLocationVerified] = useState(false);
    const initializedDraftKeyRef = useRef('');
    const draftKey = getPersonalPlaceDraftKey(open, draft);

    useEffect(() => {
        if (!open) {
            initializedDraftKeyRef.current = '';
            return;
        }
        if (initializedDraftKeyRef.current === draftKey) return;
        initializedDraftKeyRef.current = draftKey;
        const fallbackCategory = activeCategories.find(
            (category) => category.name === draft?.categoryLabel
        );
        const hasAddressedLocation = Boolean(
            String(draft?.address || '').trim()
            || String(draft?.postalCode || '').trim()
        );
        const locationMode = draft?.id && !hasAddressedLocation ? 'map_only' : 'addressed';
        setForm({
            name: draft?.name || '',
            logoUrl: draft?.logoUrl || '',
            categoryId: String(draft?.categoryId || draft?.category?.id || fallbackCategory?.id || activeCategories[0]?.id || ''),
            address: draft?.address || '',
            postalCode: draft?.postalCode || '',
            locationMode,
            lat: formatCoordinate(draft?.lat),
            lng: formatCoordinate(draft?.lng),
        });
        setLocationVerified(Boolean(draft?.id));
        setLookupQuery(draft?.postalCode || draft?.address || '');
        setLookupError('');
    }, [activeCategories, draft, draftKey, open]);

    useEffect(() => {
        if (!open || form.categoryId || activeCategories.length === 0) return;
        const fallbackCategory = activeCategories.find(
            (category) => category.name === draft?.categoryLabel
        );
        const nextCategoryId = String(draft?.categoryId || draft?.category?.id || fallbackCategory?.id || activeCategories[0]?.id || '');
        if (!nextCategoryId) return;
        setForm((current) => (
            current.categoryId ? current : { ...current, categoryId: nextCategoryId }
        ));
    }, [activeCategories, draft?.category?.id, draft?.categoryId, draft?.categoryLabel, form.categoryId, open]);

    if (!open) return null;

    const isEditing = Boolean(draft?.id);
    const selectedCategory = activeCategories.find(
        (category) => String(category.id) === String(form.categoryId)
    ) || null;
    const parsedLat = Number.parseFloat(form.lat);
    const parsedLng = Number.parseFloat(form.lng);
    const addressedLocationReady = form.locationMode === 'addressed'
        && locationVerified
        && /^\d{6}$/.test(form.postalCode.trim())
        && Boolean(form.address.trim());
    const canSubmit = Boolean(form.name.trim())
        && Number.isFinite(parsedLat)
        && Number.isFinite(parsedLng)
        && (form.locationMode === 'map_only' || addressedLocationReady)
        && !submitting;

    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
            ...(['address', 'postalCode'].includes(field) ? { locationMode: 'addressed' } : {}),
        }));
        if (['address', 'postalCode', 'lat', 'lng'].includes(field) && form.locationMode === 'addressed') {
            setLocationVerified(false);
        }
    }

    function handleLocationModeChange(mapOnly) {
        setForm((current) => ({
            ...current,
            locationMode: mapOnly ? 'map_only' : 'addressed',
            address: mapOnly ? '' : current.address,
            postalCode: mapOnly ? '' : current.postalCode,
        }));
        setLookupQuery('');
        setLookupError('');
        setLocationVerified(mapOnly);
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
                setLocationVerified(false);
                return;
            }
            const nextAddress = result.address || form.address;
            const nextPostalCode = result.postalCode || extractPostalCode(nextAddress);
            const requestedPostalCode = /^\d{6}$/.test(query) ? query : '';
            if (
                !nextAddress
                || !/^\d{6}$/.test(nextPostalCode)
                || (requestedPostalCode && requestedPostalCode !== nextPostalCode)
            ) {
                setLookupError(t('personalPlaceLookupFailed'));
                setLocationVerified(false);
                return;
            }
            setForm((current) => ({
                ...current,
                locationMode: 'addressed',
                address: nextAddress,
                postalCode: nextPostalCode,
                lat: formatCoordinate(result.lat),
                lng: formatCoordinate(result.lng),
                name: current.name || result.name || '',
            }));
            setLookupQuery(nextPostalCode);
            setLocationVerified(true);
        } catch (lookupFailure) {
            console.error(lookupFailure);
            setLookupError(t('personalPlaceLookupFailed'));
            setLocationVerified(false);
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
            locationMode: form.locationMode,
            lat: parsedLat,
            lng: parsedLng,
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
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <input
                                type="checkbox"
                                checked={form.locationMode === 'map_only'}
                                onChange={(event) => handleLocationModeChange(event.target.checked)}
                                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                            />
                            <span>
                                <span className="block text-sm font-bold text-slate-800">{t('personalPlaceMapOnly')}</span>
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{t('personalPlaceMapOnlyHelp')}</span>
                            </span>
                        </label>

                        {form.locationMode === 'addressed' ? (
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
                            {locationVerified ? (
                                <p className="mt-2 text-xs font-semibold text-emerald-700">{t('personalPlaceLocationVerified')}</p>
                            ) : (
                                <p className="mt-2 text-xs font-semibold text-amber-700">{t('personalPlaceLocationVerificationRequired')}</p>
                            )}
                            </div>
                        ) : null}

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

                            {form.locationMode === 'addressed' ? (
                                <>
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
                                </>
                            ) : null}

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
