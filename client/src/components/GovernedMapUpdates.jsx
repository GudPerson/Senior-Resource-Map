import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const actionLabels = {
    created: 'Map created', updated: 'Map details updated', resource_added: 'Resource added',
    resource_withdrawn: 'Resource removed', published: 'Publication updated',
    retirement_requested: 'Retirement requested', restored: 'Map restored', archived: 'Map archived',
};

export default function GovernedMapUpdates({ refreshKey }) {
    const [updates, setUpdates] = useState([]);
    const [error, setError] = useState('');
    const [pendingId, setPendingId] = useState(null);
    useEffect(() => {
        let active = true;
        api.getGovernedMapNotifications().then(result => {
            if (active) { setUpdates(result.notifications || []); setError(''); }
        }).catch(() => { if (active) setError('Map updates could not be loaded. Please refresh to try again.'); });
        return () => { active = false; };
    }, [refreshKey]);
    async function markRead(id) {
        setPendingId(id);
        try {
            const result = await api.markGovernedMapNotificationRead(id);
            setUpdates(current => current.map(item => item.id === id ? { ...item, readAt: result.notification.readAt } : item));
            setError('');
        } catch { setError('This update could not be marked as read. Please try again.'); }
        finally { setPendingId(null); }
    }
    return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Care Map updates">
        <h2 className="text-xl font-black text-slate-950">Care Map updates</h2>
        <p className="mt-1 text-sm text-slate-600">Recent changes to maps involving your resources.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        {!updates.length && !error ? <p className="mt-4 text-sm text-slate-500">No map updates yet.</p> : null}
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
            {updates.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="break-words font-bold text-slate-950">{item.mapName}</h3>
                        <p className="text-sm text-slate-700">{actionLabels[item.actionType] || 'Map updated'} · {item.actorName || (item.actionType === 'archived' ? 'Scheduled archive' : 'Former participant')}</p>
                        <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p></div>
                    {!item.readAt ? <button type="button" className="btn-secondary shrink-0" disabled={pendingId === item.id} onClick={() => markRead(item.id)}>Mark as read</button> : <span className="text-xs font-semibold text-slate-500">Read</span>}
                </div>
                {item.reason ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{item.reason}</p> : null}
            </article>)}
        </div>
    </section>;
}
