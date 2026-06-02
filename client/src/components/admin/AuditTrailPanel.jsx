import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, FileText, Filter, RefreshCw, ShieldCheck } from 'lucide-react';

import { api } from '../../lib/api.js';
import {
    auditTargetLabel,
    buildAuditDetailChips,
    buildAuditPlainSummary,
    buildOrganizationFilterOptions,
    userLabel,
} from '../../lib/auditTrailPresentation.js';

const CATEGORY_OPTIONS = [
    { value: '', label: 'All activity' },
    { value: 'resource', label: 'Resource changes' },
    { value: 'organization', label: 'Organisation governance' },
    { value: 'access', label: 'Access changes' },
    { value: 'restricted', label: 'Restricted content' },
    { value: 'privacy', label: 'Privacy preferences' },
    { value: 'workbook', label: 'Workbooks' },
];

function formatDateTime(value) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-SG', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function AuditLogCard({ log }) {
    const summaries = buildAuditDetailChips(log.metadata, log);
    const plainSummary = buildAuditPlainSummary(log);
    const target = auditTargetLabel(log);
    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                            <ShieldCheck size={18} />
                        </span>
                        <h3 className="text-base font-black text-slate-950">{log.actionLabel || log.actionType}</h3>
                    </div>
                    <p className="mt-3 text-base font-semibold leading-6 text-slate-800">{plainSummary}</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                        Record: {target}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                        By {userLabel(log.actor)}
                        {log.organization?.name ? ` · ${log.organization.name}` : ''}
                        {log.actionType ? ` · ${log.actionType}` : ''}
                    </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                    <Clock size={13} />
                    {formatDateTime(log.createdAt)}
                </span>
            </div>
            {summaries.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {summaries.map((item) => (
                        <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {item}
                        </span>
                    ))}
                </div>
            ) : null}
        </article>
    );
}

export default function AuditTrailPanel({ title = 'Audit Trail', subtitle = 'Review sensitive operational changes and governance activity.' }) {
    const [logs, setLogs] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [category, setCategory] = useState('');
    const [actionType, setActionType] = useState('');
    const [organizationId, setOrganizationId] = useState('');
    const [scopeOrganizationIds, setScopeOrganizationIds] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [scope, setScope] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');

    const filters = useMemo(() => ({
        limit: 50,
        category,
        actionType,
        organizationId,
    }), [actionType, category, organizationId]);

    const organizationOptions = useMemo(() => buildOrganizationFilterOptions({
        organizations,
        scope,
        scopeOrganizationIds,
    }), [organizations, scope, scopeOrganizationIds]);

    const loadLogs = useCallback(async ({ append = false, cursor = null } = {}) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }
        setError('');
        try {
            const result = await api.getGovernanceAuditLogs({
                ...filters,
                ...(cursor?.before ? { before: cursor.before } : {}),
                ...(cursor?.beforeId ? { beforeId: cursor.beforeId } : {}),
            });
            const nextLogs = Array.isArray(result.logs) ? result.logs : [];
            setLogs((previous) => (append ? [...previous, ...nextLogs] : nextLogs));
            setNextCursor(result.nextCursor || null);
            setScope(result.scope || '');
            setScopeOrganizationIds(Array.isArray(result.organizationIds) ? result.organizationIds : []);
        } catch (err) {
            setError(err.message || 'Audit logs could not be loaded.');
            if (!append) setLogs([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        let alive = true;
        async function loadOrganizations() {
            try {
                const result = await api.getGovernanceOrganizations();
                if (!alive) return;
                setOrganizations(Array.isArray(result?.organizations) ? result.organizations : []);
            } catch {
                if (alive) setOrganizations([]);
            }
        }
        loadOrganizations();
        return () => {
            alive = false;
        };
    }, []);

    return (
        <section className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Governance</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">{subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={() => loadLogs()}
                    className="btn-secondary inline-flex justify-center gap-2"
                    disabled={loading}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1fr)_minmax(240px,0.85fr)]">
                    <label className="flex min-w-0 flex-col gap-2">
                        <span className="flex min-h-5 items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            <Filter size={13} /> Category
                        </span>
                        <select value={category} onChange={(event) => setCategory(event.target.value)} className="input-field">
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-2">
                        <span className="flex min-h-5 items-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Action type</span>
                        <input
                            value={actionType}
                            onChange={(event) => setActionType(event.target.value)}
                            placeholder="e.g. resource_updated"
                            className="input-field"
                        />
                    </label>
                    <label className="flex min-w-0 flex-col gap-2">
                        <span className="flex min-h-5 items-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Organisation</span>
                        <select
                            value={organizationId}
                            onChange={(event) => setOrganizationId(event.target.value)}
                            className="input-field"
                        >
                            <option value="">{scope === 'organizations' ? 'All my organisations' : 'All organisations'}</option>
                            {organizationOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div>{error}</div>
                </div>
            ) : null}

            {loading ? (
                <div className="space-y-3">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
                    ))}
                </div>
            ) : logs.length ? (
                <div className="space-y-3">
                    {logs.map((log) => <AuditLogCard key={log.id} log={log} />)}
                    {nextCursor ? (
                        <div className="pt-2 text-center">
                            <button
                                type="button"
                                onClick={() => loadLogs({ append: true, cursor: nextCursor })}
                                className="btn-secondary inline-flex justify-center gap-2"
                                disabled={loadingMore}
                            >
                                <FileText size={16} />
                                {loadingMore ? 'Loading...' : 'Load more'}
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <FileText className="mx-auto text-slate-300" size={34} />
                    <h3 className="mt-3 text-lg font-black text-slate-800">No audit activity found</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">Try clearing filters or refreshing the page.</p>
                </div>
            )}
        </section>
    );
}
