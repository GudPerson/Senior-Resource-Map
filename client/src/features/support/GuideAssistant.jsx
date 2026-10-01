import { Component, createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { createSupportApi, isSupportImpersonating, SUPPORT_UI_ENABLED } from '../../lib/supportInbox.js';
import { buildGuideReportDraft } from './guideHistoryState.js';
import { guidePageLabel, guideReportContext, isGuideSurfaceAllowed } from './guideAssistantContext.js';

const GuidePanel = lazy(() => import('./GuidePanel.jsx'));
const GuideAssistantContext = createContext(null);
export const useGuideAssistant = () => useContext(GuideAssistantContext);

class GuideBoundary extends Component {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        return this.state.failed ? <div className="p-6" role="alert">
            <p className="font-semibold">The Guide could not load.</p>
            <p className="mt-2 text-sm">Your current page is still available. If you were creating a programme, check Manage resources before trying again.</p>
        </div> : this.props.children;
    }
}

function GuideSession({ children, user, isImpersonating, isLoading, identityKey }) {
    const location = useLocation();
    const navigate = useNavigate();
    const mobile = useMediaQuery('(max-width: 639px)');
    const [identity, setIdentity] = useState(identityKey);
    const [open, setOpen] = useState(false);
    const [started, setStarted] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [inboxPath, setInboxPath] = useState('/help?tab=inbox');
    const [launchContext, setLaunchContext] = useState({ pathname: '/help' });
    const [actionState, setActionState] = useState({});
    const [reportHandoff, setReportHandoff] = useState(null);
    const panelRef = useRef(null);
    const closeRef = useRef(null);
    const openerRef = useRef(null);
    const api = useMemo(() => createSupportApi(), []);
    const allowed = isGuideSurfaceAllowed(location.pathname, location.search);
    const visible = identity === identityKey && open && allowed && !isLoading;
    const modal = mobile || expanded;
    const signedIn = Boolean(user?.id) && user?.role !== 'guest';

    const openGuide = useCallback((options = {}) => {
        openerRef.current = document.activeElement;
        setLaunchContext(guideReportContext(location.pathname));
        if (typeof options.inboxPath === 'string' && options.inboxPath.startsWith('/help?tab=inbox')) setInboxPath(options.inboxPath);
        setStarted(true);
        setOpen(true);
    }, [location.pathname]);
    const closeGuide = useCallback(() => setOpen(false), []);
    const consumeReportDraft = useCallback(() => setReportHandoff(null), []);
    const currentReportDraft = reportHandoff?.identityKey === identityKey ? reportHandoff.draft : null;
    const currentReportContext = reportHandoff?.identityKey === identityKey ? reportHandoff.context : null;
    const context = useMemo(() => ({ openGuide, closeGuide, open: visible, available: allowed,
        reportDraft: currentReportDraft, reportContext: currentReportContext, consumeReportDraft }),
    [openGuide, closeGuide, visible, allowed, currentReportDraft, currentReportContext, consumeReportDraft]);

    // Reset only the assistant, never the underlying app or an unrelated editor.
    // Identity mismatch hides and unmounts the old conversation synchronously.
    useEffect(() => {
        setIdentity(identityKey); setOpen(false); setStarted(false); setExpanded(false);
        setActionState({}); setReportHandoff(null); setInboxPath('/help?tab=inbox'); setLaunchContext({ pathname: '/help' });
    }, [identityKey]);
    // Preserve the mounted conversation across dismissal and ordinary navigation.
    useEffect(() => { if (!allowed) setOpen(false); }, [allowed]);
    useEffect(() => {
        if (isLoading || location.pathname !== '/help') return;
        const tab = new URLSearchParams(location.search).get('tab');
        if (!tab || tab === 'guide') openGuide();
    }, [location.pathname, location.search, isLoading, identityKey, openGuide]);

    useEffect(() => {
        if (!actionState.hasDraft && !actionState.creating && !actionState.uncertain) return;
        const warnBeforeLeaving = (event) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warnBeforeLeaving);
        return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
    }, [actionState.hasDraft, actionState.creating, actionState.uncertain]);

    useEffect(() => {
        if (!visible) return undefined;
        const frame = requestAnimationFrame(() => closeRef.current?.focus());
        const onKey = (event) => {
            if (event.key === 'Escape' && (modal || panelRef.current?.contains(document.activeElement))) {
                event.preventDefault(); closeGuide(); return;
            }
            if (!modal || event.key !== 'Tab') return;
            const items = [...(panelRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex="0"]') || [])]
                .filter((element) => element.getClientRects().length && !element.closest('[hidden]'));
            const first = items[0]; const last = items[items.length - 1];
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKey);
            // Never steal focus from a newly opened page or another dialog.
            if (panelRef.current?.contains(document.activeElement) || document.activeElement === document.body) {
                // Let the modal cleanup restore inert/scroll before focusing the app.
                requestAnimationFrame(() => {
                    if (document.activeElement !== document.body && !panelRef.current?.contains(document.activeElement)) return;
                    const opener = openerRef.current;
                    const canRestore = opener?.isConnected && opener !== document.body && opener !== document.documentElement
                        && opener.matches('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]')
                        && opener.getClientRects().length && !opener.closest('[hidden], [inert]');
                    const target = canRestore ? opener : document.querySelector('[data-guide-launcher]');
                    target?.focus();
                });
            }
        };
    }, [visible, modal, closeGuide]);

    useEffect(() => {
        if (!visible || !modal) return undefined;
        const appRoot = document.getElementById('root');
        const previousInert = appRoot?.inert;
        const previousOverflow = document.body.style.overflow;
        if (appRoot) appRoot.inert = true;
        document.body.style.overflow = 'hidden';
        return () => {
            if (appRoot) appRoot.inert = previousInert;
            document.body.style.overflow = previousOverflow;
        };
    }, [visible, modal]);

    function draftReport(message) {
        const report = buildGuideReportDraft(message);
        if (!report || isImpersonating) return;
        closeGuide();
        setReportHandoff({ identityKey, draft: report, context: launchContext });
        navigate('/help?tab=report');
    }

    return <GuideAssistantContext.Provider value={context}>
        {children}
        {started && identity === identityKey && createPortal(<div hidden={!visible} style={{ display: visible ? undefined : 'none' }}>
            {modal && <div className="fixed inset-0 z-[1690] bg-slate-950/25" aria-hidden="true" />}
            <aside ref={panelRef} id="carearound-guide-assistant" role="dialog" aria-modal={modal ? true : undefined}
                aria-labelledby="guide-assistant-title" aria-describedby="guide-assistant-description" lang="en"
                className={`fixed inset-y-0 right-0 z-[1700] flex min-h-0 flex-col border-l border-slate-200 shadow-2xl ${modal ? 'w-full' : 'w-[min(460px,100vw)]'}`}
                style={{ height: '100dvh', backgroundColor: 'var(--color-surface, white)', color: 'var(--color-text, #0f172a)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2"><Sparkles size={20} className="shrink-0 text-brand-600" aria-hidden="true" />
                        <div><h2 id="guide-assistant-title" className="text-base font-bold">CareAround Guide</h2>
                            <p id="guide-assistant-description" className="text-xs text-slate-500">Help and actions, alongside your work</p></div></div>
                    <div className="flex shrink-0 items-center">
                        <Link to={inboxPath} state={{ supportContext: launchContext }} onClick={closeGuide} className="rounded-lg px-2 py-3 text-xs font-semibold text-brand-700">Inbox</Link>
                        {!mobile && <button type="button" className="rounded-lg p-3 hover:bg-brand-50" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? 'Restore Guide side panel' : 'Expand Guide'}>
                            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>}
                        <button ref={closeRef} type="button" onClick={closeGuide} className="rounded-lg p-3 hover:bg-brand-50" aria-label="Close Guide"><X size={19} /></button>
                    </div>
                </header>
                <div className="min-h-0 flex-1" onClick={(event) => {
                    const link = event.target.closest?.('a[href]');
                    if (modal && link?.getAttribute('href')?.startsWith('/')) closeGuide();
                }}>
                    <GuideBoundary><Suspense fallback={<p className="p-6 text-sm" role="status">Opening Guide…</p>}>
                        <GuidePanel api={api} signedIn={signedIn} canSaveHistory={signedIn && !isImpersonating}
                            canCreateProgramme={signedIn && !isImpersonating} compact pageLabel={guidePageLabel(location.pathname)}
                            onDraftReport={isImpersonating ? undefined : draftReport} onActionStateChange={setActionState} />
                    </Suspense></GuideBoundary>
                </div>
            </aside>
        </div>, document.body)}
    </GuideAssistantContext.Provider>;
}

export default function GuideAssistantProvider({ children }) {
    const { user, isLoading, isImpersonating } = useAuth();
    if (!SUPPORT_UI_ENABLED) return children;
    const impersonating = isSupportImpersonating(user, isImpersonating);
    return <GuideSession identityKey={`${user?.id || 'guest'}:${user?.role || ''}:${impersonating}`} user={user}
        isLoading={isLoading} isImpersonating={impersonating}>{children}</GuideSession>;
}
