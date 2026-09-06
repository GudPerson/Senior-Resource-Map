import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { canReviewSupportInbox, createSupportApi, isGuestSupportKey, isSupportImpersonating, readGuestSupportKey, rememberGuestSupportKey, signalSupportUpdate } from '../lib/supportInbox.js';
import GuidePanel from '../features/support/GuidePanel.jsx';
import SupportReportComposer from '../features/support/SupportReportComposer.jsx';
import SupportInbox from '../features/support/SupportInbox.jsx';
import NotificationPanel from '../features/support/NotificationPanel.jsx';
import { buildGuideReportDraft } from '../features/support/guideHistoryState.js';

function SupportHub({ user, isImpersonating }) {
    const location = useLocation();
    const { locale } = useLocale();
    const [params, setParams] = useSearchParams();
    const heading = useRef(null);
    const [guestKey, setGuestKey] = useState(() => user?.id ? '' : readGuestSupportKey());
    const [recoveryDraft, setRecoveryDraft] = useState('');
    const [recoveryError, setRecoveryError] = useState('');
    const [initialReportId, setInitialReportId] = useState(null);
    const [newReportKey, setNewReportKey] = useState(0);
    const [reportDraft, setReportDraft] = useState(null);
    const [context] = useState(() => ({ pathname: String(location.state?.supportContext?.pathname || '/help').slice(0, 1000) }));
    const signedIn = Boolean(user?.id);
    const canReview = canReviewSupportInbox(user, isImpersonating);
    const requestedTab = params.get('tab');
    const tab = ['report', 'inbox', ...(canReview ? ['review'] : [])].includes(requestedTab) ? requestedTab : 'guide';
    const showUpdates = tab === 'inbox' && signedIn && !guestKey && params.get('view') === 'updates';
    const api = useMemo(() => createSupportApi({ guestKey: tab === 'review' ? '' : guestKey, reviewer: tab === 'review' }), [guestKey, tab]);
    useEffect(() => { heading.current?.focus(); }, [tab, guestKey, showUpdates]);
    function changeTab(value) { setParams(value === 'guide' ? {} : { tab: value }); }
    function recover(event) {
        event.preventDefault();
        const value = recoveryDraft.trim().toLowerCase();
        if (!isGuestSupportKey(value)) { setRecoveryError('Enter the full private recovery code saved when you submitted the report.'); return; }
        setRecoveryError(''); setGuestKey(value); setInitialReportId(null); setRecoveryDraft('');
    }
    return <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 pb-16 sm:px-6" lang="en">
        <header><Link className="text-sm font-semibold text-brand-700 underline" to="/discover">Back to Discover</Link>
            <h1 className="mt-3 text-2xl font-extrabold outline-none sm:text-3xl" tabIndex={-1} ref={heading}>CareAround Guide & inbox</h1>
            <p className="mt-2 text-sm text-slate-600">Find your way, get help, and follow up on a problem.</p>
            {locale !== 'en' && <p className="mt-2 text-xs text-slate-500">Guide and support are currently in English.</p>}
        </header>
        <nav className="flex flex-wrap gap-2" aria-label="Help sections">{[['guide', 'Guide & search'], ['inbox', 'Inbox'], ['report', 'Report a problem'], ...(canReview ? [['review', 'Support review']] : [])].map(([value, label]) =>
            <button type="button" key={value} className={tab === value ? 'btn-primary' : 'btn-ghost'} aria-current={tab === value ? 'page' : undefined} onClick={() => changeTab(value)}>{label}</button>)}</nav>
        {isImpersonating && tab !== 'guide' ? <section className="card p-6"><h2 className="font-bold">Exit User View to use the inbox</h2><p className="mt-2 text-sm">Private conversations and support review are not available through impersonation.</p></section>
            : tab === 'guide' ? <GuidePanel api={api} signedIn={signedIn} canSaveHistory={signedIn && !isImpersonating} onDraftReport={isImpersonating ? undefined : (message) => {
                const draft = buildGuideReportDraft(message);
                if (!draft) return;
                setReportDraft(draft); setNewReportKey((value) => value + 1); changeTab('report');
            }} />
                : tab === 'report' ? <SupportReportComposer key={newReportKey} signedIn={signedIn} context={context} initialDraft={reportDraft} onCreated={(report, key) => {
                    setGuestKey(key); setInitialReportId(report.id); setReportDraft(null); setNewReportKey((value) => value + 1); changeTab('inbox');
                }} />
                    : <>
                        {tab === 'inbox' && signedIn && !guestKey && <nav className="mx-auto flex max-w-3xl flex-wrap gap-2" aria-label="Inbox sections">
                            <button className={!showUpdates ? 'btn-primary' : 'btn-ghost'} aria-current={!showUpdates ? 'page' : undefined} onClick={() => setParams({ tab: 'inbox' })}>Messages</button>
                            <button className={showUpdates ? 'btn-primary' : 'btn-ghost'} aria-current={showUpdates ? 'page' : undefined} onClick={() => setParams({ tab: 'inbox', view: 'updates' })}>Updates</button>
                        </nav>}
                        {showUpdates ? <NotificationPanel /> : <>
                        {tab === 'inbox' && <div className="mx-auto max-w-3xl space-y-3">
                            {guestKey && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm">Viewing a guest report using its private recovery code. This does not attach it to your account.</p>
                                <button className="btn-ghost" onClick={() => { setGuestKey(''); setInitialReportId(null); rememberGuestSupportKey(''); signalSupportUpdate(); }}>{signedIn ? 'Return to account inbox' : 'Close and forget this code'}</button>
                            </div>}
                            {!guestKey && <details className="rounded-xl border border-slate-200 p-4" open={!signedIn}>
                                <summary className="cursor-pointer text-sm font-semibold">Recover a guest report</summary>
                                <form onSubmit={recover} className="mt-3 space-y-3"><label className="block text-sm">Private recovery code<input type="password" autoComplete="off" className="input-field mt-1 w-full font-mono text-xs" required maxLength={64} value={recoveryDraft} onChange={(event) => setRecoveryDraft(event.target.value)} /></label>
                                    <button className="btn-ghost">Open guest report</button>{recoveryError && <p role="alert" className="text-sm text-red-700">{recoveryError}</p>}</form>
                                <p className="mt-2 text-xs text-slate-500">Codes expire 30 days after the report is created. They are never used as account sign-in credentials.</p>
                            </details>}
                        </div>}
                        {(signedIn || guestKey || tab === 'review') ? <SupportInbox key={`${tab}:${guestKey}:${initialReportId || ''}`} api={api} reviewer={tab === 'review'} guest={Boolean(guestKey) && tab !== 'review'} initialId={tab === 'review' ? null : initialReportId} />
                            : <section className="card mx-auto max-w-3xl space-y-3 p-6"><p>Sign in for your account inbox, recover a guest report above, or submit a new report without signing in.</p><Link className="btn-primary" to="/login">Sign in</Link></section>}
                        </>}
                    </>}
    </main>;
}

export default function SupportHubPage() {
    const { user, isLoading, isImpersonating } = useAuth();
    const supportImpersonating = isSupportImpersonating(user, isImpersonating);
    if (isLoading) return <main className="p-6" role="status">Loading your help workspace…</main>;
    // Unmount private data and drafts when identity or impersonation changes.
    return <SupportHub key={`${user?.id || 'guest'}:${user?.role || ''}:${supportImpersonating}`} user={user} isImpersonating={supportImpersonating} />;
}
