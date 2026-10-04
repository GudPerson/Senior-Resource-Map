import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Search, Sparkles, X } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useGuideAssistant } from '../support/GuideAssistant.jsx';
import { SUPPORT_UI_ENABLED } from '../../lib/supportInbox.js';
import publicLibrary from '../../generated/helpArticles.json';
import HelpArticle from './HelpArticle.jsx';
import { createHelpArticlesApi } from './helpApi.js';
import { canReadAccountHelp, helpArticleRoute, helpIdentityKey, mergeHelpArticles, mergeHelpCategories, normalizeHelpQuery, searchHelpArticles } from './helpLibrary.js';
import HelpContentPage from '../help-content/HelpContentPage.jsx';
import { createHelpContentApi } from '../help-content/helpContentApi.js';

// Restricted responses live only in this mounted identity. Clear them before
// rechecking on navigation/focus; an aborted response can never restore them.
function usePermittedHelp(api, canRead, slug, query) {
    const [refresh, setRefresh] = useState(0);
    const requestKey = `${slug}:${query}:${refresh}`;
    const [state, setState] = useState({ key: requestKey, pending: canRead, data: null, error: false });
    useEffect(() => {
        const recheck = () => { if (document.visibilityState !== 'hidden') setRefresh((value) => value + 1); };
        window.addEventListener('focus', recheck); document.addEventListener('visibilitychange', recheck);
        return () => { window.removeEventListener('focus', recheck); document.removeEventListener('visibilitychange', recheck); };
    }, []);
    useEffect(() => {
        if (!canRead) { setState({ key: requestKey, pending: false, data: null, error: false }); return undefined; }
        const controller = new AbortController();
        setState({ key: requestKey, pending: true, data: null, error: false });
        const request = slug ? api.article(slug, controller.signal) : query ? api.search(query, controller.signal) : api.list(controller.signal);
        request.then((data) => { if (!controller.signal.aborted) setState({ key: requestKey, pending: false, data, error: false }); })
            .catch(() => { if (!controller.signal.aborted) setState({ key: requestKey, pending: false, data: null, error: true }); });
        return () => controller.abort();
    }, [api, canRead, slug, query, requestKey]);
    const current = state.key === requestKey && canRead ? state : { pending: canRead, data: null, error: false };
    return { ...current, retry: () => setRefresh((value) => value + 1) };
}

function HelpCentreIndex({ api, canRead, onOpenGuide }) {
    const [params, setParams] = useSearchParams();
    const query = normalizeHelpQuery(params.get('q') || '');
    const selectedCategory = params.get('category') || '';
    const [draftQuery, setDraftQuery] = useState(query);
    const inputId = useId();
    const searchInput = useRef(null);
    const permitted = usePermittedHelp(api, canRead, '', query);
    useEffect(() => setDraftQuery(query), [query]);
    const publicResults = useMemo(() => searchHelpArticles(publicLibrary.articles, query), [query]);
    const articles = mergeHelpArticles(publicResults, canRead ? permitted.data?.articles || [] : []);
    const categories = mergeHelpCategories(publicLibrary.categories, canRead ? permitted.data?.categories || [] : []);
    const visibleArticles = selectedCategory ? articles.filter((article) => article.category === selectedCategory) : articles;
    const categoryCounts = new Map();
    for (const article of articles) categoryCounts.set(article.category, (categoryCounts.get(article.category) || 0) + 1);
    const categoryTitle = categories.find((category) => category.id === selectedCategory)?.title;
    const backRoute = `/help-centre${params.toString() ? `?${params}` : ''}`;
    function updateParams(nextQuery, category = selectedCategory) {
        const next = new URLSearchParams();
        if (normalizeHelpQuery(nextQuery)) next.set('q', normalizeHelpQuery(nextQuery));
        if (category) next.set('category', category);
        setParams(next);
    }
    return <>
        <header className="border-b border-slate-200 pb-7">
            <Link to="/discover" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} aria-hidden="true" />Back to Discover</Link>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Help with CareAround</p><h1 id="help-centre-title" tabIndex={-1} className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">CareAround Help Centre</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">Clear steps for finding resources, making maps, and using your CareAround account.</p></div>
                {SUPPORT_UI_ENABLED && <Link to="/help?tab=inbox" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700">Guide & inbox<ArrowUpRight size={16} aria-hidden="true" /></Link>}
            </div>
            <form className="mt-6 max-w-3xl" role="search" onSubmit={(event) => { event.preventDefault(); updateParams(draftQuery); }}>
                <label htmlFor={inputId} className="sr-only">Search help articles</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white p-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                    <Search size={20} className="ml-2 shrink-0 text-slate-400" aria-hidden="true" /><input id={inputId} ref={searchInput} type="search" className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-slate-900 outline-none sm:text-base" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} maxLength={120} placeholder="Search for a task or button, like Personal place" />
                    {draftQuery && <button type="button" aria-label="Clear help search" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => { setDraftQuery(''); updateParams(''); searchInput.current?.focus(); }}><X size={16} aria-hidden="true" /></button>}
                    <button type="submit" className="btn-primary shrink-0 px-4 text-sm">Search</button>
                </div>
            </form>
        </header>
        <div className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
            <nav aria-label="Help categories" className="min-w-0"><h2 className="mb-3 text-sm font-bold text-slate-800">Browse by topic</h2><ul className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible">
                <li className="shrink-0"><button type="button" className={`flex min-h-[44px] w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm lg:whitespace-normal ${!selectedCategory ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700'}`} aria-pressed={!selectedCategory} onClick={() => updateParams(query, '')}><span>All topics</span><span className="text-xs tabular-nums">{articles.length}</span></button></li>
                {categories.filter((category) => categoryCounts.has(category.id) || selectedCategory === category.id).map((category) => <li className="shrink-0" key={category.id}><button type="button" aria-pressed={selectedCategory === category.id} onClick={() => updateParams(query, category.id)} className={`flex min-h-[44px] w-full items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm lg:whitespace-normal ${selectedCategory === category.id ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-700'}`}><span>{category.title}</span><span className="text-xs tabular-nums">{categoryCounts.get(category.id) || 0}</span></button></li>)}
            </ul></nav>
            <section className="min-w-0" aria-labelledby="help-results-title">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-3"><h2 id="help-results-title" className="text-lg font-bold text-slate-900">{query ? `Results for “${query}”` : categoryTitle || 'All help articles'}</h2><p role="status" className="text-xs text-slate-500">{visibleArticles.length} {visibleArticles.length === 1 ? 'article' : 'articles'}</p></div>
                {canRead && permitted.pending && <p role="status" className="pt-4 text-xs text-slate-500">Checking additional help available to your account…</p>}
                {canRead && permitted.error && <p role="status" className="pt-4 text-xs leading-relaxed text-slate-500">Additional help could not be checked. Public articles are still available. <button type="button" onClick={permitted.retry} className="min-h-[36px] font-semibold text-brand-700 underline underline-offset-4">Try again</button></p>}
                {visibleArticles.length > 0 ? <ul className="divide-y divide-slate-200">{visibleArticles.map((article) => <li key={article.id}><Link className="group flex min-h-[100px] items-start gap-3 py-5 sm:gap-4" to={helpArticleRoute(article.slug)} state={{ helpBackRoute: backRoute }}>
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BookOpen size={18} aria-hidden="true" /></div><div className="min-w-0 flex-1"><h3 className="break-words text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-brand-700 motion-reduce:transition-none">{article.title}</h3><p className="mt-1.5 break-words text-sm leading-relaxed text-slate-600">{article.summary}</p><p className="mt-2 text-[11px] font-medium text-slate-500">{categories.find((category) => category.id === article.category)?.title || 'CareAround help'}</p></div><ChevronRight size={18} className="mt-1 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                </Link></li>)}</ul> : <div className="py-12"><h3 className="text-base font-semibold text-slate-900">No matching articles</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">Try the name of a feature or a shorter phrase, such as map, sharing, or Personal place.</p><button type="button" onClick={() => { setDraftQuery(''); updateParams('', ''); searchInput.current?.focus(); }} className="btn-ghost mt-5 text-sm">Show all help articles</button></div>}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5"><p className="text-sm text-slate-600">Prefer to ask a question?</p>{onOpenGuide ? <button type="button" onClick={onOpenGuide} className="btn-ghost inline-flex items-center gap-2 text-sm"><Sparkles size={16} aria-hidden="true" />Ask CareAround Guide</button> : <Link to="/discover" className="text-sm font-semibold text-brand-700 underline underline-offset-4">Return to Discover</Link>}</div>
            </section>
        </div>
    </>;
}

function HelpArticleLoader({ api, canRead, slug, onOpenGuide }) {
    const location = useLocation();
    const publicArticle = publicLibrary.articles.find((article) => article.slug === slug);
    const permitted = usePermittedHelp(api, canRead && !publicArticle && Boolean(helpArticleRoute(slug)), slug, '');
    const article = publicArticle || (canRead && !permitted.pending && !permitted.error ? permitted.data?.article : null);
    const backCandidate = location.state?.helpBackRoute;
    const backRoute = typeof backCandidate === 'string' && /^\/help-centre(?:\?[^#]*)?$/.test(backCandidate) ? backCandidate : '/help-centre';
    useEffect(() => {
        if (!article) return undefined;
        const frame = requestAnimationFrame(() => {
            const sectionId = location.hash.slice(1);
            const section = article.sections.find((item) => item.id === sectionId);
            const target = section ? document.getElementById(section.id) : document.getElementById('help-article-title');
            target?.focus({ preventScroll: true });
            if (section) target?.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
        });
        return () => cancelAnimationFrame(frame);
    }, [article, location.hash, location.key]);
    if (article?.slug === slug && Array.isArray(article.sections)) {
        const permittedRelated = !publicArticle && canRead && !permitted.pending && !permitted.error
            ? permitted.data?.article?.relatedArticles || [] : [];
        const relatedArticles = mergeHelpArticles(publicLibrary.articles, permittedRelated)
            .filter((related) => article.relatedArticleIds?.includes(related.id));
        return <HelpArticle article={article} relatedArticles={relatedArticles} backRoute={backRoute} onOpenGuide={onOpenGuide} />;
    }
    if (canRead && permitted.pending) return <div className="py-12" role="status"><p className="text-sm text-slate-600">Opening help article…</p></div>;
    return <section className="py-10"><Link to="/help-centre" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} aria-hidden="true" />All help articles</Link><h1 className="mt-4 text-2xl font-bold text-slate-900">This article is unavailable</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">It may have moved, or it may require account access. Browse the Help Centre for available instructions.</p>{canRead && permitted.error ? <button type="button" onClick={permitted.retry} className="btn-ghost mt-5">Try again</button> : !canRead && <Link to="/login" className="btn-ghost mt-5">Sign in</Link>}</section>;
}

function HelpCentreSession({ canRead, canEdit = false, onEdit }) {
    const { slug } = useParams();
    const [params] = useSearchParams();
    const { locale } = useLocale();
    const guide = useGuideAssistant();
    const api = useMemo(() => createHelpArticlesApi(), []);
    const openGuide = guide?.available ? () => guide.openGuide() : undefined;
    return <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-20 sm:px-6 sm:py-7" lang="en">
        {locale !== 'en' && <p className="mb-5 border-l-2 border-brand-300 bg-brand-50 px-4 py-3 text-xs leading-relaxed text-slate-600">Help Centre articles are currently in English. Your app language setting is unchanged.</p>}
        {canEdit && <div className="mb-5 flex flex-wrap items-center justify-end gap-3 border-b border-slate-200 pb-4"><span className="text-xs text-slate-500">Content owner</span><button type="button" onClick={onEdit} className="btn-ghost text-sm">{slug ? 'Edit this article' : params.get('category') ? 'Edit topic' : 'Manage help content'}</button></div>}
        {slug ? <HelpArticleLoader key={slug} api={api} canRead={canRead} slug={slug} onOpenGuide={openGuide} /> : <HelpCentreIndex api={api} canRead={canRead} onOpenGuide={openGuide} />}
    </main>;
}

function HelpCentreOwnerSession({ user, canRead, isImpersonating, isLoading }) {
    const api = useMemo(() => createHelpContentApi(), []);
    const [params] = useSearchParams();
    const [canEdit, setCanEdit] = useState(false), [started, setStarted] = useState(false), [initialEditing, setInitialEditing] = useState(false);
    useEffect(() => {
        setCanEdit(false);
        if (isLoading || isImpersonating || user?.isImpersonating || user?.role !== 'super_admin') return undefined;
        const controller = new AbortController();
        api.capability(controller.signal).then((data) => { if (!controller.signal.aborted) setCanEdit(data?.canEdit === true); }).catch(() => {});
        return () => controller.abort();
    }, [api, user?.id, user?.role, user?.isImpersonating, isImpersonating, isLoading]);
    // The protected dashboard entry opens this same persistent reading session.
    useEffect(() => { if (canEdit && params.get('manage') === '1') setStarted(true); }, [canEdit, params]);
    if (canEdit && started) return <HelpContentPage api={api} context initialEditing={initialEditing} />;
    return <HelpCentreSession canRead={canRead} canEdit={canEdit} onEdit={() => { setInitialEditing(true); setStarted(true); }} />;
}

export default function HelpCentrePage() {
    const { user, isLoading, isImpersonating } = useAuth();
    return <HelpCentreOwnerSession key={helpIdentityKey(user, isImpersonating, isLoading)} user={user} isLoading={isLoading} isImpersonating={isImpersonating} canRead={canReadAccountHelp(user, isImpersonating, isLoading)} />;
}
