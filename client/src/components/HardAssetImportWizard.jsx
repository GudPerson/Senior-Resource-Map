import {
    AlertTriangle,
    ArrowLeft,
    Link2,
    Loader2,
    MapPin,
    MapPinned,
    Search,
    Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { api } from '../lib/api.js';
import AssetForm from './AssetForm.jsx';

function buildImportedHardAssetDraft(preview) {
    const suggestion = preview?.suggestion || {};
    const resolvedSource = preview?.resolvedSource || {};
    const importedTags = [
        ...new Set(
            [
                ...(Array.isArray(suggestion.suggestedTags) ? suggestion.suggestedTags : []),
                ...(Array.isArray(preview?.candidateSuggestedTags) ? preview.candidateSuggestedTags : []),
            ]
                .map((tag) => String(tag || '').trim())
                .filter(Boolean)
        ),
    ];

    return {
        externalKey: '',
        name: suggestion.name || '',
        country: suggestion.country || 'SG',
        postalCode: suggestion.postalCode || '',
        address: suggestion.address || '',
        phone: suggestion.phone || '',
        hours: suggestion.hours || '',
        website: suggestion.website || '',
        description: suggestion.description || '',
        logoUrl: suggestion.logoUrl || '',
        bannerUrl: '',
        galleryUrls: [],
        subCategory: suggestion.subCategorySuggestion || 'Places',
        sourceGooglePlaceId: resolvedSource.googlePlaceId || '',
        sourceGoogleMapsUri: resolvedSource.googleMapsUri || '',
        ownershipMode: 'system',
        partnerId: '',
        newTags: importedTags,
        isHidden: false,
        hideFrom: '',
        hideUntil: '',
    };
}

function buildAddressOnlyPreview(postalResults) {
    const resolvedPostal = postalResults?.resolvedPostal || {};
    return {
        resolvedSource: null,
        suggestion: {
            name: '',
            country: 'SG',
            postalCode: resolvedPostal.postalCode || '',
            address: resolvedPostal.address || '',
            phone: '',
            hours: '',
            description: '',
            website: '',
            logoUrl: '',
            subCategorySuggestion: 'Places',
            suggestedTags: [],
        },
        duplicateMatches: [],
        warnings: [
            'Only the address and postal code were resolved. Fill in the organization name and any remaining place details before saving.',
        ],
    };
}

function formatExistingMatchReason(matchReason) {
    if (matchReason === 'same_place_id') return 'This Google place already exists in CareAround SG.';
    if (matchReason === 'same_name_postal') return 'A place with the same name and postal code already exists.';
    if (matchReason === 'same_phone_postal') return 'A place with the same phone number and postal code already exists.';
    return 'This candidate already exists in CareAround SG.';
}

function ModeCard({ active, icon: Icon, title, description, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-3xl border p-5 text-left transition ${
                active
                    ? 'border-brand-200 bg-brand-50/70 shadow-sm shadow-brand-100/60'
                    : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40'
            }`}
        >
            <div className={`w-fit rounded-2xl p-3 ${active ? 'bg-white text-brand-700 shadow-sm shadow-brand-100' : 'bg-slate-100 text-slate-700'}`}>
                <Icon size={20} />
            </div>
            <p className="mt-4 text-lg font-black text-slate-900">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </button>
    );
}

function CandidateRow({ candidate, loading, onSelect, onEditExisting }) {
    const existingMatch = candidate.existingMatch || null;

    return (
        <div className={`rounded-2xl border p-4 shadow-sm shadow-slate-100/70 ${existingMatch ? 'border-slate-200 bg-slate-50/90 opacity-80' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-slate-900">{candidate.name}</p>
                        {existingMatch ? (
                            <span className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                Already exists
                            </span>
                        ) : null}
                        {candidate.subCategorySuggestion ? (
                            <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                                {candidate.subCategorySuggestion}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.address}</p>
                    {existingMatch ? (
                        <p className="mt-2 text-sm font-medium text-slate-500">
                            {formatExistingMatchReason(existingMatch.matchReason)}
                        </p>
                    ) : null}
                    {candidate.matchedKeywords?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {candidate.matchedKeywords.map((keyword) => (
                                <span
                                    key={keyword}
                                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500"
                                >
                                    {keyword}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
                {existingMatch && onEditExisting ? (
                    <button
                        type="button"
                        onClick={() => onEditExisting(existingMatch.id)}
                        className="btn-secondary min-w-[164px] justify-center"
                    >
                        Edit existing asset
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onSelect(candidate)}
                        disabled={loading}
                        className="btn-primary min-w-[148px] justify-center disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {loading ? 'Loading…' : 'Use this place'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function HardAssetImportWizard({
    currentUser,
    partnerHardAssets,
    partnerOptions,
    subregions,
    onCancel,
    onSave,
    onEditExisting,
}) {
    const [mode, setMode] = useState('share');
    const [shareUrl, setShareUrl] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [keywordQuery, setKeywordQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [previewLoadingKey, setPreviewLoadingKey] = useState('');
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(null);
    const [postalResults, setPostalResults] = useState(null);
    const [selectedCandidateTags, setSelectedCandidateTags] = useState([]);

    const importDraft = useMemo(
        () => buildImportedHardAssetDraft(preview ? { ...preview, candidateSuggestedTags: selectedCandidateTags } : null),
        [preview, selectedCandidateTags]
    );

    function resetPreviewState() {
        setPreview(null);
        setSelectedCandidateTags([]);
        setError('');
    }

    function handleSwitchMode(nextMode) {
        setMode(nextMode);
        setError('');
        setPostalResults(null);
        setPreviewLoadingKey('');
        setSelectedCandidateTags([]);
    }

    async function handlePreviewFromShareLink(event) {
        event.preventDefault();
        setPreviewLoadingKey('share');
        setError('');
        setSelectedCandidateTags([]);

        try {
            const data = await api.previewGoogleHardAssetImport({ shareUrl });
            setPreview(data);
        } catch (err) {
            setError(err.message || 'Failed to preview Google place import.');
        } finally {
            setPreviewLoadingKey('');
        }
    }

    async function handlePostalCandidateSearch(event) {
        event.preventDefault();
        setSearchLoading(true);
        setError('');
        setPostalResults(null);

        try {
            const data = await api.searchGoogleHardAssetCandidatesByPostal({
                postalCode,
                keywordQuery,
            });
            setPostalResults(data);
        } catch (err) {
            setError(err.message || 'Failed to search Google places for that postal code.');
        } finally {
            setSearchLoading(false);
        }
    }

    async function handlePreviewFromCandidate(candidate) {
        const loadingKey = candidate.googlePlaceId || 'candidate';
        setPreviewLoadingKey(loadingKey);
        setError('');
        setSelectedCandidateTags(Array.isArray(candidate.suggestedTags) && candidate.suggestedTags.length
            ? candidate.suggestedTags
            : (candidate.matchedKeywords || []));

        try {
            const data = await api.previewGoogleHardAssetImport({
                googlePlaceId: candidate.googlePlaceId,
                googleMapsUri: candidate.googleMapsUri,
            });
            setPreview(data);
        } catch (err) {
            setError(err.message || 'Failed to preview the selected Google place.');
        } finally {
            setPreviewLoadingKey('');
        }
    }

    function handleUseAddressOnly() {
        if (!postalResults?.resolvedPostal) return;
        setSelectedCandidateTags([]);
        setPreview(buildAddressOnlyPreview(postalResults));
        setError('');
    }

    const exactCandidates = postalResults?.exactCandidates || [];
    const nearbyCandidates = postalResults?.nearbyCandidates || [];
    const hasAnyCandidates = exactCandidates.length > 0 || nearbyCandidates.length > 0;

    return preview ? (
        <div className="space-y-5">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Imported suggestions</p>
                        <p className="mt-1 text-sm text-slate-700">
                            Review everything before saving. The place owner remains responsible for the final accuracy.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={resetPreviewState}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                    >
                        <ArrowLeft size={14} />
                        Back to import options
                    </button>
                </div>
            </div>

            <AssetForm
                type="hard"
                initialData={importDraft}
                partnerHardAssets={partnerHardAssets}
                currentUser={currentUser}
                partnerOptions={partnerOptions}
                subregions={subregions}
                importSource={preview?.resolvedSource || null}
                importWarnings={preview?.warnings || []}
                duplicateMatches={preview?.duplicateMatches || []}
                onSelectDuplicateMatch={onEditExisting}
                onSave={onSave}
                onCancel={onCancel}
            />
        </div>
    ) : (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
                <ModeCard
                    active={mode === 'share'}
                    icon={Link2}
                    title="Google Maps share link"
                    description="Paste a Google Maps share link and we’ll resolve one place, then prefill the normal hard-asset form."
                    onClick={() => handleSwitchMode('share')}
                />
                <ModeCard
                    active={mode === 'postal'}
                    icon={Search}
                    title="Search by postal code"
                    description="Enter a 6-digit Singapore postal code, review exact matches at that location, then compare nearby relevant places if you need more options."
                    onClick={() => handleSwitchMode('postal')}
                />
            </div>

            {mode === 'share' ? (
                <form onSubmit={handlePreviewFromShareLink} className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl bg-white p-3 text-brand-600 shadow-sm shadow-slate-200/70">
                                <MapPinned size={18} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Import from Google Maps</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    Paste a Google Maps share link and we’ll prefill the place with suggested details, including contact info, hours, website, and any confident branding metadata we can find.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="google-place-share-url" className="mb-1 block text-sm font-semibold text-slate-700">
                            Google Maps share link
                        </label>
                        <textarea
                            id="google-place-share-url"
                            rows={3}
                            value={shareUrl}
                            onChange={(event) => setShareUrl(event.target.value)}
                            placeholder="https://maps.app.goo.gl/..."
                            className="input-field resize-none"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            V1 supports Google Maps share links only. The review form will still let you correct anything before saving.
                        </p>
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <div className="flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <p>
                                We’ll use Google place data for structured fields, then try the linked website for description and logo suggestions. Missing or low-confidence fields stay editable.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2">
                        <button type="button" onClick={onCancel} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={previewLoadingKey === 'share' || !shareUrl.trim()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                            {previewLoadingKey === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            {previewLoadingKey === 'share' ? 'Fetching Google place…' : 'Preview import'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl bg-white p-3 text-brand-600 shadow-sm shadow-slate-200/70">
                                <Search size={18} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Search Google places by postal code</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    Enter a 6-digit Singapore postal code, review exact place matches first, then use nearby relevant places when you want more options around that address.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handlePostalCandidateSearch} className="space-y-4">
                        <div>
                            <label htmlFor="google-place-postal-code" className="mb-1 block text-sm font-semibold text-slate-700">
                                Singapore postal code
                            </label>
                            <input
                                id="google-place-postal-code"
                                inputMode="numeric"
                                maxLength={6}
                                value={postalCode}
                                onChange={(event) => {
                                    setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                                    setPostalResults(null);
                                    setError('');
                                }}
                                placeholder="681811"
                                className="input-field"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                We’ll resolve the postcode, show places found at that exact postal code, and also surface nearby relevant Google places when available.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="google-place-keyword-query" className="mb-1 block text-sm font-semibold text-slate-700">
                                Refine nearby recommendations
                            </label>
                            <input
                                id="google-place-keyword-query"
                                value={keywordQuery}
                                onChange={(event) => {
                                    setKeywordQuery(event.target.value);
                                    setPostalResults(null);
                                    setError('');
                                }}
                                placeholder="Optional, e.g. dementia, rehab, dialysis"
                                className="input-field"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Optional. Exact same-postal matches still appear first, while nearby recommendations are ranked using these keywords.
                            </p>
                        </div>

                        {error ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        ) : null}

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2">
                            <button type="button" onClick={onCancel} className="btn-secondary">
                                Cancel
                            </button>
                            <button type="submit" disabled={searchLoading || postalCode.trim().length !== 6} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                                {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                {searchLoading ? 'Searching…' : 'Find Google places'}
                            </button>
                        </div>
                    </form>

                    {postalResults ? (
                        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-5 py-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Resolved postal anchor</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">{postalResults.resolvedPostal?.postalCode || postalCode}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{postalResults.resolvedPostal?.address || 'Google resolved the postcode, but no formatted address was returned.'}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleUseAddressOnly}
                                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                    >
                                        <MapPin size={15} />
                                        Use address only
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPostalResults(null);
                                            setError('');
                                        }}
                                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        <ArrowLeft size={14} />
                                        Search again
                                    </button>
                                </div>
                            </div>

                            {(postalResults.warnings || []).length ? (
                                <div className="space-y-2">
                                    {postalResults.warnings.map((warning) => (
                                        <div key={warning} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                                <p>{warning}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {hasAnyCandidates ? (
                                <div className="space-y-3">
                                    {exactCandidates.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={15} className="text-brand-600" />
                                                <p className="text-sm font-semibold text-slate-700">
                                                    Places at this postal code
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                {exactCandidates.map((candidate) => (
                                                    <CandidateRow
                                                        key={candidate.googlePlaceId}
                                                        candidate={candidate}
                                                        loading={previewLoadingKey === candidate.googlePlaceId}
                                                        onSelect={handlePreviewFromCandidate}
                                                        onEditExisting={onEditExisting}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {nearbyCandidates.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Search size={15} className="text-brand-600" />
                                                <p className="text-sm font-semibold text-slate-700">
                                                    Nearby relevant places
                                                </p>
                                            </div>
                                            <p className="text-sm leading-6 text-slate-500">
                                                Useful when the exact postal code has no matching Google place, or when you want to compare nearby venues around the same anchor.
                                            </p>
                                            <div className="space-y-3">
                                                {nearbyCandidates.map((candidate) => (
                                                    <CandidateRow
                                                        key={candidate.googlePlaceId}
                                                        candidate={candidate}
                                                        loading={previewLoadingKey === candidate.googlePlaceId}
                                                        onSelect={handlePreviewFromCandidate}
                                                        onEditExisting={onEditExisting}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center">
                                    <p className="text-base font-semibold text-slate-800">No strong Google place candidates found</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Try a Google Maps share link instead, or switch back to manual entry if this place is not well represented on Google.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">What happens next</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">1. Resolve one place</p>
                        <p className="mt-1 text-sm text-slate-600">Paste a Google Maps share link or search by postal code to identify the right place.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">2. Suggest the fields</p>
                        <p className="mt-1 text-sm text-slate-600">Address, phone, hours, website, and any confident metadata are prefilled.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">3. Review and save</p>
                        <p className="mt-1 text-sm text-slate-600">You stay in control and can edit anything before the new place is saved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
