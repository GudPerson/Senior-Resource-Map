import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createSavedSearchApi } from '../../lib/savedSearches.js';
import { safeGuideActionRoute, signalSupportUpdate } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import SavedSearchForm from './SavedSearchForm.jsx';

const typeLabels = { all: 'All resources', hard: 'Places', soft: 'Programmes/services' };

function SearchResults({ api, id, onClose }) {
    const [page, setPage] = useState(1);
    const [state, setState] = useState({ loading: true });
    const heading = useRef(null);
    useEffect(() => {
        const controller = new AbortController();
        setState({ loading: true });
        Promise.resolve().then(() => api.results(id, page, controller.signal)).then((data) => {
            if (!controller.signal.aborted) { setState({ data }); heading.current?.focus(); }
        }).catch((error) => { if (!controller.signal.aborted) setState({ error: error.message }); });
        return () => controller.abort();
    }, [api, id, page]);
    return <section className="card space-y-3 p-4" aria-label="Current saved-search results">
        <div className="flex flex-wrap items-start justify-between gap-2"><h3 ref={heading} tabIndex={-1} className="font-bold outline-none">Current search results</h3><button className="btn-ghost" onClick={onClose}>Close results</button></div>
        {state.loading && <p role="status">Checking the public directory…</p>}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state.data && <><p className="break-words text-sm">“{state.data.criteria.query}” · {typeLabels[state.data.criteria.type]} · page {page}</p>
            {!state.data.results.length && <p className="text-sm">No public matches are available now. The earlier alert does not guarantee a resource is still available.</p>}
            {state.data.results.map((resource) => <article key={`${resource.type}:${resource.id}`} className="space-y-1 rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">{typeLabels[resource.type]}</p>
                <h4 className="break-words font-semibold"><Link className="text-brand-700 underline" to={safeGuideActionRoute(resource.route) || '/discover'}>{resource.name}</Link></h4>
                {resource.address && <p className="break-words text-sm">{resource.address}</p>}
            </article>)}
            <div className="flex flex-wrap gap-2">{page > 1 && <button className="btn-ghost" onClick={() => setPage((value) => value - 1)}>Previous results</button>}
                {state.data.hasMore && <button className="btn-ghost" onClick={() => setPage((value) => value + 1)}>Next results</button>}</div>
            <p className="text-xs text-slate-500">Check dates, fees, availability and registration with the provider.</p>
        </>}
    </section>;
}

export default function SavedSearchPanel() {
    const api = useMemo(() => createSavedSearchApi(), []);
    const [state, setState] = useState({ loading: true });
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [notice, setNotice] = useState('');
    const [resultRevision, setResultRevision] = useState(0);
    const [params, setParams] = useSearchParams();
    const task = useSupportTask();
    const heading = useRef(null);
    useEffect(() => {
        const controller = new AbortController();
        api.list(controller.signal).then((data) => { if (!controller.signal.aborted) setState({ data }); })
            .catch((error) => { if (!controller.signal.aborted) setState({ error: error.message }); });
        return () => controller.abort();
    }, [api]);
    const applyData = (data) => { setState({ data }); setResultRevision((n) => n + 1); signalSupportUpdate(); };
    const refresh = () => task.run(() => api.list(), applyData);
    const mutate = (work, message) => task.run(async () => { await work(); return api.list(); }, (data) => {
        applyData(data); setNotice(message || 'Search updated.'); setDeleting(null); setEditing(null); heading.current?.focus();
        if (params.get('search') && !data.searches.some((search) => search.id === params.get('search'))) {
            const next = new URLSearchParams(params); next.delete('search'); setParams(next);
        }
    });
    const closeResults = () => { const next = new URLSearchParams(params); next.delete('search'); setParams(next); heading.current?.focus(); };
    const digests = new Map((state.data?.digests || []).map((item) => [item.id, item]));
    return <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="saved-search-heading">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 ref={heading} id="saved-search-heading" tabIndex={-1} className="text-xl font-bold outline-none">Saved-search alerts</h2>
            <p className="mt-1 text-sm text-slate-600">Follow public searches without saving every result.</p></div><button className="btn-ghost" disabled={task.pending} onClick={refresh}>Refresh searches</button></div>
        {state.loading && <p role="status">Loading saved searches…</p>}
        {(state.error || task.error) && <p role="alert" className="text-sm text-red-700">{task.error || state.error}</p>}
        {notice && <p role="status" className="text-sm text-brand-800">{notice}</p>}
        {state.data && !state.error && !task.error && <>
            {!state.data.masterEnabled && <p className="rounded-lg bg-amber-50 p-3 text-sm">Your Profile has paused in-app notifications. Saved choices remain available. <Link to="/dashboard/profile" className="underline">Open Profile</Link></p>}
            <p className="text-xs text-slate-500">{state.data.searches.length} of {state.data.limit} searches saved. Checks continue after you close the app; updates appear here, not as device push notifications.</p>
            {!editing && <button className="btn-ghost" disabled={task.pending || state.data.searches.length >= state.data.limit} onClick={() => setEditing({ query: '', type: 'all', enabled: false })}>Save a new search</button>}
            {editing && <SavedSearchForm key={editing.id || 'new'} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
            {params.get('search') && <SearchResults key={`${params.get('search')}:${resultRevision}`} api={api} id={params.get('search')} onClose={closeResults} />}
            {state.data.searches.map((search) => {
                const digest = digests.get(search.id);
                return <article key={search.id} className={`card space-y-3 p-4 ${digest?.unread ? 'border-brand-300' : ''}`}>
                    <div className="flex flex-wrap justify-between gap-2"><h3 className="min-w-0 break-words font-bold">“{search.query}”</h3>
                        {digest?.unread && <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">Unread</span>}</div>
                    <p className="text-xs text-slate-500">{typeLabels[search.type]} · {!search.enabled ? 'Alerts paused' : !search.active ? 'Paused in Profile' : search.preparing ? 'Checking existing matches first' : 'Alerts on'}</p>
                    {digest && <div className="space-y-2 rounded-lg bg-brand-50 p-3"><p className="text-sm">{digest.message}</p>
                        <time className="text-xs text-slate-500" dateTime={digest.updatedAt}>{new Date(digest.updatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} (Singapore)</time>
                        <div className="flex flex-wrap gap-2"><button className="btn-ghost" disabled={task.pending || Boolean(editing)} onClick={() => mutate(() => api.setState(search.id, digest.noticeId, digest.revision, digest.unread ? 'read' : 'unread'), 'Search update changed.')}>{digest.unread ? 'Mark read' : 'Mark unread'}</button>
                            <button className="btn-ghost" disabled={task.pending || Boolean(editing)} onClick={() => mutate(() => api.setState(search.id, digest.noticeId, digest.revision, 'dismiss'), 'Search update dismissed.')}>Dismiss search update</button></div>
                    </div>}
                    <div className="flex flex-wrap gap-2"><Link className="btn-primary" to={`/help?tab=inbox&view=updates&search=${search.id}`} onClick={() => setResultRevision((value) => value + 1)}>View current results</Link>
                        <button className="btn-ghost" disabled={task.pending || Boolean(editing)} onClick={() => setEditing(search)}>Edit search</button>
                        <button className="btn-ghost" disabled={task.pending || Boolean(editing)} onClick={() => mutate(() => api.edit(search.id, { query: search.query, type: search.type, enabled: !search.enabled, reviewed: true, revision: search.revision }), search.enabled ? 'Search alerts paused and its earlier update cleared.' : 'Search alerts resumed. Current matches will not create catch-up alerts.')}>{search.enabled ? 'Pause alerts' : 'Resume alerts'}</button>
                        <button className="btn-ghost" disabled={task.pending || Boolean(editing)} onClick={() => setDeleting(search.id)}>Delete search</button>
                    </div>
                    {deleting === search.id && <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm">Delete this saved search and its alert history? Resources in My Directory and calendar plans will stay unchanged.</p>
                        <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={task.pending} onClick={() => mutate(() => api.remove(search.id, search.revision), 'Saved search and its alert history deleted. Your saved resources and calendar plans were not changed.')}>Confirm delete search</button>
                            <button className="btn-ghost" disabled={task.pending} onClick={() => setDeleting(null)}>Keep search</button></div>
                    </div>}
                </article>;
            })}
        </>}
    </section>;
}
