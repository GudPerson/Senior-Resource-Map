import { useEffect, useMemo, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    FileText,
    Files,
    Loader2,
    MapPin,
    Sparkles,
    Upload,
} from 'lucide-react';

import { api } from '../lib/api.js';
import { SOFT_ASSET_BUCKETS } from '../lib/softAssetBuckets.js';

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildDraftRowState(row, index) {
    return {
        id: row.id || `draft-${index + 1}`,
        action: 'create',
        targetSoftAssetId: row.matchCandidates?.[0]?.id || '',
        expanded: index === 0,
        bucket: row.bucket || 'Programmes',
        name: row.name || '',
        subCategory: row.subCategorySuggestion || row.bucket || 'Programmes',
        description: row.description || '',
        schedule: row.schedule || '',
        newTags: Array.isArray(row.newTags) ? row.newTags : [],
        contactPhone: row.contactPhone || '',
        contactEmail: row.contactEmail || '',
        ctaLabel: row.ctaLabel || '',
        ctaUrl: row.ctaUrl || '',
        venueNote: row.venueNote || '',
        sourceExcerpt: row.sourceExcerpt || '',
        confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : 0.5,
        matchCandidates: Array.isArray(row.matchCandidates) ? row.matchCandidates : [],
    };
}

function formatConfidenceLabel(value) {
    const percent = Math.round((Number(value) || 0) * 100);
    return `${percent}% confidence`;
}

function getConfidenceBadgeClasses(value) {
    const numeric = Number(value) || 0;
    if (numeric >= 0.8) return 'border-green-200 bg-green-50 text-green-700';
    if (numeric >= 0.55) return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-red-200 bg-red-50 text-red-700';
}

function formatSelectedFiles(files) {
    if (!files.length) return 'No files selected';
    if (files.length === 1) return files[0].name;
    return `${files.length} files selected`;
}

function getActionCounts(rows) {
    return rows.reduce((accumulator, row) => {
        const action = row.action || 'create';
        accumulator[action] = (accumulator[action] || 0) + 1;
        return accumulator;
    }, { create: 0, update: 0, skip: 0 });
}

function CandidateMatchSummary({ candidates = [] }) {
    if (!candidates.length) {
        return <p className="text-xs text-slate-400">No same-host match suggested.</p>;
    }

    const top = candidates[0];
    return (
        <p className="text-xs text-slate-500">
            Suggested match: <span className="font-semibold text-slate-700">{top.name}</span> ({top.label})
        </p>
    );
}

export default function SoftAssetCollateralImportWizard({
    hostAsset,
    onSave,
    onCancel,
}) {
    const [files, setFiles] = useState([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [commitLoading, setCommitLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [draftRows, setDraftRows] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);
    const [availableTagOptions, setAvailableTagOptions] = useState([]);
    const [creatingSubCategoryRowId, setCreatingSubCategoryRowId] = useState(null);

    useEffect(() => {
        api.getSubCategories()
            .then((rows) => setAvailableSubCategories(rows.filter((row) => row.type === 'soft')))
            .catch(console.error);
        api.searchTags('')
            .then((rows) => setAvailableTagOptions(rows.map((tag) => ({ value: tag, label: tag }))))
            .catch(console.error);
    }, []);

    const softSubCategoryOptions = useMemo(
        () => availableSubCategories.map((row) => ({ value: row.name, label: row.name })),
        [availableSubCategories],
    );

    const actionCounts = useMemo(() => getActionCounts(draftRows), [draftRows]);

    function resetPreview() {
        setPreviewData(null);
        setDraftRows([]);
        setError('');
    }

    function updateRow(rowId, patch) {
        setDraftRows((prev) => prev.map((row) => (
            row.id === rowId
                ? { ...row, ...patch }
                : row
        )));
    }

    async function handleCreateSoftSubCategory(rowId, inputValue) {
        const name = normalizeText(inputValue).replace(/\s+/g, ' ');
        if (!name) return;

        const existing = availableSubCategories.find((row) => row.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            updateRow(rowId, { subCategory: existing.name });
            return;
        }

        setCreatingSubCategoryRowId(rowId);
        setError('');
        try {
            const created = await api.createSubCategory({ name, type: 'soft' });
            setAvailableSubCategories((prev) => [...prev, created].sort((left, right) => left.name.localeCompare(right.name)));
            updateRow(rowId, { subCategory: created.name });
        } catch (err) {
            setError(err.message || 'Failed to create soft sub-category.');
        } finally {
            setCreatingSubCategoryRowId(null);
        }
    }

    async function handlePreviewSubmit(event) {
        event.preventDefault();
        if (!files.length) {
            setError('Upload at least one PDF or image to continue.');
            return;
        }

        const formData = new FormData();
        formData.append('hostHardAssetId', String(hostAsset.id));
        files.forEach((file) => formData.append('files', file));

        setPreviewLoading(true);
        setError('');
        try {
            const data = await api.previewSoftAssetCollateralImport(formData);
            setPreviewData(data);
            setDraftRows((data.draftRows || []).map(buildDraftRowState));
        } catch (err) {
            setError(err.message || 'Failed to preview the uploaded collateral.');
        } finally {
            setPreviewLoading(false);
        }
    }

    async function handleCommit() {
        setCommitLoading(true);
        setError('');
        try {
            const result = await api.commitSoftAssetCollateralImport({
                hostHardAssetId: hostAsset.id,
                draftRows: draftRows.map((row) => ({
                    id: row.id,
                    action: row.action,
                    targetSoftAssetId: row.targetSoftAssetId || null,
                    bucket: row.bucket,
                    name: row.name,
                    subCategory: row.subCategory,
                    description: row.description,
                    schedule: row.schedule,
                    newTags: row.newTags,
                    contactPhone: row.contactPhone,
                    contactEmail: row.contactEmail,
                    ctaLabel: row.ctaLabel,
                    ctaUrl: row.ctaUrl,
                    venueNote: row.venueNote,
                })),
            });
            await onSave?.(result);
        } catch (err) {
            setError(err.message || 'Failed to save the imported offerings.');
        } finally {
            setCommitLoading(false);
        }
    }

    if (previewData) {
        return (
            <div className="space-y-5">
                <div className="rounded-2xl border border-brand-100 bg-brand-50/70 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">Collateral import review</p>
                            <p className="mt-1 text-sm text-slate-700">
                                Review the extracted offering drafts for {hostAsset.name}. Nothing will be created or updated until you confirm.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={resetPreview}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
                        >
                            <ArrowLeft size={14} />
                            Back to upload
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-4">
                        {error ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        ) : null}

                        {previewData?.warnings?.length ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <div className="flex items-start gap-2 text-amber-700">
                                    <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                                    <div className="space-y-1 text-sm">
                                        {previewData.warnings.map((warning) => (
                                            <p key={warning}>{warning}</p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="space-y-3">
                            {draftRows.map((row, index) => (
                                <div key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/80">
                                    <div className="flex flex-wrap items-start gap-3">
                                        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                            Row {index + 1}
                                        </div>
                                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getConfidenceBadgeClasses(row.confidence)}`}>
                                            {formatConfidenceLabel(row.confidence)}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => updateRow(row.id, { expanded: !row.expanded })}
                                            className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                        >
                                            {row.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {row.expanded ? 'Collapse' : 'Expand'}
                                        </button>
                                    </div>

                                    <div className="mt-4 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_180px]">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                Action
                                            </label>
                                            <select
                                                value={row.action}
                                                onChange={(event) => updateRow(row.id, {
                                                    action: event.target.value,
                                                    targetSoftAssetId: event.target.value === 'update'
                                                        ? (row.targetSoftAssetId || row.matchCandidates?.[0]?.id || '')
                                                        : row.targetSoftAssetId,
                                                })}
                                                className="input-field"
                                            >
                                                <option value="create">Create new</option>
                                                <option value="update" disabled={!row.matchCandidates.length}>Update existing</option>
                                                <option value="skip">Skip</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                Offering name
                                            </label>
                                            <input
                                                value={row.name}
                                                onChange={(event) => updateRow(row.id, { name: event.target.value })}
                                                className="input-field"
                                                placeholder="Befriending programme"
                                            />
                                            <div className="mt-2">
                                                <CandidateMatchSummary candidates={row.matchCandidates} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                Bucket
                                            </label>
                                            <select
                                                value={row.bucket}
                                                onChange={(event) => updateRow(row.id, { bucket: event.target.value })}
                                                className="input-field"
                                            >
                                                {SOFT_ASSET_BUCKETS.map((bucket) => (
                                                    <option key={bucket} value={bucket}>{bucket}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {row.action === 'update' ? (
                                        <div className="mt-4">
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                Existing offering to update
                                            </label>
                                            <select
                                                value={row.targetSoftAssetId}
                                                onChange={(event) => updateRow(row.id, { targetSoftAssetId: event.target.value })}
                                                className="input-field"
                                            >
                                                <option value="">Choose an existing offering</option>
                                                {row.matchCandidates.map((candidate) => (
                                                    <option key={candidate.id} value={candidate.id}>
                                                        {candidate.name} • {candidate.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : null}

                                    {row.expanded ? (
                                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Soft sub-category
                                                </label>
                                                <CreatableSelect
                                                    value={row.subCategory ? { value: row.subCategory, label: row.subCategory } : null}
                                                    options={softSubCategoryOptions}
                                                    onChange={(selected) => updateRow(row.id, { subCategory: selected?.value || row.bucket })}
                                                    onCreateOption={(value) => handleCreateSoftSubCategory(row.id, value)}
                                                    isDisabled={commitLoading || creatingSubCategoryRowId === row.id}
                                                    classNamePrefix="react-select"
                                                    formatCreateLabel={(value) => `Create "${value}"`}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Schedule
                                                </label>
                                                <input
                                                    value={row.schedule}
                                                    onChange={(event) => updateRow(row.id, { schedule: event.target.value })}
                                                    className="input-field"
                                                    placeholder="Mondays 2pm to 4pm"
                                                />
                                            </div>

                                            <div className="lg:col-span-2">
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Tags
                                                </label>
                                                <CreatableSelect
                                                    isMulti
                                                    value={row.newTags.map((tag) => ({ value: tag, label: tag }))}
                                                    options={availableTagOptions}
                                                    onChange={(selected) => updateRow(row.id, { newTags: (selected || []).map((option) => option.value) })}
                                                    onCreateOption={(value) => {
                                                        const created = normalizeText(value).toLowerCase();
                                                        if (!created) return;
                                                        setAvailableTagOptions((prev) => (
                                                            prev.some((option) => option.value === created)
                                                                ? prev
                                                                : [...prev, { value: created, label: created }]
                                                        ));
                                                        updateRow(row.id, { newTags: [...new Set([...row.newTags, created])] });
                                                    }}
                                                    classNamePrefix="react-select"
                                                    formatCreateLabel={(value) => `Add "${value}"`}
                                                />
                                            </div>

                                            <div className="lg:col-span-2">
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Description
                                                </label>
                                                <textarea
                                                    rows={4}
                                                    value={row.description}
                                                    onChange={(event) => updateRow(row.id, { description: event.target.value })}
                                                    className="input-field"
                                                    placeholder="Add a short description for this offering."
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Contact phone
                                                </label>
                                                <input
                                                    value={row.contactPhone}
                                                    onChange={(event) => updateRow(row.id, { contactPhone: event.target.value })}
                                                    className="input-field"
                                                    placeholder="+65 6123 4567"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Contact email
                                                </label>
                                                <input
                                                    value={row.contactEmail}
                                                    onChange={(event) => updateRow(row.id, { contactEmail: event.target.value })}
                                                    className="input-field"
                                                    placeholder="info@example.org"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    CTA label
                                                </label>
                                                <input
                                                    value={row.ctaLabel}
                                                    onChange={(event) => updateRow(row.id, { ctaLabel: event.target.value })}
                                                    className="input-field"
                                                    placeholder="Register now"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    CTA URL
                                                </label>
                                                <input
                                                    value={row.ctaUrl}
                                                    onChange={(event) => updateRow(row.id, { ctaUrl: event.target.value })}
                                                    className="input-field"
                                                    placeholder="https://..."
                                                />
                                            </div>

                                            <div className="lg:col-span-2">
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                    Venue note
                                                </label>
                                                <input
                                                    value={row.venueNote}
                                                    onChange={(event) => updateRow(row.id, { venueNote: event.target.value })}
                                                    className="input-field"
                                                    placeholder="Level 2 studio room"
                                                />
                                            </div>

                                            {row.sourceExcerpt ? (
                                                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Source excerpt</p>
                                                    <p className="mt-2 text-sm leading-6 text-slate-600">{row.sourceExcerpt}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected host place</p>
                            <p className="mt-2 text-base font-black text-slate-900">{previewData?.resolvedHost?.name || hostAsset.name}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{previewData?.resolvedHost?.address || hostAsset.address}</p>
                            {previewData?.resolvedHost?.postalCode ? (
                                <p className="mt-1 text-sm text-slate-500">Singapore {previewData.resolvedHost.postalCode}</p>
                            ) : null}
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100/70">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Batch summary</p>
                            <div className="mt-4 space-y-3 text-sm text-slate-600">
                                <div className="flex items-center justify-between">
                                    <span>Create new</span>
                                    <span className="font-black text-slate-900">{actionCounts.create || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Update existing</span>
                                    <span className="font-black text-slate-900">{actionCounts.update || 0}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Skip</span>
                                    <span className="font-black text-slate-900">{actionCounts.skip || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-brand-100 bg-brand-50/60 p-4">
                            <p className="text-sm font-semibold text-slate-700">
                                Governance fields like ownership, audience targeting, member-only settings, availability, eligibility, and visibility stay untouched in this importer.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={handleCommit}
                                disabled={commitLoading || !draftRows.length}
                                className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {commitLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {commitLoading ? 'Saving reviewed rows…' : 'Save reviewed rows'}
                            </button>
                            <button
                                type="button"
                                onClick={onCancel}
                                className="btn-ghost justify-center"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-3 text-brand-600 shadow-sm shadow-slate-200/70">
                        <Files size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Import printed material into offerings</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            Upload programme calendars, flyers, posters, brochures, PDFs, or phone photos for {hostAsset.name}. We’ll extract offering drafts, suggest buckets and tags, then let you review everything in bulk.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Host place</p>
                        <p className="mt-2 text-lg font-black text-slate-900">{hostAsset.name}</p>
                        <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-600">
                            <MapPin size={15} className="mt-1 flex-shrink-0 text-slate-400" />
                            <span>{hostAsset.address}</span>
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Standalone offerings only in V1
                    </div>
                </div>
            </div>

            <form onSubmit={handlePreviewSubmit} className="space-y-4">
                <label className="block rounded-3xl border border-dashed border-brand-200 bg-brand-50/40 p-6 text-center transition hover:border-brand-300 hover:bg-brand-50/70">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm shadow-brand-100/70">
                        <Upload size={22} />
                    </div>
                    <p className="mt-4 text-lg font-black text-slate-900">Upload material</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        PDF, JPG, PNG, WEBP, or HEIC. Upload one PDF or a small set of photos/scans.
                    </p>
                    <p className="mt-3 text-sm font-semibold text-brand-700">{formatSelectedFiles(files)}</p>
                    <input
                        type="file"
                        accept="application/pdf,image/*"
                        multiple
                        className="sr-only"
                        onChange={(event) => {
                            setFiles(Array.from(event.target.files || []));
                            setError('');
                        }}
                    />
                </label>

                {files.length ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                            {files.map((file) => (
                                <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                                    <FileText size={13} />
                                    {file.name}
                                </span>
                            ))}
                        </div>
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                ) : null}

                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2 text-sm leading-6 text-amber-800">
                        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
                        <p>
                            The AI suggests structure, buckets, descriptions, tags, and possible matches, but you stay in control of the final create/update decision for every row.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={onCancel} className="btn-ghost">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={previewLoading}
                        className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {previewLoading ? 'Extracting drafts…' : 'Preview extracted offerings'}
                    </button>
                </div>
            </form>
        </div>
    );
}
