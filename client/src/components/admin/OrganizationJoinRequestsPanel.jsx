import { useCallback, useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';

import { api } from '../../lib/api.js';

export default function OrganizationJoinRequestsPanel() {
    const [requests, setRequests] = useState([]);
    const [reasons, setReasons] = useState({});
    const [feedback, setFeedback] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const result = await api.getOrganizationJoinRequests();
            setRequests((result.requests || []).filter((request) => request.status === 'pending'));
        } catch (error) {
            setFeedback(error.message || 'Unable to load staff access requests.');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function decide(request, approve) {
        const reason = String(reasons[request.id] || '').trim();
        if (!approve && reason.length < 10) {
            setFeedback('Enter a rejection reason of at least 10 characters.');
            return;
        }
        setSaving(true);
        setFeedback('');
        try {
            if (approve) await api.approveOrganizationJoinRequest(request.id, { accessRole: 'staff' });
            else await api.rejectOrganizationJoinRequest(request.id, { reason });
            await load();
        } catch (error) {
            setFeedback(error.message || 'Unable to decide the access request.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserCheck size={20} /></span><div><h2 className="text-xl font-black text-slate-950">Staff access requests</h2><p className="text-sm text-slate-500">Approve staff who registered with your verified organisation domain.</p></div></div>
            {feedback ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{feedback}</p> : null}
            <div className="mt-5 space-y-3">
                {requests.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No pending staff requests.</p> : requests.map((request) => (
                    <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
                        <p className="font-black text-slate-950">{request.name}</p><p className="text-sm text-slate-600">{request.email} · {request.organizationName}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><input className="input-field" placeholder="Reason if rejecting" value={reasons[request.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [request.id]: event.target.value }))} /><button type="button" className="btn-secondary" disabled={saving} onClick={() => decide(request, false)}>Reject</button><button type="button" className="btn-primary" disabled={saving} onClick={() => decide(request, true)}>Approve staff</button></div>
                    </article>
                ))}
            </div>
        </section>
    );
}

