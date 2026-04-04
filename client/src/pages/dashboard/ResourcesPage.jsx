import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Select from 'react-select';
import Papa from 'papaparse';
import {
    CalendarDays,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    Eye,
    EyeOff,
    Files,
    Info,
    Lock,
    MapPin,
    Minus,
    Pencil,
    Phone,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    Upload,
    Users,
    X,
} from 'lucide-react';

import AssetForm from '../../components/AssetForm.jsx';
import DirectoryQrCode from '../../components/DirectoryQrCode.jsx';
import SoftAssetChildForm from '../../components/SoftAssetChildForm.jsx';
import SoftAssetTemplateForm from '../../components/SoftAssetTemplateForm.jsx';
import { AssetCard } from '../../components/AssetCard.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../../lib/availability.js';
import { isStandardUserRole, normalizeRole } from '../../lib/roles.js';

const TagBadge = ({ tag, onClick }) => (
    <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ${onClick ? 'cursor-pointer transition-colors hover:bg-slate-200' : ''}`}
    >
        {tag}
    </span>
);

const CategoryBadge = ({ category, onClick }) => (
    <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900 ${onClick ? 'cursor-pointer transition-colors hover:bg-brand-100' : ''}`}
    >
        {category}
    </span>
);

function getHiddenStatus(asset) {
    if (asset.isHidden) return { hidden: true, type: 'manual' };

    const now = new Date();
    const from = asset.hideFrom ? new Date(asset.hideFrom) : null;
    const until = asset.hideUntil ? new Date(asset.hideUntil) : null;

    if (from && until && now >= from && now <= until) return { hidden: true, type: 'scheduled' };
    if (from && !until && now >= from) return { hidden: true, type: 'scheduled' };
    if (!from && until && now <= until) return { hidden: true, type: 'scheduled' };
    return { hidden: false };
}

const HiddenBadge = ({ status }) => {
    if (!status.hidden) return null;
    return (
        <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
            {status.type === 'scheduled' ? <Clock size={10} strokeWidth={3} /> : null}
            Hidden
        </span>
    );
};

const VisibilityBadge = ({ hidden }) => (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${hidden ? 'border-red-200 bg-red-50 text-red-600' : 'border-green-200 bg-green-50 text-green-700'}`}>
        {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
        {hidden ? 'Hidden' : 'Live'}
    </span>
);

function AvailabilityCounterControl({
    asset,
    disabled = false,
    onAdjust,
    onToggle,
}) {
    const enabled = Boolean(asset?.availabilityEnabled);
    const count = normalizeAvailabilityCount(asset?.availabilityCount);
    const unit = normalizeAvailabilityUnit(asset?.availabilityUnit);
    const [draftCount, setDraftCount] = useState(String(count));

    useEffect(() => {
        setDraftCount(String(count));
    }, [count]);

    function commitDraftCount() {
        const nextCount = normalizeAvailabilityCount(draftCount);
        setDraftCount(String(nextCount));
        if (nextCount !== count) {
            onAdjust(nextCount);
        }
    }

    return (
        <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Availability counter</p>
                    <p className="mt-1 text-sm text-slate-600">
                        {enabled ? 'Shown on public offering cards and detail views.' : 'Hidden publicly until tracking is turned on.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onToggle(!enabled)}
                    disabled={disabled}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        enabled
                            ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    {enabled ? 'Tracking on' : 'Tracking off'}
                </button>
            </div>

            {enabled ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onAdjust(Math.max(0, count - 1))}
                        disabled={disabled || count <= 0}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Decrease availability"
                    >
                        <Minus size={16} />
                    </button>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        value={draftCount}
                        onChange={(event) => setDraftCount(event.target.value)}
                        onBlur={commitDraftCount}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                commitDraftCount();
                            }
                        }}
                        disabled={disabled}
                        aria-label="Availability count"
                        className="min-h-11 w-20 rounded-xl border border-brand-200 bg-white px-3 text-center text-lg font-black text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <button
                        type="button"
                        onClick={() => onAdjust(count + 1)}
                        disabled={disabled}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Increase availability"
                    >
                        <Plus size={16} />
                    </button>
                    <span className="text-sm font-semibold text-slate-500">
                        {formatAvailabilityLabel(count, unit)}
                    </span>
                    {disabled ? <RefreshCw size={15} className="animate-spin text-slate-400" /> : null}
                </div>
            ) : null}
        </div>
    );
}

const RolloutMetric = ({ label, value }) => (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm shadow-slate-100/80">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className="mt-1 text-lg font-black leading-none text-slate-900">{value}</p>
    </div>
);

const NoticeBanner = ({ notice, onDismiss }) => {
    if (!notice) return null;
    const isSuccess = notice.type === 'success';

    return (
        <div className={`mb-6 flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 ${isSuccess ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-start gap-3">
                {isSuccess ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" /> : <Info size={18} className="mt-0.5 flex-shrink-0" />}
                <p className="text-sm font-medium">{notice.message}</p>
            </div>
            <button type="button" onClick={onDismiss} className="rounded-lg p-1 transition-colors hover:bg-black/5">
                <X size={16} />
            </button>
        </div>
    );
};

const EmptyState = ({ icon: Icon, title, description, action }) => (
    <div className="card border-dashed bg-slate-50 py-16 text-center">
        <Icon size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-lg font-medium text-slate-600">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
    </div>
);

function getBoundaryBadgeMeta(status) {
    switch (status) {
        case 'inside':
            return { label: 'Inside boundary', className: 'bg-green-50 text-green-700 border-green-200' };
        case 'outside':
            return { label: 'Outside boundary', className: 'bg-red-50 text-red-700 border-red-200' };
        case 'missing-postal':
            return { label: 'No postal code', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'no-location':
            return { label: 'No linked location', className: 'bg-amber-50 text-amber-700 border-amber-200' };
        default:
            return { label: 'No boundary set', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
}

function getAssetBoundaryStatus(asset) {
    return asset?.boundaryStatus || 'no-boundary';
}

function formatAudienceMode(mode) {
    if (mode === 'partner_boundary') return 'Partner boundary';
    if (mode === 'audience_zones') return 'Audience zones';
    return 'Public';
}

function getTemplateHostOptions(template, hardAssets, subregions) {
    const allowedHardAssets = template?.partnerId
        ? hardAssets.filter((asset) => Number(asset.partnerId) === Number(template.partnerId))
        : hardAssets;

    return allowedHardAssets.map((asset) => {
        const subregion = subregions.find((item) => Number(item.id) === Number(asset.subregionId));
        return {
            value: asset.id,
            label: `${asset.name} (${subregion?.subregionCode || subregion?.name || 'No subregion'})`,
            asset,
        };
    });
}

function filterAssetWithQuery(asset, query, boundaryChecksEnabled, boundaryFilter) {
    if (boundaryChecksEnabled && boundaryFilter !== 'all' && getAssetBoundaryStatus(asset) !== boundaryFilter) {
        return false;
    }

    if (!query) return true;

    return (
        asset.name?.toLowerCase().includes(query) ||
        asset.subCategory?.toLowerCase().includes(query) ||
        asset.postalCode?.toLowerCase().includes(query) ||
        asset.address?.toLowerCase().includes(query) ||
        asset.location?.name?.toLowerCase().includes(query) ||
        asset.hostLocation?.name?.toLowerCase().includes(query) ||
        asset.parentSummary?.name?.toLowerCase().includes(query) ||
        asset.audienceZones?.some((zone) => zone.name?.toLowerCase().includes(query) || zone.zoneCode?.toLowerCase().includes(query)) ||
        asset.locations?.some((location) => `${location?.name || ''} ${location?.postalCode || ''}`.toLowerCase().includes(query)) ||
        asset.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
}

function filterTemplateWithQuery(template, query) {
    if (!query) return true;

    return (
        template.name?.toLowerCase().includes(query) ||
        template.subCategory?.toLowerCase().includes(query) ||
        template.partnerName?.toLowerCase().includes(query) ||
        template.audienceZones?.some((zone) => zone.name?.toLowerCase().includes(query) || zone.zoneCode?.toLowerCase().includes(query)) ||
        template.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
}

function formatMembershipStatusLabel(status) {
    return String(status || 'ACTIVE')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMembershipMethodLabel(method) {
    if (method === 'QR_CODE') return 'QR link';
    return String(method || 'linked')
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ResourceModal({
    title,
    description,
    onClose,
    children,
    maxWidth = 'max-w-2xl',
    bodyClassName = 'max-h-[70vh] overflow-y-auto pr-1',
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-6">
            <div className={`card relative my-auto w-full bg-white shadow-2xl ${maxWidth}`}>
                <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
                        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className={bodyClassName}>{children}</div>
            </div>
        </div>
    );
}

export default function ResourcesPage() {
    const { user } = useAuth();
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [softAssetParents, setSoftAssetParents] = useState([]);
    const [audienceZones, setAudienceZones] = useState([]);
    const [templateDetails, setTemplateDetails] = useState({});
    const [templateLoadingIds, setTemplateLoadingIds] = useState([]);
    const [subregions, setSubregions] = useState([]);
    const [partnerOptions, setPartnerOptions] = useState([]);
    const [partnerBoundary, setPartnerBoundary] = useState(null);
    const [partnerBoundaryFeedback, setPartnerBoundaryFeedback] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('hard');
    const [assetModal, setAssetModal] = useState(null);
    const [templateModal, setTemplateModal] = useState(null);
    const [childModal, setChildModal] = useState(null);
    const [generateModal, setGenerateModal] = useState(null);
    const [membershipQrModal, setMembershipQrModal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [boundaryFilter, setBoundaryFilter] = useState('all');
    const [expandedTemplateIds, setExpandedTemplateIds] = useState([]);
    const [actionNotice, setActionNotice] = useState(null);
    const [visibilityActionKey, setVisibilityActionKey] = useState(null);
    const [availabilityActionKey, setAvailabilityActionKey] = useState(null);

    const normalizedRole = normalizeRole(user?.role);
    const isStandardUser = isStandardUserRole(user?.role);
    const boundaryChecksEnabled = normalizedRole === 'regional_admin' || normalizedRole === 'partner';
    const deferredSearchTerm = useDeferredValue(searchTerm);
    const normalizedQuery = deferredSearchTerm.trim().toLowerCase();

    useEffect(() => {
        if (!actionNotice) return undefined;
        const timer = window.setTimeout(() => setActionNotice(null), 5000);
        return () => window.clearTimeout(timer);
    }, [actionNotice]);

    async function load() {
        setLoading(true);
        try {
            const requests = [
                api.getHardAssets(),
                api.getSoftAssets(),
            ];

            if (!isStandardUser) {
                requests.push(api.getSubregions().catch(() => []));
                requests.push(api.getSoftAssetParents().catch(() => []));
                requests.push(api.getAudienceZones().catch(() => []));
            }
            if (normalizedRole === 'super_admin' || normalizedRole === 'regional_admin') {
                requests.push(api.getUsers().catch(() => []));
            }
            if (normalizedRole === 'partner') {
                requests.push(api.getPartnerBoundaries(user.id).catch(() => null));
            }

            const responses = await Promise.all(requests);
            let cursor = 0;
            const hard = responses[cursor++] || [];
            const soft = responses[cursor++] || [];
            const fetchedSubregions = !isStandardUser ? (responses[cursor++] || []) : [];
            const fetchedTemplates = !isStandardUser ? (responses[cursor++] || []) : [];
            const fetchedAudienceZones = !isStandardUser ? (responses[cursor++] || []) : [];
            const fetchedUsers = (normalizedRole === 'super_admin' || normalizedRole === 'regional_admin')
                ? (responses[cursor++] || [])
                : [];
            const fetchedPartnerBoundary = normalizedRole === 'partner'
                ? (responses[cursor++] || null)
                : null;

            if (isStandardUser) {
                const favorites = await api.getFavorites();
                const favoriteHardIds = new Set(favorites.filter((favorite) => favorite.resourceType === 'hard').map((favorite) => favorite.resourceId));
                const favoriteSoftIds = new Set(favorites.filter((favorite) => favorite.resourceType === 'soft').map((favorite) => favorite.resourceId));
                setHardAssets(hard.filter((asset) => favoriteHardIds.has(asset.id)));
                setSoftAssets(soft.filter((asset) => favoriteSoftIds.has(asset.id)));
                setSoftAssetParents([]);
                setAudienceZones([]);
            } else {
                if (normalizedRole === 'super_admin' || normalizedRole === 'regional_admin') {
                    setHardAssets(hard);
                    setSoftAssets(soft);
                } else {
                    setHardAssets(hard.filter((asset) => asset.partnerId === user.id));
                    setSoftAssets(soft.filter((asset) => asset.partnerId === user.id));
                }
                setSoftAssetParents(Array.isArray(fetchedTemplates) ? fetchedTemplates : []);
            }

            if (!isStandardUser) {
                setSubregions(Array.isArray(fetchedSubregions) ? fetchedSubregions : []);
                setAudienceZones(Array.isArray(fetchedAudienceZones) ? fetchedAudienceZones : []);
            }

            if (normalizedRole === 'super_admin' || normalizedRole === 'regional_admin') {
                const partners = Array.isArray(fetchedUsers)
                    ? fetchedUsers.filter((candidate) => normalizeRole(candidate.role) === 'partner')
                    : [];
                setPartnerOptions(partners);
            } else {
                setPartnerOptions([]);
            }

            if (normalizedRole === 'partner') {
                setPartnerBoundary(fetchedPartnerBoundary);
            }
        } catch (err) {
            console.error(err);
            setActionNotice({ type: 'warning', message: err.message || 'Failed to load assets.' });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isStandardUser) return undefined;
        load();
        return undefined;
    }, [isStandardUser]);

    useEffect(() => {
        if (isStandardUser && activeTab === 'templates') {
            setActiveTab('hard');
        }
    }, [activeTab, isStandardUser]);

    const filteredHardAssets = useMemo(
        () => hardAssets.filter((asset) => filterAssetWithQuery(asset, normalizedQuery, boundaryChecksEnabled, boundaryFilter)),
        [boundaryChecksEnabled, boundaryFilter, hardAssets, normalizedQuery]
    );

    const filteredSoftAssets = useMemo(
        () => softAssets.filter((asset) => filterAssetWithQuery(asset, normalizedQuery, boundaryChecksEnabled, boundaryFilter)),
        [boundaryChecksEnabled, boundaryFilter, normalizedQuery, softAssets]
    );

    const filteredTemplates = useMemo(
        () => softAssetParents.filter((template) => filterTemplateWithQuery(template, normalizedQuery)),
        [normalizedQuery, softAssetParents]
    );

    async function refreshTemplateDetail(templateId) {
        if (!templateId) return null;
        const detail = await api.getSoftAssetParent(templateId);
        setTemplateDetails((prev) => ({ ...prev, [templateId]: detail }));
        return detail;
    }

    async function ensureTemplateDetail(templateId) {
        if (templateDetails[templateId]) return templateDetails[templateId];

        setTemplateLoadingIds((prev) => [...new Set([...prev, templateId])]);
        try {
            return await refreshTemplateDetail(templateId);
        } finally {
            setTemplateLoadingIds((prev) => prev.filter((id) => id !== templateId));
        }
    }

    async function toggleTemplateExpanded(templateId) {
        const isExpanded = expandedTemplateIds.includes(templateId);
        if (isExpanded) {
            setExpandedTemplateIds((prev) => prev.filter((id) => id !== templateId));
            return;
        }

        setExpandedTemplateIds((prev) => [...prev, templateId]);
        try {
            await ensureTemplateDetail(templateId);
        } catch (err) {
            setActionNotice({ type: 'warning', message: err.message || 'Failed to load template rollouts.' });
        }
    }

    function openCreate(assetType) {
        setAssetModal({ mode: 'create', assetType, data: null });
    }

    function openEdit(asset, assetType) {
        if (assetType === 'soft' && asset.assetMode === 'child') {
            openChildEditor(asset.id);
            return;
        }
        setAssetModal({ mode: 'edit', assetType, data: asset });
    }

    function openTemplateCreate() {
        setTemplateModal({ mode: 'create', data: null });
    }

    function openTemplateEdit(template) {
        setTemplateModal({ mode: 'edit', data: template });
    }

    async function openGenerateTemplate(template) {
        setGenerateModal({ template, selectedHostIds: [], loading: true, submitting: false });
        try {
            await ensureTemplateDetail(template.id);
        } catch (err) {
            setActionNotice({ type: 'warning', message: err.message || 'Failed to load rollout data.' });
        } finally {
            setGenerateModal((prev) => prev ? { ...prev, loading: false } : null);
        }
    }

    async function openMembershipQr(asset) {
        setMembershipQrModal({ asset, loading: true, data: null, copied: false });
        try {
            const data = await api.generateHardAssetMembershipQr(asset.id);
            setMembershipQrModal({ asset, loading: false, data, copied: false });
        } catch (err) {
            setMembershipQrModal(null);
            setActionNotice({ type: 'warning', message: err.message || 'Failed to generate membership QR.' });
        }
    }

    async function openChildEditor(childId) {
        setChildModal({ childId, loading: true, data: null });
        try {
            const data = await api.getSoftAsset(childId);
            setChildModal({ childId, loading: false, data });
        } catch (err) {
            setChildModal(null);
            setActionNotice({ type: 'warning', message: err.message || 'Failed to load child asset.' });
        }
    }

    async function handleDelete(target) {
        try {
            if (target.assetType === 'hard') {
                await api.deleteHardAsset(target.id);
            } else if (target.assetType === 'template') {
                await api.deleteSoftAssetParent(target.id);
                setTemplateDetails((prev) => {
                    const next = { ...prev };
                    delete next[target.id];
                    return next;
                });
                setExpandedTemplateIds((prev) => prev.filter((id) => id !== target.id));
            } else {
                await api.deleteSoftAsset(target.id);
                if (target.parentId) {
                    await refreshTemplateDetail(target.parentId).catch(() => null);
                }
            }

            setDeleteTarget(null);
            await load();
            setActionNotice({ type: 'success', message: `${target.label} deleted.` });
        } catch (err) {
            setActionNotice({ type: 'warning', message: err.message || `Failed to delete ${target.label.toLowerCase()}.` });
        }
    }

    function getVisibilityActionKey(assetType, assetId) {
        return `${assetType}-${assetId}`;
    }

    function getAvailabilityActionKey(assetId) {
        return `availability-${assetId}`;
    }

    function replaceSoftAsset(updatedAsset) {
        setSoftAssets((prev) => prev.map((asset) => (asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset)));
    }

    function buildHardVisibilityPayload(asset, nextHidden) {
        return {
            name: asset.name,
            country: asset.country,
            postalCode: asset.postalCode,
            address: asset.address,
            subCategory: asset.subCategory,
            phone: asset.phone,
            hours: asset.hours,
            description: asset.description,
            logoUrl: asset.logoUrl,
            bannerUrl: asset.bannerUrl,
            galleryUrls: asset.galleryUrls,
            isHidden: nextHidden,
            hideFrom: nextHidden ? asset.hideFrom : null,
            hideUntil: nextHidden ? asset.hideUntil : null,
        };
    }

    function buildSoftVisibilityPayload(asset, nextHidden) {
        return {
            isHidden: nextHidden,
            hideFrom: nextHidden ? asset.hideFrom : null,
            hideUntil: nextHidden ? asset.hideUntil : null,
        };
    }

    async function handleToggleVisibility(asset, assetType) {
        const hiddenStatus = getHiddenStatus(asset);
        const nextHidden = !hiddenStatus.hidden;
        const actionKey = getVisibilityActionKey(assetType, asset.id);

        setVisibilityActionKey(actionKey);
        try {
            if (assetType === 'hard') {
                await api.updateHardAsset(asset.id, buildHardVisibilityPayload(asset, nextHidden));
            } else {
                await api.updateSoftAsset(asset.id, buildSoftVisibilityPayload(asset, nextHidden));
            }

            await load();
            setActionNotice({
                type: 'success',
                message: `${assetType === 'hard' ? 'Place' : 'Offering'} ${nextHidden ? 'hidden from the app.' : 'is live in the app again.'}`,
            });
        } catch (err) {
            setActionNotice({
                type: 'warning',
                message: err.message || `Failed to update ${assetType === 'hard' ? 'place' : 'offering'} visibility.`,
            });
        } finally {
            setVisibilityActionKey(null);
        }
    }

    async function handleAvailabilityUpdate(asset, patch) {
        const actionKey = getAvailabilityActionKey(asset.id);
        const previousAsset = asset;
        const optimisticAsset = {
            ...asset,
            ...(patch.availabilityEnabled !== undefined ? { availabilityEnabled: Boolean(patch.availabilityEnabled) } : {}),
            ...(patch.availabilityCount !== undefined ? { availabilityCount: normalizeAvailabilityCount(patch.availabilityCount) } : {}),
            ...(patch.availabilityUnit !== undefined ? { availabilityUnit: normalizeAvailabilityUnit(patch.availabilityUnit) } : {}),
        };

        replaceSoftAsset(optimisticAsset);
        setAvailabilityActionKey(actionKey);

        try {
            const updatedAsset = await api.updateSoftAssetAvailability(asset.id, patch);
            replaceSoftAsset(updatedAsset);
        } catch (err) {
            replaceSoftAsset(previousAsset);
            setActionNotice({
                type: 'warning',
                message: err.message || 'Failed to update offering availability.',
            });
        } finally {
            setAvailabilityActionKey(null);
        }
    }

    async function handleUnfavorite(type, id) {
        try {
            await api.toggleFavorite(type, id);
            await load();
        } catch (err) {
            console.error(err);
        }
    }

    function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8') {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 1000);
    }

    function handleDownloadPartnerBoundaryTemplate() {
        const csv = Papa.unparse({
            fields: ['postalCode'],
            data: [['680153'], ['680574'], ['681809']],
        });
        downloadFile(`\uFEFF${csv}`, 'partner_boundary_upload_template.csv');
    }

    function handleExportPartnerBoundary() {
        if (!partnerBoundary) return;
        const csv = Papa.unparse({
            fields: ['partnerUsername', 'postalCode'],
            data: (partnerBoundary.postalCodes || []).map((postalCode) => [partnerBoundary.partnerUsername, postalCode]),
        });
        downloadFile(`\uFEFF${csv}`, `${partnerBoundary.partnerUsername || 'partner'}_boundary_export.csv`);
    }

    function handlePartnerBoundaryUpload(e) {
        const file = e.target.files?.[0];
        if (!file || normalizedRole !== 'partner') return;

        setLoading(true);
        setPartnerBoundaryFeedback('');
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = Array.isArray(results.data) ? results.data : [];
                    const response = await api.bulkUploadPartnerBoundaries(user.id, { rows });
                    setPartnerBoundaryFeedback(`Boundary updated: ${response.assignedPostalCodes || 0} postal code(s) assigned.`);
                    await load();
                } catch (err) {
                    setPartnerBoundaryFeedback(err.message || 'Failed to update partner boundary.');
                } finally {
                    setLoading(false);
                    e.target.value = null;
                }
            },
            error: (err) => {
                setPartnerBoundaryFeedback(`File parsing error: ${err.message}`);
                setLoading(false);
            },
        });
    }

    async function handleGenerateChildren() {
        if (!generateModal?.template?.id) return;

        setGenerateModal((prev) => prev ? { ...prev, submitting: true } : null);
        try {
            const response = await api.generateSoftAssetChildren(generateModal.template.id, {
                hostIds: generateModal.selectedHostIds,
            });
            await Promise.all([
                load(),
                refreshTemplateDetail(generateModal.template.id).catch(() => null),
            ]);
            setGenerateModal(null);
            setExpandedTemplateIds((prev) => [...new Set([...prev, response.parentId])]);
            setActionNotice({
                type: 'success',
                message: `Generated ${response.createdCount} child asset(s). ${response.skippedCount ? `${response.skippedCount} host(s) already had a rollout.` : ''}`.trim(),
            });
        } catch (err) {
            setActionNotice({ type: 'warning', message: err.message || 'Failed to generate child assets.' });
            setGenerateModal((prev) => prev ? { ...prev, submitting: false } : null);
        }
    }

    async function handleChildSave(payload) {
        if (!childModal?.childId || !childModal?.data) return;

        await api.updateSoftAsset(childModal.childId, payload);
        await Promise.all([
            load(),
            childModal.data.parentSummary?.id ? refreshTemplateDetail(childModal.data.parentSummary.id).catch(() => null) : Promise.resolve(),
        ]);
        setChildModal(null);
        setActionNotice({ type: 'success', message: 'Child asset updated.' });
    }

    async function handleChildResetOverrides(fields) {
        if (!childModal?.childId) return null;

        await api.resetSoftAssetOverrides(childModal.childId, { fields });
        const refreshed = await api.getSoftAsset(childModal.childId);
        setChildModal({ childId: childModal.childId, loading: false, data: refreshed });
        await Promise.all([
            load(),
            refreshed.parentSummary?.id ? refreshTemplateDetail(refreshed.parentSummary.id).catch(() => null) : Promise.resolve(),
        ]);
        setActionNotice({ type: 'success', message: 'Child override reset.' });
        return refreshed;
    }

    const searchPlaceholder = activeTab === 'templates'
        ? 'Search templates by name, category, owner, or tag...'
        : 'Search assets by name, category, postal code, or tag...';

    const generateHostOptions = useMemo(() => {
        if (!generateModal?.template) return [];
        return getTemplateHostOptions(generateModal.template, hardAssets, subregions);
    }, [generateModal, hardAssets, subregions]);

    const generateSelectedOptions = useMemo(() => {
        if (!generateModal) return [];
        return generateHostOptions.filter((option) => generateModal.selectedHostIds.includes(option.value));
    }, [generateHostOptions, generateModal]);

    const generateHostSelectStyles = useMemo(() => ({
        menuPortal: (base) => ({
            ...base,
            zIndex: 80,
        }),
        menu: (base) => ({
            ...base,
            zIndex: 70,
        }),
        menuList: (base) => ({
            ...base,
            maxHeight: 460,
            paddingTop: 6,
            paddingBottom: 6,
        }),
        option: (base) => ({
            ...base,
            whiteSpace: 'normal',
            lineHeight: 1.35,
            paddingTop: 12,
            paddingBottom: 12,
        }),
        multiValue: (base) => ({
            ...base,
            maxWidth: '100%',
        }),
        multiValueLabel: (base) => ({
            ...base,
            whiteSpace: 'normal',
            overflow: 'visible',
            textOverflow: 'unset',
            lineHeight: 1.25,
        }),
    }), []);

    const existingGenerateChildren = generateModal?.template?.id
        ? (templateDetails[generateModal.template.id]?.children || [])
        : [];
    const existingHostIds = new Set(existingGenerateChildren.map((child) => child.hostHardAssetId));

    if (isStandardUser) {
        return <Navigate to="/my-directory" replace />;
    }

    return (
        <div className="mx-auto max-w-6xl p-6 lg:p-8">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-8">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                        {isStandardUser ? 'Saved' : 'My'} <span className="text-brand-600">Assets</span>
                    </h1>
                    <p className="mt-3 max-w-2xl text-lg font-medium text-slate-500">
                        {isStandardUser
                            ? 'Your curated collection of medical resources and care facilities.'
                            : "Comprehensive management of your organization's care infrastructure."}
                    </p>
                </div>
                {!isStandardUser && (
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => openCreate('hard')}
                            className="flex h-12 items-center gap-2 rounded-2xl bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-brand-200 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-300 active:scale-[0.98]"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            New Place
                        </button>
                        <button
                            onClick={() => openCreate('soft')}
                            className="flex h-12 items-center gap-2 rounded-2xl bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-brand-200 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-300 active:scale-[0.98]"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            New Offering
                        </button>
                        <button
                            onClick={openTemplateCreate}
                            className="flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-black hover:shadow-xl hover:shadow-slate-300 active:scale-[0.98]"
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            New Template
                        </button>
                    </div>
                )}
            </div>

            <NoticeBanner notice={actionNotice} onDismiss={() => setActionNotice(null)} />

            {normalizedRole === 'partner' ? (
                <div className="card mb-6 border border-slate-200">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Partner Boundary</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Upload the exact postcode set used to target partner-boundary offerings to your managed members.
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                                Current boundary: <span className="font-semibold text-slate-700">{partnerBoundary?.postalCodeCount || 0}</span> postcode(s)
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <label className="btn-secondary flex cursor-pointer items-center justify-center gap-2">
                                <input type="file" accept=".csv" className="hidden" onChange={handlePartnerBoundaryUpload} />
                                <Upload size={16} /> Upload Boundary CSV
                            </label>
                            <button type="button" onClick={handleDownloadPartnerBoundaryTemplate} className="btn-ghost flex items-center justify-center gap-2">
                                <Download size={16} /> Template
                            </button>
                            <button type="button" onClick={handleExportPartnerBoundary} className="btn-ghost flex items-center justify-center gap-2" disabled={!partnerBoundary}>
                                <Download size={16} /> Export
                            </button>
                        </div>
                    </div>
                    {partnerBoundary?.postalCodes?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {partnerBoundary.postalCodes.slice(0, 20).map((postalCode) => (
                                <span key={postalCode} className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                    {postalCode}
                                </span>
                            ))}
                            {partnerBoundary.postalCodes.length > 20 ? (
                                <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                                    +{partnerBoundary.postalCodes.length - 20} more
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                    {partnerBoundaryFeedback ? (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {partnerBoundaryFeedback}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="relative mb-6">
                <div className="flex flex-col gap-3 lg:flex-row">
                    <div className="relative max-w-md flex-1">
                        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>
                    {boundaryChecksEnabled && activeTab !== 'templates' ? (
                        <select
                            value={boundaryFilter}
                            onChange={(e) => setBoundaryFilter(e.target.value)}
                            className="input-field lg:w-48"
                        >
                            <option value="all">All boundary status</option>
                            <option value="inside">Inside boundary</option>
                            <option value="outside">Outside boundary</option>
                            <option value="missing-postal">Missing postal code</option>
                            <option value="no-location">No linked location</option>
                            <option value="no-boundary">No boundary set</option>
                        </select>
                    ) : null}
                </div>
            </div>

            {boundaryChecksEnabled && activeTab !== 'templates' ? (
                <p className="mb-6 text-xs text-slate-500">
                    Boundary checks use the exact postal code set assigned to your scoped subregion(s).
                </p>
            ) : null}

            <div className="mb-8 flex w-full overflow-x-auto pb-1 scrollbar-hide">
                <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 shadow-inner whitespace-nowrap">
                    <button
                        onClick={() => setActiveTab('hard')}
                        className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                            activeTab === 'hard'
                                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Building2 size={18} strokeWidth={activeTab === 'hard' ? 2.5 : 2} />
                        Places ({filteredHardAssets.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('soft')}
                        className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                            activeTab === 'soft'
                                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <CalendarDays size={18} strokeWidth={activeTab === 'soft' ? 2.5 : 2} />
                        Offerings ({filteredSoftAssets.length})
                    </button>
                    {!isStandardUser ? (
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-200 ${
                                activeTab === 'templates'
                                    ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Files size={18} strokeWidth={activeTab === 'templates' ? 2.5 : 2} />
                            Templates ({filteredTemplates.length})
                        </button>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, index) => <div key={index} className="card h-24 animate-pulse bg-slate-100" />)}
                </div>
            ) : activeTab === 'hard' ? (
                filteredHardAssets.length === 0 ? (
                    <EmptyState
                        icon={Building2}
                        title="No places found"
                        description="Try adjusting your search criteria."
                        action={!isStandardUser && !searchTerm ? (
                            <button onClick={() => openCreate('hard')} className="btn-primary mx-auto border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                                <Plus size={16} /> Add Place
                            </button>
                        ) : null}
                    />
                ) : isStandardUser ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredHardAssets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                type="hard"
                                isFavorite
                                isLoggedIn
                                onToggleFavorite={(id, type) => handleUnfavorite(type, id)}
                                onTagClick={setSearchTerm}
                                onCategoryClick={setSearchTerm}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHardAssets.map((asset) => {
                            const hiddenStatus = getHiddenStatus(asset);
                            const canShowMembers = typeof asset.membershipCount === 'number';

                            return (
                                <div key={asset.id} className="card flex flex-col gap-4">
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <div className="flex min-w-0 flex-1 gap-4">
                                            {asset.logoUrl ? (
                                                <img src={asset.logoUrl} alt="Logo" className="h-16 w-16 flex-shrink-0 rounded-lg border border-slate-200 bg-slate-100 object-cover" />
                                            ) : (
                                                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                                    <Building2 size={24} />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-lg font-bold text-slate-900">{asset.name}</p>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                                            {asset.address ? <span className="flex items-center gap-1 truncate"><MapPin size={14} />{asset.address}</span> : null}
                                                            {(normalizedRole === 'super_admin' || normalizedRole === 'regional_admin') ? (
                                                                <span className="text-xs text-slate-400">{asset.partnerName ? `Owner: ${asset.partnerName}` : 'Owner: System'}</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    {canShowMembers ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
                                                            <Users size={13} />
                                                            {asset.membershipCount} linked
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {(asset.subCategory || asset.tags?.length > 0 || hiddenStatus.hidden) ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        <HiddenBadge status={hiddenStatus} />
                                                        {boundaryChecksEnabled ? (
                                                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getBoundaryBadgeMeta(getAssetBoundaryStatus(asset)).className}`}>
                                                                {getBoundaryBadgeMeta(getAssetBoundaryStatus(asset)).label}
                                                            </span>
                                                        ) : null}
                                                        {asset.subCategory ? <CategoryBadge category={asset.subCategory} onClick={() => setSearchTerm(asset.subCategory)} /> : null}
                                                        {asset.tags?.map((tag) => <TagBadge key={tag} tag={tag} onClick={() => setSearchTerm(tag)} />)}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                            <button
                                                onClick={() => handleToggleVisibility(asset, 'hard')}
                                                disabled={visibilityActionKey === getVisibilityActionKey('hard', asset.id)}
                                                className="btn-ghost px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <span className="flex items-center gap-2">
                                                    {visibilityActionKey === getVisibilityActionKey('hard', asset.id) ? (
                                                        <RefreshCw size={15} className="animate-spin" />
                                                    ) : hiddenStatus.hidden ? (
                                                        <Eye size={15} />
                                                    ) : (
                                                        <EyeOff size={15} />
                                                    )}
                                                    {hiddenStatus.hidden ? 'Show in app' : 'Hide from app'}
                                                </span>
                                            </button>
                                            <button onClick={() => openEdit(asset, 'hard')} className="btn-ghost px-3 py-2 text-sm">
                                                <Pencil size={15} /> Edit
                                            </button>
                                            <button onClick={() => openMembershipQr(asset)} className="btn-ghost px-3 py-2 text-sm">
                                                <Building2 size={15} /> Generate Membership QR
                                            </button>
                                            <button onClick={() => setDeleteTarget({ id: asset.id, assetType: 'hard', label: 'Place' })} className="btn-danger px-3 py-2 text-sm">
                                                <Trash2 size={15} /> Delete
                                            </button>
                                        </div>
                                    </div>

                                    {canShowMembers ? (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Members</p>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Linked members who joined this place through the membership flow.
                                                    </p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                    <Users size={13} />
                                                    {asset.membershipCount} total
                                                </span>
                                            </div>

                                            {asset.memberPreview?.length ? (
                                                <div className="mt-4 space-y-2">
                                                    {asset.memberPreview.map((membership) => (
                                                        <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                                    {membership.user?.name || membership.user?.username || 'Unknown member'}
                                                                </p>
                                                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                                                    {membership.user?.username ? `@${membership.user.username}` : membership.user?.email || 'No username'}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-700">
                                                                    {formatMembershipStatusLabel(membership.status)}
                                                                </span>
                                                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                                    {formatMembershipMethodLabel(membership.joinMethod)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {asset.hasMoreMembers ? (
                                                        <p className="px-1 text-xs text-slate-500">
                                                            And {asset.membershipCount - asset.memberPreview.length} more linked member{asset.membershipCount - asset.memberPreview.length === 1 ? '' : 's'}.
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                                                    No linked members yet. When someone scans this place&apos;s membership QR, they&apos;ll appear here.
                                                </p>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : activeTab === 'soft' ? (
                filteredSoftAssets.length === 0 ? (
                    <EmptyState
                        icon={CalendarDays}
                        title="No offerings found"
                        description="Try adjusting your search criteria."
                        action={!isStandardUser && !searchTerm ? (
                            <button onClick={() => openCreate('soft')} className="btn-primary mx-auto">
                                <Plus size={16} /> Add Offering
                            </button>
                        ) : null}
                    />
                ) : isStandardUser ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredSoftAssets.map((asset) => (
                            <AssetCard
                                key={asset.id}
                                asset={asset}
                                type="soft"
                                isFavorite
                                isLoggedIn
                                onToggleFavorite={(id, type) => handleUnfavorite(type, id)}
                                onTagClick={setSearchTerm}
                                onCategoryClick={setSearchTerm}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {filteredSoftAssets.map((asset) => {
                            const hiddenStatus = getHiddenStatus(asset);
                            const isChild = asset.assetMode === 'child';
                            const isVisibilitySaving = visibilityActionKey === getVisibilityActionKey('soft', asset.id);
                            const isAvailabilitySaving = availabilityActionKey === getAvailabilityActionKey(asset.id);
                            return (
                                <div key={asset.id} className="card flex flex-col items-start gap-4 p-5">
                                    <div className="flex w-full items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            {asset.logoUrl ? (
                                                <img src={asset.logoUrl} alt="Logo" className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100 object-cover" />
                                            ) : (
                                                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${isChild ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {isChild ? <Files size={20} /> : <CalendarDays size={20} />}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-base font-bold leading-tight text-slate-900">{asset.name}</p>
                                                {asset.location ? (
                                                    <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500">
                                                        <MapPin size={12} /> {asset.location.name}
                                                    </p>
                                                ) : (
                                                    <p className="mt-0.5 text-sm italic text-slate-400">No specific location</p>
                                                )}
                                                {isChild && asset.parentSummary ? (
                                                    <p className="mt-1 text-xs font-medium text-brand-700">Generated from: {asset.parentSummary.name}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    {(asset.subCategory || asset.tags?.length > 0 || hiddenStatus.hidden || asset.isMemberOnly || isChild) ? (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <HiddenBadge status={hiddenStatus} />
                                            {boundaryChecksEnabled ? (
                                                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getBoundaryBadgeMeta(getAssetBoundaryStatus(asset)).className}`}>
                                                    {getBoundaryBadgeMeta(getAssetBoundaryStatus(asset)).label}
                                                </span>
                                            ) : null}
                                            {isChild ? <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">Child rollout</span> : null}
                                            {asset.audienceMode === 'partner_boundary' ? <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">Partner boundary</span> : null}
                                            {asset.audienceMode === 'audience_zones' ? <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">Audience zones</span> : null}
                                            {asset.isMemberOnly ? <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Member-only</span> : null}
                                            {asset.subCategory ? <CategoryBadge category={asset.subCategory} onClick={() => setSearchTerm(asset.subCategory)} /> : null}
                                            {asset.tags?.map((tag) => <TagBadge key={tag} tag={tag} onClick={() => setSearchTerm(tag)} />)}
                                        </div>
                                    ) : null}

                                    {isChild ? (
                                        <div className="grid w-full grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                            <div className="flex items-start gap-2">
                                                <Lock size={14} className="mt-0.5 text-slate-400" />
                                                <div>
                                                    <p className="font-semibold text-slate-700">Template-managed</p>
                                                    <p className="text-xs text-slate-500">Name, category, description, media, audience, and membership inherit from the parent template.</p>
                                                </div>
                                            </div>
                                            {asset.contactPhone || asset.contactEmail ? (
                                                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                                                    {asset.contactPhone ? <span className="inline-flex items-center gap-1"><Phone size={12} /> {asset.contactPhone}</span> : null}
                                                    {asset.contactEmail ? <span>{asset.contactEmail}</span> : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    <AvailabilityCounterControl
                                        asset={asset}
                                        disabled={isAvailabilitySaving}
                                        onToggle={(availabilityEnabled) => handleAvailabilityUpdate(asset, { availabilityEnabled })}
                                        onAdjust={(availabilityCount) => handleAvailabilityUpdate(asset, { availabilityCount })}
                                    />

                                    <div className="mt-auto flex w-full items-center gap-2 border-t border-slate-100 pt-4">
                                        <button
                                            onClick={() => handleToggleVisibility(asset, 'soft')}
                                            disabled={isVisibilitySaving}
                                            className="btn-ghost flex-1 justify-center py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {isVisibilitySaving ? (
                                                <RefreshCw size={15} className="animate-spin" />
                                            ) : hiddenStatus.hidden ? (
                                                <Eye size={15} />
                                            ) : (
                                                <EyeOff size={15} />
                                            )}
                                            {hiddenStatus.hidden ? 'Show in app' : 'Hide from app'}
                                        </button>
                                        <button onClick={() => openEdit(asset, 'soft')} className="btn-ghost flex-1 justify-center py-2 text-sm">
                                            <Pencil size={15} /> {isChild ? 'Edit Child Asset' : 'Edit'}
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget({ id: asset.id, assetType: 'soft', label: isChild ? 'Child asset' : 'Offering', parentId: asset.parentSummary?.id || null })}
                                            className="btn-ghost flex-1 justify-center py-2 text-sm text-red-600 hover:border-red-100 hover:bg-red-50"
                                        >
                                            <Trash2 size={15} /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                filteredTemplates.length === 0 ? (
                    <EmptyState
                        icon={Files}
                        title="No templates found"
                        description="Create a parent template to generate host-specific child assets."
                        action={!searchTerm ? (
                            <button onClick={openTemplateCreate} className="btn-primary mx-auto">
                                <Plus size={16} /> Create Template
                            </button>
                        ) : null}
                    />
                ) : (
                    <div className="space-y-4">
                        {filteredTemplates.map((template) => {
                            const isExpanded = expandedTemplateIds.includes(template.id);
                            const detail = templateDetails[template.id];
                            const isTemplateLoading = templateLoadingIds.includes(template.id);

                            return (
                                <div key={template.id} className="card overflow-hidden border border-slate-200/80 p-0 shadow-sm shadow-slate-100/80">
                                    <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50/90 via-white to-slate-50 px-5 py-5">
                                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">
                                                        <Files size={12} />
                                                        Template
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                                    {formatAudienceMode(template.audienceMode)}
                                                </span>
                                                {template.audienceMode === 'audience_zones' ? (
                                                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                                        {template.audienceZoneIds?.length || 0} zone{(template.audienceZoneIds?.length || 0) === 1 ? '' : 's'}
                                                    </span>
                                                ) : null}
                                                {template.isMemberOnly ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Member-only</span> : null}
                                                    {template.partnerName ? <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Owner: {template.partnerName}</span> : null}
                                                </div>

                                                <div className="mt-3 flex items-start gap-3">
                                                    {template.logoUrl ? (
                                                        <img src={template.logoUrl} alt="Template logo" className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-cover" />
                                                    ) : (
                                                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-brand-200 bg-white text-brand-700">
                                                            <Files size={22} />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-col gap-2">
                                                            <div>
                                                                <h2 className="text-[1.45rem] font-black leading-tight text-slate-900">{template.name}</h2>
                                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                                                    <span>{template.subCategory}</span>
                                                                    {template.partnerName ? <span>Owner: {template.partnerName}</span> : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {template.description ? (
                                                            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{template.description}</p>
                                                        ) : null}

                                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                                            {template.schedule ? (
                                                                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                                    <Clock size={10} />
                                                                    {template.schedule}
                                                                </span>
                                                            ) : null}
                                                            {template.audienceZones?.map((zone) => (
                                                                <span key={zone.id} className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                                                                    {zone.zoneCode || zone.name}
                                                                </span>
                                                            ))}
                                                            {template.tags?.map((tag) => (
                                                                <TagBadge key={tag} tag={tag} onClick={() => setSearchTerm(tag)} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-3xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-slate-200/70 backdrop-blur">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <RolloutMetric label="Child assets" value={template.childCount} />
                                                    <RolloutMetric label="Live" value={template.liveChildCount} />
                                                    <RolloutMetric label="Hidden" value={template.hiddenChildCount} />
                                                    <RolloutMetric label="Overrides" value={template.overriddenChildCount} />
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                                    <button type="button" onClick={() => openGenerateTemplate(template)} className="btn-primary whitespace-nowrap justify-center">
                                                        <Plus size={16} /> Generate Child Assets
                                                    </button>
                                                    <button type="button" onClick={() => openTemplateEdit(template)} className="btn-ghost whitespace-nowrap justify-center">
                                                        <Pencil size={15} /> Edit Template
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleTemplateExpanded(template.id)}
                                                        className="btn-ghost whitespace-nowrap justify-center"
                                                    >
                                                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                        {isExpanded ? 'Hide Child Assets' : 'Manage Child Assets'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget({ id: template.id, assetType: 'template', label: 'Template' })}
                                                        className="btn-ghost whitespace-nowrap justify-center text-red-600 hover:border-red-100 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={15} /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded ? (
                                        <div className="bg-slate-50/70 px-5 py-5">
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Child Assets</h3>
                                                    <p className="mt-1 text-sm text-slate-500">Each child asset is tied to exactly one host and starts hidden until locally prepared.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => refreshTemplateDetail(template.id)}
                                                    className="btn-ghost whitespace-nowrap text-sm"
                                                    disabled={isTemplateLoading}
                                                >
                                                    <RefreshCw size={14} className={isTemplateLoading ? 'animate-spin' : ''} />
                                                    Refresh
                                                </button>
                                            </div>

                                            {isTemplateLoading && !detail ? (
                                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                                                    Loading rollout details...
                                                </div>
                                            ) : detail?.children?.length ? (
                                                <div className="space-y-3">
                                                    {detail.children.map((child) => {
                                                        const subregion = subregions.find((item) => Number(item.id) === Number(child.subregionId));
                                                        const hiddenStatus = getHiddenStatus(child);

                                                        return (
                                                            <div key={child.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex flex-wrap items-center gap-2">
                                                                            <VisibilityBadge hidden={hiddenStatus.hidden} />
                                                                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                                                {child.overriddenFields?.length || 0} local override{child.overriddenFields?.length === 1 ? '' : 's'}
                                                                            </span>
                                                                            {subregion ? (
                                                                                <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                                                    {subregion.subregionCode || subregion.name}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="mt-3">
                                                                            <p className="text-base font-semibold text-slate-900">{child.hostLocation?.name || 'Unknown host'}</p>
                                                                            {child.hostLocation?.address ? <p className="mt-1 text-sm text-slate-500">{child.hostLocation.address}</p> : null}
                                                                            {child.overriddenFields?.length ? (
                                                                                <p className="mt-2 text-xs text-slate-500">Local fields: {child.overriddenFields.join(', ')}</p>
                                                                            ) : (
                                                                                <p className="mt-2 text-xs text-slate-500">No local overrides yet. This rollout is still fully controlled by the parent template.</p>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <button type="button" onClick={() => openChildEditor(child.id)} className="btn-primary whitespace-nowrap">
                                                                            <Pencil size={15} /> Edit Rollout
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteTarget({ id: child.id, assetType: 'soft', label: 'Child asset', parentId: template.id })}
                                                                            className="btn-ghost whitespace-nowrap text-red-600 hover:border-red-100 hover:bg-red-50"
                                                                        >
                                                                            <Trash2 size={15} /> Delete
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                                                    <p className="text-base font-semibold text-slate-700">No child assets yet</p>
                                                    <p className="mt-1 text-sm text-slate-500">Generate hidden child assets for selected hosts to start local rollout management.</p>
                                                    <button type="button" onClick={() => openGenerateTemplate(template)} className="btn-primary mx-auto mt-4">
                                                        <Plus size={16} /> Generate First Child Asset
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {assetModal ? (
                <ResourceModal
                    title={`${assetModal.mode === 'create' ? 'Create' : 'Edit'} ${assetModal.assetType === 'hard' ? 'Place' : 'Offering'}`}
                    description={assetModal.assetType === 'hard' ? 'Add a physical address and contact info.' : 'Add schedule, description, and link to a location.'}
                    onClose={() => setAssetModal(null)}
                >
                    <AssetForm
                        type={assetModal.assetType}
                        initialData={assetModal.data}
                        partnerHardAssets={hardAssets}
                        currentUser={user}
                        partnerOptions={partnerOptions}
                        subregions={subregions}
                        audienceZones={audienceZones}
                        onSave={async () => {
                            setAssetModal(null);
                            await load();
                            setActionNotice({ type: 'success', message: `${assetModal.assetType === 'hard' ? 'Place' : 'Offering'} saved.` });
                        }}
                        onCancel={() => setAssetModal(null)}
                    />
                </ResourceModal>
            ) : null}

            {templateModal ? (
                <ResourceModal
                    title={`${templateModal.mode === 'create' ? 'Create' : 'Edit'} Template`}
                    description="Save canonical content once, then generate hidden host-specific child assets."
                    onClose={() => setTemplateModal(null)}
                >
                    <SoftAssetTemplateForm
                        initialData={templateModal.data}
                        currentUser={user}
                        partnerOptions={partnerOptions}
                        audienceZones={audienceZones}
                        onSave={async () => {
                            const templateId = templateModal.data?.id || null;
                            setTemplateModal(null);
                            await load();
                            if (templateId) {
                                await refreshTemplateDetail(templateId).catch(() => null);
                            }
                            setActionNotice({ type: 'success', message: `Template ${templateModal.mode === 'create' ? 'created' : 'updated'}.` });
                        }}
                        onCancel={() => setTemplateModal(null)}
                    />
                </ResourceModal>
            ) : null}

            {generateModal ? (
                <ResourceModal
                    title="Generate Child Assets"
                    description="Select the hosts that should receive a hidden local rollout from this template."
                    onClose={() => setGenerateModal(null)}
                    maxWidth="max-w-[min(96vw,1100px)]"
                    bodyClassName="max-h-[82vh] overflow-y-auto pr-1"
                >
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Template</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{generateModal.template.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{generateModal.template.childCount} existing child asset(s)</p>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Eligible Hosts</label>
                            <Select
                                isMulti
                                isDisabled={generateModal.loading || generateModal.submitting}
                                options={generateHostOptions}
                                value={generateSelectedOptions}
                                onChange={(selected) => setGenerateModal((prev) => prev ? { ...prev, selectedHostIds: Array.isArray(selected) ? selected.map((item) => item.value) : [] } : null)}
                                styles={generateHostSelectStyles}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                menuPosition="fixed"
                                menuPlacement="auto"
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder={generateModal.loading ? 'Loading hosts...' : 'Select one or more hosts...'}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Child assets are created hidden by default. Existing parent-host pairs are skipped automatically.
                            </p>
                        </div>

                        {generateSelectedOptions.length ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Generation Preview</h3>
                                    <span className="text-xs text-slate-500">{generateSelectedOptions.length} selected</span>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {generateSelectedOptions.map((option) => {
                                        const host = option.asset;
                                        const subregion = subregions.find((item) => Number(item.id) === Number(host.subregionId));
                                        const alreadyExists = existingHostIds.has(host.id);
                                        return (
                                            <div key={host.id} className={`rounded-2xl border p-4 ${alreadyExists ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{host.name}</p>
                                                        <p className="mt-1 text-sm text-slate-500">{host.address}</p>
                                                    </div>
                                                    {alreadyExists ? (
                                                        <span className="inline-flex rounded-md border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                                            Already exists
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                                                            New hidden child asset
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                                    {subregion ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                                            <MapPin size={12} />
                                                            {subregion.subregionCode || subregion.name}
                                                        </span>
                                                    ) : null}
                                                    {host.phone ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                                                            <Phone size={12} />
                                                            {host.phone}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setGenerateModal(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                            <button
                                type="button"
                                onClick={handleGenerateChildren}
                                disabled={generateModal.submitting || generateModal.loading || generateModal.selectedHostIds.length === 0}
                                className="btn-primary flex-1 justify-center disabled:opacity-50"
                            >
                                {generateModal.submitting ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                Generate Child Assets
                            </button>
                        </div>
                    </div>
                </ResourceModal>
            ) : null}

            {membershipQrModal ? (
                <ResourceModal
                    title="Generate Membership QR"
                    description="Users can scan this QR code to link themselves to this place as an active member."
                    onClose={() => setMembershipQrModal(null)}
                    maxWidth="max-w-xl"
                >
                    {membershipQrModal.loading || !membershipQrModal.data ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Generating membership QR…
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Place</p>
                                <p className="mt-1 text-lg font-bold text-slate-900">{membershipQrModal.asset.name}</p>
                                {membershipQrModal.asset.address ? (
                                    <p className="mt-1 text-sm text-slate-500">{membershipQrModal.asset.address}</p>
                                ) : null}
                            </div>

                            <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-6">
                                <DirectoryQrCode value={membershipQrModal.data.linkUrl} compact />
                                <p className="max-w-sm text-center text-sm text-slate-500">
                                    Scanning this code signs the user into an active membership for this place. Repeat scans are safe and won&apos;t create duplicates.
                                </p>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Membership link</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={membershipQrModal.data.linkUrl}
                                        className="input-field flex-1 bg-slate-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(membershipQrModal.data.linkUrl);
                                                setMembershipQrModal((prev) => prev ? { ...prev, copied: true } : prev);
                                            } catch (error) {
                                                console.error(error);
                                            }
                                        }}
                                        className="btn-ghost whitespace-nowrap"
                                    >
                                        {membershipQrModal.copied ? 'Copied' : 'Copy link'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </ResourceModal>
            ) : null}

            {childModal ? (
                <ResourceModal
                    title="Edit Child Asset"
                    description="Adjust only the host-local fields for this generated offering."
                    onClose={() => setChildModal(null)}
                    maxWidth="max-w-3xl"
                >
                    {childModal.loading || !childModal.data ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                            Loading child asset...
                        </div>
                    ) : (
                        <SoftAssetChildForm
                            initialData={childModal.data}
                            onSave={handleChildSave}
                            onResetOverrides={handleChildResetOverrides}
                            onCancel={() => setChildModal(null)}
                        />
                    )}
                </ResourceModal>
            ) : null}

            {deleteTarget ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="card w-full max-w-sm text-center shadow-2xl">
                        <Trash2 size={36} className="mx-auto mb-3 text-red-500" />
                        <h2 className="mb-2 text-xl font-bold text-slate-900">Delete {deleteTarget.label}?</h2>
                        <p className="mb-6 text-sm text-slate-500">
                            {deleteTarget.assetType === 'hard'
                                ? 'This will permanently remove this place. Ensure no offerings are solely relying on it.'
                                : deleteTarget.assetType === 'template'
                                    ? 'Deleting a template also deletes all of its generated child assets.'
                                    : 'This action cannot be undone. It will be permanently removed from the directory.'}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                            <button onClick={() => handleDelete(deleteTarget)} className="btn-danger flex-1 justify-center">Delete</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
