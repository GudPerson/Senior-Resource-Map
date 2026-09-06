import { useEffect, useRef, useState } from 'react';
import { useSupportTask } from './useSupportTask.js';

export default function SupportFixReview({ api, conversation, onChanged }) {
    const [proposal, setProposal] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [proposalId, setProposalId] = useState(() => crypto.randomUUID());
    const [sourceRevision, setSourceRevision] = useState('');
    const [target, setTarget] = useState('client');
    const [summary, setSummary] = useState('');
    const [testEvidence, setTestEvidence] = useState('');
    const [approvalConfirmed, setApprovalConfirmed] = useState(false);
    const [tested, setTested] = useState(false);
    const [productionCheck, setProductionCheck] = useState('');
    const proposalHeading = useRef(null);
    const focusProposal = useRef(false);
    const errorMessage = useRef(null);
    const task = useSupportTask();
    useEffect(() => { if (task.error) errorMessage.current?.focus(); }, [task.error]);
    useEffect(() => {
        const controller = new AbortController();
        setProposal(null); setLoadError(''); setApprovalConfirmed(false); setTested(false);
        if (conversation.currentProposalId) api.proposal(conversation.id, conversation.currentProposalId, controller.signal)
            .then((result) => { if (!controller.signal.aborted) setProposal(result); })
            .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); });
        return () => controller.abort();
    }, [api, conversation.id, conversation.currentProposalId, conversation.revision]);
    useEffect(() => {
        if (proposal && focusProposal.current && proposalHeading.current) {
            proposalHeading.current.focus();
            focusProposal.current = false;
        }
    }, [proposal]);
    function changed(result) { focusProposal.current = true; onChanged(result); }
    const decision = { proposalId: proposal?.id, revision: conversation.revision };
    return <details className="rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-bold">Human review and fix release</summary>
        <p className="my-3 text-sm text-slate-600">This workflow records and reviews a developer-prepared fix. It does not edit code or deploy. Approval is tied to the exact source revision; another version requires a new proposal.</p>
        {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
        {proposal && <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <h3 ref={proposalHeading} tabIndex={-1} className="font-semibold">Current proposal: {proposal.summary}</h3>
            <p className="break-all font-mono text-xs">{proposal.source_revision}</p>
            <p className="text-sm">Target: {proposal.target}</p>
            <p className="whitespace-pre-wrap break-words text-sm">{proposal.test_evidence}</p>
            {proposal.verified_at ? <p className="font-semibold text-brand-700">Verified release update has been sent.</p>
                : !proposal.approved_at ? <>
                    <label className="flex min-h-[44px] items-start gap-3 text-sm"><input type="checkbox" checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)} />I have reviewed this exact revision and its test evidence, and approve it for the release process.</label>
                    <button className="btn-primary" disabled={!approvalConfirmed || task.pending} onClick={() => task.run(() => api.approve(conversation.id, decision), changed)}>Approve this exact fix</button>
                </> : <>
                    <p className="text-sm font-semibold">Human approval recorded. Release verification is still required.</p>
                    <label className="block text-sm font-semibold">Production test performed<textarea className="input-field mt-1 w-full" rows={3} maxLength={2000} value={productionCheck} onChange={(event) => setProductionCheck(event.target.value)} placeholder="What was checked against the original report, and what happened?" /></label>
                    <label className="flex min-h-[44px] items-start gap-3 text-sm"><input type="checkbox" checked={tested} onChange={(event) => setTested(event.target.checked)} />I checked the reported behaviour on production after this approved fix was released.</label>
                    <button className="btn-primary" disabled={!tested || !productionCheck.trim() || task.pending} onClick={() => task.run(() => api.verify(conversation.id, { ...decision, testedInProduction: true, productionCheck }), changed)}>Verify release and notify reporter</button>
                    <p className="text-xs text-slate-600">The server must independently find the approved version on production. A mismatch or missing evidence sends no fix-available message.</p>
                </>}
        </div>}
        <form className="mt-4 space-y-3" onSubmit={(event) => {
            event.preventDefault();
            task.run(() => api.propose(conversation.id, { id: proposalId, revision: conversation.revision, sourceRevision, target, summary, testEvidence }), (result) => {
                setProposalId(crypto.randomUUID()); changed(result);
            });
        }}>
            <h3 className="font-semibold">{proposal ? 'Propose a replacement fix' : 'Propose a fix'}</h3>
            <label className="block text-sm">Full source revision<input className="input-field mt-1 w-full font-mono text-xs" required pattern="[a-f0-9]{40}" maxLength={40} value={sourceRevision} onChange={(event) => setSourceRevision(event.target.value)} /></label>
            <label className="block text-sm">Release target<select className="input-field mt-1 w-full" value={target} onChange={(event) => setTarget(event.target.value)}><option value="client">App client</option><option value="server">API server</option><option value="both">Both</option></select></label>
            <label className="block text-sm">Fix summary<textarea className="input-field mt-1 w-full" required rows={2} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
            <label className="block text-sm">Test evidence<textarea className="input-field mt-1 w-full" required rows={3} maxLength={4000} value={testEvidence} onChange={(event) => setTestEvidence(event.target.value)} /></label>
            <button className="btn-ghost" disabled={task.pending}>Submit for human approval</button>
        </form>
        {task.error && <p role="alert" ref={errorMessage} tabIndex={-1} className="mt-3 text-sm text-red-700">{task.error}</p>}
    </details>;
}
