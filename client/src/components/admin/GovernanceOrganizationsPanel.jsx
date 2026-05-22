import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, FileText, Link2, Printer, RefreshCw, Save, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import Select from 'react-select';

import { api } from '../../lib/api.js';
import {
    AGREEMENT_STATUS_HELP,
    AGREEMENT_TYPE_OPTIONS,
    AGREEMENT_USE_DETAILS,
    AGREEMENT_USE_ORDER,
    getAgreementCoverageSummary,
    getAgreementTypeLabel,
    openPrintableAgreement,
} from '../../lib/governanceAgreementUi.js';

const EMPTY_ORG_FORM = {
    name: '',
    description: '',
    governanceStatus: 'active',
    dataContactName: '',
    dataContactEmail: '',
};

const EMPTY_AGREEMENT_FORM = {
    agreementReference: '',
    agreementType: 'data_sharing',
    fileUrl: '',
    fileName: '',
    status: 'draft',
    effectiveAt: '',
    expiresAt: '',
    allowedUses: {
        publicListing: false,
        restrictedFiles: false,
        aggregateAnalytics: false,
        aiAssistedEnrichment: false,
        notifications: false,
        externalSharing: false,
    },
};

const ORGANIZATION_STATUS_HELP = {
    draft: 'Profile is being prepared. Empty drafts can be deleted before they are used.',
    active: 'Ready for agreement coverage, governance access, and resource linking.',
    paused: 'Temporarily prevents new access, agreement records, and resource links.',
    archived: 'Retained for records. Existing history remains, but new governance activity is closed.',
};

const SELECT_STYLES = {
    container: (base) => ({
        ...base,
        minWidth: 0,
        width: '100%',
    }),
    control: (base, state) => ({
        ...base,
        minHeight: '48px',
        width: '100%',
        borderColor: state.isFocused ? '#0f766e' : '#dbe4ef',
        borderRadius: '0.75rem',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(15, 118, 110, 0.12)' : 'none',
        '&:hover': { borderColor: '#99c7c1' },
    }),
    valueContainer: (base) => ({
        ...base,
        minWidth: 0,
        gap: '0.25rem',
        padding: '0.45rem 0.75rem',
    }),
    placeholder: (base) => ({
        ...base,
        color: '#64748b',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    }),
    input: (base) => ({
        ...base,
        minWidth: '8rem',
        color: '#0f172a',
    }),
    singleValue: (base) => ({
        ...base,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
        ...base,
        zIndex: 9999,
        minWidth: '18rem',
        overflow: 'hidden',
        borderRadius: '0.85rem',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.16)',
    }),
    menuList: (base) => ({
        ...base,
        padding: '0.35rem',
    }),
    option: (base, state) => ({
        ...base,
        borderRadius: '0.65rem',
        color: state.isSelected ? '#0f172a' : '#1e293b',
        backgroundColor: state.isSelected ? '#dbeafe' : state.isFocused ? '#f1f5f9' : 'white',
        cursor: 'pointer',
        overflow: 'hidden',
    }),
    multiValue: (base) => ({
        ...base,
        maxWidth: '12rem',
        borderRadius: '999px',
        backgroundColor: '#e6f7f4',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#0f766e',
        fontWeight: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    }),
};

function getSelectMenuPortalTarget() {
    return typeof document !== 'undefined' ? document.body : null;
}

function normalizeOrganizationStatus(value) {
    const normalized = String(value || 'active').trim().toLowerCase();
    return ['active', 'draft', 'paused', 'archived'].includes(normalized) ? normalized : 'active';
}

function isOrganizationOpenForNewRecords(organization) {
    const status = normalizeOrganizationStatus(organization?.governanceStatus);
    return status === 'active' || status === 'draft';
}

function isEmptyDraftOrganization(organization) {
    return normalizeOrganizationStatus(organization?.governanceStatus) === 'draft'
        && !organization?.legacyPartnerUserId
        && (organization?.access || []).length === 0
        && (organization?.agreements || []).length === 0
        && (organization?.resourceLinks || []).length === 0;
}

function coverageToneClass(tone) {
    if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-800';
    return 'border-amber-200 bg-amber-50 text-amber-800';
}

function agreementStatusClass(status) {
    const normalized = String(status || 'draft').toLowerCase();
    if (normalized === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (normalized === 'expired' || normalized === 'revoked') return 'border-red-200 bg-red-50 text-red-800';
    return 'border-slate-200 bg-slate-50 text-slate-700';
}

function formatDateForInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function normalizeOrgForm(organization) {
    if (!organization) return EMPTY_ORG_FORM;
    return {
        name: organization.name || '',
        description: organization.description || '',
        governanceStatus: organization.governanceStatus || 'active',
        dataContactName: organization.dataContactName || '',
        dataContactEmail: organization.dataContactEmail || '',
    };
}

function normalizeAgreementForm(agreement) {
    if (!agreement) return EMPTY_AGREEMENT_FORM;
    return {
        agreementReference: agreement.agreementReference || '',
        agreementType: agreement.agreementType || 'data_sharing',
        fileUrl: agreement.fileUrl || '',
        fileName: agreement.fileName || '',
        status: agreement.status || 'draft',
        effectiveAt: formatDateForInput(agreement.effectiveAt),
        expiresAt: formatDateForInput(agreement.expiresAt),
        allowedUses: {
            ...EMPTY_AGREEMENT_FORM.allowedUses,
            ...(agreement.allowedUses || {}),
        },
    };
}

function buildAgreementPayload(form) {
    return {
        ...form,
        effectiveAt: form.effectiveAt || null,
        expiresAt: form.expiresAt || null,
        allowedUses: { ...form.allowedUses },
    };
}

function formatUserOption(candidate) {
    const title = candidate.name || candidate.username || candidate.email || `User ${candidate.id}`;
    return {
        value: candidate.id,
        label: title,
        meta: [candidate.email, candidate.role].filter(Boolean).join(' · '),
    };
}

function formatResourceOption(candidate) {
    return {
        value: candidate.id,
        label: candidate.name || `Resource ${candidate.id}`,
        resourceType: candidate.resourceType,
        meta: [candidate.subtitle, `${candidate.resourceType} #${candidate.id}`].filter(Boolean).join(' · '),
    };
}

function renderSelectOption(option, { context } = {}) {
    if (context === 'value') return option.label;
    return (
        <div className="min-w-0" title={[option.label, option.meta].filter(Boolean).join(' · ')}>
            <div className="truncate font-bold text-slate-800">{option.label}</div>
            {option.meta ? <div className="mt-0.5 truncate text-xs text-slate-500">{option.meta}</div> : null}
        </div>
    );
}

function Feedback({ feedback }) {
    if (!feedback) return null;
    const isError = feedback.type === 'error';
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {feedback.message}
        </div>
    );
}

export default function GovernanceOrganizationsPanel() {
    const [organizations, setOrganizations] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [orgForm, setOrgForm] = useState(EMPTY_ORG_FORM);
    const [agreementForm, setAgreementForm] = useState(EMPTY_AGREEMENT_FORM);
    const [editingAgreementId, setEditingAgreementId] = useState(null);
    const [accessCandidates, setAccessCandidates] = useState([]);
    const [selectedAccessUsers, setSelectedAccessUsers] = useState([]);
    const [accessQuery, setAccessQuery] = useState('');
    const [accessForm, setAccessForm] = useState({ accessRole: 'staff' });
    const [resourceCandidates, setResourceCandidates] = useState([]);
    const [selectedResources, setSelectedResources] = useState([]);
    const [resourceQuery, setResourceQuery] = useState('');
    const [resourceForm, setResourceForm] = useState({ resourceType: 'hard' });
    const [loading, setLoading] = useState(true);
    const [loadingResources, setLoadingResources] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const selectedOrganization = useMemo(() => (
        organizations.find((organization) => Number(organization.id) === Number(selectedId)) || null
    ), [organizations, selectedId]);
    const selectedOrganizationStatus = normalizeOrganizationStatus(selectedOrganization?.governanceStatus || orgForm.governanceStatus);
    const organizationOpenForNewRecords = !selectedOrganization || isOrganizationOpenForNewRecords(selectedOrganization);
    const selectedOrganizationCanDelete = selectedOrganization ? isEmptyDraftOrganization(selectedOrganization) : false;
    const agreementCoverageItems = useMemo(() => (
        AGREEMENT_USE_ORDER.map((key) => ({
            key,
            ...AGREEMENT_USE_DETAILS[key],
            summary: getAgreementCoverageSummary(selectedOrganization?.agreements || [], key),
        }))
    ), [selectedOrganization?.agreements]);

    async function loadOrganizations(nextSelectedId = selectedId) {
        setLoading(true);
        try {
            const data = await api.getGovernanceOrganizations();
            const items = Array.isArray(data?.organizations) ? data.organizations : [];
            setOrganizations(items);
            const stillSelected = items.some((organization) => Number(organization.id) === Number(nextSelectedId));
            const resolvedSelectedId = stillSelected ? nextSelectedId : items[0]?.id || null;
            setSelectedId(resolvedSelectedId);
            setOrgForm(normalizeOrgForm(items.find((organization) => Number(organization.id) === Number(resolvedSelectedId))));
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisations failed to load.' });
        } finally {
            setLoading(false);
        }
    }

    const accessOptions = useMemo(() => (
        accessCandidates.map(formatUserOption)
    ), [accessCandidates]);

    const resourceOptions = useMemo(() => (
        resourceCandidates.map(formatResourceOption)
    ), [resourceCandidates]);

    async function loadAccessCandidates(organizationId = selectedId, query = accessQuery) {
        if (!organizationId) {
            setAccessCandidates([]);
            return;
        }
        try {
            const data = await api.getGovernanceOrganizationAccessCandidates(organizationId, query);
            setAccessCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Access candidates failed to load.' });
        }
    }

    async function loadResourceCandidates(organizationId = selectedId, resourceType = resourceForm.resourceType, query = resourceQuery) {
        if (!organizationId) {
            setResourceCandidates([]);
            return;
        }
        setLoadingResources(true);
        try {
            const data = await api.getGovernanceOrganizationResourceCandidates(organizationId, resourceType, query);
            setResourceCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Resource candidates failed to load.' });
        } finally {
            setLoadingResources(false);
        }
    }

    useEffect(() => {
        loadOrganizations(null);
    }, []);

    useEffect(() => {
        setOrgForm(normalizeOrgForm(selectedOrganization));
        setAgreementForm(EMPTY_AGREEMENT_FORM);
        setEditingAgreementId(null);
        setSelectedAccessUsers([]);
        setAccessQuery('');
        setAccessForm({ accessRole: 'staff' });
        setResourceForm({ resourceType: 'hard' });
        setSelectedResources([]);
        setResourceQuery('');
        loadAccessCandidates(selectedOrganization?.id || null, '');
        loadResourceCandidates(selectedOrganization?.id || null, 'hard', '');
    }, [selectedOrganization?.id]);

    useEffect(() => {
        if (!selectedOrganization?.id) return undefined;
        const timeout = window.setTimeout(() => {
            loadAccessCandidates(selectedOrganization.id, accessQuery);
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [selectedOrganization?.id, accessQuery]);

    useEffect(() => {
        if (!selectedOrganization?.id) return undefined;
        const timeout = window.setTimeout(() => {
            loadResourceCandidates(selectedOrganization.id, resourceForm.resourceType, resourceQuery);
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [selectedOrganization?.id, resourceForm.resourceType, resourceQuery]);

    async function handleSaveOrganization(event) {
        event.preventDefault();
        setSaving(true);
        setFeedback(null);
        try {
            if (selectedOrganization) {
                await api.updateGovernanceOrganization(selectedOrganization.id, orgForm);
                setFeedback({ type: 'success', message: 'Organisation profile updated.' });
                await loadOrganizations(selectedOrganization.id);
            } else {
                const created = await api.createGovernanceOrganization(orgForm);
                setFeedback({ type: 'success', message: 'Organisation created.' });
                await loadOrganizations(created.id);
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisation could not be saved.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleArchiveOrganization() {
        if (!selectedOrganization) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.updateGovernanceOrganization(selectedOrganization.id, {
                ...orgForm,
                governanceStatus: 'archived',
            });
            setFeedback({ type: 'success', message: 'Organisation archived. Existing history is retained.' });
            await loadOrganizations(selectedOrganization.id);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisation could not be archived.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteOrganization() {
        if (!selectedOrganization || !selectedOrganizationCanDelete) return;
        const confirmed = window.confirm('Delete this empty draft organisation? This is only for unused draft records.');
        if (!confirmed) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.deleteGovernanceOrganization(selectedOrganization.id);
            setFeedback({ type: 'success', message: 'Empty draft organisation deleted.' });
            setSelectedId(null);
            setOrgForm(EMPTY_ORG_FORM);
            await loadOrganizations(null);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisation could not be deleted.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleAddAccess(event) {
        event.preventDefault();
        if (!selectedOrganization || selectedAccessUsers.length === 0 || !organizationOpenForNewRecords) return;
        setSaving(true);
        setFeedback(null);
        try {
            for (const option of selectedAccessUsers) {
                await api.addGovernanceOrganizationAccess(selectedOrganization.id, {
                    userId: option.value,
                    accessRole: accessForm.accessRole,
                });
            }
            setFeedback({ type: 'success', message: selectedAccessUsers.length === 1 ? 'Organisation access added.' : `${selectedAccessUsers.length} organisation access records added.` });
            setSelectedAccessUsers([]);
            await loadOrganizations(selectedOrganization.id);
            await loadAccessCandidates(selectedOrganization.id, accessQuery);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisation access could not be added.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleRevokeAccess(membershipId) {
        if (!selectedOrganization || !membershipId) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.revokeGovernanceOrganizationAccess(selectedOrganization.id, membershipId);
            setFeedback({ type: 'success', message: 'Organisation access revoked.' });
            await loadOrganizations(selectedOrganization.id);
            await loadAccessCandidates(selectedOrganization.id);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Organisation access could not be revoked.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveAgreement(event) {
        event.preventDefault();
        if (!selectedOrganization || (!editingAgreementId && !organizationOpenForNewRecords)) return;
        setSaving(true);
        setFeedback(null);
        try {
            if (editingAgreementId) {
                await api.updateGovernanceAgreement(selectedOrganization.id, editingAgreementId, buildAgreementPayload(agreementForm));
                setFeedback({ type: 'success', message: 'Agreement reference updated.' });
            } else {
                await api.createGovernanceAgreement(selectedOrganization.id, buildAgreementPayload(agreementForm));
                setFeedback({ type: 'success', message: 'Agreement reference added.' });
            }
            setAgreementForm(EMPTY_AGREEMENT_FORM);
            setEditingAgreementId(null);
            await loadOrganizations(selectedOrganization.id);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Agreement could not be saved.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleRevokeAgreement(agreementId) {
        if (!selectedOrganization || !agreementId) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.revokeGovernanceAgreement(selectedOrganization.id, agreementId);
            setFeedback({ type: 'success', message: 'Agreement reference revoked.' });
            await loadOrganizations(selectedOrganization.id);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Agreement could not be revoked.' });
        } finally {
            setSaving(false);
        }
    }

    function handlePrintAgreementDraft(agreement = agreementForm) {
        if (!selectedOrganization) return;
        const opened = openPrintableAgreement({
            organization: selectedOrganization,
            agreement: buildAgreementPayload(agreement),
            resourceLinks: selectedOrganization.resourceLinks || [],
        });
        if (!opened) {
            setFeedback({ type: 'error', message: 'The printable agreement window was blocked. Allow pop-ups for this site and try again.' });
        }
    }

    async function handleLinkResource(event) {
        event.preventDefault();
        if (!selectedOrganization || selectedResources.length === 0 || !organizationOpenForNewRecords) return;
        setSaving(true);
        setFeedback(null);
        try {
            for (const option of selectedResources) {
                await api.linkGovernanceResource(selectedOrganization.id, {
                    resourceType: resourceForm.resourceType,
                    resourceId: option.value,
                });
            }
            setFeedback({ type: 'success', message: selectedResources.length === 1 ? 'Resource linked for agreement coverage.' : `${selectedResources.length} resources linked for agreement coverage.` });
            setSelectedResources([]);
            await loadOrganizations(selectedOrganization.id);
            await loadResourceCandidates(selectedOrganization.id, resourceForm.resourceType, resourceQuery);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Resource could not be linked.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleUnlinkResource(linkId) {
        if (!selectedOrganization || !linkId) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.unlinkGovernanceResource(selectedOrganization.id, linkId);
            setFeedback({ type: 'success', message: 'Resource link removed.' });
            await loadOrganizations(selectedOrganization.id);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Resource link could not be removed.' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700">Governance</p>
                    <h2 className="mt-1 text-3xl font-black text-slate-900">Organisations</h2>
                    <p className="mt-2 max-w-3xl text-sm text-slate-500">
                        Track legal counterparty context, agreement coverage, and governance access without granting resource edit rights.
                    </p>
                </div>
                <button type="button" onClick={() => loadOrganizations(selectedOrganization?.id || null)} className="btn-secondary w-fit gap-2" disabled={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </button>
            </div>

            <Feedback feedback={feedback} />

            <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-black text-slate-900">Organisation list</h3>
                        <button
                            type="button"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
                            onClick={() => {
                                setSelectedId(null);
                                setOrgForm(EMPTY_ORG_FORM);
                            }}
                        >
                            New
                        </button>
                    </div>
                    <div className="mt-4 space-y-2">
                        {loading ? (
                            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">Loading organisations...</p>
                        ) : organizations.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500">No organisations yet.</p>
                        ) : organizations.map((organization) => (
                            <button
                                key={organization.id}
                                type="button"
                                onClick={() => setSelectedId(organization.id)}
                                className={`w-full rounded-xl border px-4 py-3 text-left transition ${Number(selectedId) === Number(organization.id) ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'}`}
                            >
                                <span className="block font-bold">{organization.name}</span>
                                <span className="mt-1 block text-xs text-slate-500">
                                    {organization.access?.length || 0} access · {organization.agreements?.length || 0} agreement · {organization.resourceLinks?.length || 0} linked
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-5">
                    <form onSubmit={handleSaveOrganization} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 className="h-5 w-5" /></span>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">{selectedOrganization ? 'Organisation profile' : 'New organisation'}</h3>
                                <p className="text-sm text-slate-500">Governance metadata only. Asset editing still needs Asset Owner/Staff access.</p>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Organisation name</span>
                                <input className="input-field" value={orgForm.name} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} required />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-bold text-slate-700">Status</span>
                                <select className="input-field" value={orgForm.governanceStatus} onChange={(event) => setOrgForm({ ...orgForm, governanceStatus: event.target.value })}>
                                    <option value="active">Active</option>
                                    <option value="draft">Draft</option>
                                    <option value="paused">Paused</option>
                                    <option value="archived">Archived</option>
                                </select>
                                <span className="block text-xs leading-5 text-slate-500">
                                    {ORGANIZATION_STATUS_HELP[normalizeOrganizationStatus(orgForm.governanceStatus)]}
                                </span>
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-bold text-slate-700">Data contact email</span>
                                <input className="input-field" value={orgForm.dataContactEmail} onChange={(event) => setOrgForm({ ...orgForm, dataContactEmail: event.target.value })} />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Data contact name</span>
                                <input className="input-field" value={orgForm.dataContactName} onChange={(event) => setOrgForm({ ...orgForm, dataContactName: event.target.value })} />
                            </label>
                            <label className="space-y-1 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">Notes</span>
                                <textarea className="input-field min-h-[110px]" value={orgForm.description} onChange={(event) => setOrgForm({ ...orgForm, description: event.target.value })} />
                            </label>
                        </div>
                        <button type="submit" className="btn-primary mt-5 w-full gap-2" disabled={saving}>
                            <Save className="h-4 w-4" />
                            {selectedOrganization ? 'Save Organisation' : 'Create Organisation'}
                        </button>
                        {selectedOrganization ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    className="btn-secondary gap-2"
                                    onClick={handleArchiveOrganization}
                                    disabled={saving || selectedOrganizationStatus === 'archived'}
                                >
                                    <FileText className="h-4 w-4" />
                                    Archive Organisation
                                </button>
                                <button
                                    type="button"
                                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={handleDeleteOrganization}
                                    disabled={saving || !selectedOrganizationCanDelete}
                                    title={selectedOrganizationCanDelete ? 'Delete this unused draft organisation' : 'Only empty draft organisations can be deleted'}
                                >
                                    <span className="inline-flex items-center justify-center gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Delete Empty Draft
                                    </span>
                                </button>
                            </div>
                        ) : null}
                    </form>

                    {selectedOrganization ? (
                        <>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                <div className="flex gap-2">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                                    <p>Organisation access is governance-only. It does not grant resource editing, restricted content editing, or dashboard resource ownership.</p>
                                </div>
                            </div>
                            {!organizationOpenForNewRecords ? (
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    This organisation is {selectedOrganizationStatus}. You can still review history and remove old links/access, but new access, agreement records, and linked resources are closed until it is set back to Active or Draft.
                                </div>
                            ) : null}

                            <div className="grid gap-5 xl:grid-cols-2">
                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><UserPlus className="h-5 w-5" /></span>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">Organisation access</h3>
                                            <p className="text-sm text-slate-500">Admin manages this organisation. Staff can view context.</p>
                                        </div>
                                    </div>
                                    <form onSubmit={handleAddAccess} className="mt-4 space-y-3">
                                        <label className="block space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Eligible users</span>
                                            <Select
                                                isMulti
                                                className="react-select-container"
                                                classNamePrefix="react-select"
                                                styles={SELECT_STYLES}
                                                menuPortalTarget={getSelectMenuPortalTarget()}
                                                menuPosition="fixed"
                                                maxMenuHeight={260}
                                                options={accessOptions}
                                                value={selectedAccessUsers}
                                                onChange={(value) => setSelectedAccessUsers(Array.isArray(value) ? value : [])}
                                                onInputChange={(value, action) => {
                                                    if (action.action === 'input-change') setAccessQuery(value);
                                                }}
                                                formatOptionLabel={renderSelectOption}
                                                placeholder="Search eligible users..."
                                                noOptionsMessage={() => 'No eligible users found'}
                                                isDisabled={saving || !organizationOpenForNewRecords}
                                            />
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                            <label className="space-y-1">
                                                <span className="text-sm font-bold text-slate-700">Access level</span>
                                                <select className="input-field min-h-[48px]" value={accessForm.accessRole} onChange={(event) => setAccessForm({ ...accessForm, accessRole: event.target.value })} disabled={saving || !organizationOpenForNewRecords}>
                                                    <option value="staff">Staff</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </label>
                                            <button type="submit" className="btn-primary min-h-[48px] gap-2 self-end sm:min-w-[9rem]" disabled={saving || selectedAccessUsers.length === 0 || !organizationOpenForNewRecords}>
                                                <UserPlus className="h-4 w-4" />
                                                Add
                                            </button>
                                        </div>
                                    </form>
                                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                        {(selectedOrganization.access || []).length === 0 ? (
                                            <p className="p-4 text-sm text-slate-500">No organisation access assigned.</p>
                                        ) : selectedOrganization.access.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
                                                <div>
                                                    <p className="font-bold text-slate-800">{entry.user?.name || entry.user?.username}</p>
                                                    <p className="text-xs text-slate-500">{entry.user?.email} · {entry.accessRole}</p>
                                                </div>
                                                <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => handleRevokeAccess(entry.id)} disabled={saving}>
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Link2 className="h-5 w-5" /></span>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">Linked resources</h3>
                                            <p className="text-sm text-slate-500">Agreement coverage and reporting context only.</p>
                                        </div>
                                    </div>
                                    <form onSubmit={handleLinkResource} className="mt-4 space-y-3">
                                        <label className="block space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Resources</span>
                                            <Select
                                                isMulti
                                                className="react-select-container"
                                                classNamePrefix="react-select"
                                                styles={SELECT_STYLES}
                                                menuPortalTarget={getSelectMenuPortalTarget()}
                                                menuPosition="fixed"
                                                maxMenuHeight={260}
                                                options={resourceOptions}
                                                value={selectedResources}
                                                onChange={(value) => setSelectedResources(Array.isArray(value) ? value : [])}
                                                onInputChange={(value, action) => {
                                                    if (action.action === 'input-change') setResourceQuery(value);
                                                }}
                                                formatOptionLabel={renderSelectOption}
                                                placeholder="Search resources to link..."
                                                noOptionsMessage={() => (loadingResources ? 'Searching resources...' : 'No resources found')}
                                                isLoading={loadingResources}
                                                isDisabled={saving || !organizationOpenForNewRecords}
                                            />
                                        </label>
                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                            <label className="space-y-1">
                                                <span className="text-sm font-bold text-slate-700">Resource type</span>
                                                <select
                                                    className="input-field min-h-[48px]"
                                                    value={resourceForm.resourceType}
                                                    disabled={saving || !organizationOpenForNewRecords}
                                                    onChange={(event) => {
                                                        setResourceForm({ resourceType: event.target.value });
                                                        setSelectedResources([]);
                                                        setResourceQuery('');
                                                    }}
                                                >
                                                    <option value="hard">Place</option>
                                                    <option value="soft">Offering</option>
                                                    <option value="template">Template</option>
                                                </select>
                                            </label>
                                            <button type="submit" className="btn-primary min-h-[48px] gap-2 self-end sm:min-w-[9rem]" disabled={saving || selectedResources.length === 0 || !organizationOpenForNewRecords}>
                                                <Link2 className="h-4 w-4" />
                                                Link
                                            </button>
                                        </div>
                                    </form>
                                    <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                        {(selectedOrganization.resourceLinks || []).length === 0 ? (
                                            <p className="p-4 text-sm text-slate-500">No linked resources yet.</p>
                                        ) : selectedOrganization.resourceLinks.map((link) => (
                                            <div key={link.id} className="flex items-center justify-between gap-3 p-3">
                                                <div>
                                                    <p className="font-bold text-slate-800">{link.resourceName || `Resource ${link.resourceId}`}</p>
                                                    <p className="text-xs text-slate-500">{link.resourceType} #{link.resourceId}</p>
                                                </div>
                                                <button type="button" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => handleUnlinkResource(link.id)} disabled={saving}>
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="rounded-xl bg-sky-50 p-3 text-sky-700"><FileText className="h-5 w-5" /></span>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">Agreement records</h3>
                                        <p className="text-sm text-slate-500">Create a printable agreement summary, then store the signed-copy link or file reference here.</p>
                                    </div>
                                </div>
                                <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                                    <p className="text-sm font-black text-sky-900">How this works</p>
                                    <p className="mt-1 text-sm text-sky-800">
                                        Use this record to prove what the organisation has agreed to. You can print or save the draft as PDF, get it signed outside CareAround SG, then paste the signed-copy storage link back into this record.
                                    </p>
                                </div>
                                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {agreementCoverageItems.map((item) => (
                                        <div key={item.key} className={`rounded-xl border p-3 ${coverageToneClass(item.summary.tone)}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-black">{item.label}</p>
                                                <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-black">{item.summary.label}</span>
                                            </div>
                                            <p className="mt-1 text-xs leading-5">{item.summary.description}</p>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSaveAgreement} className="mt-5 space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Reference/code</span>
                                            <input className="input-field" placeholder="e.g. FY-DSA-2026-001" value={agreementForm.agreementReference} onChange={(event) => setAgreementForm({ ...agreementForm, agreementReference: event.target.value })} required />
                                            <span className="block text-xs text-slate-500">Use the agreement number, MOU code, or your own tracking reference.</span>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Type</span>
                                            <select className="input-field" value={agreementForm.agreementType} onChange={(event) => setAgreementForm({ ...agreementForm, agreementType: event.target.value })}>
                                                {AGREEMENT_TYPE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            <span className="block text-xs text-slate-500">Choose the closest plain-language category. This does not change asset edit rights.</span>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Status</span>
                                            <select className="input-field" value={agreementForm.status} onChange={(event) => setAgreementForm({ ...agreementForm, status: event.target.value })}>
                                                <option value="draft">Draft</option>
                                                <option value="active">Active</option>
                                                <option value="expired">Expired</option>
                                                <option value="revoked">Revoked</option>
                                            </select>
                                            <span className="block text-xs text-slate-500">{AGREEMENT_STATUS_HELP[agreementForm.status] || AGREEMENT_STATUS_HELP.draft}</span>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Signed copy link / storage reference</span>
                                            <input className="input-field" placeholder="Paste Drive link, file path, or archive reference" value={agreementForm.fileUrl} onChange={(event) => setAgreementForm({ ...agreementForm, fileUrl: event.target.value })} />
                                            <span className="block text-xs text-slate-500">After printing or e-signing, store the signed-copy reference here.</span>
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Effective date</span>
                                            <input type="date" className="input-field" value={agreementForm.effectiveAt} onChange={(event) => setAgreementForm({ ...agreementForm, effectiveAt: event.target.value })} />
                                        </label>
                                        <label className="space-y-1">
                                            <span className="text-sm font-bold text-slate-700">Expiry date</span>
                                            <input type="date" className="input-field" value={agreementForm.expiresAt} onChange={(event) => setAgreementForm({ ...agreementForm, expiresAt: event.target.value })} />
                                        </label>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {AGREEMENT_USE_ORDER.map((key) => {
                                            const item = AGREEMENT_USE_DETAILS[key];
                                            return (
                                                <label key={key} className="flex min-h-[96px] items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 transition hover:border-brand-200 hover:bg-brand-50/40">
                                                <input
                                                    className="mt-1 h-4 w-4 accent-brand-600"
                                                    type="checkbox"
                                                    checked={agreementForm.allowedUses[key]}
                                                    onChange={(event) => setAgreementForm({
                                                        ...agreementForm,
                                                        allowedUses: {
                                                            ...agreementForm.allowedUses,
                                                            [key]: event.target.checked,
                                                        },
                                                    })}
                                                />
                                                <span>
                                                    <span className="block font-black text-slate-800">{item.label}</span>
                                                    <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                                                </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <button type="submit" className="btn-primary flex-1 gap-2" disabled={saving || (!editingAgreementId && !organizationOpenForNewRecords)}>
                                            <ShieldCheck className="h-4 w-4" />
                                            {editingAgreementId ? 'Update Agreement' : 'Add Agreement'}
                                        </button>
                                        <button type="button" className="btn-secondary flex-1 gap-2" onClick={() => handlePrintAgreementDraft()} disabled={!selectedOrganization}>
                                            <Printer className="h-4 w-4" />
                                            Print / Save PDF
                                        </button>
                                        {editingAgreementId ? (
                                            <button type="button" className="btn-secondary flex-1" onClick={() => {
                                                setEditingAgreementId(null);
                                                setAgreementForm(EMPTY_AGREEMENT_FORM);
                                            }}>
                                                Cancel edit
                                            </button>
                                        ) : null}
                                    </div>
                                </form>
                                <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
                                    {(selectedOrganization.agreements || []).length === 0 ? (
                                        <p className="p-4 text-sm text-slate-500">No agreement records yet.</p>
                                    ) : selectedOrganization.agreements.map((agreement) => (
                                        <div key={agreement.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-black text-slate-900">{agreement.agreementReference}</p>
                                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black uppercase ${agreementStatusClass(agreement.status)}`}>{agreement.status}</span>
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">{getAgreementTypeLabel(agreement.agreementType)} · expires {formatDateForInput(agreement.expiresAt) || 'not set'}</p>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {AGREEMENT_USE_ORDER.filter((key) => agreement.allowedUses?.[key]).length === 0 ? (
                                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">No allowed uses selected</span>
                                                    ) : AGREEMENT_USE_ORDER.filter((key) => agreement.allowedUses?.[key]).map((key) => (
                                                        <span key={key} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">{AGREEMENT_USE_DETAILS[key].label}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button type="button" className="btn-secondary gap-2 py-2 text-sm" onClick={() => handlePrintAgreementDraft(agreement)}>
                                                    <Printer className="h-4 w-4" />
                                                    Print
                                                </button>
                                                <button type="button" className="btn-secondary py-2 text-sm" onClick={() => {
                                                    setEditingAgreementId(agreement.id);
                                                    setAgreementForm(normalizeAgreementForm(agreement));
                                                }}>
                                                    Edit
                                                </button>
                                                <button type="button" className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50" onClick={() => handleRevokeAgreement(agreement.id)} disabled={saving}>
                                                    Revoke
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
