import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useGuideAssistant } from './GuideAssistant.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { createSupportApi, isSupportImpersonating, readGuestSupportKey, SUPPORT_UPDATED_EVENT } from '../../lib/supportInbox.js';
import { createNotificationApi } from '../../lib/notifications.js';
import { createSavedSearchApi } from '../../lib/savedSearches.js';
import { notificationInboxPath } from './notificationState.js';

function SupportLink({ user, isImpersonating }) {
    const location = useLocation();
    const guide = useGuideAssistant();
    const [counts, setCounts] = useState({ messages: 0, updates: 0 });
    const unread = counts.messages + counts.updates;
    useEffect(() => {
        if (isImpersonating) return undefined;
        const controller = new AbortController();
        let running = false;
        async function update() {
            if (running || document.visibilityState === 'hidden') return;
            const guestKey = user?.id ? '' : readGuestSupportKey();
            if (!user?.id && !guestKey) { setCounts({ messages: 0, updates: 0 }); return; }
            running = true;
            try {
                const results = await Promise.allSettled([createSupportApi({ guestKey }).unread(controller.signal),
                    user?.id ? createNotificationApi().unread(controller.signal) : Promise.resolve({ count: 0 }),
                    user?.id ? createSavedSearchApi().unread(controller.signal) : Promise.resolve({ count: 0 })]);
                if (!controller.signal.aborted) setCounts({ messages: results[0].status === 'fulfilled' ? results[0].value.count : 0,
                    updates: (results[1].status === 'fulfilled' ? results[1].value.count : 0)
                        + (results[2].status === 'fulfilled' ? results[2].value.count : 0) });
            } catch { if (!controller.signal.aborted) setCounts({ messages: 0, updates: 0 }); }
            finally { running = false; }
        }
        update();
        const timer = window.setInterval(update, 60000);
        window.addEventListener('focus', update);
        window.addEventListener(SUPPORT_UPDATED_EVENT, update);
        return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener(SUPPORT_UPDATED_EVENT, update); };
    }, [user?.id, isImpersonating]);
    const destination = notificationInboxPath(counts.messages, counts.updates);
    const control = <>
        <Sparkles size={18} aria-hidden="true" />
        <span className="hidden lg:inline">Ask Guide</span>
        {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
    </>;
    if (guide?.available) return <button type="button" data-guide-launcher onClick={() => guide.openGuide({ inboxPath: destination })}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        aria-label={unread ? `Ask Guide, ${unread} unread inbox items` : 'Ask Guide'} aria-expanded={guide.open} aria-controls="carearound-guide-assistant" title="Ask Guide">{control}</button>;
    return <Link to={destination} state={{ supportContext: { pathname: location.pathname } }}
        className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-brand-700 hover:bg-brand-50"
        aria-label={unread ? `Help and inbox, ${unread} unread ${unread === 1 ? 'item' : 'items'}` : 'Help and inbox'} title="Help and inbox">
        {control}
    </Link>;
}

export default function SupportNavLink() {
    const { user, isLoading, isImpersonating } = useAuth();
    const supportImpersonating = isSupportImpersonating(user, isImpersonating);
    return isLoading ? null : <SupportLink key={`${user?.id || 'guest'}:${supportImpersonating}`} user={user} isImpersonating={supportImpersonating} />;
}
