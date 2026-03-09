import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Plus, Pencil, Trash2, X, MapPin, Building2, CalendarDays, Clock, Search } from 'lucide-react';
import AssetForm from '../../components/AssetForm.jsx';
import { AssetCard } from '../../components/AssetCard.jsx';
import { isStandardUserRole, normalizeRole } from '../../lib/roles.js';
import { collectSubregionPostalPatterns, getBoundaryStatus, normalizePostalCode } from '../../lib/postalBoundaries.js';

const TagBadge = ({ tag, onClick }) => (
    <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider border border-slate-200 ${onClick ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
    >
        {tag}
    </span>
);

const CategoryBadge = ({ category, onClick }) => (
    <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[10px] font-bold uppercase tracking-wider border border-brand-200 ${onClick ? 'cursor-pointer hover:bg-brand-100 transition-colors' : ''}`}
    >
        {category}
    </span>
);

const getHiddenStatus = (a) => {
    if (a.isHidden) return { hidden: true, type: 'manual' };
    const now = new Date();
    const from = a.hideFrom ? new Date(a.hideFrom) : null;
    const until = a.hideUntil ? new Date(a.hideUntil) : null;
    if (from && until && now >= from && now <= until) return { hidden: true, type: 'scheduled' };
    if (from && !until && now >= from) return { hidden: true, type: 'scheduled' };
    if (!from && until && now <= until) return { hidden: true, type: 'scheduled' };
    return { hidden: false };
};

const HiddenBadge = ({ status }) => {
    if (!status.hidden) return null;
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-600 text-[10px] font-semibold uppercase tracking-wider border border-red-200">
            {status.type === 'scheduled' ? <Clock size={10} strokeWidth={3} /> : null}
            Hidden
        </span>
    );
};

export default function ResourcesPage() {
    const { user } = useAuth();
    const [hardAssets, setHardAssets] = useState([]);
    const [softAssets, setSoftAssets] = useState([]);
    const [subregions, setSubregions] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [activeTab, setActiveTab] = useState('hard'); // 'hard' | 'soft'
    const [modal, setModal] = useState(null); // null | { type: 'create'|'edit', assetType: 'hard'|'soft', data: obj }
    const [deleteId, setDeleteId] = useState(null); // { id, assetType }
    const [searchTerm, setSearchTerm] = useState('');
    const [boundaryFilter, setBoundaryFilter] = useState('all');

    const normalizedRole = normalizeRole(user?.role);
    const boundaryChecksEnabled = normalizedRole === 'regional_admin' || normalizedRole === 'partner';
    const scopedBoundaryPatterns = useMemo(
        () => collectSubregionPostalPatterns(subregions, user?.subregionIds || []),
        [subregions, user?.subregionIds]
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

    function getAssetBoundaryStatus(asset, assetType) {
        if (!boundaryChecksEnabled) return 'no-boundary';

        if (assetType === 'hard') {
            return getBoundaryStatus(asset.postalCode, scopedBoundaryPatterns);
        }

        const locations = Array.isArray(asset.locations) ? asset.locations : [];
        if (locations.length === 0) return 'no-location';

        const validPostalCodes = locations.map((location) => normalizePostalCode(location.postalCode)).filter(Boolean);
        if (validPostalCodes.length === 0) return 'missing-postal';

        return validPostalCodes.some((postalCode) => getBoundaryStatus(postalCode, scopedBoundaryPatterns) === 'inside')
            ? 'inside'
            : 'outside';
    }

    const filterAsset = (a, assetType) => {
        if (boundaryChecksEnabled && boundaryFilter !== 'all' && getAssetBoundaryStatus(a, assetType) !== boundaryFilter) {
            return false;
        }

        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            a.name?.toLowerCase().includes(q) ||
            a.subCategory?.toLowerCase().includes(q) ||
            a.postalCode?.toLowerCase().includes(q) ||
            a.address?.toLowerCase().includes(q) ||
            a.location?.name?.toLowerCase().includes(q) ||
            a.locations?.some((location) => `${location?.name || ''} ${location?.postalCode || ''}`.toLowerCase().includes(q)) ||
            a.tags?.some(t => t.toLowerCase().includes(q))
        );
    };
    const filteredHardAssets = hardAssets.filter((asset) => filterAsset(asset, 'hard'));
    const filteredSoftAssets = softAssets.filter((asset) => filterAsset(asset, 'soft'));

    async function load() {
        try {
            const [hard, soft, subregionData] = await Promise.all([
                api.getHardAssets(),
                api.getSoftAssets(),
                api.getSubregions().catch(() => [])
            ]);
            setSubregions(subregionData);

            if (isStandardUserRole(user.role)) {
                const favs = await api.getFavorites();
                const favHardIds = new Set(favs.filter(f => f.resourceType === 'hard').map(f => f.resourceId));
                const favSoftIds = new Set(favs.filter(f => f.resourceType === 'soft').map(f => f.resourceId));
                setHardAssets(hard.filter(r => favHardIds.has(r.id)));
                setSoftAssets(soft.filter(r => favSoftIds.has(r.id)));
            } else {
                if (normalizeRole(user.role) === 'super_admin' || normalizeRole(user.role) === 'regional_admin') {
                    setHardAssets(hard);
                    setSoftAssets(soft);
                } else {
                    setHardAssets(hard.filter(r => r.partnerId === user.id));
                    setSoftAssets(soft.filter(r => r.partnerId === user.id));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function openCreate(assetType) {
        setModal({ type: 'create', assetType, data: null });
    }

    function openEdit(asset, assetType) {
        setModal({ type: 'edit', assetType, data: asset });
    }

    async function handleDelete(payload) {
        try {
            payload.assetType === 'hard'
                ? await api.deleteHardAsset(payload.id)
                : await api.deleteSoftAsset(payload.id);
            setDeleteId(null);
            await load();
        } catch (err) {
            alert(err.message || "Failed to delete asset");
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

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{isStandardUserRole(user.role) ? 'My Favorites' : 'My Assets'}</h1>
                    <p className="text-slate-500 mt-0.5">{isStandardUserRole(user.role) ? 'Your saved places and offerings.' : "Manage your organization's places and offerings."}</p>
                </div>
                {!isStandardUserRole(user.role) && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => openCreate('hard')} className="btn-primary bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 shadow-sm whitespace-nowrap">
                            <Plus size={16} /> New Place
                        </button>
                        <button onClick={() => openCreate('soft')} className="btn-primary whitespace-nowrap">
                            <Plus size={16} /> New Offering
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-6 relative">
                <div className="flex flex-col lg:flex-row gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="search"
                            placeholder="Search assets by name, category, postal code, or #tag..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-sm"
                        />
                    </div>
                    {boundaryChecksEnabled ? (
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

            {boundaryChecksEnabled ? (
                <p className="mb-6 text-xs text-slate-500">
                    Boundary checks use the postal patterns assigned to your scoped subregion(s).
                </p>
            ) : null}

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
                <button
                    onClick={() => setActiveTab('hard')}
                    className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'hard' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Places ({filteredHardAssets.length})
                </button>
                <button
                    onClick={() => setActiveTab('soft')}
                    className={`pb-3 px-1 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'soft' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Offerings ({filteredSoftAssets.length})
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-slate-100" />)}
                </div>
            ) : activeTab === 'hard' ? (
                /* Hard Assets List */
                filteredHardAssets.length === 0 ? (
                    <div className="card text-center py-16 bg-slate-50 border-dashed">
                        <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-600 text-lg font-medium">No places found</p>
                        <p className="text-slate-500 text-sm mt-1 mb-5">Try adjusting your search criteria.</p>
                        {!isStandardUserRole(user.role) && !searchTerm && <button onClick={() => openCreate('hard')} className="btn-primary bg-white text-slate-700 hover:bg-slate-50 border-2 border-slate-200 mx-auto"><Plus size={16} /> Add Place</button>}
                    </div>
                ) : isStandardUserRole(user.role) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredHardAssets.map(r => (
                            <AssetCard
                                key={r.id}
                                asset={r}
                                type="hard"
                                isFavorite={true}
                                isLoggedIn={true}
                                onToggleFavorite={(id, type) => handleUnfavorite(type, id)}
                                onTagClick={setSearchTerm}
                                onCategoryClick={setSearchTerm}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHardAssets.map(r => (
                            <div key={r.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                                {r.logoUrl ? (
                                    <img src={r.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover bg-slate-100 flex-shrink-0 border border-slate-200" />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                                        <Building2 size={24} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="font-bold text-slate-900 text-lg truncate">{r.name}</p>
                                        {(normalizeRole(user.role) === 'super_admin' || normalizeRole(user.role) === 'regional_admin') && r.partnerName && (
                                            <span className="text-xs text-slate-400">by {r.partnerName}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                        {r.address && <span className="flex items-center gap-1 truncate"><MapPin size={14} />{r.address}</span>}
                                    </div>
                                    {(r.subCategory || r.tags?.length > 0 || getHiddenStatus(r).hidden) && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <HiddenBadge status={getHiddenStatus(r)} />
                                            {boundaryChecksEnabled ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${getBoundaryBadgeMeta(getAssetBoundaryStatus(r, 'hard')).className}`}>
                                                    {getBoundaryBadgeMeta(getAssetBoundaryStatus(r, 'hard')).label}
                                                </span>
                                            ) : null}
                                            {r.subCategory && <CategoryBadge category={r.subCategory} onClick={() => setSearchTerm(r.subCategory)} />}
                                            {r.tags?.map(t => <TagBadge key={t} tag={t} onClick={() => setSearchTerm(t)} />)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 mt-3 sm:mt-0">
                                    <button onClick={() => openEdit(r, 'hard')} className="btn-ghost text-sm px-3 py-2">
                                        <Pencil size={15} /> Edit
                                    </button>
                                    <button onClick={() => setDeleteId({ id: r.id, assetType: 'hard' })} className="btn-danger text-sm px-3 py-2">
                                        <Trash2 size={15} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* Soft Assets List */
                filteredSoftAssets.length === 0 ? (
                    <div className="card text-center py-16 bg-slate-50 border-dashed">
                        <CalendarDays size={40} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-600 text-lg font-medium">No offerings found</p>
                        <p className="text-slate-500 text-sm mt-1 mb-5">Try adjusting your search criteria.</p>
                        {!isStandardUserRole(user.role) && !searchTerm && <button onClick={() => openCreate('soft')} className="btn-primary mx-auto"><Plus size={16} /> Add Offering</button>}
                    </div>
                ) : isStandardUserRole(user.role) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSoftAssets.map(r => (
                            <AssetCard
                                key={r.id}
                                asset={r}
                                type="soft"
                                isFavorite={true}
                                isLoggedIn={true}
                                onToggleFavorite={(id, type) => handleUnfavorite(type, id)}
                                onTagClick={setSearchTerm}
                                onCategoryClick={setSearchTerm}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredSoftAssets.map(r => (
                            <div key={r.id} className="card p-5 outline flex flex-col items-start gap-4">
                                <div className="flex items-start justify-between w-full">
                                    <div className="flex items-center gap-3">
                                        {r.logoUrl ? (
                                            <img src={r.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                                                <CalendarDays size={20} />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-900 text-base leading-tight">{r.name}</p>
                                            {r.location ? (
                                                <p className="text-sm text-slate-500 mt-0.5 truncate flex items-center gap-1">
                                                    <MapPin size={12} /> {r.location.name}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-slate-400 mt-0.5 italic">No specific location</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {(r.subCategory || r.tags?.length > 0 || getHiddenStatus(r).hidden || r.isMemberOnly) && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        <HiddenBadge status={getHiddenStatus(r)} />
                                        {boundaryChecksEnabled ? (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${getBoundaryBadgeMeta(getAssetBoundaryStatus(r, 'soft')).className}`}>
                                                {getBoundaryBadgeMeta(getAssetBoundaryStatus(r, 'soft')).label}
                                            </span>
                                        ) : null}
                                        {r.isMemberOnly && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wider border border-amber-200">Member-Only</span>}
                                        {r.subCategory && <CategoryBadge category={r.subCategory} onClick={() => setSearchTerm(r.subCategory)} />}
                                        {r.tags?.map(t => <TagBadge key={t} tag={t} onClick={() => setSearchTerm(t)} />)}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 border-t border-slate-100 w-full pt-4 mt-auto">
                                    <button onClick={() => openEdit(r, 'soft')} className="btn-ghost flex-1 justify-center text-sm py-2">
                                        <Pencil size={15} /> Edit
                                    </button>
                                    <button onClick={() => setDeleteId({ id: r.id, assetType: 'soft' })} className="btn-ghost flex-1 justify-center text-sm py-2 text-red-600 hover:bg-red-50 hover:border-red-100">
                                        <Trash2 size={15} /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Create/Edit Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6 overflow-y-auto">
                    <div className="card w-full max-w-2xl bg-white shadow-2xl relative my-auto">
                        <div className="flex items-start justify-between mb-5 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {modal.type === 'create' ? 'Create' : 'Edit'} {modal.assetType === 'hard' ? 'Place' : 'Offering'}
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {modal.assetType === 'hard' ? "Add a physical address and contact info." : "Add schedule, description, and link to a location."}
                                </p>
                            </div>
                            <button onClick={() => setModal(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto pr-1 -mr-1">
                            <AssetForm
                                type={modal.assetType}
                                initialData={modal.data}
                                partnerHardAssets={hardAssets} // used for SoftAsset location linking
                                onSave={() => { setModal(null); load(); }}
                                onCancel={() => setModal(null)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="card w-full max-w-sm shadow-2xl text-center">
                        <Trash2 size={36} className="mx-auto text-red-500 mb-3" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Delete {deleteId.assetType === 'hard' ? 'Place' : 'Offering'}?</h2>
                        <p className="text-slate-500 mb-6 text-sm">
                            {deleteId.assetType === 'hard'
                                ? 'This will permanently remove this place. Ensure no offerings are solely relying on it.'
                                : 'This action cannot be undone. It will be permanently removed from the directory.'}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1 justify-center">Cancel</button>
                            <button onClick={() => handleDelete(deleteId)} className="btn-danger flex-1 justify-center">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
