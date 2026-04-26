import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ExternalLink,
    Globe,
    Loader2,
    MapPin,
    Plus,
    Search,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

import { api } from '../lib/api.js';
import { collectSubregionPostalCodes } from '../lib/postalBoundaries.js';
import AssetForm from './AssetForm.jsx';

function dedupeTags(values) {
    return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function buildImportedHardAssetDraft(preview) {
    const suggestion = preview?.suggestion || {};
    const resolvedSource = preview?.resolvedSource || {};
    const importedTags = dedupeTags([
        ...(Array.isArray(suggestion.suggestedTags) ? suggestion.suggestedTags : []),
        ...(Array.isArray(preview?.candidateSuggestedTags) ? preview.candidateSuggestedTags : []),
        ...(Array.isArray(preview?.aiServices) ? preview.aiServices : []),
    ]);

    return {
        externalKey: '',
        name: suggestion.name || '',
        country: suggestion.country || 'SG',
        postalCode: suggestion.postalCode || '',
        address: suggestion.address || '',
        phone: suggestion.phone || '',
        hours: suggestion.hours || '',
        website: suggestion.website || '',
        // Use AI-generated description/logo as fallback when Places preview has none
        description: suggestion.description || preview?.aiDescription || '',
        logoUrl: suggestion.logoUrl || preview?.aiLogoUrl || '',
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

function createCandidateDraft(candidate) {
    const candidateSource = candidate?.candidateSource === 'web_fallback' ? 'web_fallback' : 'google_places';
    const sourceType = candidateSource === 'web_fallback' ? 'web-fallback' : 'google-place';
    const draftSeed = candidateSource === 'web_fallback' && candidate?.draftSeed
        ? {
            ...candidate.draftSeed,
            newTags: dedupeTags(candidate.draftSeed.newTags),
        }
        : null;
    const previewData = candidateSource === 'web_fallback'
        ? {
            resolvedSource: null,
            duplicateMatches: [],
            warnings: [
                'This draft came from web-grounded fallback suggestions. Review the details carefully before saving.',
            ],
            suggestion: {
                suggestedTags: draftSeed?.newTags || [],
            },
        }
        : null;

    // Effective confidence: for Google Places candidates, prefer the AI grounding score
    const rawConfidence = candidate?.groundingConfidence ?? candidate?.confidence;
    const confidence = Number.isFinite(Number(rawConfidence)) ? Number(rawConfidence) : null;

    return {
        id: `${sourceType}:${candidate.googlePlaceId || candidate.sourceUrl || candidate.name || candidate.address}`,
        sourceType,
        googlePlaceId: candidate.googlePlaceId || '',
        googleMapsUri: candidate.googleMapsUri || '',
        displayName: candidate.name || '',
        displayAddress: candidate.address || '',
        displayPostalCode: candidate.postalCode || '',
        subCategorySuggestion: candidate.subCategorySuggestion || '',
        candidateSource,
        candidateSuggestedTags: dedupeTags([
            ...(Array.isArray(candidate.suggestedTags) ? candidate.suggestedTags : []),
            ...(Array.isArray(candidate.matchedKeywords) ? candidate.matchedKeywords : []),
        ]),
        sourceUrl: candidate.sourceUrl || '',
        sourceTitle: candidate.sourceTitle || '',
        sourceSnippet: candidate.sourceSnippet || '',
        confidence,
        // AI enrichment fields carried into the queue object
        aiDescription: candidate.aiDescription || '',
        aiLogoUrl: candidate.aiLogoUrl || '',
        aiServices: Array.isArray(candidate.aiServices) ? candidate.aiServices : [],
        groundingSourceUrl: candidate.groundingSourceUrl || '',
        groundingSourceTitle: candidate.groundingSourceTitle || '',
        groundingConfidence: candidate.groundingConfidence ?? null,
        previewData,
        formDraft: draftSeed,
        loadStatus: candidateSource === 'web_fallback' ? 'ready' : 'not-loaded',
        savedAssetId: null,
        error: '',
    };
}

function createAddressOnlyDraft(postalResults) {
    const resolvedPostal = postalResults?.resolvedPostal || {};
    const preview = buildAddressOnlyPreview(postalResults);

    return {
        id: `address-only:${resolvedPostal.postalCode || resolvedPostal.address || 'draft'}`,
        sourceType: 'address-only',
        googlePlaceId: '',
        googleMapsUri: '',
        displayName: 'Address-only draft',
        displayAddress: resolvedPostal.address || '',
        displayPostalCode: resolvedPostal.postalCode || '',
        subCategorySuggestion: 'Places',
        candidateSuggestedTags: [],
        previewData: preview,
        formDraft: buildImportedHardAssetDraft(preview),
        loadStatus: 'ready',
        savedAssetId: null,
        error: '',
    };
}

function formatExistingMatchReason(matchReason) {
    if (matchReason === 'same_place_id') return 'This Google place already exists in CareAround SG.';
    if (matchReason === 'same_name_postal') return 'A place with the same name and postal code already exists.';
    if (matchReason === 'same_phone_postal') return 'A place with the same phone number and postal code already exists.';
    return 'This candidate already exists in CareAround SG.';
}

function formatRadiusLabel(value) {
    if (String(value) === 'all') return 'All of SG';
    return `${value} km`;
}

function formatConfidenceLabel(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return `${Math.round(numeric * 100)}% confidence`;
}

function formatCandidateDistance(candidate, anchorPostalCode) {
    if (candidate?.postalCode && candidate.postalCode === anchorPostalCode) {
        return 'At this postal code';
    }

    const distanceMeters = Number(candidate?.distanceMeters);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '';
    if (distanceMeters < 1000) {
        return `${Math.round(distanceMeters / 10) * 10} m away`;
    }
    if (distanceMeters < 10000) {
        return `${(distanceMeters / 1000).toFixed(1)} km away`;
    }
    return `${Math.round(distanceMeters / 1000)} km away`;
}

function getDraftDisplayName(draft) {
    const explicitName = String(draft?.formDraft?.name || '').trim();
    if (explicitName) return explicitName;
    const fallbackName = String(draft?.displayName || '').trim();
    if (fallbackName) return fallbackName;
    return draft?.sourceType === 'address-only' ? 'Address-only draft' : 'Queued place draft';
}

function getDraftDisplayAddress(draft) {
    return String(draft?.formDraft?.address || draft?.displayAddress || '').trim();
}

function getDraftStatusMeta(draft, isActive, isLoading) {
    if (isLoading || draft?.loadStatus === 'loading') {
        return {
            label: 'Loading preview',
            className: 'border-brand-200 bg-brand-50 text-brand-700',
        };
    }
    if (isActive) {
        return {
            label: 'Reviewing',
            className: 'border-brand-200 bg-brand-50 text-brand-700',
        };
    }
    if (draft?.loadStatus === 'saved') {
        return {
            label: 'Saved',
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
    }
    if (draft?.loadStatus === 'failed') {
        return {
            label: 'Needs attention',
            className: 'border-red-200 bg-red-50 text-red-700',
        };
    }
    if (draft?.formDraft) {
        return {
            label: 'Ready',
            className: 'border-slate-200 bg-slate-50 text-slate-600',
        };
    }
    return {
        label: 'Queued',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
}

function findNextPendingDraftId(drafts, currentDraftId) {
    if (!Array.isArray(drafts) || drafts.length === 0) return '';
    const currentIndex = drafts.findIndex((draft) => draft.id === currentDraftId);
    for (let offset = 1; offset <= drafts.length; offset += 1) {
        const candidate = drafts[(currentIndex + offset) % drafts.length];
        if (candidate && candidate.id !== currentDraftId && candidate.loadStatus !== 'saved') {
            return candidate.id;
        }
    }
    return '';
}

function buildDiscardMessage(unsavedCount, actionLabel) {
    const noun = unsavedCount === 1 ? 'draft' : 'drafts';
    return `You have ${unsavedCount} queued ${noun} that haven't been saved yet. ${actionLabel} will discard this postal import session. Continue?`;
}

function QueueSummaryPanel({
    drafts,
    activeDraftId,
    loadingDraftId,
    viewMode,
    onOpenDraft,
    onClearQueue,
}) {
    if (!drafts.length) return null;

    const savedCount = drafts.filter((draft) => draft.loadStatus === 'saved').length;
    const remainingCount = drafts.length - savedCount;

    return (
        <div className="rounded-3xl border border-brand-100 bg-white px-5 py-5 shadow-sm shadow-slate-100/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Draft queue</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                        {drafts.length} queued {drafts.length === 1 ? 'draft' : 'drafts'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                        {savedCount > 0
                            ? `${savedCount} saved, ${remainingCount} remaining in this postal search session.`
                            : 'Add multiple places now, then review and save them one at a time.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClearQueue}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                    Clear queue
                </button>
            </div>

            <div className="mt-4 space-y-2">
                {drafts.map((draft) => {
                    const isActive = viewMode === 'form' && activeDraftId === draft.id;
                    const isLoading = loadingDraftId === draft.id;
                    const statusMeta = getDraftStatusMeta(draft, isActive, isLoading);
                    const canOpen = Boolean(onOpenDraft) && !isActive && !isLoading && draft.loadStatus !== 'saved';

                    return (
                        <button
                            key={draft.id}
                            type="button"
                            onClick={canOpen ? () => onOpenDraft(draft.id) : undefined}
                            disabled={!canOpen}
                            className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                canOpen
                                    ? 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                                    : 'border-slate-200 bg-slate-50/80'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                        {getDraftDisplayName(draft)}
                                    </p>
                                    <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.className}`}
                                    >
                                        {statusMeta.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                    {getDraftDisplayAddress(draft) || 'Complete the full place form to finish this draft.'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                                        {draft.sourceType === 'address-only'
                                            ? 'Address only'
                                            : draft.sourceType === 'web-fallback'
                                                ? 'Web fallback'
                                                : 'Google place'}
                                    </span>
                                    {draft.savedAssetId ? (
                                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                            Asset #{draft.savedAssetId}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            {isLoading ? <Loader2 size={16} className="mt-1 flex-shrink-0 animate-spin text-brand-700" /> : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function CandidateRow({
    candidate,
    draft,
    loading,
    isReviewing,
    onAddToQueue,
    onReviewDraft,
    onEditExisting,
    anchorPostalCode,
}) {
    const existingMatch = candidate.existingMatch || null;
    const distanceLabel = formatCandidateDistance(candidate, anchorPostalCode);
    const draftStatus = draft?.loadStatus || '';
    const isWebFallback = candidate?.candidateSource === 'web_fallback';
    const isEnrichedGooglePlace = !isWebFallback && Boolean(candidate?.groundingConfidence != null || candidate?.aiDescription || candidate?.groundingSourceUrl);
    const displayConfidence = isWebFallback ? candidate?.confidence : (candidate?.groundingConfidence ?? candidate?.confidence);
    const confidenceLabel = formatConfidenceLabel(displayConfidence);
    const aiDescription = candidate?.aiDescription || '';
    const aiLogoUrl = candidate?.aiLogoUrl || '';
    const groundingSourceUrl = candidate?.groundingSourceUrl || candidate?.sourceUrl || '';

    let actionButton = (
        <button
            type="button"
            onClick={() => onAddToQueue(candidate)}
            className="btn-primary min-w-[148px] justify-center"
            data-testid={`postal-candidate-add-${candidate.googlePlaceId || candidate.name || 'candidate'}`}
        >
            <Plus size={16} />
            Add to queue
        </button>
    );

    if (existingMatch && onEditExisting) {
        actionButton = (
            <button
                type="button"
                onClick={() => onEditExisting(existingMatch.id)}
                className="btn-secondary min-w-[164px] justify-center"
                data-testid={`postal-candidate-existing-${existingMatch.id}`}
            >
                Edit existing asset
            </button>
        );
    } else if (draftStatus === 'saved') {
        actionButton = (
            <button
                type="button"
                disabled
                className="btn-secondary min-w-[148px] justify-center cursor-not-allowed opacity-60"
            >
                <CheckCircle2 size={16} />
                Saved
            </button>
        );
    } else if (draft) {
        actionButton = (
            <button
                type="button"
                onClick={() => onReviewDraft(draft.id)}
                disabled={loading || isReviewing}
                className="btn-secondary min-w-[148px] justify-center disabled:cursor-not-allowed disabled:opacity-60"
                data-testid={`postal-draft-review-${draft.id}`}
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Loading…' : isReviewing ? 'Reviewing…' : draftStatus === 'failed' ? 'Retry draft' : 'Review draft'}
            </button>
        );
    }

    return (
        <div className={`rounded-2xl border p-4 shadow-sm shadow-slate-100/70 ${existingMatch ? 'border-slate-200 bg-slate-50/90 opacity-80' : 'border-slate-200 bg-white'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {aiLogoUrl ? (
                            <img
                                src={aiLogoUrl}
                                alt=""
                                aria-hidden="true"
                                className="h-9 w-9 flex-shrink-0 rounded-lg object-contain border border-slate-100 bg-slate-50 p-0.5"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : null}
                        <p className="text-base font-black text-slate-900">{candidate.name}</p>
                        {(isWebFallback && groundingSourceUrl) ? (
                            <a
                                href={groundingSourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                            >
                                Web
                                <ExternalLink size={10} />
                            </a>
                        ) : isWebFallback ? (
                            <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                                Web fallback
                            </span>
                        ) : (
                            <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                                Google place
                            </span>
                        )}
                        {distanceLabel ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {distanceLabel}
                            </span>
                        ) : null}
                        {confidenceLabel ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {confidenceLabel}
                            </span>
                        ) : null}
                        {existingMatch ? (
                            <span className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                Already exists
                            </span>
                        ) : null}
                        {!existingMatch && draftStatus && draftStatus !== 'saved' ? (
                            <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                                {draftStatus === 'failed' ? 'Queued draft needs review' : 'Added to queue'}
                            </span>
                        ) : null}
                        {candidate.subCategorySuggestion ? (
                            <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                                {candidate.subCategorySuggestion}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.address}</p>
                    {aiDescription ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600 italic">{aiDescription}</p>
                    ) : isWebFallback && candidate.sourceSnippet ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {candidate.sourceSnippet}
                        </p>
                    ) : null}
                    {isWebFallback && candidate.sourceTitle && !aiDescription ? (
                        <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                            Source: {candidate.sourceTitle}
                        </p>
                    ) : null}
                    {existingMatch ? (
                        <p className="mt-2 text-sm font-medium text-slate-500">
                            {formatExistingMatchReason(existingMatch.matchReason)}
                        </p>
                    ) : null}
                    {(isWebFallback || isEnrichedGooglePlace) && (candidate.sourceUrl || candidate.groundingSourceUrl || candidate.website) ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {isWebFallback && candidate.sourceUrl ? (
                                <a
                                    href={candidate.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                    Source
                                    <ExternalLink size={12} />
                                </a>
                            ) : null}
                            {isEnrichedGooglePlace && candidate.groundingSourceUrl ? (
                                <a
                                    href={candidate.groundingSourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                    {candidate.groundingSourceTitle || 'AI source'}
                                    <ExternalLink size={12} />
                                </a>
                            ) : null}
                            {candidate.website ? (
                                <a
                                    href={candidate.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                    Website
                                    <Globe size={12} />
                                </a>
                            ) : null}
                        </div>
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
                {actionButton}
            </div>
        </div>
    );
}

const RADIUS_OPTIONS = [
    { value: '0.5', label: '0.5 km' },
    { value: '1', label: '1 km' },
    { value: '2', label: '2 km' },
    { value: '3', label: '3 km' },
    { value: '5', label: '5 km' },
    { value: '10', label: '10 km' },
    { value: '20', label: '20 km' },
    { value: 'all', label: 'All of SG' },
];

const PREFERRED_RESULT_OPTIONS = [
    { value: '1', label: '1' },
    { value: '4', label: '4' },
    { value: '6', label: '6' },
    { value: '8', label: '8' },
    { value: '10', label: '10' },
    { value: '12', label: '12' },
    { value: '16', label: '16' },
    { value: '20', label: '20' },
];

export default function HardAssetImportWizard({
    currentUser,
    partnerHardAssets,
    partnerOptions,
    subregions,
    onCancel,
    onSave,
    onEditExisting,
    onRegisterCloseHandler,
}) {
    const [postalCodes, setPostalCodes] = useState([]);
    const [postalInput, setPostalInput] = useState('');
    const [searchProgressMsg, setSearchProgressMsg] = useState('');
    const [keywordQuery, setKeywordQuery] = useState('');
    const [radiusKm, setRadiusKm] = useState('1');
    const [preferredResultCount, setPreferredResultCount] = useState('1');
    const [enableEnrichment, setEnableEnrichment] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [loadingDraftId, setLoadingDraftId] = useState('');
    const [error, setError] = useState('');
    const [viewMode, setViewMode] = useState('results');
    const [postalResults, setPostalResults] = useState(null);
    const [draftQueue, setDraftQueue] = useState([]);
    const [activeDraftId, setActiveDraftId] = useState('');

    const availablePostalCodes = useMemo(() => Array.from(collectSubregionPostalCodes(subregions, currentUser?.subregionIds || [])), [subregions, currentUser]);
    const exactCandidates = postalResults?.exactCandidates || [];
    const nearbyCandidates = postalResults?.nearbyCandidates || [];
    const hasAnyCandidates = exactCandidates.length > 0 || nearbyCandidates.length > 0;
    const resolvedPostalCode = postalResults?.resolvedPostal?.postalCode || (postalCodes.length ? postalCodes.join(', ') : postalInput);
    const activeDraft = draftQueue.find((draft) => draft.id === activeDraftId) || null;
    const unsavedDraftCount = draftQueue.filter((draft) => draft.loadStatus !== 'saved').length;
    const hasUnsavedDrafts = unsavedDraftCount > 0;

    function confirmDiscardQueuedDrafts(actionLabel) {
        if (!hasUnsavedDrafts) return true;
        return window.confirm(buildDiscardMessage(unsavedDraftCount, actionLabel));
    }

    function resetDraftSession({ preserveResults = false } = {}) {
        setDraftQueue([]);
        setActiveDraftId('');
        setViewMode('results');
        setLoadingDraftId('');
        setError('');
        if (!preserveResults) {
            setPostalResults(null);
        }
    }

    useEffect(() => {
        if (!onRegisterCloseHandler) return undefined;
        onRegisterCloseHandler(() => {
            if (!hasUnsavedDrafts) return true;
            return window.confirm(buildDiscardMessage(unsavedDraftCount, 'Closing this wizard'));
        });
        return () => onRegisterCloseHandler(null);
    }, [hasUnsavedDrafts, onRegisterCloseHandler, unsavedDraftCount]);

    function handleRequestClose() {
        if (!confirmDiscardQueuedDrafts('Closing this wizard')) return;
        onCancel();
    }

    async function handlePostalCandidateSearch(event) {
        event.preventDefault();

        if ((postalResults || draftQueue.length > 0) && !confirmDiscardQueuedDrafts('Starting a new postal search')) {
            return;
        }

        const rawTargetPostals = dedupeTags([...postalCodes, postalInput.replace(/\D/g, '').slice(0, 6)]).filter(p => p.length === 6);
        if (rawTargetPostals.length === 0) {
            setError('Please provide at least one valid 6-digit postal code.');
            return;
        }

        setSearchLoading(true);
        setError('');
        resetDraftSession();

        try {
            const mergedExact = [];
            const mergedNearby = [];
            let firstResolvedPostal = null;

            for (let i = 0; i < rawTargetPostals.length; i++) {
                const targetPostal = rawTargetPostals[i];
                if (rawTargetPostals.length > 1) {
                    setSearchProgressMsg(`Searching ${targetPostal} (${i + 1} of ${rawTargetPostals.length})...`);
                } else {
                    setSearchProgressMsg('Searching...');
                }

                const data = await api.searchGoogleHardAssetCandidatesByPostal({
                    postalCode: targetPostal,
                    keywordQuery,
                    radiusKm: radiusKm === 'all' ? 'all' : Number(radiusKm),
                    preferredResultCount: Number(preferredResultCount),
                    enrich: enableEnrichment,
                });
                
                if (!firstResolvedPostal && data.resolvedPostal) {
                    firstResolvedPostal = data.resolvedPostal;
                }
                
                (data.exactCandidates || []).forEach((c) => mergedExact.push(c));
                (data.nearbyCandidates || []).forEach((c) => mergedNearby.push(c));
            }

            const uniqueExact = Array.from(new Map(mergedExact.map(c => [c.id || c.googlePlaceId, c])).values());
            const uniqueNearby = Array.from(new Map(mergedNearby.map(c => [c.id || c.googlePlaceId, c])).values());

            setPostalResults({
                resolvedPostal: firstResolvedPostal || { postalCode: rawTargetPostals.join(', ') },
                exactCandidates: uniqueExact,
                nearbyCandidates: uniqueNearby,
                keywordQuery,
                radiusKm,
                preferredResultCount
            });
            if (postalInput) {
                setPostalCodes((prev) => dedupeTags([...prev, postalInput.replace(/\D/g, '').slice(0, 6)]).filter(p => p.length === 6));
                setPostalInput('');
            }
        } catch (err) {
            setError(err.message || 'Failed to search Google places for the given postal codes.');
        } finally {
            setSearchLoading(false);
            setSearchProgressMsg('');
        }
    }

    function handleAddCandidateToQueue(candidate) {
        const draft = createCandidateDraft(candidate);
        setDraftQueue((prev) => {
            if (prev.some((item) => item.id === draft.id)) return prev;
            return [...prev, draft];
        });
        setError('');
    }

    function handleAddAddressOnlyToQueue() {
        if (!postalResults?.resolvedPostal) return;
        const draft = createAddressOnlyDraft(postalResults);
        setDraftQueue((prev) => {
            if (prev.some((item) => item.id === draft.id)) return prev;
            return [...prev, draft];
        });
        setError('');
    }

    async function openDraftForReview(draftId) {
        const draft = draftQueue.find((item) => item.id === draftId);
        if (!draft || draft.loadStatus === 'saved') return;

        if (draft.formDraft) {
            setActiveDraftId(draftId);
            setViewMode('form');
            setError('');
            return;
        }

        if (draft.sourceType !== 'google-place') return;

        setLoadingDraftId(draftId);
        setError('');
        setDraftQueue((prev) => prev.map((item) => (
            item.id === draftId
                ? { ...item, loadStatus: 'loading', error: '' }
                : item
        )));

        try {
            const previewData = await api.previewGoogleHardAssetImport({
                googlePlaceId: draft.googlePlaceId,
                googleMapsUri: draft.googleMapsUri,
            });
            const previewWithTags = {
                ...previewData,
                candidateSuggestedTags: draft.candidateSuggestedTags,
                // Merge AI enrichment from the candidate as fallbacks for empty Places preview fields
                aiDescription: draft.aiDescription || '',
                aiLogoUrl: draft.aiLogoUrl || '',
                aiServices: Array.isArray(draft.aiServices) ? draft.aiServices : [],
            };
            const formDraft = buildImportedHardAssetDraft(previewWithTags);
            setDraftQueue((prev) => prev.map((item) => (
                item.id === draftId
                    ? {
                        ...item,
                        previewData,
                        formDraft,
                        loadStatus: 'ready',
                        error: '',
                    }
                    : item
            )));
            setActiveDraftId(draftId);
            setViewMode('form');
        } catch (err) {
            const message = err.message || 'Failed to preview the selected Google place.';
            setDraftQueue((prev) => prev.map((item) => (
                item.id === draftId
                    ? {
                        ...item,
                        loadStatus: 'failed',
                        error: message,
                    }
                    : item
            )));
            setError(message);
            setViewMode('results');
        } finally {
            setLoadingDraftId('');
        }
    }

    function handleDraftCancel(formDraft) {
        if (!activeDraftId) {
            setViewMode('results');
            return;
        }

        setDraftQueue((prev) => prev.map((item) => (
            item.id === activeDraftId
                ? {
                    ...item,
                    formDraft: formDraft || item.formDraft,
                    loadStatus: 'ready',
                    error: '',
                }
                : item
        )));
        setError('');
        setViewMode('results');
    }

    async function handleDraftSaved(savedAsset) {
        const currentDraftId = activeDraftId;
        if (!currentDraftId) return;

        const nextDraftId = findNextPendingDraftId(draftQueue, currentDraftId);
        setDraftQueue((prev) => prev.map((item) => (
            item.id === currentDraftId
                ? {
                    ...item,
                    formDraft: item.formDraft
                        ? {
                            ...item.formDraft,
                            name: savedAsset?.name || item.formDraft.name,
                            address: savedAsset?.address || item.formDraft.address,
                            postalCode: savedAsset?.postalCode || item.formDraft.postalCode,
                        }
                        : item.formDraft,
                    loadStatus: 'saved',
                    savedAssetId: savedAsset?.id || item.savedAssetId || null,
                    error: '',
                }
                : item
        )));
        setError('');

        await onSave?.(savedAsset);

        if (nextDraftId) {
            await openDraftForReview(nextDraftId);
            return;
        }

        setActiveDraftId('');
        setViewMode('results');
    }

    function handleClearQueue() {
        if (!confirmDiscardQueuedDrafts('Clearing this queue')) return;
        setDraftQueue([]);
        setActiveDraftId('');
        setViewMode('results');
        setError('');
        setLoadingDraftId('');
    }

    function handleResetSession() {
        if (!confirmDiscardQueuedDrafts('Resetting this postal search')) return;
        resetDraftSession();
    }

    function handleEditExisting(existingAssetId) {
        if (!existingAssetId) return;
        if (!confirmDiscardQueuedDrafts('Leaving this import session to edit an existing asset')) return;
        onEditExisting?.(existingAssetId);
    }

    const activeAddressDraft = postalResults?.resolvedPostal
        ? draftQueue.find((draft) => draft.id === `address-only:${postalResults.resolvedPostal.postalCode || postalResults.resolvedPostal.address || 'draft'}`) || null
        : null;

    const queueSummaryPanel = (
        <QueueSummaryPanel
            drafts={draftQueue}
            activeDraftId={activeDraftId}
            loadingDraftId={loadingDraftId}
            viewMode={viewMode}
            onOpenDraft={viewMode === 'results' ? openDraftForReview : null}
            onClearQueue={handleClearQueue}
        />
    );

    if (viewMode === 'form' && activeDraft?.formDraft) {
        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Draft review</p>
                            <p className="mt-1 text-sm text-slate-700">
                                Review this place in the full form. Save moves straight to the next queued draft, while cancel returns to the queue without losing your edits.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
                                {activeDraft.sourceType === 'address-only'
                                    ? 'Address only'
                                    : activeDraft.sourceType === 'web-fallback'
                                        ? 'Web fallback'
                                        : 'Google place'}
                            </span>
                            {resolvedPostalCode ? (
                                <span className="inline-flex rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
                                    Postal {resolvedPostalCode}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>

                {draftQueue.length > 0 ? queueSummaryPanel : null}

                <AssetForm
                    key={activeDraft.id}
                    type="hard"
                    initialData={activeDraft.formDraft}
                    partnerHardAssets={partnerHardAssets}
                    currentUser={currentUser}
                    partnerOptions={partnerOptions}
                    subregions={subregions}
                    importSource={activeDraft.previewData?.resolvedSource || null}
                    importWarnings={activeDraft.previewData?.warnings || []}
                    duplicateMatches={activeDraft.previewData?.duplicateMatches || []}
                    onSelectDuplicateMatch={handleEditExisting}
                    onSave={handleDraftSaved}
                    onCancel={handleDraftCancel}
                />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-white p-3 text-brand-600 shadow-sm shadow-slate-200/70">
                            <Search size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">Search places by postal code</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                Run one postal search, add multiple candidate places into a draft queue, then review each full place form one at a time without losing your place in the session. Google Places stays primary, while lower-confidence web fallback suggestions appear only when Google has no place candidates.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handlePostalCandidateSearch} className="space-y-4">
                    <div className="space-y-4">
                        <label htmlFor="google-place-postal-code" className="block text-sm font-semibold text-slate-700">
                            Singapore postal codes (multi-search)
                        </label>
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
                            {postalCodes.map((pc) => (
                                <span key={pc} className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-1 text-sm font-bold text-brand-700">
                                    {pc}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPostalCodes(prev => prev.filter(p => p !== pc));
                                        }}
                                        className="text-brand-500 hover:text-brand-800"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                            <input
                                id="google-place-postal-code"
                                inputMode="numeric"
                                maxLength={6}
                                value={postalInput}
                                onChange={(event) => {
                                    setPostalInput(event.target.value.replace(/\D/g, '').slice(0, 6));
                                    setError('');
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ',') {
                                        event.preventDefault();
                                        if (postalInput.length === 6 && !postalCodes.includes(postalInput)) {
                                            setPostalCodes([...postalCodes, postalInput]);
                                            setPostalInput('');
                                        }
                                    } else if (event.key === 'Backspace' && !postalInput && postalCodes.length > 0) {
                                        setPostalCodes(postalCodes.slice(0, -1));
                                    }
                                }}
                                placeholder={postalCodes.length ? "Add another..." : "681811"}
                                className="min-w-[120px] flex-1 border-0 bg-transparent p-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            />
                        </div>
                        {availablePostalCodes.length > 0 && (
                            <div className="mt-3">
                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Available Boundary Postals</p>
                                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 scrollbar-thin">
                                    {availablePostalCodes.map(pc => {
                                        const isSelected = postalCodes.includes(pc);
                                        return (
                                            <button
                                                key={pc}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setPostalCodes(prev => prev.filter(p => p !== pc));
                                                    } else {
                                                        setPostalCodes(prev => dedupeTags([...prev, pc]).filter(p => p.length === 6));
                                                    }
                                                }}
                                                className={`rounded-md border px-2 py-1 flex items-center justify-center text-[11px] font-bold transition-colors ${isSelected ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                {isSelected ? <CheckCircle2 size={12} className="mr-1" /> : <Plus size={12} className="mr-1" />}
                                                {pc}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                            We’ll search all listed postcodes sequentially, aggregating exact and nearby Google places into a combined candidate result list.
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
                                setError('');
                            }}
                            placeholder="Optional, e.g. dementia, rehab, dialysis"
                            className="input-field"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            Optional. Exact same-postal matches still appear first, while nearby recommendations are ranked using these keywords.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label htmlFor="google-place-radius" className="mb-1 block text-sm font-semibold text-slate-700">
                                Distance radius
                            </label>
                            <select
                                id="google-place-radius"
                                value={radiusKm}
                                onChange={(event) => {
                                    setRadiusKm(event.target.value);
                                    setError('');
                                }}
                                className="input-field"
                            >
                                {RADIUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs text-slate-500">
                                Exact same-postal matches still show first. Expand this when you want to compare nearby places farther away, up to all of Singapore.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="google-place-result-count" className="mb-1 block text-sm font-semibold text-slate-700">
                                Number of results
                            </label>
                            <select
                                id="google-place-result-count"
                                value={preferredResultCount}
                                onChange={(event) => {
                                    setPreferredResultCount(event.target.value);
                                    setError('');
                                }}
                                className="input-field"
                            >
                                {PREFERRED_RESULT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs text-slate-500">
                                Maximum candidates per postal code. Exact matches appear first; nearby matches fill any remaining slots.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Enrich top 4 places with Vertex AI</p>
                            <p className="mt-1 text-xs text-slate-600">Extracts services, refines description and improves quality (takes longer).</p>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                checked={enableEnrichment}
                                onChange={(e) => setEnableEnrichment(e.target.checked)}
                                className="peer sr-only"
                            />
                            <div className="peer h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30"></div>
                        </label>
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
                        <button type="button" onClick={handleRequestClose} className="btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={searchLoading || (postalCodes.length === 0 && postalInput.trim().length !== 6)}
                            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                            data-testid="postal-import-search"
                        >
                            {searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            {searchLoading ? (searchProgressMsg || 'Searching…') : 'Find places'}
                        </button>
                    </div>
                </form>

                {postalResults ? (
                    <div className="space-y-4">
                        {draftQueue.length > 0 ? queueSummaryPanel : null}

                        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/70 px-5 py-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Resolved postal anchor</p>
                                    <p className="mt-2 text-base font-semibold text-slate-900">{postalResults.resolvedPostal?.postalCode || (postalCodes.length ? postalCodes.join(', ') : postalInput)}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{postalResults.resolvedPostal?.address || 'Google resolved the postcode, but no formatted address was returned.'}</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                            Anchor source: {postalResults.resolvedPostal?.source === 'onemap' ? 'OneMap' : 'Google Places'}
                                        </span>
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                            Distance radius: {postalResults.radiusLabel || formatRadiusLabel(postalResults.radiusKm || radiusKm)}
                                        </span>
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                            Number of results: {postalResults.preferredResultCount || preferredResultCount}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {activeAddressDraft?.loadStatus === 'saved' ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 opacity-70"
                                        >
                                            <CheckCircle2 size={15} />
                                            Saved
                                        </button>
                                    ) : activeAddressDraft ? (
                                        <button
                                            type="button"
                                            onClick={() => openDraftForReview(activeAddressDraft.id)}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                            data-testid="postal-address-draft-review"
                                        >
                                            <MapPin size={15} />
                                            Review address draft
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleAddAddressOnlyToQueue}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                                            data-testid="postal-address-draft-add"
                                        >
                                            <MapPin size={15} />
                                            Add address-only draft
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleResetSession}
                                        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                        data-testid="postal-import-reset"
                                    >
                                        <ArrowLeft size={14} />
                                        Reset session
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

                            {postalResults.fallbackUsed ? (
                                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                        <p>
                                            Google Places returned no candidate places, so web-grounded fallback suggestions are shown below. Treat them as lower-confidence suggestions and review every detail before saving.
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {(postalResults.fallbackWarnings || []).length ? (
                                <div className="space-y-2">
                                    {postalResults.fallbackWarnings.map((warning) => (
                                        <div key={warning} className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
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
                                                {exactCandidates.map((candidate) => {
                                                    const draft = draftQueue.find((item) => item.googlePlaceId === candidate.googlePlaceId) || null;
                                                    return (
                                                        <CandidateRow
                                                            key={candidate.googlePlaceId}
                                                            candidate={candidate}
                                                            draft={draft}
                                                            loading={loadingDraftId === draft?.id}
                                                            isReviewing={viewMode === 'form' && activeDraftId === draft?.id}
                                                            onAddToQueue={handleAddCandidateToQueue}
                                                            onReviewDraft={openDraftForReview}
                                                            onEditExisting={handleEditExisting}
                                                            anchorPostalCode={resolvedPostalCode}
                                                        />
                                                    );
                                                })}
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
                                                Useful when the exact postal code has no matching Google place, or when you want to compare nearby venues within {postalResults.radiusLabel || formatRadiusLabel(postalResults.radiusKm || radiusKm)} of the same anchor.
                                            </p>
                                            <div className="space-y-3">
                                                {nearbyCandidates.map((candidate) => {
                                                    const draft = draftQueue.find((item) => item.googlePlaceId === candidate.googlePlaceId) || null;
                                                    return (
                                                        <CandidateRow
                                                            key={candidate.googlePlaceId}
                                                            candidate={candidate}
                                                            draft={draft}
                                                            loading={loadingDraftId === draft?.id}
                                                            isReviewing={viewMode === 'form' && activeDraftId === draft?.id}
                                                            onAddToQueue={handleAddCandidateToQueue}
                                                            onReviewDraft={openDraftForReview}
                                                            onEditExisting={handleEditExisting}
                                                            anchorPostalCode={resolvedPostalCode}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center">
                                    <p className="text-base font-semibold text-slate-800">No strong Google place candidates found</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Try another postal code, add refine keywords, or switch back to manual entry if this place is not well represented on Google.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">What happens next</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">1. Search once</p>
                        <p className="mt-1 text-sm text-slate-600">Resolve one postal code and keep that result context active until you explicitly reset it.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">2. Queue multiple drafts</p>
                        <p className="mt-1 text-sm text-slate-600">Add several Google places or the address-only fallback before you start full-form review.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-semibold text-slate-800">3. Review one by one</p>
                        <p className="mt-1 text-sm text-slate-600">Save advances to the next draft automatically, while cancel returns you to the queue with edits preserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
