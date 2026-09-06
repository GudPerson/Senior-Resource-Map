import { useEffect, useState } from 'react';
import { guideHistoryInputs } from './guideHistoryState.js';
import { useSupportTask } from './useSupportTask.js';

export default function GuideHistory({ api, messages, onRestore, onStartNew, busy, onBusyChange }) {
    const [conversations, setConversations] = useState([]);
    const [active, setActive] = useState(null);
    const [savedSignature, setSavedSignature] = useState('');
    const [preview, setPreview] = useState(null);
    const [consent, setConsent] = useState(false);
    const [removing, setRemoving] = useState(null);
    const [notice, setNotice] = useState('');
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(true);
    const task = useSupportTask();
    const inputs = guideHistoryInputs(messages);
    const signature = JSON.stringify(inputs);
    const disabled = busy || task.pending || loading;
    useEffect(() => { onBusyChange(task.pending); }, [task.pending, onBusyChange]);
    useEffect(() => {
        const controller = new AbortController();
        api.guideHistory(controller.signal).then((result) => { if (!controller.signal.aborted) setConversations(result.conversations); })
            .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [api]);
    function refresh() {
        task.run(() => api.guideHistory(), (result) => { setConversations(result.conversations); setLoadError(''); });
    }
    function startNew() {
        setActive(null); setSavedSignature(''); setPreview(null); setRemoving(null); setNotice('Started a new conversation. Saved history is unchanged.'); onStartNew();
    }
    function prepare() {
        setConsent(false); setRemoving(null);
        setPreview({ id: active?.id || crypto.randomUUID(), revision: active?.revision || 0,
            requestId: crypto.randomUUID(), inputs, excludedCount: messages.length - inputs.length });
    }
    return <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold">My private Guide history</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-600">Questions are saved to your account only when you choose Save. Support cannot read this history through the support inbox. Save up to 20 conversations, with the latest 20 questions each. You can delete them here.</p>
            <p className="text-xs text-slate-600">Saved questions use current help answers when reopened. Search results are not stored; run the search again for current resources.</p>
            {active && <p className="text-sm">Opened: {active.title}{signature !== savedSignature ? ' · unsaved changes' : ''}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost text-sm" disabled={disabled || !inputs.length || signature === savedSignature} onClick={prepare}>{active ? 'Review history update' : 'Review questions to save'}</button>
                <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={startNew}>Start new conversation</button>
                <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={refresh}>Refresh saved history</button>
            </div>
            {preview && <section className="space-y-3 rounded-xl bg-brand-50 p-3" aria-label="Review Guide history save">
                <p className="text-sm font-semibold">{preview.inputs.length === 1 ? 'Save this question?' : `Save these ${preview.inputs.length} questions?`}</p>
                {preview.excludedCount > 0 && <p className="text-xs">Questions flagged for private details are excluded.</p>}
                <ol className="max-h-48 list-decimal space-y-2 overflow-y-auto pl-5 text-sm">{preview.inputs.map((input, index) => <li key={index} className="break-words">{input.question || messages.find((message) => message.input?.topicId === input.topicId)?.question || input.topicId}</li>)}</ol>
                <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" checked={consent} disabled={disabled} onChange={(event) => setConsent(event.target.checked)} />Save these questions to my private account history. I have removed sensitive personal details.</label>
                <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary text-sm" disabled={disabled || !consent} onClick={() => task.run(() => api.saveGuideConversation({ id: preview.id, revision: preview.revision, requestId: preview.requestId, inputs: preview.inputs, consent: true }), (result) => {
                    setActive(result.conversation); setSavedSignature(JSON.stringify(preview.inputs)); setPreview(null);
                    setConversations((items) => [result.conversation, ...items.filter((item) => item.id !== result.conversation.id)]);
                    setNotice('Questions saved privately. No report was sent to support.');
                })}>{task.pending ? 'Saving…' : 'Save questions privately'}</button>
                    <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => setPreview(null)}>Cancel save</button></div>
            </section>}
            {removing && <section className="space-y-2 rounded-xl border border-amber-200 p-3" aria-label="Confirm history deletion">
                <p className="text-sm">Delete “{removing.title}” from saved Guide history? This cannot be undone. Submitted support reports are not affected.</p>
                <div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost text-sm text-red-700" disabled={disabled} onClick={() => task.run(() => api.deleteGuideConversation(removing.id, removing.revision), () => {
                    setConversations((items) => items.filter((item) => item.id !== removing.id));
                    if (active?.id === removing.id) { setActive(null); setSavedSignature(''); onStartNew(); }
                    setRemoving(null); setNotice('Saved Guide conversation deleted. Support reports are unchanged.');
                })}>Delete saved conversation</button><button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => setRemoving(null)}>Keep conversation</button></div>
            </section>}
            {loading && <p role="status" className="text-sm text-slate-600">Loading saved Guide conversations…</p>}
            {!loading && !conversations.length && !loadError && <p className="text-sm text-slate-600">No saved Guide conversations.</p>}
            <ul className="space-y-2" aria-label="Saved Guide conversations">{conversations.map((conversation) => <li key={conversation.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <button type="button" className="min-h-[44px] min-w-0 break-words text-left text-sm font-semibold text-brand-700 underline" disabled={disabled} onClick={() => task.run(() => api.guideConversation(conversation.id), (result) => {
                    setActive(result.conversation); setSavedSignature(JSON.stringify(guideHistoryInputs(result.messages)));
                    setPreview(null); setRemoving(null); onRestore(result.messages);
                    setNotice('Saved questions reopened with current help. Run searches again for current results.');
                })}>{conversation.title}</button>
                <button type="button" className="btn-ghost text-sm" aria-label={`Delete saved conversation: ${conversation.title}`} disabled={disabled} onClick={() => { setPreview(null); setRemoving(conversation); }}>Delete</button>
            </li>)}</ul>
            {(loadError || task.error) && <p role="alert" className="text-sm text-red-700">{task.error || loadError}</p>}
            {notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}
        </div>
    </details>;
}
