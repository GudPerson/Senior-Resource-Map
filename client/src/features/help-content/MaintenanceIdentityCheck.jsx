// Temporary owner-only maintenance control; remove with the Regional release.
import { useEffect, useRef, useState } from 'react';
import { CmsButton } from './CmsControls.jsx';

const fields = ['ok', 'branch_id', 'database', 'effective_role', 'session_role', 'workerVersionId', 'sourceRevision', 'observedAt'];
const closed = () => ({ armed: false, expiresAt: null });
export function identityPermitReady(permit, now = Date.now()) {
    return permit?.armed === true && typeof permit.expiresAt === 'string'
        && Number.isFinite(Date.parse(permit.expiresAt)) && now < Date.parse(permit.expiresAt);
}
export async function observeIdentityOnce({ latch, permit, observe, signal }) {
    if (latch.current || !identityPermitReady(permit)) return { state: 'disabled' };
    latch.current = true;
    try { return { state: 'complete', value: await observe(signal) }; }
    catch { return { state: 'unknown' }; }
}

export default function MaintenanceIdentityCheck({ api, attemptLatch, disabled = false, onAccessDenied }) {
    const localLatch = useRef(false), latch = attemptLatch || localLatch;
    const [permit, setPermit] = useState(closed), [busy, setBusy] = useState(false);
    const [attempted, setAttempted] = useState(latch.current), [result, setResult] = useState(null), [unavailable, setUnavailable] = useState(false);
    const lifetime = useRef(null);
    useEffect(() => {
        const controller = new AbortController(); lifetime.current = controller;
        return () => controller.abort();
    }, []);
    useEffect(() => {
        if (!permit.armed) return undefined;
        const timer = setTimeout(() => setPermit(closed()), Math.max(0, Math.min(900000, Date.parse(permit.expiresAt) - Date.now())));
        return () => clearTimeout(timer);
    }, [permit]);
    async function refresh() {
        if (busy || disabled || latch.current || typeof api?.identityPermitStatus !== 'function') return;
        setBusy(true); setPermit(closed()); setUnavailable(false);
        try {
            const metadata = await api.identityPermitStatus(lifetime.current.signal);
            if (!lifetime.current.signal.aborted) setPermit(metadata);
        } catch (cause) {
            if (!lifetime.current.signal.aborted) {
                setUnavailable(true);
                if (cause?.status === 401 || cause?.status === 403) onAccessDenied?.(cause);
            }
        } finally { if (!lifetime.current.signal.aborted) setBusy(false); }
    }
    async function observe() {
        if (busy || disabled || latch.current || !identityPermitReady(permit) || typeof api?.observeBindingOnce !== 'function') return;
        setAttempted(true); setBusy(true);
        const outcome = await observeIdentityOnce({ latch, permit, observe: signal => api.observeBindingOnce(signal), signal: lifetime.current.signal });
        if (!lifetime.current.signal.aborted) { setResult(outcome); setPermit(closed()); setBusy(false); }
    }
    const ready = !attempted && !latch.current && identityPermitReady(permit);
    return <section className="cms-banner" aria-label="Temporary database identity check" style={{ marginTop: 20 }}>
        <h3>Temporary database identity check</h3>
        <p role="status">{attempted || latch.current ? 'This session’s check has been used. Do not retry.' : ready ? `Permit ready until ${permit.expiresAt}.` : unavailable ? 'Permit status is unavailable. The check remains disabled.' : 'Explicitly refresh permit status after the verified publication. The check remains disabled until ready.'}</p>
        <div className="cms-actions">
            <CmsButton disabled={disabled || busy || attempted || latch.current || typeof api?.identityPermitStatus !== 'function'} onClick={refresh}>Refresh permit status</CmsButton>
            <CmsButton disabled={disabled || busy || !ready || typeof api?.observeBindingOnce !== 'function'} onClick={observe}>Check database identity once</CmsButton>
        </div>
        {result?.state === 'unknown' && <p role="alert">Database identity could not be confirmed. Stop and do not retry.</p>}
        {result?.state === 'complete' && <dl>{fields.map(field => <div key={field}><dt>{field}</dt><dd>{String(result.value[field])}</dd></div>)}</dl>}
    </section>;
}
