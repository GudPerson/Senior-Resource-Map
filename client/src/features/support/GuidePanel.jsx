import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { safeGuideActionRoute } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import GuideHistory from './GuideHistory.jsx';
import SavedSearchForm from './SavedSearchForm.jsx';
import { restoreSupportFocus } from './supportFocus.js';

export default function GuidePanel({ api, signedIn, canSaveHistory = false, onDraftReport }) {
    const [topics, setTopics] = useState([]);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [query, setQuery] = useState('');
    const [type, setType] = useState('all');
    const [searchState, setSearchState] = useState(null);
    const [saveCriteria, setSaveCriteria] = useState(null);
    const [historyPending, setHistoryPending] = useState(false);
    const answerHeading = useRef(null);
    const questionInput = useRef(null);
    const resultHeading = useRef(null);
    const resourceQuery = useRef(null);
    const helpError = useRef(null);
    const searchError = useRef(null);
    const helpOrigin = useRef(null);
    const searchOrigin = useRef(null);
    const help = useSupportTask();
    const search = useSupportTask();
    useEffect(() => {
        restoreSupportFocus(messages.length ? answerHeading.current : questionInput.current, helpOrigin.current);
        helpOrigin.current = null;
    }, [messages]);
    useEffect(() => {
        if (searchState) restoreSupportFocus(resultHeading.current, searchOrigin.current);
        searchOrigin.current = null;
    }, [searchState]);
    useEffect(() => { if (help.error) restoreSupportFocus(helpError.current, helpOrigin.current); }, [help.error]);
    useEffect(() => { if (search.error) restoreSupportFocus(searchError.current, searchOrigin.current); }, [search.error]);
    useEffect(() => {
        const controller = new AbortController();
        api.topics(controller.signal).then((result) => setTopics(result.topics)).catch(() => {});
        return () => controller.abort();
    }, [api]);
    function ask(input, label) {
        helpOrigin.current = document.activeElement;
        help.run(() => api.answer(input), (answer) => {
            setMessages((items) => [...items, { id: crypto.randomUUID(), question: label, ...answer }].slice(-20));
            setQuestion('');
        });
    }
    function find(page = 1) {
        searchOrigin.current = document.activeElement;
        const criteria = page === 1 ? { query: query.trim(), type, page } : { ...searchState.criteria, page };
        search.run(() => api.search(criteria), (result) => setSearchState({ ...result, criteria }));
    }
    return <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="guide-heading">
            <div><h2 id="guide-heading" className="text-xl font-bold">How can I help?</h2>
                <p className="mt-2 text-sm text-slate-600">Verified help with using CareAround. The Guide cannot give care advice, book services, or change your maps for you.</p></div>
            <div className="flex flex-wrap gap-2">{topics.map((topic) => <button type="button" className="btn-ghost text-sm" key={topic.id}
                disabled={help.pending || historyPending} onClick={() => ask({ topicId: topic.id }, topic.title)}>{topic.title}</button>)}</div>
            {canSaveHistory ? <GuideHistory api={api} messages={messages} busy={help.pending} onBusyChange={setHistoryPending}
                onRestore={(items) => { helpOrigin.current = document.activeElement; setMessages(items); setQuestion(''); }} onStartNew={() => { helpOrigin.current = document.activeElement; setMessages([]); setQuestion(''); }} />
                : <p className="text-xs text-slate-500">This Guide conversation is not saved. Sign in outside User View to optionally save private history.</p>}
            <div className="max-h-[50svh] space-y-4 overflow-y-auto" role="log" aria-label="Conversation with CareAround Guide" aria-live="polite">
                {messages.map((message, index) => <article className="space-y-3 border-t border-slate-200 pt-4" key={message.id}>
                    <h3 ref={index === messages.length - 1 ? answerHeading : undefined} tabIndex={-1} className="font-semibold">You: {message.question}</h3>
                    <div className="rounded-xl bg-brand-50 p-4"><p className="text-xs font-bold text-brand-700">CareAround Guide</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
                        {message.resources?.length > 0 && <ul className="mt-3 space-y-2">{message.resources.map((resource) => <li key={`${resource.type}:${resource.id}`}>
                            <Link className="text-sm font-semibold text-brand-700 underline" to={safeGuideActionRoute(resource.route) || '/discover'}>{resource.name}</Link>
                            {resource.address && <p className="text-xs text-slate-600">{resource.address}</p>}
                        </li>)}</ul>}
                        {message.criteria && <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => { setQuery(message.criteria.query); setType(message.criteria.type); resourceQuery.current?.focus(); }}>Use these keywords in resource search</button>}
                        <div className="mt-3 flex flex-wrap gap-2">{message.actions?.map((action) => {
                            const route = safeGuideActionRoute(action.route, signedIn);
                            if (route === '/help?tab=report') return null;
                            return route ? <Link className="btn-ghost text-sm" key={route} to={route}>{action.label}</Link> : null;
                        })}
                            {message.input && onDraftReport && <button type="button" className="btn-ghost text-sm" onClick={() => onDraftReport(message)}>Use this question in a report</button>}
                        </div></div>
                </article>)}
            </div>
            <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); ask({ question }, question); }}>
                <label htmlFor="guide-question" className="block text-sm font-semibold">Ask how to use CareAround</label>
                <textarea id="guide-question" ref={questionInput} className="input-field w-full" required maxLength={600} rows={2} value={question} onChange={(event) => setQuestion(event.target.value)}
                    placeholder="How do I remove saved resources safely?" disabled={help.pending || historyPending} />
                <p className="text-xs text-slate-500">Do not include passwords, private links, identity numbers, or medical details.</p>
                <p className="text-xs text-slate-500">You can also ask “Find Havelock” to search the public directory.</p>
                {help.error && <p role="alert" ref={helpError} tabIndex={-1} className="text-sm text-red-700">{help.error}</p>}
                <button className="btn-primary" disabled={help.pending || historyPending || !question.trim()}>{help.pending ? 'Checking…' : 'Ask Guide'}</button>
            </form>
        </section>
        <section className="card space-y-4 p-4 sm:p-6" aria-labelledby="guide-search-heading">
            <div><h2 id="guide-search-heading" className="text-xl font-bold">Search real resources</h2>
                <p className="mt-2 text-sm text-slate-600">Search the public directory by name, service, tag, or address. Use keywords, such as “active ageing” or “Havelock”. No private profile is used.</p></div>
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); find(); }}>
                <label className="block text-sm font-semibold" htmlFor="guide-resource-query">Resource keywords</label>
                <input id="guide-resource-query" ref={resourceQuery} type="search" className="input-field w-full" required minLength={2} maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} />
                <label htmlFor="guide-resource-type" className="sr-only">Resource type</label>
                <select id="guide-resource-type" className="input-field w-full" value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="all">All resources</option><option value="hard">Places</option><option value="soft">Programmes/services</option>
                </select>
                <button className="btn-primary" disabled={search.pending}>{search.pending ? 'Searching…' : 'Search directory'}</button>
            </form>
            {search.error && <p role="alert" ref={searchError} tabIndex={-1} className="text-sm text-red-700">{search.error}</p>}
            {canSaveHistory && saveCriteria && <SavedSearchForm key={`${saveCriteria.query}:${saveCriteria.type}`} initial={saveCriteria} onCancel={() => setSaveCriteria(null)} />}
            {searchState && <div aria-live="polite" className="space-y-3">
                <h3 ref={resultHeading} tabIndex={-1} className="text-sm text-slate-600">Results for “{searchState.criteria.query}” · page {searchState.page}</h3>
                {!searchState.results.length && <p>No public matches found. Try a shorter name, service, or address.</p>}
                {searchState.results.map((resource) => <article key={`${resource.type}:${resource.id}`} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs text-slate-500">{resource.type === 'hard' ? 'Place' : 'Programme/service'}{resource.category ? ` · ${resource.category}` : ''}</p>
                    <h3 className="mt-1 font-bold"><Link className="text-brand-700 underline underline-offset-4" to={safeGuideActionRoute(resource.route) || '/discover'}>{resource.name}</Link></h3>
                    {resource.address && <p className="mt-2 text-sm">{resource.address}</p>}
                </article>)}
                <div className="flex flex-wrap gap-2">
                    {searchState.page > 1 && <button className="btn-ghost" disabled={search.pending} onClick={() => find(searchState.page - 1)}>Previous page</button>}
                    {searchState.hasMore && <button className="btn-ghost" disabled={search.pending} onClick={() => find(searchState.page + 1)}>Next page</button>}
                    <Link className="btn-ghost" to={`/discover?${new URLSearchParams({ q: searchState.criteria.query })}`}>Continue in Discover</Link>
                    {canSaveHistory && <button className="btn-ghost" onClick={() => setSaveCriteria(searchState.criteria)}>Save this search</button>}
                </div>
                <p className="text-xs text-slate-500">Check current dates, fees, availability, and registration with the provider.</p>
            </div>}
        </section>
    </div>;
}
