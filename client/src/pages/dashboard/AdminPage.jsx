import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { CategoryBadge } from '../../lib/categories.jsx';
import { Shield, Users, BookOpen, Trash2, MapPin, ChevronDown, Database, Upload, Download } from 'lucide-react';
import Papa from 'papaparse';
import { useAuth } from '../../contexts/AuthContext.jsx';
import AdminUserForm from '../../components/AdminUserForm.jsx';
import { canChangeUserRoles, canManageUser, getAdminTabs, getCreatableUserRoles, getRoleMeta, normalizeRole } from '../../lib/roles.js';


export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const currentRole = normalizeRole(currentUser?.role);
    const availableTabs = getAdminTabs(currentRole);
    const defaultTab = availableTabs[0] || 'users';
    const [tab, setTab] = useState(defaultTab);
    const [resources, setResources] = useState([]);
    const [users, setUsers] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [subregions, setSubregions] = useState([]);
    const [selectedResources, setSelectedResources] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedSubCategories, setSelectedSubCategories] = useState([]);

    const [loading, setLoading] = useState(true);
    const [newSubCat, setNewSubCat] = useState({ name: '', type: 'hard', color: '#3b82f6' });
    const [newSubregion, setNewSubregion] = useState({ subregionCode: '', name: '', description: '' });
    const [selectedSubregions, setSelectedSubregions] = useState([]);
    const [subregionFeedback, setSubregionFeedback] = useState(null);
    const [adminFeedback, setAdminFeedback] = useState(null);
    const [pendingSubregionDelete, setPendingSubregionDelete] = useState(null);
    const [subregionDeleteLoading, setSubregionDeleteLoading] = useState(false);
    const [pendingBulkDelete, setPendingBulkDelete] = useState(null);
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
    const [importReport, setImportReport] = useState(null);
    const [importCopyNotice, setImportCopyNotice] = useState('');
    const canEditUserRoles = canChangeUserRoles(currentRole);
    const creatableRoles = getCreatableUserRoles(currentRole);
    const superAdminRoleOptions = getCreatableUserRoles('super_admin');

    useEffect(() => {
        if (!availableTabs.includes(tab)) {
            setTab(defaultTab);
        }
    }, [availableTabs, defaultTab, tab]);

    async function loadAll() {
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                api.getResources(),
                api.getUsers(),
                api.getSubCategories(),
                api.getSubregions()
            ]);

            if (results[0].status === 'fulfilled') {
                const items = results[0].value;
                setResources(items);
                setSelectedResources((prev) => prev.filter((key) => items.some((item) => getResourceSelectionKey(item) === key)));
            }
            if (results[1].status === 'fulfilled') {
                const items = results[1].value;
                setUsers(items);
                setSelectedUsers((prev) => prev.filter((id) => items.some((item) => item.id === id)));
            }
            if (results[2].status === 'fulfilled') {
                const items = results[2].value;
                setSubCategories(items);
                setSelectedSubCategories((prev) => prev.filter((id) => items.some((item) => item.id === id)));
            }
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

    function getResourceSelectionKey(resource) {
        const assetType = resource.category === 'Places' ? 'hard' : 'soft';
        return `${assetType}:${resource.id}`;
    }

    function canManageUserRecord(targetUser) {
        if (!targetUser) return false;
        if (targetUser.id === currentUser?.id) return false;
        return canManageUser(currentRole, targetUser.role);
    }

    function getManageableUsers() {
        return users.filter((candidate) => canManageUserRecord(candidate));
    }

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
        if (!canEditUserRoles) return;
        try {
            await api.updateRole(userId, newRole);
            await loadAll();
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleDeleteUser(id) {
        const targetUser = users.find((candidate) => candidate.id === id);
        if (!canManageUserRecord(targetUser)) return;
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

    function toggleResourceSelection(resource) {
        const key = getResourceSelectionKey(resource);
        setSelectedResources((prev) =>
            prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
        );
    }

    function toggleSelectAllResources() {
        if (selectedResources.length === resources.length) {
            setSelectedResources([]);
        } else {
            setSelectedResources(resources.map((resource) => getResourceSelectionKey(resource)));
        }
    }

    function toggleUserSelection(id) {
        const targetUser = users.find((candidate) => candidate.id === id);
        if (!canManageUserRecord(targetUser)) return;
        setSelectedUsers((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    }

    function toggleSelectAllUsers() {
        const manageableUserIds = getManageableUsers().map((candidate) => candidate.id);
        if (manageableUserIds.length === 0) {
            setSelectedUsers([]);
            return;
        }
        if (selectedUsers.length === manageableUserIds.length && manageableUserIds.every((id) => selectedUsers.includes(id))) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers(manageableUserIds);
        }
    }

    function toggleSubCategorySelection(id) {
        setSelectedSubCategories((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    }

    function toggleSelectAllSubCategories() {
        if (selectedSubCategories.length === subCategories.length) {
            setSelectedSubCategories([]);
        } else {
            setSelectedSubCategories(subCategories.map((category) => category.id));
        }
    }

    function promptBulkDelete(type) {
        const count = type === 'resources'
            ? selectedResources.length
            : type === 'users'
                ? selectedUsers.length
                : selectedSubCategories.length;

        if (count === 0) return;

        setAdminFeedback(null);
        setPendingBulkDelete({ type, count });
    }

    async function handleConfirmBulkDelete() {
        if (!pendingBulkDelete) return;

        setBulkDeleteLoading(true);
        setLoading(true);
        setAdminFeedback(null);

        const failures = [];
        let deletedCount = 0;

        try {
            if (pendingBulkDelete.type === 'resources') {
                const targets = resources.filter((resource) => selectedResources.includes(getResourceSelectionKey(resource)));
                for (const resource of targets) {
                    try {
                        if (resource.category === 'Places') {
                            await api.deleteHardAsset(resource.id);
                        } else {
                            await api.deleteSoftAsset(resource.id);
                        }
                        deletedCount += 1;
                    } catch (err) {
                        failures.push(`${resource.name}: ${err.message || 'Delete failed.'}`);
                    }
                }
                setSelectedResources([]);
            } else if (pendingBulkDelete.type === 'users') {
                const targets = users.filter((user) => selectedUsers.includes(user.id));
                for (const user of targets) {
                    try {
                        await api.deleteUser(user.id);
                        deletedCount += 1;
                    } catch (err) {
                        failures.push(`${user.username || user.name}: ${err.message || 'Delete failed.'}`);
                    }
                }
                setSelectedUsers([]);
            } else if (pendingBulkDelete.type === 'subcategories') {
                const targets = subCategories.filter((category) => selectedSubCategories.includes(category.id));
                for (const category of targets) {
                    try {
                        await api.deleteSubCategory(category.id);
                        deletedCount += 1;
                    } catch (err) {
                        failures.push(`${category.name}: ${err.message || 'Delete failed.'}`);
                    }
                }
                setSelectedSubCategories([]);
            }

            await loadAll();

            setAdminFeedback({
                type: failures.length > 0 ? (deletedCount > 0 ? 'warning' : 'error') : 'success',
                message: failures.length > 0
                    ? `${deletedCount} deleted, ${failures.length} failed.`
                    : `${deletedCount} item(s) deleted successfully.`,
                details: failures
            });
        } catch (err) {
            setAdminFeedback({
                type: 'error',
                message: err.message || 'Bulk delete failed.',
                details: []
            });
        } finally {
            setPendingBulkDelete(null);
            setBulkDeleteLoading(false);
            setLoading(false);
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
        const templateRole = creatableRoles[0] || 'standard';
        const demoRow = ['johndoe', 'john@example.com', 'John Doe', 'P@ssw0rd123', '+6591234567', templateRole, currentRole === 'super_admin' ? '1,2' : (currentUser?.subregionIds || []).join(',')];
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

    function parseImportedCount(result) {
        if (Number.isInteger(result?.importedCount)) return result.importedCount;
        const message = String(result?.message || '');
        const match = message.match(/Successfully imported\s+(\d+)\s+rows/i);
        return match ? Number.parseInt(match[1], 10) : 0;
    }

    function normalizeBatchErrors(batchErrors, rowOffset) {
        if (!Array.isArray(batchErrors)) return [];

        return batchErrors.map((err) => {
            const text = String(err || '').trim();
            const match = text.match(/^Row\s+(\d+):\s*(.*)$/i);
            if (match) {
                const mappedRow = rowOffset + Number.parseInt(match[1], 10);
                return `Row ${mappedRow}: ${match[2]}`;
            }
            return `Row ${rowOffset + 1}: ${text}`;
        });
    }

    function buildImportReportText(report) {
        if (!report) return '';

        const lines = [
            `Import Report - ${report.resourceLabel}`,
            `File: ${report.fileName}`,
            `Timestamp: ${new Date(report.timestamp).toLocaleString()}`,
            `Total rows: ${report.totalRows}`,
            `Imported: ${report.importedCount}`,
            `Failed: ${report.failedCount}`,
            ''
        ];

        if (report.errors.length > 0) {
            lines.push('Errors:');
            lines.push(...report.errors);
        } else {
            lines.push('No row-level errors.');
        }

        return lines.join('\n');
    }

    async function copyImportReport() {
        if (!importReport) return;
        try {
            await navigator.clipboard.writeText(buildImportReportText(importReport));
            setImportCopyNotice('Copied to clipboard.');
        } catch (err) {
            setImportCopyNotice('Copy failed. You can still select and copy manually below.');
        }
    }

    function downloadImportReport() {
        if (!importReport) return;
        const content = buildImportReportText(importReport);
        const datePart = new Date(importReport.timestamp).toISOString().replace(/[:.]/g, '-');
        const fileName = `import_report_${importReport.resourceType}_${datePart}.txt`;
        downloadFile(content, fileName, 'text/plain;charset=utf-8');
    }

    function handleImportCSV(e, type) {
        const file = e.target.files[0];
        if (!file) return;

        const resourceLabel = type === 'hard' ? 'Places' : 'Offerings';
        setImportReport(null);
        setImportCopyNotice('');
        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = Array.isArray(results.data) ? results.data : [];
                    if (rows.length === 0) {
                        setImportReport({
                            type: 'error',
                            resourceType: type,
                            resourceLabel,
                            fileName: file.name,
                            timestamp: Date.now(),
                            totalRows: 0,
                            importedCount: 0,
                            failedCount: 0,
                            errors: ['CSV has no data rows.']
                        });
                        return;
                    }

                    // Import one row per request to stay well under Cloudflare Worker subrequest limits.
                    const batchSize = 1;
                    let importedCount = 0;
                    const allErrors = [];

                    for (let start = 0; start < rows.length; start += batchSize) {
                        const batchRows = rows.slice(start, start + batchSize);
                        try {
                            const res = await api.importCSV({ rows: batchRows, type });
                            importedCount += parseImportedCount(res);
                            allErrors.push(...normalizeBatchErrors(res?.errors, start));
                        } catch (batchErr) {
                            const end = Math.min(start + batchSize, rows.length);
                            allErrors.push(`Rows ${start + 1}-${end}: ${batchErr.message || 'Import batch failed.'}`);
                        }
                    }

                    if (importedCount > 0) {
                        await loadAll();
                    }

                    setImportReport({
                        type: allErrors.length > 0 ? (importedCount > 0 ? 'warning' : 'error') : 'success',
                        resourceType: type,
                        resourceLabel,
                        fileName: file.name,
                        timestamp: Date.now(),
                        totalRows: rows.length,
                        importedCount,
                        failedCount: allErrors.length,
                        errors: allErrors
                    });
                } catch (err) {
                    setImportReport({
                        type: 'error',
                        resourceType: type,
                        resourceLabel,
                        fileName: file.name,
                        timestamp: Date.now(),
                        totalRows: 0,
                        importedCount: 0,
                        failedCount: 1,
                        errors: [err.message || 'Import failed.']
                    });
                } finally {
                    setLoading(false);
                    e.target.value = null; // reset input
                }
            },
            error: (err) => {
                setImportReport({
                    type: 'error',
                    resourceType: type,
                    resourceLabel,
                    fileName: file.name,
                    timestamp: Date.now(),
                    totalRows: 0,
                    importedCount: 0,
                    failedCount: 1,
                    errors: [`File parsing error: ${err.message}`]
                });
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

    const manageableUsers = getManageableUsers();
    const manageableUserIds = manageableUsers.map((candidate) => candidate.id);
    const allManageableUsersSelected = manageableUserIds.length > 0 && manageableUserIds.every((id) => selectedUsers.includes(id));

    return (
        <div className="p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Shield size={20} className="text-red-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
                    <p className="text-slate-500 text-sm">
                        {currentRole === 'super_admin'
                            ? 'Global oversight of all resources and users'
                            : currentRole === 'regional_admin'
                                ? 'Manage partners and resources within your region'
                                : 'Manage user accounts within your organization'}
                    </p>
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
                ].filter(({ key }) => availableTabs.includes(key)).map(({ key, label, Icon }) => (
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

            {adminFeedback && (
                <div
                    className={`mb-6 rounded-xl border px-4 py-3 text-sm font-semibold ${adminFeedback.type === 'error'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : adminFeedback.type === 'warning'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-green-50 text-green-700 border-green-200'
                        }`}
                >
                    <div>{adminFeedback.message}</div>
                    {adminFeedback.details?.length > 0 && (
                        <textarea
                            readOnly
                            value={adminFeedback.details.join('\n')}
                            className="mt-3 w-full min-h-[120px] rounded-lg border border-current/20 bg-white/80 p-3 text-xs font-mono text-slate-700"
                        />
                    )}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-100" />)}
                </div>
            ) : tab === 'resources' ? (
                /* ======== Resources Table ======== */
                <div className="space-y-4">
                    {selectedResources.length > 0 && (
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm font-bold text-blue-700 ml-2">{selectedResources.length} selected</span>
                            <div className="flex-1"></div>
                            <button type="button" onClick={() => promptBulkDelete('resources')} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 py-1.5 text-xs flex items-center gap-2">
                                <Trash2 size={14} /> Delete Selected
                            </button>
                        </div>
                    )}

                    <div className=" card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="hc-table w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={resources.length > 0 && selectedResources.length === resources.length}
                                            onChange={toggleSelectAllResources}
                                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-semibold">Category</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Address</th>
                                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Partner</th>
                                    <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {resources.map(r => (
                                    <tr key={getResourceSelectionKey(r)} className={`hover:bg-slate-50 transition-colors ${selectedResources.includes(getResourceSelectionKey(r)) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedResources.includes(getResourceSelectionKey(r))}
                                                onChange={() => toggleResourceSelection(r)}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </td>
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

                    {selectedSubCategories.length > 0 && (
                        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm font-bold text-blue-700 ml-2">{selectedSubCategories.length} selected</span>
                            <div className="flex-1"></div>
                            <button type="button" onClick={() => promptBulkDelete('subcategories')} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 py-1.5 text-xs flex items-center gap-2">
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
                                            checked={subCategories.length > 0 && selectedSubCategories.length === subCategories.length}
                                            onChange={toggleSelectAllSubCategories}
                                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-semibold w-24">Type</th>
                                    <th className="px-4 py-3 font-semibold">Name</th>
                                    <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subCategories.map(sc => (
                                    <tr key={sc.id} className={`hover:bg-slate-50 transition-colors ${selectedSubCategories.includes(sc.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedSubCategories.includes(sc.id)}
                                                onChange={() => toggleSubCategorySelection(sc.id)}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </td>
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
                                {currentRole === 'super_admin'
                                    ? 'Super admins can bulk-upload any account tier.'
                                    : currentRole === 'regional_admin'
                                        ? 'Regional admins can bulk-upload partners in their region.'
                                        : 'Partners can bulk-upload users in their scope.'}
                            </p>
                        </div>
                    </div>

                    <div className=" card overflow-hidden p-0">
                        {selectedUsers.length > 0 && (
                            <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border-b border-blue-100 animate-in fade-in slide-in-from-top-2">
                                <span className="text-sm font-bold text-blue-700 ml-2">{selectedUsers.length} selected</span>
                                <div className="flex-1"></div>
                                <button type="button" onClick={() => promptBulkDelete('users')} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 py-1.5 text-xs flex items-center gap-2">
                                    <Trash2 size={14} /> Delete Selected
                                </button>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="hc-table w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-500">
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={allManageableUsersSelected}
                                                onChange={toggleSelectAllUsers}
                                                disabled={manageableUserIds.length === 0}
                                                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </th>
                                        <th className="px-4 py-3 font-semibold">User</th>
                                        <th className="px-4 py-3 font-semibold">Role</th>
                                        <th className="px-4 py-3 font-semibold w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${selectedUsers.includes(u.id) ? 'bg-blue-50/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(u.id)}
                                                    onChange={() => toggleUserSelection(u.id)}
                                                    disabled={!canManageUserRecord(u)}
                                                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-900">{u.name}</span>
                                                    <span className="text-xs text-slate-400">@{u.username} • {u.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {canEditUserRoles && u.id !== currentUser?.id ? (
                                                    <div className="relative inline-block">
                                                        <select
                                                            id={`admin-role-${u.id}`}
                                                            value={normalizeRole(u.role)}
                                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                            className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold cursor-pointer border transition-colors min-h-[36px] ${getRoleMeta(u.role).controlClassName}`}
                                                        >
                                                            {superAdminRoleOptions.map((role) => (
                                                                <option key={role} value={role}>
                                                                    {getRoleMeta(role).label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                                                    </div>
                                                ) : (
                                                    <span className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${getRoleMeta(u.role).controlClassName}`}>
                                                        {getRoleMeta(u.role).label}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {canManageUserRecord(u) ? (
                                                    <button
                                                        id={`admin-delete-user-${u.id}`}
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
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
                                <li>• Imports are processed in small batches to avoid Cloudflare worker subrequest limits.</li>
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

                        {importReport && (
                            <div
                                className={`mt-6 rounded-xl border p-4 ${importReport.type === 'success'
                                        ? 'border-green-200 bg-green-50'
                                        : importReport.type === 'warning'
                                            ? 'border-amber-200 bg-amber-50'
                                            : 'border-red-200 bg-red-50'
                                    }`}
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Import Report</h3>
                                        <p className="text-xs text-slate-600">
                                            {importReport.resourceLabel} • {importReport.fileName}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={copyImportReport} className="btn-secondary py-1.5 text-xs">Copy</button>
                                        <button type="button" onClick={downloadImportReport} className="btn-secondary py-1.5 text-xs">Download .txt</button>
                                        <button type="button" onClick={() => setImportReport(null)} className="btn-ghost py-1.5 text-xs">Clear</button>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                    <div className="rounded-lg bg-white/70 p-2 border border-slate-200">
                                        <span className="text-slate-500">Total</span>
                                        <div className="font-bold text-slate-900">{importReport.totalRows}</div>
                                    </div>
                                    <div className="rounded-lg bg-white/70 p-2 border border-slate-200">
                                        <span className="text-slate-500">Imported</span>
                                        <div className="font-bold text-green-700">{importReport.importedCount}</div>
                                    </div>
                                    <div className="rounded-lg bg-white/70 p-2 border border-slate-200">
                                        <span className="text-slate-500">Errors</span>
                                        <div className="font-bold text-red-700">{importReport.failedCount}</div>
                                    </div>
                                </div>

                                {importCopyNotice && (
                                    <p className="mt-3 text-xs font-semibold text-slate-700">{importCopyNotice}</p>
                                )}

                                {importReport.errors.length > 0 ? (
                                    <textarea
                                        readOnly
                                        value={importReport.errors.join('\n')}
                                        className="mt-3 w-full min-h-[180px] rounded-lg border border-slate-200 bg-white p-3 text-xs font-mono text-slate-700"
                                    />
                                ) : (
                                    <p className="mt-3 text-xs font-semibold text-green-700">No row-level errors.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {pendingBulkDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            {pendingBulkDelete.type === 'resources'
                                ? `Delete ${pendingBulkDelete.count} selected resource(s)?`
                                : pendingBulkDelete.type === 'users'
                                    ? `Delete ${pendingBulkDelete.count} selected user(s)?`
                                    : `Delete ${pendingBulkDelete.count} selected category item(s)?`}
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => !bulkDeleteLoading && setPendingBulkDelete(null)}
                                disabled={bulkDeleteLoading}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmBulkDelete}
                                disabled={bulkDeleteLoading}
                                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-50"
                            >
                                {bulkDeleteLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
