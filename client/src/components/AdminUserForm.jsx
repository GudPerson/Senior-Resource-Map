import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { resolveSingleSubregionByPostal } from '../lib/postalBoundaries.js';
import { getCreatableUserRoles, normalizeRole } from '../lib/roles.js';
import { Shield, MapPin, Database } from 'lucide-react';

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    regional_admin: 'Admin',
    standard: 'User',
};

function buildInitialForm(defaultRole, currentUser) {
    return {
        username: '',
        name: '',
        email: '',
        password: '',
        phone: '',
        postalCode: '',
        role: defaultRole,
    };
}

export default function AdminUserForm({ currentUser, onCreated }) {
    const currentRole = normalizeRole(currentUser?.role);
    const creatableRoles = getCreatableUserRoles(currentRole);
    const defaultRole = creatableRoles[0] || 'standard';
    const [formData, setFormData] = useState(() => buildInitialForm(defaultRole, currentUser));
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [subregionsList, setSubregionsList] = useState([]);

    const isSuperAdmin = currentRole === 'super_admin';
    const isRegionalAdmin = currentRole === 'regional_admin';

    useEffect(() => {
        async function loadContext() {
            try {
                const subregions = await api.getSubregions();
                setSubregionsList(Array.isArray(subregions) ? subregions : []);
            } catch (err) {
                console.error('Failed to load user form context:', err);
            }
        }

        loadContext();
    }, []);

    const derivedSubregionResult = useMemo(() => {
        if (normalizeRole(formData.role) === 'super_admin') {
            return { status: 'not-required', subregion: null, matches: [] };
        }

        const scopedSubregionIds = isSuperAdmin ? null : currentUser?.subregionIds;
        return resolveSingleSubregionByPostal(subregionsList, formData.postalCode, scopedSubregionIds);
    }, [currentUser?.subregionIds, formData.postalCode, formData.role, isSuperAdmin, subregionsList]);

    const derivedSubregionLabel = derivedSubregionResult.subregion
        ? `${derivedSubregionResult.subregion.subregionCode || 'No code'} · ${derivedSubregionResult.subregion.name}`
        : null;

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!creatableRoles.includes(formData.role)) {
                throw new Error('You cannot create that role.');
            }

            if (normalizeRole(formData.role) !== 'super_admin' && derivedSubregionResult.status !== 'ok') {
                if (derivedSubregionResult.status === 'missing') {
                    throw new Error('Postal code does not match any configured region boundary.');
                }
                if (derivedSubregionResult.status === 'ambiguous') {
                    throw new Error('Postal code matches multiple regions. Fix the boundary data before creating this user.');
                }
                throw new Error('Postal code must be a valid 6-digit code.');
            }

            const payload = {
                username: formData.username,
                name: formData.name,
                email: formData.email,
                password: formData.password,
                phone: formData.phone,
                postalCode: formData.postalCode,
                role: formData.role,
            };

            await api.createUser(payload);
            setMessage({ type: 'success', text: 'User created successfully.' });
            setFormData(buildInitialForm(defaultRole, currentUser));
            if (typeof onCreated === 'function') {
                await onCreated();
            }
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to create user' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="card p-8 max-w-xl mx-auto mb-8 border border-slate-200 shadow-xl rounded-3xl bg-white">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                    <Shield size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">Create New Account</h2>
                    <p className="text-slate-500">Provision specialized access for team members</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                        <input
                            type="text"
                            required
                            className="input-field w-full"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="johndoe123"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="input-field w-full"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="input-field w-full"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Number</label>
                        <input
                            type="text"
                            className="input-field w-full"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+65 9XXX XXXX"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Postal Code{normalizeRole(formData.role) !== 'super_admin' ? ' *' : ''}</label>
                    <input
                        type="text"
                        required={normalizeRole(formData.role) !== 'super_admin'}
                        className="input-field w-full"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="680153"
                    />
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed">
                        {normalizeRole(formData.role) === 'super_admin' ? (
                            <span className="text-slate-500 font-medium flex items-center gap-2">
                                <Database size={14} className="text-slate-400" />
                                Global account - no region assignment required.
                            </span>
                        ) : derivedSubregionResult.status === 'ok' ? (
                            <span className="text-green-700 font-bold flex items-center gap-2">
                                <MapPin size={14} />
                                Derived region: {derivedSubregionLabel}
                            </span>
                        ) : derivedSubregionResult.status === 'ambiguous' ? (
                            <span className="text-amber-700 font-medium">Postal code matches multiple regions. Boundary data needs cleanup.</span>
                        ) : derivedSubregionResult.status === 'missing' ? (
                            <span className="text-red-700 font-medium">Postal code does not match any configured region boundary.</span>
                        ) : (
                            <span className="text-slate-500 font-medium italic">Enter a valid 6-digit postal code to resolve region automatically.</span>
                        )}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Temporary Password</label>
                    <input
                        type="password"
                        required
                        className="input-field w-full"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Role</label>
                        <select
                            className="input-field w-full"
                            disabled={!isSuperAdmin}
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            {creatableRoles.map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                            ))}
                        </select>
                    </div>

                    {normalizeRole(formData.role) === 'super_admin' ? (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Support Coverage</label>
                            <div className="input-field w-full bg-slate-50 text-slate-500 italic flex items-center">Platform-wide</div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Support Coverage</label>
                            <div className="input-field w-full bg-slate-50 text-slate-500 flex items-center">
                                {derivedSubregionResult.status === 'ok'
                                    ? 'Covered by matching Admin Region Scope'
                                    : 'Resolved after a valid postal region is set'}
                            </div>
                        </div>
                    )}
                </div>

                {!isSuperAdmin ? (
                    <div className="bg-brand-50/50 p-4 rounded-2xl text-sm border border-brand-100/50">
                        <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Support Context</span>
                        <div className="mt-2 font-medium text-slate-700 leading-relaxed">
                            {isRegionalAdmin ? 'This User account will appear inside your Admin scope when the postal region is inside your assigned regions.' : null}
                        </div>
                    </div>
                ) : null}

                {message && (
                    <div className={`p-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-1 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {message.text}
                    </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-lg h-auto">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2">
                             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                             <span>Provisioning Account...</span>
                        </div>
                    ) : 'Create Account'}
                </button>
            </form>
        </div>
    );
}
