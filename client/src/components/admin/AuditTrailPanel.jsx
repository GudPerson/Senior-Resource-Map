import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, FileText, Filter, RefreshCw, ShieldCheck } from 'lucide-react';

import { api } from '../../lib/api.js';

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

function userLabel(user) {
    if (!user) return 'System';
    return user.name || user.email || `User ${user.id}`;
}

function targetLabel(log) {
    if (log.resource?.name) return log.resource.name;
    if (log.organization?.name) return log.organization.name;
    if (log.target?.name) return userLabel(log.target);
    return log.entityId ? `Record ${log.entityId}` : 'CareAround SG';
}

function metadataSummary(metadata = {}) {
    const fields = Array.isArray(metadata.changedFields) ? metadata.changedFields : [];
    const items = [];
    if (fields.length) {
        items.push(`${fields.length} field${fields.length === 1 ? '' : 's'}: ${fields.join(', ')}`);
    }
    if (metadata.resourceName && !fields.length) items.push(`Resource: ${metadata.resourceName}`);
    if (metadata.reason) items.push(`Reason: ${metadata.reason}`);
    if (metadata.actorRole) items.push(`Actor role: ${metadata.actorRole}`);
    if (metadata.resourceType && !metadata.resourceName) items.push(`Type: ${metadata.resourceType}`);
    return items;
}

function AuditLogCard({ log }) {
    const summaries = metadataSummary(log.metadata);
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
                    <p className="mt-2 text-sm font-semibold text-slate-700">{targetLabel(log)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                        By {userLabel(log.actor)}
                        {log.organization?.name ? ` · ${log.organization.name}` : ''}
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
    const [category, setCategory] = useState('');
    const [actionType, setActionType] = useState('');
    const [organizationId, setOrganizationId] = useState('');
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
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
                    <label className="space-y-1">
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            <Filter size={13} /> Category
                        </span>
                        <select value={category} onChange={(event) => setCategory(event.target.value)} className="input-field">
                            {CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Action type</span>
                        <input
                            value={actionType}
                            onChange={(event) => setActionType(event.target.value)}
                            placeholder="e.g. resource_updated"
                            className="input-field"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Org ID</span>
                        <input
                            value={organizationId}
                            onChange={(event) => setOrganizationId(event.target.value.replace(/\D/g, ''))}
                            inputMode="numeric"
                            placeholder={scope === 'organizations' ? 'Scoped' : 'Optional'}
                            className="input-field"
                        />
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
