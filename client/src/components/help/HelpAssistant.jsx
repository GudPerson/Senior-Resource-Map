import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, LoaderCircle, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { api } from '../../lib/api.js';
import {
    filterHelpActions,
    INITIAL_HELP_SUGGESTIONS,
} from '../../lib/helpAssistant.js';
import MobileBottomSheet from '../mobile/MobileBottomSheet.jsx';

const WELCOME_MESSAGE = {
    role: 'assistant',
    message: 'How can I help? Ask about finding resources, using My Directory or My Maps, account navigation, or an error shown on screen.',
    actions: [],
};

function HelpConversation({
    actionsUser,
    input,
    loading,
    messages,
    onAction,
    onInputChange,
    onSubmit,
    onSuggestion,
    suggestions,
}) {
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [loading, messages]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-4"
                aria-live="polite"
            >
                {messages.map((item, index) => (
                    <div
                        key={`${item.role}-${index}-${item.message.slice(0, 24)}`}
                        className={item.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                    >
                        <div
                            className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-6 ${
                                item.role === 'user'
                                    ? 'bg-brand-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700'
                            }`}
                        >
                            <p>{item.message}</p>
                            {item.role === 'assistant' && item.actions?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {filterHelpActions(actionsUser, item.actions).map((action) => (
                                        <button
                                            key={`${action.kind}-${action.route || action.label}`}
                                            type="button"
                                            onClick={() => onAction(action)}
                                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-left text-xs font-bold text-brand-800 transition hover:bg-brand-100"
                                        >
                                            {action.kind === 'reload' ? <RefreshCw size={15} /> : <ArrowRight size={15} />}
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}

                {loading ? (
                    <div className="flex justify-start">
                        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            <LoaderCircle size={16} className="animate-spin" />
                            Checking verified guidance
                        </div>
                    </div>
                ) : null}
                <div ref={endRef} />
            </div>

            {!loading && suggestions?.length ? (
                <div className="border-t border-slate-200 py-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {suggestions.map((suggestion) => (
                            <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => onSuggestion(suggestion)}
                                className="min-h-[40px] flex-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                            >
                                {suggestion.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

            <form onSubmit={onSubmit} className="border-t border-slate-200 pt-3">
                <label htmlFor="carearound-help-question" className="sr-only">
                    Ask CareAround Guide
                </label>
                <div className="flex items-end gap-2">
                    <textarea
                        id="carearound-help-question"
                        value={input}
                        onChange={(event) => onInputChange(event.target.value)}
                        rows={2}
                        maxLength={500}
                        disabled={loading}
                        placeholder="Ask about navigation or an error message"
                        className="min-h-[52px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="inline-flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Send question"
                    >
                        <Send size={19} />
                    </button>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-slate-500">
                    <ShieldCheck size={13} className="flex-none" />
                    Avoid sharing passwords, identity numbers, medical details, private notes, or access links.
                </p>
            </form>
        </div>
    );
}

export default function HelpAssistant() {
    const { user } = useAuth();
    const { locale } = useLocale();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [suggestions, setSuggestions] = useState(INITIAL_HELP_SUGGESTIONS);

    async function askHelp({ question = '', topicId = '', userLabel = '' }) {
        if (loading || (!question.trim() && !topicId)) return;

        const displayText = userLabel || question.trim();
        setMessages((current) => [...current.slice(-10), {
            role: 'user',
            message: displayText,
            actions: [],
        }]);
        setInput('');
        setLoading(true);

        try {
            const response = await api.askHelpQuestion({
                question: question.trim(),
                topicId,
                context: {
                    pathname: location.pathname,
                    locale,
                },
            });
            setMessages((current) => [...current.slice(-10), {
                role: 'assistant',
                message: response.message,
                actions: response.actions || [],
            }]);
            setSuggestions(response.suggestions || INITIAL_HELP_SUGGESTIONS);
        } catch (error) {
            setMessages((current) => [...current.slice(-10), {
                role: 'assistant',
                message: error?.message || 'Help could not load just now. Refresh the app or try again in a moment.',
                actions: [{ kind: 'reload', label: 'Refresh app' }],
            }]);
        } finally {
            setLoading(false);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        void askHelp({ question: input });
    }

    function handleSuggestion(suggestion) {
        void askHelp({
            topicId: suggestion.id,
            userLabel: suggestion.label,
        });
    }

    function handleAction(action) {
        if (action.kind === 'reload') {
            window.location.reload();
            return;
        }
        if (action.kind === 'navigate' && action.route) {
            setOpen(false);
            navigate(action.route);
        }
    }

    const conversation = (
        <HelpConversation
            actionsUser={user}
            input={input}
            loading={loading}
            messages={messages}
            onAction={handleAction}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onSuggestion={handleSuggestion}
            suggestions={suggestions}
        />
    );

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-4 z-[1300] inline-flex h-12 items-center gap-2 rounded-xl border border-brand-200 bg-white px-3.5 text-sm font-bold text-brand-800 shadow-lg transition hover:bg-brand-50 sm:bottom-6 sm:right-6"
                aria-label="Open CareAround Guide"
                aria-expanded={open}
            >
                <CircleHelp size={20} />
                <span className="hidden sm:inline">Help</span>
            </button>

            {isMobile ? (
                <MobileBottomSheet
                    open={open}
                    onOpenChange={setOpen}
                    title="CareAround Guide"
                    description="Navigation and troubleshooting"
                    contentClassName="h-[82svh]"
                    bodyClassName="flex flex-col"
                    layer={2400}
                    headerActions={(
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                            aria-label="Close CareAround Guide"
                        >
                            <X size={19} />
                        </button>
                    )}
                >
                    {conversation}
                </MobileBottomSheet>
            ) : open ? (
                <div className="fixed inset-0" style={{ zIndex: 2400 }}>
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/25"
                        onClick={() => setOpen(false)}
                        aria-label="Close CareAround Guide"
                    />
                    <aside
                        className="absolute bottom-0 right-0 top-0 flex w-[min(440px,100vw)] flex-col border-l border-slate-200 bg-slate-50 px-5 py-5 shadow-2xl"
                        aria-label="CareAround Guide"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-950">CareAround Guide</h2>
                                <p className="mt-1 text-sm text-slate-600">Navigation and troubleshooting</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200"
                                aria-label="Close CareAround Guide"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {conversation}
                    </aside>
                </div>
            ) : null}
        </>
    );
}
