import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createSavedSearchApi } from '../../lib/savedSearches.js';
import { signalSupportUpdate } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';

export default function SavedSearchForm({ initial, onSaved, onCancel }) {
    const api = useMemo(() => createSavedSearchApi(), []);
    const [draftId] = useState(() => crypto.randomUUID());
    const [query, setQuery] = useState(initial.query || '');
    const [type, setType] = useState(initial.type || 'all');
    const [enabled, setEnabled] = useState(initial.enabled === true);
    const [reviewed, setReviewed] = useState(false);
    const [saved, setSaved] = useState(null);
    const task = useSupportTask();
    const prefix = useId();
    function submit(event) {
        event.preventDefault();
        if (!reviewed) return;
        const input = { query: query.trim(), type, enabled, reviewed: true };
        task.run(() => initial.id ? api.edit(initial.id, { ...input, revision: initial.revision }) : api.create({ ...input, id: draftId }), (result) => {
            signalSupportUpdate(); setSaved(result); onSaved?.(result);
        });
    }
    if (saved) return <div role="status" className="space-y-2 rounded-xl bg-brand-50 p-4 text-sm">
        <p>{saved.enabled ? saved.active ? 'Search saved. Alerts will start after checking the current matches.' : 'Search saved. Alerts are paused by your Profile notification setting.' : 'Search saved with alerts paused.'}</p>
        <Link className="font-semibold underline" to="/help?tab=inbox&view=updates">Manage saved searches in your inbox</Link>
        {onCancel && <button className="btn-ghost block" onClick={onCancel}>Close</button>}
    </div>;
    return <form onSubmit={submit} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4" aria-label={initial.id ? 'Edit saved search' : 'Review and save search'}>
        <h3 className="font-bold">{initial.id ? 'Edit saved search' : 'Review and save search'}</h3>
        <p className="text-sm text-slate-600">Save public keywords only, not personal or medical details. This search does not use your private profile or save its resources to My Directory.</p>
        <label htmlFor={`${prefix}-query`} className="block text-sm font-semibold">Search keywords</label>
        <input id={`${prefix}-query`} className="input-field w-full" autoFocus required minLength={2} maxLength={120} value={query} disabled={task.pending}
            onChange={(event) => { setQuery(event.target.value); setReviewed(false); }} />
        <label htmlFor={`${prefix}-type`} className="block text-sm font-semibold">Resource type</label>
        <select id={`${prefix}-type`} className="input-field w-full" value={type} disabled={task.pending} onChange={(event) => { setType(event.target.value); setReviewed(false); }}>
            <option value="all">All resources</option><option value="hard">Places</option><option value="soft">Programmes/services</option>
        </select>
        <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-teal-700" checked={enabled} disabled={task.pending}
            onChange={(event) => { setEnabled(event.target.checked); setReviewed(false); }} />Alert me in the inbox when new public matches appear</label>
        <p className="text-xs text-slate-600">Existing matches will not create alerts. Editing or resuming starts a fresh check without catch-up alerts. No device push, email or WhatsApp messages are sent.</p>
        <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0 accent-teal-700" required checked={reviewed} disabled={task.pending}
            onChange={(event) => setReviewed(event.target.checked)} />I reviewed these keywords and my alert choice</label>
        {task.error && <p role="alert" className="text-sm text-red-700">{task.error}</p>}
        <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={!reviewed || task.pending}>{task.pending ? 'Saving…' : initial.id ? 'Save changes' : 'Save search'}</button>
            {onCancel && <button type="button" className="btn-ghost" disabled={task.pending} onClick={onCancel}>Cancel</button>}</div>
    </form>;
}
