import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { CategoryBadge } from '../../lib/categories.jsx';
import { Shield, Users, BookOpen, Trash2, MapPin, ChevronDown, Database, Upload, Download } from 'lucide-react';
import Papa from 'papaparse';
import { useAuth } from '../../contexts/AuthContext.jsx';
import AdminUserForm from '../../components/AdminUserForm.jsx';


export default function AdminPage() {
    const [tab, setTab] = useState('resources');
    const [resources, setResources] = useState([]);
    const [users, setUsers] = useState([]);
    const { user: currentUser } = useAuth();
    const [subCategories, setSubCategories] = useState([]);
    const [subregions, setSubregions] = useState([]);

    const [loading, setLoading] = useState(true);
    const [newSubCat, setNewSubCat] = useState({ name: '', type: 'hard', color: '#3b82f6' });
    const [newSubregion, setNewSubregion] = useState({ subregionCode: '', name: '', description: '' });
    const [selectedSubregions, setSelectedSubregions] = useState([]);
    const [subregionFeedback, setSubregionFeedback] = useState(null);
    const [pendingSubregionDelete, setPendingSubregionDelete] = useState(null);
    const [subregionDeleteLoading, setSubregionDeleteLoading] = useState(false);

    async function loadAll() {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                api.getResources(),
                api.getUsers(),
                api.getSubCategories(),
                api.getSubregions()
            ]);

            if (results[0].status === 'fulfilled') setResources(results[0].value);
            if (results[1].status === 'fulfilled') setUsers(results[1].value);
            if (results[2].status === 'fulfilled') setSubCategories(results[2].value);
            if (results[3].status === 'fulfilled') {
                const regs = results[3].value;
                setSubregions(regs);
                setSelectedSubregions((prev) => prev.filter((id) => regs.some((reg) => reg.id === id)));
            }

            // Inform of partial failures (e.g. permission issues for Users tab)
            const rejected = results.filter(r => r.status === 'rejected');
            if (rejected.length > 0 && rejected.length < 4) {
                console.warn('Some admin modules failed to load (likely permissions):', rejected);
            } else if (rejected.length === 4) {
                alert('Admin data load failed entirely. Please check your login session.');
            }
        } catch (err) {
            console.error('Core load error:', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { loadAll(); }, []);

    async function handleDeleteResource(id, category) {
        if (!confirm('Delete this resource permanently?')) return;
        try {
            if (category === 'Places') {
                await api.deleteHardAsset(id);
            } else {
                await api.deleteSoftAsset(id);
            }
            await loadAll();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    }

    async function handleRoleChange(userId, newRole) {
        try {
            await api.updateRole(userId, newRole);
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleDeleteUser(id) {
        if (!confirm('Delete this user and all their resources?')) return;
        try {
            await api.deleteUser(id);
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleAddSubCategory(e) {
        e.preventDefault();
        try {
            await api.createSubCategory(newSubCat);
            setNewSubCat({ name: '', type: 'hard', color: '#3b82f6' });
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleDeleteSubCategory(id) {
        if (!confirm('Delete this sub-category? (Assets using it will fall back to Defaults)')) return;
        try {
            await api.deleteSubCategory(id);
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleAddSubregion(e) {
        e.preventDefault();
        setLoading(true);
        setSubregionFeedback(null);
        console.log('Submitting subregion:', newSubregion);
        try {
            const res = await api.createSubregion(newSubregion);
            console.log('Subregion created:', res);
            setNewSubregion({ subregionCode: '', name: '', description: '' });
            await loadAll();
            setSubregionFeedback({ type: 'success', message: `Subregion "${res.subregionCode || res.id}" added successfully.` });
        } catch (err) {
            console.error('Subregion add failed:', err);
            setSubregionFeedback({
                type: 'error',
                message: err.message || 'Unable to add subregion. Please try again.'
            });
        } finally {
            setLoading(false);
        }
    }

    function promptSingleSubregionDelete(subregion) {
        setPendingSubregionDelete({
            mode: 'single',
            id: subregion.id,
            label: subregion.subregionCode || subregion.id
        });
    }

    async function handleExportCSV() {
        try {
            setLoading(true);
            const data = await api.exportFullDB();

            if (data.hardAssets?.length > 0) {
                downloadFile('\uFEFF' + Papa.unparse(data.hardAssets), 'hard_assets_export.csv', 'text/csv;charset=utf-8');
            }
            if (data.softAssets?.length > 0) {
                downloadFile('\uFEFF' + Papa.unparse(data.softAssets), 'soft_assets_export.csv', 'text/csv;charset=utf-8');
            }
            alert('Export complete');
        } catch (err) {
            alert('Export failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleDownloadPlacesTemplate() {
        const headers = ['id', 'name', 'subCategory', 'postalCode', 'phone', 'hours', 'description', 'tags', 'partnerUsername', 'subregionId'];
        const demoRow = ['', 'Example AAC', 'Active Ageing Centres', '123456', '+6591234567', '9am-6pm', 'A great place for seniors', 'wellness, active', '', ''];
        downloadFile('\uFEFF' + Papa.unparse({ fields: headers, data: [demoRow] }), 'places_upload_template.csv', 'text/csv;charset=utf-8');
    }

    function handleDownloadOfferingsTemplate() {
        const headers = ['id', 'name', 'subCategory', 'description', 'schedule', 'isMemberOnly', 'tags', 'partnerUsername', 'subregionId', 'linkedPlaceIds'];
        const demoRow = ['', 'Morning Yoga', 'Programmes', 'Gentle yoga for seniors', 'Mon/Wed 9am', 'false', 'fitness, health', '', '', ''];
        downloadFile('\uFEFF' + Papa.unparse({ fields: headers, data: [demoRow] }), 'offerings_upload_template.csv', 'text/csv;charset=utf-8');
    }

    function handleDownloadUserTemplate() {
        const headers = ['username', 'email', 'name', 'password', 'phone', 'role', 'subregionIds'];
        const demoRow = ['johndoe', 'john@example.com', 'John Doe', 'P@ssw0rd123', '+6591234567', 'partner', '1,2'];
        downloadFile('\uFEFF' + Papa.unparse({ fields: headers, data: [demoRow] }), 'user_upload_template.csv', 'text/csv;charset=utf-8');
    }

    function downloadFile(content, fileName, mimeType = 'text/csv;charset=utf-8') {
        try {
            console.log('Preparing download link for:', fileName);

            // Standard approach using a blob and a temporary anchor
            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.setAttribute('download', fileName);
            link.setAttribute('target', '_blank');

            // Append to body to ensure it's in the DOM for Chrome/Safari
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 5000);

            alert(`Export initiated: ${fileName}`);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Export failed. Please check browser console for details.');
        }
    }

    function handleImportCSV(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const res = await api.importCSV({ rows: results.data, type });
                    alert(`Import successful: ${res.message}. Errors: ${res.errors?.length ? res.errors.join('\n') : '0'}`);
                    await loadAll();
                } catch (err) {
                    alert('Import failed: ' + err.message);
                } finally {
                    setLoading(false);
                    e.target.value = null; // reset input
                }
            },
            error: (err) => {
                alert('File parsing error: ' + err.message);
                setLoading(false);
            }
        });
    }

    function handleBulkUserUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const res = await api.bulkCreateUsers({ rows: results.data });
                    alert(`Import processed: ${res.successful} successful, ${res.failed} failed.${res.errors.length > 0 ? '\n\nErrors:\n' + res.errors.join('\n') : ''}`);
                    await loadAll();
                } catch (err) {
                    alert('Bulk upload failed: ' + err.message);
                } finally {
                    setLoading(false);
                    e.target.value = null;
                }
            },
            error: (err) => {
                alert('File parsing error: ' + err.message);
                setLoading(false);
            }
        });
    }

    function handleDownloadSubregionTemplate() {
        const headers = ['id', 'subregionId', 'name', 'description'];
        const demoRow = ['', 'SR-JW', 'Jurong West', 'Residential area in the west'];
        const csv = Papa.unparse({ fields: headers, data: [demoRow] });
        downloadFile('\uFEFF' + csv, 'subregion_upload_template.csv', 'text/csv;charset=utf-8');
    }

    function handleBulkSubregionUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const res = await api.bulkCreateSubregions({ rows: results.data });
                    alert(`Import processed: ${res.successful} successful, ${res.failed} failed.${res.errors.length > 0 ? '\n\nErrors:\n' + res.errors.join('\n') : ''}`);
                    await loadAll();
                } catch (err) {
                    alert('Bulk upload failed: ' + err.message);
                } finally {
                    setLoading(false);
                    e.target.value = null;
                }
            },
            error: (err) => {
                alert('File parsing error: ' + err.message);
                setLoading(false);
            }
        });
    }

    function promptBulkDeleteSubregions() {
        if (selectedSubregions.length === 0) return;
        setPendingSubregionDelete({
            mode: 'bulk',
            ids: [...selectedSubregions],
            count: selectedSubregions.length
        });
    }

    async function handleConfirmSubregionDelete() {
        if (!pendingSubregionDelete) return;
        try {
            setSubregionDeleteLoading(true);
            setLoading(true);
            setSubregionFeedback(null);
            if (pendingSubregionDelete.mode === 'single') {
                const res = await api.deleteSubregion(pendingSubregionDelete.id);
                const deletedLabel = res?.deleted?.subregionCode || res?.deleted?.id || pendingSubregionDelete.label;
                await loadAll();
                setSubregionFeedback({ type: 'success', message: `Subregion "${deletedLabel}" deleted.` });
            } else {
                const res = await api.bulkDeleteSubregions(pendingSubregionDelete.ids);
                setSelectedSubregions([]);
                await loadAll();
                setSubregionFeedback({
                    type: 'success',
                    message: `${res?.deletedCount || 0} subregion(s) deleted successfully.`
                });
            }
        } catch (err) {
            console.error('Subregion delete failed:', err);
            setSubregionFeedback({ type: 'error', message: err.message || 'Delete failed.' });
        } finally {
            setPendingSubregionDelete(null);
            setSubregionDeleteLoading(false);
            setLoading(false);
        }
    }

    function handleExportSelectedSubregions() {
        const selectedData = selectedSubregions.length > 0
            ? subregions.filter(s => selectedSubregions.includes(s.id))
            : subregions;

        if (selectedData.length === 0) {
            alert('No subregions to export');
            return;
        }

        const toExport = selectedData.map(s => ({
            id: s.id,
            subregionId: s.subregionCode || '',
            name: s.name,
            description: s.description || ''
        }));

        const csv = Papa.unparse({
            fields: ['id', 'subregionId', 'name', 'description'],
            data: toExport.map(s => [s.id, s.subregionId, s.name, s.description])
        });

        const fileName = `subregions_export_${new Date().toISOString().split('T')[0]}.csv`;
        downloadFile('\uFEFF' + csv, fileName, 'text/csv;charset=utf-8');
    }

    function toggleSubregionSelection(id) {
        setSelectedSubregions(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    }

    function toggleSelectAllSubregions() {
        if (selectedSubregions.length === subregions.length) {
            setSelectedSubregions([]);
        } else {
            setSelectedSubregions(subregions.map(s => s.id));
        }
    }

    return (
        <div className="p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Shield size={20} className="text-red-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
                    <p className="text-slate-500 text-sm">Global oversight of all resources and users</p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total Resources', val: resources.length, color: 'bg-brand-50 text-brand-700', icon: BookOpen },
                    { label: 'Total Users', val: users.length, color: 'bg-green-50 text-green-700', icon: Users },
                    { label: 'Partners', val: users.filter(u => u.role === 'partner').length, color: 'bg-amber-50 text-amber-700', icon: Users },
                    { label: 'Admins', val: users.filter(u => ['super_admin', 'regional_admin'].includes(u.role)).length, color: 'bg-red-50 text-red-700', icon: Shield },

                ].map(({ label, val, color, icon: Icon }) => (
                    <div key={label} className={`card ${color} border-0`}>
                        <Icon size={18} className="mb-1 opacity-60" />
                        <p className="text-2xl font-bold">{val}</p>
                        <p className="text-xs font-semibold opacity-70">{label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-slate-100 rounded-xl p-1 mb-6 w-fit overflow-x-auto max-w-full">
                {[
                    { key: 'resources', label: 'All Resources', Icon: BookOpen },
                    { key: 'users', label: 'All Users', Icon: Users },
                    { key: 'subregions', label: 'Subregions', Icon: MapPin },
                    { key: 'subcats', label: 'Categories', Icon: BookOpen },
                    { key: 'datatools', label: 'Data Tools', Icon: Database },
                ].map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        id={`admin-tab-${key}`}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-100" />)}
                </div>
            ) : tab === 'resources' ? (
                /* ======== Resources Table ======== */
                <div className=" card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="hc-table w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                    <th className="px-4 py-3 font-semibold">Category</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Address</th>
                                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Partner</th>
                                    <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resources.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3"><CategoryBadge category={r.category} /></td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-sm hidden md:table-cell">
                                            <span className="flex items-center gap-1"><MapPin size={12} />{r.address}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 text-sm hidden lg:table-cell">{r.partnerName || '—'}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                id={`admin-delete-resource-${r.id}`}
                                                onClick={() => handleDeleteResource(r.id, r.category)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {resources.length === 0 && (
                        <div className="text-center py-12 text-slate-400">No resources in the system.</div>
                    )}
                </div>
            ) : tab === 'subregions' ? (
                /* ======== Subregions Table ======== */
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <form onSubmit={handleAddSubregion} className="flex-1 flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <input
                                required
                                placeholder="Subregion ID (e.g. SR-AMK)"
                                value={newSubregion.subregionCode}
                                onChange={e => setNewSubregion({ ...newSubregion, subregionCode: e.target.value })}
                                className="input-field w-40 sm:w-44"
                                title="Unique subregion identifier"
                            />
                            <input
                                required
                                placeholder="Name (e.g. Jurong)"
                                value={newSubregion.name}
                                onChange={e => setNewSubregion({ ...newSubregion, name: e.target.value })}
                                className="input-field flex-1"
                            />
                            <input
                                placeholder="Description"
                                value={newSubregion.description}
                                onChange={e => setNewSubregion({ ...newSubregion, description: e.target.value })}
                                className="input-field flex-1"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary sm:w-auto w-full disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {loading ? 'Adding...' : 'Add Subregion'}
                            </button>
                        </form>

                        <div className="flex gap-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <label className="btn-secondary cursor-pointer flex items-center justify-center gap-2 text-sm flex-1 sm:flex-none">
                                <input type="file" accept=".csv" className="hidden" onChange={handleBulkSubregionUpload} />
                                <Upload size={16} />
                                Upload CSV
                            </label>
                            <button onClick={handleDownloadSubregionTemplate} className="btn-ghost flex items-center justify-center p-2" title="Download Template">
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    {subregionFeedback && (
                        <div
                            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${subregionFeedback.type === 'error'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-green-50 text-green-700 border-green-200'
                                }`}
                        >
                            {subregionFeedback.message}
                        </div>
                    )}

                    {selectedSubregions.length > 0 && (
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm font-bold text-blue-700 ml-2">{selectedSubregions.length} selected</span>
                            <div className="flex-1"></div>
                            <button type="button" onClick={handleExportSelectedSubregions} className="btn-secondary py-1.5 text-xs flex items-center gap-2">
                                <Download size={14} /> Export Selected
                            </button>
                            <button type="button" onClick={promptBulkDeleteSubregions} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 py-1.5 text-xs flex items-center gap-2">
                                <Trash2 size={14} /> Delete Selected
                            </button>
                        </div>
                    )}

                    <div className="card overflow-hidden p-0">
                        <table className="hc-table w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={subregions.length > 0 && selectedSubregions.length === subregions.length}
                                            onChange={toggleSelectAllSubregions}
                                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-semibold w-16">ID</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold">Description</th>
                                    <th className="px-4 py-3 font-semibold w-24 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subregions.map(reg => (
                                    <tr key={reg.id} className={`hover:bg-slate-50 transition-colors ${selectedSubregions.includes(reg.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedSubregions.includes(reg.id)}
                                                onChange={() => toggleSubregionSelection(reg.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-slate-500 font-mono text-xs" title={`DB ID: ${reg.id}`}>
                                            {reg.subregionCode || reg.id}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-900">{reg.name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-sm truncate max-w-[200px]">{reg.description || '—'}</td>
                                        <td className="px-4 py-3 flex justify-center">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    promptSingleSubregionDelete(reg);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center relative z-10"
                                                title="Delete subregion"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {subregions.length === 0 && (
                            <div className="text-center py-12 text-slate-400">No subregions defined.</div>
                        )}
                    </div>

                    {pendingSubregionDelete && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                            <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                                <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    {pendingSubregionDelete.mode === 'single'
                                        ? `Delete subregion "${pendingSubregionDelete.label}"? Users and assets in this region will be set to Global.`
                                        : `Delete ${pendingSubregionDelete.count} selected subregion(s)? Users and assets in these regions will be set to Global.`}
                                </p>
                                <div className="mt-5 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => !subregionDeleteLoading && setPendingSubregionDelete(null)}
                                        disabled={subregionDeleteLoading}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmSubregionDelete}
                                        disabled={subregionDeleteLoading}
                                        className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50"
                                    >
                                        {subregionDeleteLoading ? 'Deleting...' : 'Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : tab === 'subcats' ? (
                /* ======== SubCategories Table ======== */
                <div className="space-y-6">
                    <form onSubmit={handleAddSubCategory} className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <select
                            value={newSubCat.type}
                            onChange={e => setNewSubCat({ ...newSubCat, type: e.target.value })}
                            className="input-field max-w-[150px]"
                        >
                            <option value="hard">Place</option>
                            <option value="soft">Offering</option>
                        </select>
                        <input
                            required
                            placeholder="New sub-category name (e.g. Wellness)"
                            value={newSubCat.name}
                            onChange={e => setNewSubCat({ ...newSubCat, name: e.target.value })}
                            className="input-field flex-1"
                        />
                        <div className="flex items-center gap-2 px-2 border border-slate-200 rounded-lg">
                            <span className="text-sm text-slate-500 font-medium">Color:</span>
                            <input
                                type="color"
                                value={newSubCat.color}
                                onChange={e => setNewSubCat({ ...newSubCat, color: e.target.value })}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                            />
                        </div>
                        <button type="submit" className="btn-primary sm:w-auto w-full">Add Category</button>
                    </form>

                    <div className="card overflow-hidden p-0">
                        <table className="hc-table w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                    <th className="px-4 py-3 font-semibold w-24">Type</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subCategories.map(sc => (
                                    <tr key={sc.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3"><CategoryBadge category={sc.type === 'hard' ? 'hard' : 'soft'} /></td>
                                        <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sc.color || '#94a3b8' }}></div>
                                            {sc.name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleDeleteSubCategory(sc.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                title="Delete category"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {subCategories.length === 0 && (
                            <div className="text-center py-12 text-slate-400">No sub-categories created yet.</div>
                        )}
                    </div>
                </div>
            ) : tab === 'users' ? (
                /* ======== Users Table ======== */
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <AdminUserForm currentUser={currentUser} />

                        <div className="card p-6 border border-slate-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold">Bulk User Upload</h2>
                                    <p className="text-sm text-slate-500">Create multiple accounts via CSV</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">CSV Requirements</h3>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    <li>• Required: <code className="bg-slate-200 px-1 rounded">username</code>, <code className="bg-slate-200 px-1 rounded">email</code></li>
                                    <li>• Optional: <code className="bg-slate-200 px-1 rounded">name</code>, <code className="bg-slate-200 px-1 rounded">password</code>, <code className="bg-slate-200 px-1 rounded">phone</code></li>
                                    <li>• Scope: <code className="bg-slate-200 px-1 rounded">role</code>, <code className="bg-slate-200 px-1 rounded">subregionIds</code> (comma separated)</li>
                                </ul>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <label className="btn-secondary flex-1 cursor-pointer flex items-center justify-center gap-2">
                                    <input type="file" accept=".csv" className="hidden" onChange={handleBulkUserUpload} />
                                    <Upload size={18} />
                                    Choose User CSV
                                </label>
                                <button
                                    onClick={handleDownloadUserTemplate}
                                    className="btn-ghost flex-1 flex items-center justify-center gap-2"
                                >
                                    <Download size={18} />
                                    Download Template
                                </button>
                            </div>
                            <p className="text-[10px] text-center text-slate-400 mt-3">
                                Regional admins can only bulk-upload partners in their region.
                            </p>
                        </div>
                    </div>

                    <div className=" card overflow-hidden p-0">

                        <div className="overflow-x-auto">
                            <table className="hc-table w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                        <th className="px-4 py-3 font-semibold">User</th>
                                        <th className="px-4 py-3 font-semibold">Role</th>
                                        <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900">{u.name}</span>
                                                    <span className="text-xs text-slate-400">@{u.username} • {u.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="relative inline-block">
                                                    <select
                                                        id={`admin-role-${u.id}`}
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                        className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-colors min-h-[36px] ${u.role === 'admin'
                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                            : u.role === 'user'
                                                                ? 'bg-slate-50 text-slate-700 border-slate-200'
                                                                : 'bg-brand-50 text-brand-700 border-brand-200'
                                                            }`}
                                                    >
                                                        <option value="standard">Standard</option>
                                                        <option value="partner">Partner</option>
                                                        <option value="regional_admin">Regional Admin</option>
                                                        <option value="super_admin">Super Admin</option>

                                                    </select>
                                                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    id={`admin-delete-user-${u.id}`}
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                    title="Delete user"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {users.length === 0 && (
                            <div className="text-center py-12 text-slate-400">No users found.</div>
                        )}
                    </div>
                </div>
            ) : (
                /* ======== Data Tools ======== */

                <div className="space-y-6 max-w-2xl">
                    <div className="card border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
                                <Download size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Export Full Database</h2>
                                <p className="text-sm text-slate-500">Download all resources as CSV files</p>
                            </div>
                        </div>
                        <button onClick={handleExportCSV} className="btn-primary w-full sm:w-auto">
                            Export Database (Places & Offerings)
                        </button>
                    </div>

                    <div className="card border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-700">
                                <Upload size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Bulk Import Resources</h2>
                                <p className="text-sm text-slate-500">Must include header row. Places require valid SG Postal Code.</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 mt-4 border border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">CSV Features</h3>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>• Supply <code className="bg-slate-200 px-1 rounded">id</code> to update an existing record instead of creating a new one.</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">subregionId</code> overrides the uploader's default assigned region.</li>
                                <li>• <code className="bg-slate-200 px-1 rounded">partnerUsername</code> overrides the uploader as the owner.</li>
                                <li>• Offerings can define comma-separated <code className="bg-slate-200 px-1 rounded">linkedPlaceIds</code> to map to Places.</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center gap-3">
                                <span className="font-semibold text-slate-800">Import Places</span>
                                <label className="btn-secondary cursor-pointer min-h-[44px] flex items-center justify-center w-full">
                                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportCSV(e, 'hard')} />
                                    Choose Places CSV
                                </label>
                                <button
                                    onClick={handleDownloadPlacesTemplate}
                                    className="btn-ghost flex items-center justify-center gap-2 text-xs w-full"
                                >
                                    <Download size={14} /> Download Template
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-center text-center gap-3">
                                <span className="font-semibold text-slate-800">Import Offerings</span>
                                <label className="btn-secondary cursor-pointer min-h-[44px] flex items-center justify-center w-full">
                                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImportCSV(e, 'soft')} />
                                    Choose Offerings CSV
                                </label>
                                <button
                                    onClick={handleDownloadOfferingsTemplate}
                                    className="btn-ghost flex items-center justify-center gap-2 text-xs w-full"
                                >
                                    <Download size={14} /> Download Template
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}
