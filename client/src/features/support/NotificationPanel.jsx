import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createNotificationApi } from '../../lib/notifications.js';
import { safeGuideActionRoute, signalSupportUpdate } from '../../lib/supportInbox.js';
import { useSupportTask } from './useSupportTask.js';
import { mergeNotificationPages } from './notificationState.js';
import SavedSearchPanel from './SavedSearchPanel.jsx';

const categoryLabels = { calendar: 'Saved schedule changes', resources: 'Saved resource changes' };
const fieldLabels = { name: 'Name', category: 'Category', address: 'Address', hours: 'Opening hours',
    contact: 'Contact details', schedule: 'Schedule', availability: 'Availability in CareAround' };

export default function NotificationPanel() {
    const api = useMemo(() => createNotificationApi(), []);
    const task = useSupportTask();
    const [settings, setSettings] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [muted, setMuted] = useState([]);
    const [mutedCursor, setMutedCursor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const heading = useRef(null);
    const load = (signal) => Promise.all([api.preferences(signal), api.list(null, signal), api.muted(null, signal)]);
    function applyData([preferences, updates, controls]) {
        setSettings(preferences); setNotifications(updates.notifications); setNextCursor(updates.nextCursor);
        setMuted(controls.muted); setMutedCursor(controls.nextCursor);
    }
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setLoadError('');
        load(controller.signal).then((data) => { if (!controller.signal.aborted) applyData(data); })
            .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message || 'Please try again.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        heading.current?.focus();
        return () => controller.abort();
    }, [api]);
    const refresh = () => { setLoadError(''); return task.run(() => load(), applyData); };
    const mutate = (work, focusHeading = false) => task.run(async () => { await work(); return load(); }, (data) => {
        applyData(data); signalSupportUpdate();
        if (focusHeading) heading.current?.focus();
    });
    return <section className="mx-auto max-w-3xl space-y-4" aria-labelledby="notification-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 id="notification-heading" ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">Your updates</h2>
                <p className="mt-1 text-sm text-slate-600">Updates for saved resources and searches. Your plans and calendar review decisions stay unchanged.</p></div>
            <button className="btn-ghost" disabled={task.pending} onClick={refresh}>Refresh updates</button>
        </div>
        {task.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{task.error}</p>}
        {loadError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
        {settings && task.pending && <p role="status" className="text-sm text-slate-600">Updating your inbox…</p>}
        {!settings && (loading || task.pending) && <p role="status">Loading your updates…</p>}
        {settings && <details className="card p-4">
            <summary className="cursor-pointer font-semibold">Notification preferences</summary>
            <p className="mt-3 text-sm text-slate-600">Choose updates to keep in this private inbox. Checks continue when you close the app; this does not send device push, email or WhatsApp messages. Turning a category on starts from current information, without a backlog.</p>
            {!settings.masterEnabled && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">In-app notifications are disabled in your Profile. Your choices below are saved but paused. <Link className="font-semibold underline" to="/dashboard/profile">Open Profile</Link></p>}
            <div className="mt-3 space-y-2">{Object.entries(categoryLabels).map(([category, label]) =>
                <label key={category} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-teal-700" checked={Boolean(settings.categories[category]?.enabled)} disabled={task.pending}
                        onChange={(event) => mutate(() => api.setPreference(category, event.target.checked))} />
                    <span className="text-sm font-medium">{label}</span>
                </label>)}</div>
            <p className="mt-3 text-xs text-slate-500">Schedule updates use published Care Calendar revisions. Resource updates cover name, category, address, opening hours, phone/website, and whether the saved resource is still visible to you.</p>
            {muted.length > 0 && <div className="mt-4 space-y-2 border-t border-slate-200 pt-4"><h3 className="font-semibold">Muted resources</h3>
                <p className="text-xs text-slate-500">Unmuting starts checking from current information; it does not create catch-up alerts.</p>
                {muted.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3">
                    <span className="min-w-0 break-words text-sm">{item.title}</span>
                    <button className="btn-ghost" disabled={task.pending} onClick={() => mutate(() => api.setMute(item.id, item.revision, false), true)}>Unmute</button>
                </div>)}
                {mutedCursor && <button className="btn-ghost" disabled={task.pending} onClick={() => task.run(() => api.muted(mutedCursor), (data) => {
                    setMuted((current) => mergeNotificationPages(current, data.muted)); setMutedCursor(data.nextCursor);
                })}>More muted resources</button>}
            </div>}
        </details>}
        {settings && !task.error && !loadError && !notifications.length && <div className="card space-y-2 p-5">
            <h3 className="font-semibold">No saved-resource changes to review</h3>
            <p className="text-sm text-slate-600">Choose notification categories above. New changes will appear here after checking your saved resources.</p>
        </div>}
        {!task.error && !loadError && notifications.map((notice) => <article key={notice.id} className={`card space-y-3 p-4 sm:p-5 ${notice.unread ? 'border-brand-300' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 break-words font-bold">{notice.title}</h3>
                {notice.unread && <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">Unread</span>}
            </div>
            <p className="text-sm text-slate-700">{notice.message}</p>
            {notice.changedFields?.length > 0 && <p className="text-xs text-slate-500">Updated: {notice.changedFields.map((field) => fieldLabels[field]).filter(Boolean).join(', ')}</p>}
            <time className="block text-xs text-slate-500" dateTime={notice.updatedAt}>{new Date(notice.updatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} (Singapore)</time>
            <div className="flex flex-wrap gap-2">{notice.actions?.map((action, index) => {
                const path = safeGuideActionRoute(action.path, true);
                return path ? <Link key={path} className={index === 0 ? 'btn-primary' : 'btn-ghost'} to={path}>{action.label}</Link> : null;
            })}
                <button className="btn-ghost" disabled={task.pending} onClick={() => mutate(() => api.setState(notice.id, notice.revision, notice.unread ? 'read' : 'unread'))}>{notice.unread ? 'Mark read' : 'Mark unread'}</button>
                <button className="btn-ghost" disabled={task.pending} onClick={() => mutate(() => api.setState(notice.id, notice.revision, 'dismiss'), true)}>Dismiss</button>
                <button className="btn-ghost" disabled={task.pending} onClick={() => mutate(() => api.setMute(notice.watch.id, notice.watch.revision, true), true)}>Mute resource</button>
            </div>
        </article>)}
        {nextCursor && <button className="btn-ghost w-full" disabled={task.pending} onClick={() => task.run(() => api.list(nextCursor), (data) => {
            setNotifications((current) => mergeNotificationPages(current, data.notifications)); setNextCursor(data.nextCursor);
        })}>Load older updates</button>}
        <SavedSearchPanel />
    </section>;
}
