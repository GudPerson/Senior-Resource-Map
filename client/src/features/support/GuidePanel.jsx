import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, BookOpen, Plus, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { safeGuideActionRoute } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import GuideHistory from './GuideHistory.jsx';
import GuideSourceLinks from './GuideSourceLinks.jsx';
import GuideActionLinks from './GuideActionLinks.jsx';
import GuideResourceSearch from './GuideResourceSearch.jsx';
import GuideManagedAccess from './GuideManagedAccess.jsx';
import GuideProgrammeDraft from './GuideProgrammeDraft.jsx';
import { useGuideProgramme } from './useGuideProgramme.js';
import { isProgrammeCreationRequest } from './guideProgrammeState.js';
import { restoreSupportFocus } from './supportFocus.js';
import { useLocale } from '../../contexts/LocaleContext.jsx';

export default function GuidePanel({ api, signedIn, canSaveHistory = false, canCreateProgramme = canSaveHistory,
    onDraftReport, compact = false, pageLabel = '', onActionStateChange }) {
    const { locale } = useLocale();
    const accountAcceptancePreview = import.meta.env.VITE_GUIDE_ACCOUNT_ACCEPTANCE_PREVIEW === 'true';
    const fieldId = useId();
    const [topics, setTopics] = useState([]);
    const [chatMode, setChatMode] = useState('guide');
    const [aiConsent, setAiConsent] = useState(false);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [historyPending, setHistoryPending] = useState(false);
    const [historyKey, setHistoryKey] = useState(0);
    const [searchCriteria, setSearchCriteria] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [managedAccessOpen, setManagedAccessOpen] = useState(false);
    const [access, setAccess] = useState({ canCreate: false, places: [] });
    const answerHeading = useRef(null);
    const conversationViewport = useRef(null);
    const latestMessage = useRef(null);
    const latestReply = useRef(null);
    const questionInput = useRef(null);
    const helpError = useRef(null);
    const helpOrigin = useRef(null);
    const help = useSupportTask();
    function addMessage(message, { clearQuestion = true } = {}) {
        setMessages((items) => [...items, { id: crypto.randomUUID(), ...message }].slice(-20));
        if (clearQuestion) setQuestion('');
    }
    const action = useGuideProgramme({ api, onMessage: addMessage, onStateChange: onActionStateChange });
    const busy = help.pending || historyPending || Boolean(action.pending);
    const locked = busy || action.uncertain || action.conflict;
    useLayoutEffect(() => {
        const shouldReveal = restoreSupportFocus(messages.length ? answerHeading.current : questionInput.current, helpOrigin.current);
        helpOrigin.current = null;
        if (!messages.length || !shouldReveal || !conversationViewport.current || !latestMessage.current) return;
        const viewport = conversationViewport.current;
        // Keep the question when the complete turn fits; otherwise prioritise
        // the reply, so its actions are not pushed below the fixed composer.
        const target = latestMessage.current.getBoundingClientRect().height > viewport.clientHeight - 24
            ? latestReply.current || latestMessage.current : latestMessage.current;
        viewport.scrollTop += target.getBoundingClientRect().top
            - viewport.getBoundingClientRect().top - 12;
    }, [messages]);
    useEffect(() => { if (help.error) restoreSupportFocus(helpError.current, helpOrigin.current); }, [help.error]);
    useEffect(() => {
        const controller = new AbortController();
        api.topics(controller.signal).then((result) => {
            if (!controller.signal.aborted) { setTopics(result.topics); setChatMode(result.chatMode || 'guide'); }
        }).catch(() => {});
        return () => controller.abort();
    }, [api]);
    useEffect(() => {
        if (!canCreateProgramme) return;
        const controller = new AbortController();
        api.guideProgrammePlaces('', controller.signal).then((result) => { if (!controller.signal.aborted) setAccess(result); }).catch(() => {});
        return () => controller.abort();
    }, [api, canCreateProgramme]);
    function ask(input, label) {
        if (locked) return;
        helpOrigin.current = document.activeElement;
        const useAi = Boolean(signedIn && aiConsent && chatMode !== 'guide' && !input.topicId);
        if (!input.topicId && (action.draft || isProgrammeCreationRequest(input.question))) {
            if (!canCreateProgramme) {
                addMessage({ question: label, message: signedIn ? 'Programme creation is unavailable in User View. Exit User View to use your own resource permissions.' : 'Sign in to create a programme/service at a place you can manage.',
                    input: null, actions: signedIn ? [] : [{ label: 'Sign in', route: '/login' }] });
                return;
            }
            action.prepare(input.question, useAi);
            return;
        }
        const turns = useAi ? messages.filter((message) => message.input?.question
            && !['resource-search', 'resource-access', 'template-access', 'workbook-access', 'group-access', 'governance-group-access', 'lifecycle-access', 'composite-guidance', 'verified-boundary', 'unverified-workflow', 'account-refresh', 'managed-resources', 'saved-resources', 'personal-places', 'my-plans', 'audit-access', 'audit-activity', 'organization-access', 'own-region-scope'].includes(message.topicId)
            && !message.actionKind && typeof message.message === 'string')
            .slice(-4).map((message) => ({ question: message.input.question, answer: message.message.slice(0, 1600) })) : [];
        const contextualInput = { ...input, pageContext: pageLabel || 'CareAround', locale };
        help.run(() => api.answer(useAi ? { ...contextualInput, useAi: true, turns } : contextualInput),
            (answer) => addMessage({ question: label, ...answer }));
    }
    function newConversation() {
        if (locked) return;
        helpOrigin.current = document.activeElement;
        action.cancel(); setMessages([]); setQuestion(''); setAiConsent(false); setManagedAccessOpen(false); setHistoryKey((value) => value + 1);
    }
    const starters = topics.filter((topic) => ['discover', 'maps', 'sharing'].includes(topic.id));

    return <section className={`flex min-h-0 min-w-0 flex-col bg-white ${compact ? 'h-full' : 'h-[75svh] min-h-[34rem] overflow-hidden rounded-2xl border border-slate-200'}`} aria-label="CareAround Guide conversation">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <p className="min-w-0 truncate text-xs text-slate-500">{pageLabel ? `You’re on ${pageLabel}` : 'Help with CareAround'}</p>
            <button type="button" className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50" disabled={locked || Boolean(action.draft)} onClick={newConversation} aria-label="Start new Guide conversation"><Plus size={15} aria-hidden="true" />New conversation</button>
        </div>
        <div ref={conversationViewport} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
            {!messages.length && !action.draft && <div className="pb-2 pt-3">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Sparkles size={24} aria-hidden="true" /></div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">What would you like to do?</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Find your way around CareAround{access.canCreate ? ', or prepare a programme/service to review and create.' : '.'}</p>
                <div className="mt-5 divide-y divide-slate-100">
                    {access.canCreate && <button type="button" className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 hover:text-brand-700 disabled:opacity-50" disabled={locked} onClick={() => ask({ question: 'Create a programme/service' }, 'Create a programme/service')}><Plus size={18} className="shrink-0 text-brand-600" aria-hidden="true" /><span className="flex-1">Create a programme/service<span className="mt-0.5 block text-xs font-normal text-slate-500">Draft, review, then save at a place you manage</span></span><ArrowUpRight size={16} aria-hidden="true" /></button>}
                    {canSaveHistory && <button type="button" className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 hover:text-brand-700 disabled:opacity-50" disabled={locked} onClick={() => { setSearchCriteria({ query: '', type: 'all' }); setSearchOpen(true); }}><Search size={18} className="shrink-0 text-brand-600" aria-hidden="true" /><span className="flex-1">Find and save a resource<span className="mt-0.5 block text-xs font-normal text-slate-500">Choose a public result, review, then save it privately</span></span><ArrowUpRight size={16} aria-hidden="true" /></button>}
                    {starters.map((topic) => <button type="button" key={topic.id} className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-700 hover:text-brand-700 disabled:opacity-50" disabled={locked} onClick={() => ask({ topicId: topic.id }, topic.title)}><BookOpen size={17} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="flex-1">{topic.title}</span><ArrowUpRight size={16} className="text-slate-400" aria-hidden="true" /></button>)}
                </div>
            </div>}
            <div className="space-y-6" role="log" aria-label="Conversation with CareAround Guide" aria-live="polite" aria-relevant="additions">
                {messages.map((message, index) => <article ref={index === messages.length - 1 ? latestMessage : undefined} className="min-w-0 space-y-3" key={message.id}>
                    <h3 ref={index === messages.length - 1 ? answerHeading : undefined} tabIndex={-1} className="ml-6 rounded-2xl rounded-br-md bg-slate-100 px-4 py-3 text-sm font-medium leading-relaxed text-slate-800"><span className="sr-only">You: </span>{message.question}</h3>
                    <div ref={index === messages.length - 1 ? latestReply : undefined} className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold text-brand-700"><Sparkles size={14} aria-hidden="true" />CareAround Guide</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{message.message}</p>
                        {message.answerSource && <p className="mt-2 text-[11px] text-slate-500">{message.answerSource === 'ai' ? 'Cloudflare AI answer based on reviewed CareAround guidance; check the related topics below' : message.answerSource === 'simulation' ? 'Simulated AI selection of reviewed guidance for this local test' : message.answerSource === 'account' ? 'Checked against this account’s current information' : 'Reviewed CareAround help'}</p>}
                        <GuideSourceLinks sources={message.sources} />
                        {message.aiStatus === 'limited' && <p className="mt-1 text-xs text-slate-500">AI answers are at their limit for now. The reviewed Guide is still available.</p>}
                        {message.resources?.length > 0 && <ul className="mt-3 space-y-2">{message.resources.map((resource) => <li className="border-l-2 border-brand-200 pl-3" key={`${resource.type}:${resource.id}`}>
                            <Link className="break-words text-sm font-semibold text-brand-700 underline underline-offset-4" to={safeGuideActionRoute(resource.route) || '/discover'}>{message.actionKind === 'programme' ? `Open ${resource.name}` : resource.name}</Link>
                            {resource.address && <p className="mt-1 text-xs text-slate-500">{resource.address}</p>}
                        </li>)}</ul>}
                        {message.criteria && <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => { setSearchCriteria(message.criteria); setSearchOpen(true); }}>Use these keywords in resource search</button>}
                        {message.canCheckManagedListing && canSaveHistory && <button type="button" className="btn-ghost mt-3 text-sm" onClick={() => setManagedAccessOpen(true)}>Choose a listing to check</button>}
                        <div className="mt-3 flex flex-wrap gap-2"><GuideActionLinks actions={message.actions} signedIn={signedIn} />
                            {message.input && onDraftReport && <button type="button" className="min-h-[36px] text-left text-xs text-slate-500 underline underline-offset-4" onClick={() => onDraftReport(message)}>Use this question in a report</button>}
                        </div>
                    </div>
                </article>)}
            </div>
            {action.draft && <GuideProgrammeDraft api={api} action={action} initialPlaces={access.places} />}
            {action.pending === 'draft' && <p role="status" className="text-sm text-slate-500">Preparing your draft…</p>}
            {action.error && !action.draft && <p role="alert" className="text-sm text-red-700">{action.error}</p>}
            {help.pending && <p role="status" className="text-sm text-slate-500">Checking CareAround guidance…</p>}
            <div className="space-y-3 border-t border-slate-100 pt-4">
                <Link to="/help-centre" className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-brand-700 underline underline-offset-4"><BookOpen size={13} aria-hidden="true" />Browse help articles</Link>
                <details><summary className="min-h-[36px] cursor-pointer text-xs font-semibold text-slate-500">Browse help topics</summary><div className="flex flex-wrap gap-2 py-2">{topics.map((topic) => <button type="button" className="btn-ghost text-xs" key={topic.id} disabled={locked || Boolean(action.draft)} onClick={() => ask({ topicId: topic.id }, topic.title)}>{topic.title}</button>)}</div></details>
                <details open={searchOpen} onToggle={(event) => setSearchOpen(event.currentTarget.open)}><summary className="min-h-[36px] cursor-pointer text-xs font-semibold text-slate-500"><Search size={13} className="mr-1 inline" aria-hidden="true" />Search the public directory</summary><div className="py-3"><GuideResourceSearch api={api} canSaveHistory={canSaveHistory} canSaveResource={canSaveHistory} initialCriteria={searchCriteria} /></div></details>
                {canSaveHistory && !action.draft && <details open={managedAccessOpen} onToggle={(event) => setManagedAccessOpen(event.currentTarget.open)}><summary className="min-h-[36px] cursor-pointer text-xs font-semibold text-slate-500">Check access to a managed listing</summary><GuideManagedAccess key={historyKey} api={api} open={managedAccessOpen} onResult={(result) => { helpOrigin.current = document.activeElement; addMessage(result, { clearQuestion: false }); }} /></details>}
                {canSaveHistory ? <GuideHistory key={historyKey} api={api} messages={messages} busy={busy || Boolean(action.draft)} onBusyChange={setHistoryPending}
                    onRestore={(items) => { helpOrigin.current = document.activeElement; setMessages(items); setQuestion(''); setAiConsent(false); }} onStartNew={() => { helpOrigin.current = document.activeElement; setMessages([]); setQuestion(''); setAiConsent(false); }} />
                    : <p className="text-xs text-slate-500">Questions are not saved. Sign in outside User View to optionally save private help history.</p>}
                {action.aiAvailable === false && action.draft && aiConsent && <p className="text-xs leading-relaxed text-slate-500">AI drafting is unavailable. You can complete the fields and create your programme/service here.</p>}
            </div>
        </div>
        <form className="shrink-0 border-t border-slate-100 bg-white px-4 pb-4 pt-3 sm:px-5" onSubmit={(event) => { event.preventDefault(); ask({ question: question.trim() }, question.trim()); }}>
            {signedIn && chatMode !== 'guide' && <label className="mb-2 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} className="mt-0.5" />
                <span>{chatMode === 'simulation' ? action.draft ? 'Use simulated AI to suggest draft edits in this local test.' : 'Try simulated AI selection of reviewed guidance in this local test.' : action.draft ? 'Use Cloudflare AI to suggest edits: your request and current draft name, description and schedule go to Cloudflare. Contact fields and the selected Place stay here.' : 'Use Cloudflare AI: send your question, reviewed help, and up to four recent Guide turns to Cloudflare for an answer based on reviewed guidance. For programme drafts, only your request and draft name, description and schedule are sent.'} AI may be wrong. Keep private and medical details out of chat.</span>
            </label>}
            <label htmlFor={`${fieldId}-question`} className="sr-only">{action.draft ? 'Describe a change to the programme draft' : 'Ask CareAround Guide'}</label>
            <div className="rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <textarea id={`${fieldId}-question`} ref={questionInput} className="block max-h-32 min-h-[60px] w-full resize-y border-0 bg-transparent px-2 py-1 text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400" required maxLength={600} rows={2} value={question} onChange={(event) => setQuestion(event.target.value)}
                    placeholder={action.draft ? 'Describe a change, or edit the draft above…' : access.canCreate ? 'Ask a question or create a programme…' : 'Ask how to use CareAround…'} disabled={locked} />
                <div className="flex items-center justify-between gap-3 pl-2"><span className="text-xs text-slate-400">{action.draft ? 'Review before saving' : 'CareAround Guide'}</span><button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-400 motion-reduce:transition-none" disabled={locked || !question.trim()} aria-label={action.draft ? 'Update programme draft' : 'Ask Guide'}><ArrowUp size={19} aria-hidden="true" /></button></div>
            </div>
            {help.error && <p role="alert" ref={helpError} tabIndex={-1} className="mt-2 text-sm text-red-700">{help.error}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{accountAcceptancePreview
                ? 'This test preview cannot save changes. '
                : chatMode === 'guide' ? 'AI answers are not connected here. Reviewed help and resource creation remain available. ' : ''}
                Keep passwords, private links, identity numbers and medical details out of chat.
                {!accountAcceptancePreview && ' Review the draft and choose Create to save a resource.'}</p>
        </form>
    </section>;
}
