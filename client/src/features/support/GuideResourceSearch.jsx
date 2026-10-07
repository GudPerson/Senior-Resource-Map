import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSavedAssetsContext } from '../../contexts/SavedAssetsContext.jsx';
import { buildSavedAssetKey } from '../../lib/savedAssets.js';
import { safeGuideActionRoute } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import SavedSearchForm from './SavedSearchForm.jsx';
import { restoreSupportFocus } from './supportFocus.js';

// Public directory search keeps its existing visibility-aware API and save flow.
export default function GuideResourceSearch({ api, canSaveHistory, canSaveResource = false, initialCriteria }) {
    const fieldId = useId();
    const { savedAssetKeys, refreshSavedAssets } = useSavedAssetsContext();
    const [query, setQuery] = useState(initialCriteria?.query || '');
    const [type, setType] = useState(initialCriteria?.type || 'all');
    const [searchState, setSearchState] = useState(null);
    const [saveCriteria, setSaveCriteria] = useState(null);
    const [reviewResource, setReviewResource] = useState(null);
    const [savedResource, setSavedResource] = useState(null);
    const resultHeading = useRef(null);
    const reviewCard = useRef(null);
    const savedStatus = useRef(null);
    const resourceQuery = useRef(null);
    const searchError = useRef(null);
    const searchOrigin = useRef(null);
    const search = useSupportTask();
    const save = useSupportTask();
    useEffect(() => {
        if (searchState) restoreSupportFocus(resultHeading.current, searchOrigin.current);
        searchOrigin.current = null;
    }, [searchState]);
    useEffect(() => { if (search.error) restoreSupportFocus(searchError.current, searchOrigin.current); }, [search.error]);
    useEffect(() => {
        if (!reviewResource) return;
        reviewCard.current?.focus({ preventScroll: true });
        reviewCard.current?.scrollIntoView({ block: 'nearest' });
    }, [reviewResource]);
    useEffect(() => { if (savedResource) savedStatus.current?.scrollIntoView({ block: 'nearest' }); }, [savedResource]);
    useEffect(() => {
        if (!initialCriteria) return;
        setQuery(initialCriteria.query); setType(initialCriteria.type);
        setReviewResource(null); setSavedResource(null);
        resourceQuery.current?.focus();
    }, [initialCriteria]);
    function find(page = 1) {
        searchOrigin.current = document.activeElement;
        const criteria = page === 1 ? { query: query.trim(), type, page } : { ...searchState.criteria, page };
        search.run(() => api.search(criteria), (result) => {
            setSearchState({ ...result, criteria }); setReviewResource(null); setSavedResource(null);
        });
    }
    function saveReviewedResource() {
        if (!reviewResource || save.pending) return;
        const selected = reviewResource;
        save.run(() => api.guideSaveResource({ resourceType: selected.type, resourceId: selected.id }), (result) => {
            if (!result.saved) return;
            setSavedResource({ ...selected, alreadySaved: result.alreadySaved });
            setReviewResource(null);
            void refreshSavedAssets();
        });
    }
    return (
        <div className="space-y-4" aria-labelledby={`${fieldId}-heading`}>
            <div><h2 id={`${fieldId}-heading`} className="text-base font-semibold">Search real resources</h2>
                <p className="mt-2 text-sm text-slate-600">Search the public directory by name, service, tag, or address. Use keywords, such as “active ageing” or “Havelock”. No private profile is used.{canSaveResource ? ' Choose a result to review before saving it to your private My Directory.' : ''}</p></div>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); find(); }}>
                <label className="block text-sm font-semibold" htmlFor={`${fieldId}-query`}>Resource keywords</label>
                <input id={`${fieldId}-query`} ref={resourceQuery} type="search" className="input-field w-full" required minLength={2} maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} />
                <label htmlFor={`${fieldId}-type`} className="sr-only">Resource type</label>
                <select id={`${fieldId}-type`} className="input-field w-full" value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="all">All resources</option><option value="hard">Places</option><option value="soft">Programmes/services</option>
                </select>
                <button className="btn-primary" disabled={search.pending}>{search.pending ? 'Searching…' : 'Search directory'}</button>
            </form>
            {search.error && <p role="alert" ref={searchError} tabIndex={-1} className="text-sm text-red-700">{search.error}</p>}
            {save.error && <p role="alert" className="text-sm text-red-700">{save.error}</p>}
            {savedResource && <p ref={savedStatus} role="status" className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">{savedResource.alreadySaved ? 'Already saved' : 'Saved'}: {savedResource.name}. <Link className="font-semibold underline underline-offset-2" to="/my-directory">Open My Directory</Link></p>}
            {reviewResource && <div ref={reviewCard} tabIndex={-1} className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4" aria-label="Review resource save">
                <p className="text-sm font-semibold text-slate-900">Save {reviewResource.name} to My Directory?</p>
                <p className="text-xs text-slate-600">{reviewResource.type === 'hard' ? 'Place' : 'Programme/service'}{reviewResource.address ? ` · ${reviewResource.address}` : ''}. Saving keeps it in your private list; it does not register you or add it to a Care Map.</p>
                <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary text-sm" disabled={save.pending} onClick={saveReviewedResource}>{save.pending ? 'Saving…' : 'Save to My Directory'}</button>
                    <button type="button" className="btn-ghost text-sm" disabled={save.pending} onClick={() => setReviewResource(null)}>Cancel</button></div>
            </div>}
            {canSaveHistory && saveCriteria && <SavedSearchForm key={`${saveCriteria.query}:${saveCriteria.type}`} initial={saveCriteria} onCancel={() => setSaveCriteria(null)} />}
            {searchState && <div aria-live="polite" className="space-y-3">
                <h3 ref={resultHeading} tabIndex={-1} className="text-sm text-slate-600">Results for “{searchState.criteria.query}” · page {searchState.page}</h3>
                {!searchState.results.length && <p>No public matches found. Try a shorter name, service, or address.</p>}
                {searchState.results.map((resource) => <article key={`${resource.type}:${resource.id}`} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">{resource.type === 'hard' ? 'Place' : 'Programme/service'}{resource.category ? ` · ${resource.category}` : ''}</p>
                    <h3 className="mt-1 font-bold"><Link className="text-brand-700 underline underline-offset-4" to={safeGuideActionRoute(resource.route) || '/discover'}>{resource.name}</Link></h3>
                    {resource.address && <p className="mt-2 text-sm">{resource.address}</p>}
                    {canSaveResource && <div className="mt-3">{savedAssetKeys.has(buildSavedAssetKey(resource.type, resource.id))
                        ? <span className="text-xs font-medium text-brand-700">Saved in My Directory</span>
                        : <button type="button" className="btn-ghost text-sm" disabled={save.pending} onClick={() => { setReviewResource(resource); setSavedResource(null); }}>Review save</button>}</div>}
                </article>)}
                <div className="flex flex-wrap gap-2">
                    {searchState.page > 1 && <button className="btn-ghost" disabled={search.pending} onClick={() => find(searchState.page - 1)}>Previous page</button>}
                    {searchState.hasMore && <button className="btn-ghost" disabled={search.pending} onClick={() => find(searchState.page + 1)}>Next page</button>}
                    <Link className="btn-ghost" to={`/discover?${new URLSearchParams({ q: searchState.criteria.query })}`}>Continue in Discover</Link>
                    {canSaveHistory && <button className="btn-ghost" onClick={() => setSaveCriteria(searchState.criteria)}>Save this search</button>}
                </div>
                <p className="text-xs text-slate-500">Check current dates, fees, availability, and registration with the provider.</p>
            </div>}
        </div>
    );
}
