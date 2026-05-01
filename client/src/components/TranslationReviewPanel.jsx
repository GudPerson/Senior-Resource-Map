import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleDashed,
    Languages,
    Loader2,
    RefreshCw,
    Save,
} from 'lucide-react';

import { api } from '../lib/api.js';

const FIELD_STATUS_LABELS = {
    machine: 'Auto prepared',
    human_edited: 'Staff edited',
    reviewed: 'Ready',
    stale: 'English changed',
    missing: 'Missing translation',
};

const LANGUAGE_STATUS_LABELS = {
    ready: 'Ready',
    staff_edited: 'Staff edited',
    needs_review: 'Needs review',
    missing: 'Missing translation',
};

function badgeClass(status) {
    if (status === 'missing') return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'stale' || status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (status === 'human_edited' || status === 'staff_edited' || status === 'reviewed' || status === 'ready') {
        return 'border-green-200 bg-green-50 text-green-700';
    }
    return 'border-sky-200 bg-sky-50 text-sky-700';
}

function statusIcon(status) {
    if (status === 'missing') return <CircleDashed size={16} className="text-red-600" />;
    if (status === 'stale' || status === 'needs_review') return <AlertTriangle size={16} className="text-amber-700" />;
    return <CheckCircle2 size={16} className="text-green-600" />;
}

function fieldLabel(field) {
    return field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase());
}

function getFieldState(field, localeEntry) {
    const fields = localeEntry?.fields || {};
    const meta = localeEntry?.fieldMeta || {};
    const value = String(fields[field] || '').trim();
    const status = value ? (meta[field]?.status || 'machine') : 'missing';

    return {
        field,
        value,
        status,
        needsAttention: status === 'missing' || status === 'stale',
    };
}

function buildLanguageSummary(locale, label, sourceFieldNames, localeEntry) {
    const fieldStates = sourceFieldNames.map((field) => getFieldState(field, localeEntry));
    const missingCount = fieldStates.filter((item) => item.status === 'missing').length;
    const staleCount = fieldStates.filter((item) => item.status === 'stale').length;
    const staffEditedCount = fieldStates.filter((item) => item.status === 'human_edited').length;
    const readyCount = fieldStates.length - missingCount - staleCount;

    let status = 'ready';
    if (missingCount > 0) status = 'missing';
    else if (staleCount > 0) status = 'needs_review';
    else if (staffEditedCount > 0) status = 'staff_edited';

    return {
        locale,
        label,
        status,
        readyCount,
        totalCount: fieldStates.length,
        missingCount,
        staleCount,
        staffEditedCount,
        needsAttention: missingCount > 0 || staleCount > 0,
    };
}

function statusHelp(summary) {
    if (summary.status === 'missing') {
        return `${summary.missingCount} ${summary.missingCount === 1 ? 'field is' : 'fields are'} missing.`;
    }
    if (summary.status === 'needs_review') {
        return `${summary.staleCount} ${summary.staleCount === 1 ? 'field changed' : 'fields changed'} in English.`;
    }
    if (summary.status === 'staff_edited') {
        return 'Staff wording is saved for this language.';
    }
    return summary.totalCount > 0 ? 'All translated fields are ready.' : 'Add English text first.';
}

function sortFieldStates(fieldStates) {
    const priority = { missing: 0, stale: 1, machine: 2, reviewed: 3, human_edited: 4 };
    return [...fieldStates].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5));
}

export default function TranslationReviewPanel({ resourceType, resourceId }) {
    const [payload, setPayload] = useState(null);
    const [activeLocale, setActiveLocale] = useState('zh-CN');
    const [draftFields, setDraftFields] = useState({});
    const [showAllFields, setShowAllFields] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const sourceFields = payload?.sourceFields || {};
    const sourceFieldNames = useMemo(() => Object.keys(sourceFields), [sourceFields]);
    const summaries = useMemo(() => {
        return (payload?.targetLocales || []).map((item) => buildLanguageSummary(
            item.locale,
            item.label,
            sourceFieldNames,
            payload?.translations?.[item.locale] || {},
        ));
    }, [payload, sourceFieldNames]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        api.getResourceTranslations(resourceType, resourceId)
            .then((data) => {
                if (cancelled) return;
                const nextSummaries = (data?.targetLocales || []).map((item) => buildLanguageSummary(
                    item.locale,
                    item.label,
                    Object.keys(data?.sourceFields || {}),
                    data?.translations?.[item.locale] || {},
                ));
                setPayload(data);
                setActiveLocale(nextSummaries.find((item) => item.needsAttention)?.locale || data?.targetLocales?.[0]?.locale || 'zh-CN');
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Failed to load translations');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [resourceId, resourceType]);

    const activeSummary = summaries.find((item) => item.locale === activeLocale) || summaries[0] || null;
    const localeEntry = payload?.translations?.[activeLocale] || {};
    const activeFieldStates = useMemo(() => {
        return sortFieldStates(sourceFieldNames.map((field) => getFieldState(field, localeEntry)));
    }, [localeEntry, sourceFieldNames]);
    const attentionFields = activeFieldStates.filter((item) => item.needsAttention);
    const visibleFieldStates = showAllFields || attentionFields.length > 0
        ? (showAllFields ? activeFieldStates : attentionFields)
        : [];
    const hiddenReadyCount = Math.max(0, activeFieldStates.length - visibleFieldStates.length);
    const readyLanguageCount = summaries.filter((item) => !item.needsAttention && item.totalCount > 0).length;

    useEffect(() => {
        setDraftFields(localeEntry.fields || {});
        setShowAllFields(false);
    }, [activeLocale, payload]);

    async function saveDraft() {
        const currentFields = localeEntry.fields || {};
        const fieldsToSave = {};
        const reviewedFields = [];

        visibleFieldStates.forEach(({ field }) => {
            const draftValue = String(draftFields[field] || '');
            const currentValue = String(currentFields[field] || '');
            if (draftValue !== currentValue) {
                fieldsToSave[field] = draftValue;
            }
            if (draftValue.trim()) {
                reviewedFields.push(field);
            }
        });

        if (reviewedFields.length === 0 && Object.keys(fieldsToSave).length === 0) {
            setMessage('');
            setError('Add translated text or open fields to review before saving.');
            return;
        }

        setSaving(true);
        setMessage('');
        setError('');
        try {
            const next = await api.updateResourceTranslation(resourceType, resourceId, activeLocale, {
                fields: fieldsToSave,
                reviewedFields,
            });
            setPayload(next);
            setMessage('Review saved. Staff-edited wording will not be overwritten when English changes.');
        } catch (err) {
            setError(err.message || 'Failed to save review');
        } finally {
            setSaving(false);
        }
    }

    async function regenerate() {
        setRegenerating(true);
        setMessage('');
        setError('');
        try {
            const next = await api.regenerateResourceTranslations(resourceType, resourceId, { locales: [activeLocale], force: false });
            setPayload(next);
            const status = next?.translationStatus?.status;
            setMessage(status === 'not_configured'
                ? 'English was saved, but auto-translation is not configured yet.'
                : 'Missing auto text was refreshed. Please review the wording before relying on it.');
        } catch (err) {
            setError(err.message || 'Failed to fill missing text');
        } finally {
            setRegenerating(false);
        }
    }

    if (loading) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading translation review...</span>
            </section>
        );
    }

    if (error && !payload) {
        return (
            <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                {error}
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <Languages size={18} className="mt-0.5 text-sky-700" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">Translation review</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            English is the main version. Staff-edited wording will not be overwritten automatically.
                        </p>
                    </div>
                </div>
                <span className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-800">
                    {readyLanguageCount} of {summaries.length} languages ready
                </span>
            </div>

            {sourceFieldNames.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                    Add English public content first. Translations will appear after saving or filling missing text.
                </p>
            ) : (
                <>
                    <div className="grid gap-2 md:grid-cols-3">
                        {summaries.map((summary) => {
                            const isActive = activeLocale === summary.locale;
                            return (
                                <button
                                    key={summary.locale}
                                    type="button"
                                    onClick={() => setActiveLocale(summary.locale)}
                                    className={`min-h-24 rounded-2xl border bg-white p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${isActive ? 'border-sky-300 shadow-sm' : 'border-slate-200 hover:border-sky-200'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-slate-900">{summary.label}</span>
                                        {statusIcon(summary.status)}
                                    </div>
                                    <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${badgeClass(summary.status)}`}>
                                        {LANGUAGE_STATUS_LABELS[summary.status]}
                                    </span>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">{statusHelp(summary)}</p>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h4 className="text-sm font-semibold text-slate-900">{activeSummary?.label || 'Language'} review</h4>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {attentionFields.length > 0
                                        ? `${attentionFields.length} ${attentionFields.length === 1 ? 'field needs' : 'fields need'} attention first.`
                                        : 'No urgent translation issues for this language.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={regenerate}
                                disabled={saving || regenerating}
                                className="btn-ghost min-h-11 px-4 text-sm"
                            >
                                {regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Fill missing or outdated text
                            </button>
                        </div>

                        {visibleFieldStates.length === 0 ? (
                            <div className="mt-3 rounded-xl border border-green-100 bg-green-50 px-3 py-3 text-sm text-green-700">
                                This language is ready. Open all translated fields if you want to check or adjust the wording.
                            </div>
                        ) : (
                            <div className="mt-3 space-y-3">
                                {visibleFieldStates.map(({ field, status }) => {
                                    const isLong = String(sourceFields[field] || '').length > 120 || ['description', 'schedule', 'hours', 'venueNote'].includes(field);
                                    return (
                                        <div key={field} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <label className="text-sm font-semibold text-slate-800">{fieldLabel(field)}</label>
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${badgeClass(status)}`}>
                                                    {FIELD_STATUS_LABELS[status] || 'Auto prepared'}
                                                </span>
                                            </div>
                                            <p className="mb-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                                                English: {sourceFields[field]}
                                            </p>
                                            {isLong ? (
                                                <textarea
                                                    rows={4}
                                                    value={draftFields[field] || ''}
                                                    onChange={(event) => setDraftFields((prev) => ({ ...prev, [field]: event.target.value }))}
                                                    className="input-field resize-y text-sm"
                                                    placeholder={`Add ${fieldLabel(field).toLowerCase()} translation`}
                                                />
                                            ) : (
                                                <input
                                                    value={draftFields[field] || ''}
                                                    onChange={(event) => setDraftFields((prev) => ({ ...prev, [field]: event.target.value }))}
                                                    className="input-field text-sm"
                                                    placeholder={`Add ${fieldLabel(field).toLowerCase()} translation`}
                                                />
                                            )}
                                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                                Saving unchanged auto text marks it as reviewed. Changing the wording marks it as staff edited.
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {hiddenReadyCount > 0 || (attentionFields.length === 0 && activeFieldStates.length > 0) ? (
                            <button
                                type="button"
                                onClick={() => setShowAllFields((current) => !current)}
                                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            >
                                {showAllFields ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {showAllFields ? 'Show only fields needing attention' : `Show all translated fields${hiddenReadyCount > 0 ? ` (${hiddenReadyCount})` : ''}`}
                            </button>
                        ) : null}

                        {message ? <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}
                        {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

                        {visibleFieldStates.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button type="button" onClick={saveDraft} disabled={saving || regenerating} className="btn-primary min-h-11 px-4">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save review
                                </button>
                            </div>
                        ) : null}
                    </div>
                </>
            )}
        </section>
    );
}
