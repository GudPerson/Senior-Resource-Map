import { useCallback, useEffect, useRef, useState } from 'react';
import { SUPPORT_STATUS_LABELS, signalSupportUpdate } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import SupportFixReview from './SupportFixReview.jsx';

function timestamp(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function Conversation({ api, id, reviewer, onBack, onChanged }) {
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [reply, setReply] = useState('');
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const [readNotice, setReadNotice] = useState('');
    const heading = useRef(null);
    const focusHeading = useRef(true);
    const errorMessage = useRef(null);
    const task = useSupportTask();
    useEffect(() => { if (task.error) errorMessage.current?.focus(); }, [task.error]);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        api.detail(id, 0, controller.signal).then((result) => { if (!controller.signal.aborted) setDetail(result); })
            .catch((err) => { if (!controller.signal.aborted) { setDetail(null); setError(err.message); } });
        return () => controller.abort();
    }, [api, id, refresh]);
    useEffect(() => {
        // Opening a report or replacing a status control needs a focus destination.
        // Reading, replying and refreshing must not steal focus from the user.
        if (detail && focusHeading.current && heading.current) {
            heading.current.focus();
            focusHeading.current = false;
        }
    }, [detail]);
    // Explicit read action avoids claiming that older, collapsed, or unseen pages were read.
    const changed = useCallback(() => {
        setRefresh((value) => value + 1); signalSupportUpdate(); onChanged();
    }, [onChanged]);
    function changeStatus(status) {
        task.run(() => api.status(id, { status, revision: detail.conversation.revision, requestId: crypto.randomUUID() }), () => {
            focusHeading.current = true; changed();
        });
    }
    return <section className="card min-w-0 space-y-4 p-4 sm:p-6" aria-labelledby="support-conversation-title">
        <div className="flex flex-wrap items-center justify-between gap-2"><button className="btn-ghost" onClick={onBack}>Back to reports</button>
            <button className="btn-ghost" disabled={task.pending} onClick={() => setRefresh((value) => value + 1)}>Refresh conversation</button></div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {!detail && !error && <p role="status">Loading conversation…</p>}
        {detail && <>
            <header><h2 id="support-conversation-title" ref={heading} tabIndex={-1} className="break-words text-xl font-bold">{detail.conversation.title}</h2>
                <p className="mt-1 text-sm text-brand-700">{SUPPORT_STATUS_LABELS[detail.conversation.status]}</p></header>
            <ol className="space-y-3" aria-label="Report messages">{detail.messages.map((message) => <li className={`rounded-xl border p-4 ${message.author === 'user' ? 'border-slate-200' : 'border-brand-100 bg-brand-50'}`} key={message.sequence}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span className="font-bold">{message.author === 'staff' ? 'Support team' : message.author === 'system' ? 'System update' : reviewer ? 'Reporter' : 'You'}</span><time dateTime={message.createdAt}>{timestamp(message.createdAt)}</time></div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
            </li>)}</ol>
            {detail.hasMore && <button className="btn-ghost" disabled={task.pending} onClick={() => task.run(() => api.detail(id, detail.messages.at(-1)?.sequence || 0), (next) => {
                setDetail((previous) => ({ ...next, messages: [...previous.messages, ...next.messages] }));
            })}>Load newer messages</button>}
            <div className="flex flex-wrap gap-2"><button className="btn-ghost text-sm" disabled={task.pending} onClick={() => task.run(() => api.read(id, detail.messages.at(-1)?.sequence || 0), () => {
                setReadNotice('Messages shown here marked as read.'); signalSupportUpdate(); onChanged();
            })}>Mark shown messages read</button>
                {reviewer ? <>
                    {detail.conversation.status !== 'open' && <button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('open')}>Reopen for review</button>}
                    {!['fix_available', 'resolved'].includes(detail.conversation.status) && <>
                        <button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('in_progress')}>Mark under review</button>
                        <button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('awaiting_user')}>Request reporter reply</button>
                    </>}
                </> : detail.conversation.status === 'resolved'
                    ? <button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('open')}>Reopen report</button>
                    : <><button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('resolved')}>Mark resolved</button>
                        {detail.conversation.status === 'fix_available' && <button className="btn-ghost text-sm" disabled={task.pending} onClick={() => changeStatus('open')}>Problem remains — reopen</button>}</>}
            </div>
            {readNotice && <p role="status" className="text-sm text-brand-700">{readNotice}</p>}
            {detail.conversation.status !== 'resolved' && <form className="space-y-3" onSubmit={(event) => {
                event.preventDefault();
                task.run(() => api.reply(id, { requestId, revision: detail.conversation.revision, body: reply }), () => {
                    setReply(''); setRequestId(crypto.randomUUID()); changed();
                });
            }}>
                <label className="block text-sm font-semibold">{reviewer ? 'Reply to reporter' : 'Your reply'}<textarea className="input-field mt-1 w-full" required rows={3} maxLength={4000} value={reply} disabled={task.pending} onChange={(event) => { setReply(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
                <p className="text-xs text-slate-500">Keep replies about the app problem. Do not send passwords or sensitive personal details.</p>
                <button className="btn-primary" disabled={task.pending || !reply.trim()}>{task.pending ? 'Sending…' : 'Send reply'}</button>
            </form>}
            {reviewer && <SupportFixReview key={id} api={api} conversation={detail.conversation} onChanged={changed} />}
        </>}
        {task.error && <p role="alert" ref={errorMessage} tabIndex={-1} className="text-sm text-red-700">{task.error} Refresh to check for updates before retrying.</p>}
    </section>;
}

export default function SupportInbox({ api, reviewer = false, guest = false, initialId = null }) {
    const [selected, setSelected] = useState(initialId);
    const [reports, setReports] = useState(null);
    const [next, setNext] = useState(null);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const heading = useRef(null);
    const reportButtons = useRef(new Map());
    const returnToReport = useRef(null);
    const task = useSupportTask();
    const refreshList = useCallback(() => setRefresh((value) => value + 1), []);
    useEffect(() => {
        const controller = new AbortController();
        setError('');
        api.list(null, controller.signal).then((result) => { if (!controller.signal.aborted) { setReports(result.conversations); setNext(result.next); } })
            .catch((err) => { if (!controller.signal.aborted) { setReports(null); setError(err.message); } });
        return () => controller.abort();
    }, [api, refresh]);
    useEffect(() => {
        const poll = () => { if (document.visibilityState === 'visible') refreshList(); };
        const timer = window.setInterval(poll, 60000);
        window.addEventListener('focus', poll);
        return () => { clearInterval(timer); window.removeEventListener('focus', poll); };
    }, [refreshList]);
    useEffect(() => {
        if (!selected && returnToReport.current) {
            const destination = reportButtons.current.get(returnToReport.current) || heading.current;
            if (destination) { destination.focus(); returnToReport.current = null; }
        }
    }, [selected, reports]);
    if (selected) return <Conversation key={selected} api={api} id={selected} reviewer={reviewer} onBack={() => { returnToReport.current = selected; setSelected(null); refreshList(); }} onChanged={refreshList} />;
    return <section className="card mx-auto max-w-3xl space-y-4 p-4 sm:p-6" aria-labelledby="support-inbox-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="support-inbox-heading" ref={heading} tabIndex={-1} className="text-xl font-bold">{reviewer ? 'Support review queue' : 'Your support conversations'}</h2><button className="btn-ghost" onClick={refreshList}>Refresh inbox</button></div>
        <p className="text-sm text-slate-600">{reviewer ? 'Private reports are available here to authorised support reviewers only.' : guest ? 'Replies and updates for this guest report stay together. Anyone with its recovery code can read and reply; keep the code private.' : 'Reports, support replies, and fix updates stay together. Only you and authorised support reviewers can access your account reports.'}</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {!reports && !error && <p role="status">Loading inbox…</p>}
        {reports?.length === 0 && <p>No reports yet. Use “Report a problem” when you need help.</p>}
        <div className="space-y-2">{reports?.map((report) => <button key={report.id} ref={(element) => { if (element) reportButtons.current.set(report.id, element); else reportButtons.current.delete(report.id); }} className="flex w-full items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 text-left hover:bg-brand-50" onClick={() => setSelected(report.id)}>
            <span className="min-w-0"><span className="block break-words font-bold">{report.title}</span><span className="mt-1 block text-xs text-slate-600">{SUPPORT_STATUS_LABELS[report.status]} · {timestamp(report.updatedAt)}</span></span>
            {report.unreadCount > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-1 text-xs font-bold text-white">Unread</span>}
        </button>)}</div>
        {next && <button className="btn-ghost" disabled={task.pending} onClick={() => task.run(() => api.list(next), (result) => {
            setReports((items) => [...new Map([...items, ...result.conversations].map((item) => [item.id, item])).values()]); setNext(result.next);
        })}>Load older reports</button>}
        {task.error && <p role="alert" className="text-sm text-red-700">{task.error}</p>}
    </section>;
}
