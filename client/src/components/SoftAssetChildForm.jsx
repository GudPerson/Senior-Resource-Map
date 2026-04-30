import React, { useEffect, useId, useState } from 'react';
import { Clock, EyeOff, FileText, Link2, Loader2, Lock, Mail, MapPin, Package2, Phone, RotateCcw } from 'lucide-react';
import { normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import EligibilityRulesEditor from './EligibilityRulesEditor.jsx';
import MarkdownLiteText from './MarkdownLiteText.jsx';

function formatDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildInitialForm(initialData) {
    return {
        id: initialData?.id,
        name: initialData?.name || '',
        bucket: initialData?.bucket || '',
        subCategory: initialData?.subCategory || '',
        description: initialData?.description || '',
        schedule: initialData?.schedule || '',
        audienceMode: initialData?.audienceMode || 'public',
        isMemberOnly: Boolean(initialData?.isMemberOnly),
        isHidden: Boolean(initialData?.isHidden),
        hideFrom: formatDateTimeLocal(initialData?.hideFrom),
        hideUntil: formatDateTimeLocal(initialData?.hideUntil),
        contactPhone: initialData?.contactPhone || '',
        contactEmail: initialData?.contactEmail || '',
        ctaLabel: initialData?.ctaLabel || '',
        ctaUrl: initialData?.ctaUrl || '',
        venueNote: initialData?.venueNote || '',
        availabilityEnabled: Boolean(initialData?.availabilityEnabled),
        availabilityCount: normalizeAvailabilityCount(initialData?.availabilityCount),
        availabilityUnit: initialData?.availabilityUnit || '',
        overriddenFields: initialData?.overriddenFields || [],
        audienceZones: initialData?.audienceZones || [],
        parentSummary: initialData?.parentSummary || null,
        hostLocation: initialData?.hostLocation || initialData?.location || null,
        eligibilityRules: initialData?.eligibilityRules || null,
    };
}

function ResetButton({ visible, onClick, disabled }) {
    if (!visible) return null;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
            <RotateCcw size={12} />
            Reset
        </button>
    );
}

export default function SoftAssetChildForm({
    initialData,
    onSave,
    onCancel,
    onResetOverrides,
}) {
    const visibilityToggleId = useId();
    const [form, setForm] = useState(() => buildInitialForm(initialData));
    const [saving, setSaving] = useState(false);
    const [resettingField, setResettingField] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        setForm(buildInitialForm(initialData));
    }, [initialData]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
    const overriddenFieldSet = new Set(form.overriddenFields || []);

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const payload = {
                schedule: form.schedule || null,
                contactPhone: form.contactPhone || null,
                contactEmail: form.contactEmail || null,
                ctaLabel: form.ctaLabel || null,
                ctaUrl: form.ctaUrl || null,
                venueNote: form.venueNote || null,
                availabilityEnabled: Boolean(form.availabilityEnabled),
                availabilityCount: normalizeAvailabilityCount(form.availabilityCount),
                availabilityUnit: normalizeAvailabilityUnit(form.availabilityUnit),
                isHidden: Boolean(form.isHidden),
                hideFrom: form.hideFrom ? new Date(form.hideFrom).toISOString() : null,
                hideUntil: form.hideUntil ? new Date(form.hideUntil).toISOString() : null,
            };

            await onSave?.(payload);
        } catch (err) {
            setError(err.message || 'Failed to save child offering');
            setSaving(false);
            return;
        }

        setSaving(false);
    }

    async function handleReset(field) {
        setResettingField(field);
        setError('');
        try {
            const refreshed = await onResetOverrides?.([field]);
            if (refreshed) {
                setForm(buildInitialForm(refreshed));
            }
        } catch (err) {
            setError(err.message || `Failed to reset ${field}`);
        } finally {
            setResettingField('');
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                    <Lock size={16} className="text-slate-500" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Inherited From Template</h3>
                        <p className="text-xs text-slate-500">These fields stay aligned with the parent template and are read-only here.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Template</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.parentSummary?.name || 'Generated child offering'}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Host Location</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.hostLocation?.name || 'No host assigned'}</p>
                        {form.hostLocation?.address ? <p className="mt-1 text-xs text-slate-500">{form.hostLocation.address}</p> : null}
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Name</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.name || 'Untitled offering'}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bucket</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.bucket || 'Programme'}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sub-Category</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.subCategory || 'Programme'}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3 md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Description</p>
                        {form.description ? (
                            <MarkdownLiteText
                                text={form.description}
                                compact
                                className="mt-1 text-sm leading-relaxed text-slate-700"
                            />
                        ) : (
                            <p className="mt-1 text-sm leading-relaxed text-slate-700">No shared description set.</p>
                        )}
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audience</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                            {form.audienceMode === 'partner_boundary'
                                ? 'Partner boundary'
                                : form.audienceMode === 'audience_zones'
                                    ? 'Audience zones'
                                    : 'Public'}
                        </p>
                        {form.audienceMode === 'audience_zones' && form.audienceZones?.length ? (
                            <p className="mt-1 text-xs text-slate-500">
                                {form.audienceZones.map((zone) => zone.zoneCode || zone.name).join(', ')}
                            </p>
                        ) : null}
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Visibility Rule</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{form.isMemberOnly ? 'Member-only' : 'Visible to guests'}</p>
                    </div>
                </div>

                <div className="mt-4">
                    <EligibilityRulesEditor
                        value={form.eligibilityRules}
                        readOnly
                        title="Eligibility rules"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-4 md:col-span-2">
                    <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-brand-600" />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">Host-Specific Details</h3>
                            <p className="text-xs text-slate-500">These fields can diverge from the parent template for one host rollout.</p>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2">
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Clock size={13} /> Local Schedule</label>
                        <ResetButton visible={overriddenFieldSet.has('schedule')} onClick={() => handleReset('schedule')} disabled={resettingField === 'schedule'} />
                    </div>
                    <input value={form.schedule} onChange={(e) => setField('schedule', e.target.value)} placeholder="Host-specific schedule" className="input-field" />
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Phone size={13} /> Contact Phone</label>
                        <ResetButton visible={overriddenFieldSet.has('contactPhone')} onClick={() => handleReset('contactPhone')} disabled={resettingField === 'contactPhone'} />
                    </div>
                    <input value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} placeholder="+65 6000 1111" className="input-field" />
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Mail size={13} /> Contact Email</label>
                        <ResetButton visible={overriddenFieldSet.has('contactEmail')} onClick={() => handleReset('contactEmail')} disabled={resettingField === 'contactEmail'} />
                    </div>
                    <input value={form.contactEmail} onChange={(e) => setField('contactEmail', e.target.value)} placeholder="hello@example.com" className="input-field" />
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Link2 size={13} /> CTA Label</label>
                        <ResetButton visible={overriddenFieldSet.has('ctaLabel')} onClick={() => handleReset('ctaLabel')} disabled={resettingField === 'ctaLabel'} />
                    </div>
                    <input value={form.ctaLabel} onChange={(e) => setField('ctaLabel', e.target.value)} placeholder="Register now" className="input-field" />
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><Link2 size={13} /> CTA URL</label>
                        <ResetButton visible={overriddenFieldSet.has('ctaUrl')} onClick={() => handleReset('ctaUrl')} disabled={resettingField === 'ctaUrl'} />
                    </div>
                    <input value={form.ctaUrl} onChange={(e) => setField('ctaUrl', e.target.value)} placeholder="https://example.com/register" className="input-field" />
                </div>

                <div className="md:col-span-2">
                    <div className="mb-1 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-1 text-sm font-semibold text-slate-700"><FileText size={13} /> Venue Note</label>
                        <ResetButton visible={overriddenFieldSet.has('venueNote')} onClick={() => handleReset('venueNote')} disabled={resettingField === 'venueNote'} />
                    </div>
                    <textarea value={form.venueNote} onChange={(e) => setField('venueNote', e.target.value)} rows={3} placeholder="Entrance instructions, room number, or host-specific venue note." className="input-field resize-none" />
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center gap-2">
                        <Package2 size={16} className="text-brand-600" />
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">Availability tracking</h3>
                            <p className="text-xs text-slate-500">Track host-specific remaining slots, tickets, or vouchers for this rollout.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-700">Enable availability tracking</p>
                                <p className="text-xs text-slate-500">When on, this rollout’s count is shown publicly.</p>
                            </div>
                            <span className="relative inline-flex items-center">
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.availabilityEnabled)}
                                    onChange={(e) => setField('availabilityEnabled', e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-brand-600 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                            </span>
                        </label>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Availability count</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={form.availabilityCount}
                                    onChange={(e) => setField('availabilityCount', e.target.value)}
                                    placeholder="0"
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Availability unit</label>
                                <input
                                    value={form.availabilityUnit || ''}
                                    onChange={(e) => setField('availabilityUnit', e.target.value)}
                                    placeholder="slots, tickets, vouchers"
                                    className="input-field"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                    <EyeOff size={16} className="text-brand-600" />
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800">Rollout Visibility</h3>
                        <p className="text-xs text-slate-500">Generated child offerings start hidden until the local rollout is ready.</p>
                    </div>
                </div>

                <label htmlFor={visibilityToggleId} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">Hide from app</p>
                        <p className="text-xs text-slate-500">Keep this host rollout off public discovery.</p>
                    </div>
                    <span className="relative inline-flex items-center">
                        <input
                            id={visibilityToggleId}
                            type="checkbox"
                            checked={Boolean(form.isHidden)}
                            onChange={(e) => setField('isHidden', e.target.checked)}
                            className="peer sr-only"
                        />
                        <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-red-500 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-['']" />
                    </span>
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (From)</label>
                        <input type="datetime-local" value={form.hideFrom} onChange={(e) => setField('hideFrom', e.target.value)} className="input-field text-sm" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Scheduled Hide (Until)</label>
                        <input type="datetime-local" value={form.hideUntil} onChange={(e) => setField('hideUntil', e.target.value)} className="input-field text-sm" />
                    </div>
                </div>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onCancel} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Local Rollout'}
                </button>
            </div>
        </form>
    );
}
