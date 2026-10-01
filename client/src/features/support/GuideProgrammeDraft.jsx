import { useEffect, useId, useRef, useState } from 'react';
import { Check, Pencil, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import OfferingScheduleEntriesEditor from '../../components/OfferingScheduleEntriesEditor.jsx';
import { buildSchedulePlanOccurrencePreview, createEmptyScheduleEntry, getSchedulePlanValidationError } from '../../lib/offeringSchedule.js';
import { GUIDE_VISIBILITY_LABELS } from './guideProgrammeState.js';
import { restoreSupportFocus } from './supportFocus.js';

export default function GuideProgrammeDraft({ api, action, initialPlaces = [] }) {
    const { draft, review, pending, uncertain, error, conflict } = action;
    const fieldId = useId();
    const [query, setQuery] = useState('');
    const [places, setPlaces] = useState(initialPlaces);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [placeError, setPlaceError] = useState('');
    const [placePending, setPlacePending] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const reviewHeading = useRef(null);
    const errorMessage = useRef(null);
    const disabled = Boolean(pending) || uncertain || conflict;
    const scheduleError = getSchedulePlanValidationError(draft.schedulePlan);
    const occurrences = buildSchedulePlanOccurrencePreview(draft.schedulePlan, 3);
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(() => {
            setPlacePending(true); setPlaceError('');
            api.guideProgrammePlaces(query, controller.signal).then((result) => {
                if (controller.signal.aborted) return;
                setPlaces(result.places); setHasMore(Boolean(result.hasMore));
                if (!result.canCreate) setPlaceError('You do not currently have permission to create programmes/services here.');
            }).catch((err) => { if (!controller.signal.aborted) setPlaceError(err.message); })
                .finally(() => { if (!controller.signal.aborted) setPlacePending(false); });
        }, query ? 200 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [api, query]);
    useEffect(() => { if (review) restoreSupportFocus(reviewHeading.current, action.origin.current); }, [review]);
    useEffect(() => { if (error) restoreSupportFocus(errorMessage.current, action.origin.current); }, [error]);
    const placeOptions = selectedPlace && !places.some((place) => place.id === selectedPlace.id) ? [selectedPlace, ...places] : places;

    return <section className="min-w-0 rounded-2xl border border-brand-200 bg-white p-4 sm:p-5" aria-labelledby={`${fieldId}-title`}>
        <div className="mb-4 flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{review ? 'Ready for your review' : 'Programme/service draft'}</p>
                <h3 id={`${fieldId}-title`} ref={reviewHeading} tabIndex={-1} className="mt-1 text-lg font-bold text-slate-900">{review ? 'Create this programme/service?' : 'Make it yours'}</h3></div>
            {review && <ShieldCheck className="mt-1 shrink-0 text-brand-600" size={22} aria-hidden="true" />}
        </div>
        {review ? <div className="space-y-4">
            <dl className="space-y-3 text-sm">
                <div><dt className="font-semibold text-slate-500">Type</dt><dd className="mt-1">{draft.bucket === 'Services' ? 'Service' : 'Programme'}</dd></div>
                <div><dt className="font-semibold text-slate-500">Name</dt><dd className="mt-1 break-words font-semibold text-slate-900">{draft.name}</dd></div>
                <div><dt className="font-semibold text-slate-500">Linked place</dt><dd className="mt-1 break-words">{review.place.name}{review.place.address && <span className="mt-1 block text-xs text-slate-500">{review.place.address}</span>}</dd></div>
                <div><dt className="font-semibold text-slate-500">Visibility</dt><dd className="mt-1">{GUIDE_VISIBILITY_LABELS[draft.visibility]}</dd></div>
                {draft.description && <div><dt className="font-semibold text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap break-words">{draft.description}</dd></div>}
                {(draft.contactPhone || draft.contactEmail) && <div><dt className="font-semibold text-slate-500">Contact</dt><dd className="mt-1 break-words">{[draft.contactPhone, draft.contactEmail].filter(Boolean).join(' · ')}</dd></div>}
                {draft.schedule && <div><dt className="font-semibold text-slate-500">Requested timing</dt><dd className="mt-1 whitespace-pre-wrap break-words">{draft.schedule}</dd></div>}
                <div><dt className="font-semibold text-slate-500">Care Calendar dates · Singapore time</dt><dd className="mt-1">{draft.schedulePlan.enabled ? <><ul className="space-y-1">{occurrences.map((item) => <li key={item}>{item}</li>)}</ul><p className="mt-1 text-xs text-slate-500">First {occurrences.length} scheduled occurrence{occurrences.length === 1 ? '' : 's'} shown.</p>{draft.schedulePlan.notes && <p className="mt-2 whitespace-pre-wrap">{draft.schedulePlan.notes}</p>}</> : 'No dated sessions added.'}</dd></div>
            </dl>
            <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">This saves a real resource using your account’s existing permissions. It does not book anyone into a service.</p>
        </div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (!scheduleError) action.prepareReview(); }}>
            <label className="block text-sm font-semibold" htmlFor={`${fieldId}-name`}>Name <span className="font-normal text-slate-500">(required)</span>
                <input id={`${fieldId}-name`} className="input-field mt-1 w-full" value={draft.name} onChange={(event) => action.edit({ name: event.target.value })} maxLength={200} required disabled={disabled} /></label>
            <label className="block text-sm font-semibold" htmlFor={`${fieldId}-bucket`}>Type
                <select id={`${fieldId}-bucket`} className="input-field mt-1 w-full" value={draft.bucket} disabled={disabled} onChange={(event) => action.edit({ bucket: event.target.value })}>
                    <option value="Programmes">Programme</option><option value="Services">Service</option>
                </select></label>
            <div className="space-y-2">
                <label className="block text-sm font-semibold" htmlFor={`${fieldId}-place-search`}>Linked place <span className="font-normal text-slate-500">(required)</span></label>
                <input id={`${fieldId}-place-search`} type="search" className="input-field w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a place you can manage" maxLength={100} disabled={disabled} />
                <label htmlFor={`${fieldId}-place`} className="sr-only">Choose linked place</label>
                <select id={`${fieldId}-place`} className="input-field w-full" value={draft.locationId || ''} required disabled={disabled || placePending} onChange={(event) => {
                    const id = Number(event.target.value) || null;
                    setSelectedPlace(placeOptions.find((place) => place.id === id) || null); action.edit({ locationId: id });
                }}><option value="">Choose a place…</option>{placeOptions.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select>
                {placePending && <p className="text-xs text-slate-500" role="status">Finding places you can manage…</p>}
                {hasMore && <p className="text-xs text-slate-500">Type a place name to narrow these results.</p>}
                {!placePending && !placeError && !places.length && <p className="text-xs text-slate-500">No matching manageable places. Try another name or check your resource access.</p>}
                {placeError && <p className="text-sm text-red-700" role="alert">{placeError}</p>}
            </div>
            <label className="block text-sm font-semibold" htmlFor={`${fieldId}-visibility`}>Visibility
                <select id={`${fieldId}-visibility`} className="input-field mt-1 w-full" value={draft.visibility} disabled={disabled} onChange={(event) => action.edit({ visibility: event.target.value })}>
                    <option value="hidden">Hidden from directory</option><option value="public">Public directory</option>
                </select><span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{GUIDE_VISIBILITY_LABELS[draft.visibility]}</span></label>
            <label className="block text-sm font-semibold" htmlFor={`${fieldId}-description`}>Description <span className="font-normal text-slate-500">(optional)</span>
                <textarea id={`${fieldId}-description`} className="input-field mt-1 w-full" rows={3} maxLength={4000} value={draft.description} disabled={disabled} onChange={(event) => action.edit({ description: event.target.value })} /></label>
            <details className="border-t border-slate-100 pt-3" open={Boolean(draft.schedule || draft.schedulePlan.enabled)}>
                <summary className="min-h-[36px] cursor-pointer text-sm font-semibold">Dates & recurrence</summary>
                <div className="space-y-3 pt-2">
                    <p className="text-xs leading-relaxed text-slate-500">Use Singapore time. Enter the actual first date; the Guide does not assume when a series starts.</p>
                    <div className="rounded-lg bg-slate-50 p-3"><label className="block text-xs font-semibold" htmlFor={`${fieldId}-timing`}>Requested timing (optional)</label><input id={`${fieldId}-timing`} className="input-field mt-1 w-full text-sm" value={draft.schedule} disabled={disabled} maxLength={1000} onChange={(event) => action.edit({ schedule: event.target.value })} /><p className="mt-1 text-xs text-slate-500">Add matching dated sessions below for Care Calendar. This text alone does not create sessions.</p></div>
                    <label className="flex min-h-[44px] items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={draft.schedulePlan.enabled} disabled={disabled} onChange={(event) => action.edit({ schedulePlan: { ...draft.schedulePlan, enabled: event.target.checked, entries: event.target.checked && !draft.schedulePlan.entries.length ? [createEmptyScheduleEntry()] : draft.schedulePlan.entries } })} /><span>Add dated sessions for Care Calendar</span></label>
                    {draft.schedulePlan.enabled && <><OfferingScheduleEntriesEditor compact disabled={disabled} entries={draft.schedulePlan.entries} onChange={(entries) => action.edit({ schedulePlan: { ...draft.schedulePlan, entries } })} />
                        <label className="block text-sm" htmlFor={`${fieldId}-schedule-notes`}>Schedule notes<input id={`${fieldId}-schedule-notes`} className="input-field mt-1 w-full" value={draft.schedulePlan.notes} maxLength={1000} disabled={disabled} onChange={(event) => action.edit({ schedulePlan: { ...draft.schedulePlan, notes: event.target.value } })} /></label>
                        {scheduleError && <p className="text-sm text-amber-800">{scheduleError}</p>}</>}
                </div>
            </details>
            <details className="border-t border-slate-100 pt-3"><summary className="min-h-[36px] cursor-pointer text-sm font-semibold">Contact details <span className="font-normal text-slate-500">(optional)</span></summary>
                <div className="space-y-3 pt-2"><label className="block text-sm" htmlFor={`${fieldId}-phone`}>Phone<input id={`${fieldId}-phone`} type="tel" className="input-field mt-1 w-full" value={draft.contactPhone} maxLength={50} disabled={disabled} onChange={(event) => action.edit({ contactPhone: event.target.value })} /></label>
                    <label className="block text-sm" htmlFor={`${fieldId}-email`}>Email<input id={`${fieldId}-email`} type="email" className="input-field mt-1 w-full" value={draft.contactEmail} maxLength={254} disabled={disabled} onChange={(event) => action.edit({ contactEmail: event.target.value })} /></label></div>
            </details>
            <div className="flex flex-wrap gap-2"><button className="btn-primary text-sm" disabled={disabled || !draft.name.trim() || !draft.locationId || Boolean(scheduleError)}>{pending === 'review' ? 'Checking draft…' : 'Review programme/service'}</button><button type="button" className="btn-ghost text-sm" disabled={Boolean(pending) || uncertain} onClick={action.cancel}>Discard draft</button></div>
        </form>}
        {conflict && <div className="mt-4 space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status"><p>This saved request has changed or cannot be reconciled. Check your resources before starting another draft.</p><p className="text-xs">Discard only clears this chat draft. It does not delete a saved programme/service.</p><Link className="font-semibold underline underline-offset-4" to="/dashboard/resources">Open Manage resources</Link></div>}
        {uncertain && pending !== 'create' && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">The result of this save is not confirmed. Retry the same request below to check or complete it safely. Keep this conversation open.</p>}
        {error && <p ref={errorMessage} tabIndex={-1} role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {review && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-primary text-sm" disabled={Boolean(pending)} onClick={action.create}><Check size={16} aria-hidden="true" />{pending === 'create' ? 'Creating…' : uncertain ? 'Retry same request' : 'Create programme/service'}</button>
            <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => action.edit({})}><Pencil size={15} aria-hidden="true" />Edit draft</button></div>}
    </section>;
}
