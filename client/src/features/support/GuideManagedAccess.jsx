import { useEffect, useId, useRef, useState } from 'react';
import { useSupportTask } from './useSupportTask.js';

function resourceLabel(type) {
    return type === 'hard' ? 'Place' : type === 'group' ? 'Resource Group' : 'Programme/service';
}

function accessMessage(resource) {
    const label = resourceLabel(resource.type);
    const yesNo = (allowed) => allowed ? 'yes' : 'no';
    return `I checked the current management permissions for ${label} “${resource.name}” on this account.\n`
        + `Edit: ${yesNo(resource.permissions.canEdit)}. Hide or show: ${yesNo(resource.permissions.canHide)}. Delete: ${yesNo(resource.permissions.canDelete)}.\n`
        + 'These are listing-level permissions, not a change to the listing. The app checks its current state and permission again before any edit, visibility change, or deletion.';
}

export default function GuideManagedAccess({ api, onResult, open }) {
    const fieldId = useId();
    const queryField = useRef(null);
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [selectionError, setSelectionError] = useState('');
    const search = useSupportTask();
    const check = useSupportTask();
    useEffect(() => { if (open) queryField.current?.focus(); }, [open]);

    function find(event) {
        event.preventDefault();
        const q = query.trim();
        if (q.length < 2) return;
        setResult(null); setSelectionError('');
        search.run(() => api.guideManagedAccess(q), (response) => setResult({ ...response, query: q }));
    }

    function select(resource) {
        setSelectionError('');
        // Re-read the managed scope at selection time. A previous search result is never authority.
        check.run(() => api.guideManagedAccess(result.query), (response) => {
            const current = response.resources?.find((item) => item.id === resource.id && item.type === resource.type);
            if (!current) {
                setSelectionError('That listing is no longer in these search results. Search again to check its access.');
                setResult(null);
                return;
            }
            onResult({ question: `What can I change on ${current.name}?`, topicId: 'selected-resource-access',
                message: accessMessage(current), input: null, answerSource: 'account',
                actions: [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }] });
        });
    }

    return <div className="space-y-3 py-3">
        <p className="text-sm text-slate-600">Search resources assigned to this account, then choose the exact Place, Programme/service or Resource Group to check. This read-only check stays out of AI chat and saved Guide history.</p>
        <form className="flex flex-wrap gap-2" onSubmit={find}>
            <label htmlFor={`${fieldId}-query`} className="sr-only">Managed listing name</label>
            <input id={`${fieldId}-query`} ref={queryField} type="search" required minLength={2} maxLength={120} value={query}
                onChange={(event) => setQuery(event.target.value)} placeholder="Search a managed listing name"
                className="input-field min-w-0 flex-1" disabled={search.pending || check.pending} />
            <button type="submit" className="btn-ghost" disabled={search.pending || check.pending || query.trim().length < 2}>{search.pending ? 'Searching…' : 'Find'}</button>
        </form>
        {(search.error || check.error || selectionError) && <p role="alert" className="text-sm text-red-700">{search.error || check.error || selectionError}</p>}
        {result && <div aria-live="polite" className="space-y-2">
            {result.canManage === false ? <p className="text-sm text-slate-600">This account has no Manage My Resources access. Saving a resource in My Directory does not grant management rights.</p>
                : !result.resources?.length ? <p className="text-sm text-slate-600">No assigned Place, Programme/service or Resource Group matched. Try a shorter name.</p>
                    : <ul className="space-y-2">{result.resources.map((resource) => <li key={`${resource.type}:${resource.id}`}>
                        <button type="button" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                            disabled={check.pending} onClick={() => select(resource)}>
                            <span className="block text-xs text-slate-500">{resourceLabel(resource.type)}</span>
                            <span className="font-semibold text-slate-800">{resource.name}</span>
                            <span className="block text-xs text-brand-700">Check current access</span>
                        </button>
                    </li>)}</ul>}
            {result.hasMore && <p className="text-xs text-slate-500">More matches exist. Use a more specific name to find the right listing.</p>}
        </div>}
    </div>;
}
