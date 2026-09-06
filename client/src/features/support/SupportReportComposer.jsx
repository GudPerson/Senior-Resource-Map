import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupportApi, newGuestSupportKey, rememberGuestSupportKey, signalSupportUpdate } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';

export default function SupportReportComposer({ signedIn, context, onCreated, initialDraft = null }) {
    const [id] = useState(() => crypto.randomUUID());
    const [guestKey] = useState(() => signedIn ? '' : newGuestSupportKey());
    const api = useMemo(() => createSupportApi({ guestKey }), [guestKey]);
    const [title, setTitle] = useState(() => initialDraft?.title || '');
    const [description, setDescription] = useState(() => initialDraft?.description || '');
    const [expected, setExpected] = useState('');
    const [includeContext, setIncludeContext] = useState(false);
    const [preview, setPreview] = useState(null);
    const [savedCode, setSavedCode] = useState(false);
    const [remember, setRemember] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const heading = useRef(null);
    const titleInput = useRef(null);
    const previousPreview = useRef(null);
    const errorMessage = useRef(null);
    const task = useSupportTask();
    useEffect(() => { if (task.error) errorMessage.current?.focus(); }, [task.error]);
    useEffect(() => {
        if (preview) heading.current?.focus();
        else if (previousPreview.current) titleInput.current?.focus();
        previousPreview.current = preview;
    }, [preview]);
    function prepare(event) {
        event.preventDefault();
        task.run(() => api.preview({ id, title, description, expected, context: includeContext ? context : {} }), setPreview);
    }
    function send() {
        task.run(() => api.create(preview), (report) => {
            if (guestKey && remember) rememberGuestSupportKey(guestKey);
            signalSupportUpdate();
            onCreated(report, guestKey);
        });
    }
    return <section className="card mx-auto max-w-2xl space-y-4 p-4 sm:p-6" aria-labelledby="report-heading">
        <h2 id="report-heading" ref={heading} tabIndex={-1} className="text-xl font-bold">{preview ? 'Review your report' : 'Report an app problem'}</h2>
        <p className="text-sm text-slate-600">The support team can read submitted reports and reply here. Please do not include medical details, identity numbers, passwords, verification codes, or private links. No screenshot is captured automatically.</p>
        {initialDraft && !preview && <p className="rounded-xl bg-brand-50 p-3 text-sm">Only the question you chose has been copied into this draft. Your other Guide questions are not included. Describe the problem below, then review before sending. Nothing has been submitted yet.</p>}
        {!preview ? <form onSubmit={prepare} className="space-y-4">
            <label className="block text-sm font-semibold">Short title<input ref={titleInput} className="input-field mt-1 w-full" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="block text-sm font-semibold">What happened?<textarea className="input-field mt-1 w-full" required maxLength={4000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="block text-sm font-semibold">What did you expect? (optional)<textarea className="input-field mt-1 w-full" maxLength={2000} rows={3} value={expected} onChange={(event) => setExpected(event.target.value)} /></label>
            <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} />Include the page where I opened Help (page name only)</label>
            <button className="btn-primary" disabled={task.pending}>{task.pending ? 'Preparing…' : 'Review before sending'}</button>
        </form> : <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4"><h3 className="font-bold">{preview.title}</h3>
                <p className="whitespace-pre-wrap break-words">{preview.description}</p>
                {preview.expected && <div><p className="text-sm font-semibold">Expected behaviour</p><p className="whitespace-pre-wrap break-words">{preview.expected}</p></div>}
                {preview.context.pathname !== '/' && <p className="text-xs text-slate-500">Page: {preview.context.pathname}</p>}
            </div>
            <p className="text-xs text-slate-600">This is the text that will be saved. Recognisable links and credential-like details have been removed; please check for anything else private.</p>
            {guestKey && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-bold">Keep your private recovery code</h3>
                <p className="text-sm">This code opens this report for 30 days. Anyone with it can read and reply. Keep it private; we cannot recover it for you.</p>
                <label className="block text-sm">Recovery code<input className="input-field mt-1 w-full font-mono text-xs" readOnly type={showCode ? 'text' : 'password'} value={guestKey} onFocus={(event) => event.target.select()} /></label>
                <button type="button" className="btn-ghost" onClick={() => setShowCode(!showCode)}>{showCode ? 'Hide code' : 'Show code to copy'}</button>
                <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" checked={savedCode} onChange={(event) => setSavedCode(event.target.checked)} />I have saved my recovery code somewhere private</label>
                <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Also remember it in this browser tab</label>
            </div>}
            <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={task.pending || Boolean(guestKey && !savedCode)} onClick={send}>{task.pending ? 'Sending…' : 'Send report'}</button>
                <button className="btn-ghost" disabled={task.pending} onClick={() => setPreview(null)}>Edit report</button></div>
        </div>}
        {task.error && <p role="alert" ref={errorMessage} tabIndex={-1} className="text-sm text-red-700">{task.error} Your draft is still here.</p>}
    </section>;
}
