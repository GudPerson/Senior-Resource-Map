import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { resolveSingleSubregionByPostal } from '../lib/postalBoundaries.js';
import { getCreatableUserRoles, getRequiredManagerRole, normalizeRole } from '../lib/roles.js';

const ROLE_LABELS = {
    super_admin: 'Super Admin',
    regional_admin: 'Regional Admin',
    partner: 'Partner (Asset Owner)',
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
        managerUserId: defaultRole === 'regional_admin' ? (currentUser?.id || '') : '',
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
    const [usersList, setUsersList] = useState([]);

    const isSuperAdmin = currentRole === 'super_admin';
    const isRegionalAdmin = currentRole === 'regional_admin';
    const isPartner = currentRole === 'partner';
    const requiredManagerRole = getRequiredManagerRole(formData.role);

    useEffect(() => {
        async function loadContext() {
            try {
                const requests = [api.getSubregions()];
                if (isSuperAdmin) {
                    requests.push(api.getUsers());
                }

                const [subregions, users = []] = await Promise.all(requests);
                setSubregionsList(Array.isArray(subregions) ? subregions : []);
                setUsersList(Array.isArray(users) ? users : []);
            } catch (err) {
                console.error('Failed to load user form context:', err);
            }
        }

        loadContext();
    }, [isSuperAdmin]);

    useEffect(() => {
        if (!isSuperAdmin) {
            setFormData((prev) => ({ ...prev, managerUserId: '' }));
            return;
        }

        if (formData.role === 'regional_admin' && !formData.managerUserId) {
            setFormData((prev) => ({ ...prev, managerUserId: currentUser?.id || '' }));
            return;
        }

        if (!requiredManagerRole) {
            setFormData((prev) => ({ ...prev, managerUserId: '' }));
        }
    }, [currentUser?.id, formData.managerUserId, formData.role, isSuperAdmin, requiredManagerRole]);

    const derivedSubregionResult = useMemo(() => {
        if (normalizeRole(formData.role) === 'super_admin') {
            return { status: 'not-required', subregion: null, matches: [] };
        }

        const scopedSubregionIds = isSuperAdmin ? null : currentUser?.subregionIds;
        return resolveSingleSubregionByPostal(subregionsList, formData.postalCode, scopedSubregionIds);
    }, [currentUser?.subregionIds, formData.postalCode, formData.role, isSuperAdmin, subregionsList]);

    const managerOptions = useMemo(() => {
        if (!isSuperAdmin || !requiredManagerRole) return [];
        return usersList
            .filter((candidate) => normalizeRole(candidate.role) === requiredManagerRole)
            .filter((candidate) => candidate.id !== currentUser?.id || requiredManagerRole === 'super_admin');
    }, [currentUser?.id, isSuperAdmin, requiredManagerRole, usersList]);

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
                    throw new Error('Postal code does not match any configured subregion boundary.');
                }
                if (derivedSubregionResult.status === 'ambiguous') {
                    throw new Error('Postal code matches multiple subregions. Fix the boundary data before creating this user.');
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

            if (isSuperAdmin && requiredManagerRole) {
                if (!formData.managerUserId) {
                    throw new Error(`${ROLE_LABELS[formData.role]} accounts require an assigned manager.`);
                }
                payload.managerUserId = Number.parseInt(String(formData.managerUserId), 10);
            }

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
        <div className="card p-6 max-w-lg mx-auto mb-8 border border-slate-200">
            <h2 className="text-xl font-bold mb-4">Create New Account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium opacity-70">Username</label>
                        <input
                            type="text"
                            required
                            className="input-field w-full mt-1"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="johndoe123"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium opacity-70">Full Name</label>
                        <input
                            type="text"
                            required
                            className="input-field w-full mt-1"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium opacity-70">Email Address</label>
                        <input
                            type="email"
                            required
                            className="input-field w-full mt-1"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium opacity-70">Contact Number</label>
                        <input
                            type="text"
                            className="input-field w-full mt-1"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+65 9XXX XXXX"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium opacity-70">Postal Code{normalizeRole(formData.role) !== 'super_admin' ? ' *' : ''}</label>
                    <input
                        type="text"
                        required={normalizeRole(formData.role) !== 'super_admin'}
                        className="input-field w-full mt-1"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="680153"
                    />
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                        {normalizeRole(formData.role) === 'super_admin' ? (
                            <span className="text-slate-500">Super Admin accounts are global and are not auto-routed to a subregion.</span>
                        ) : derivedSubregionResult.status === 'ok' ? (
                            <span className="text-green-700 font-medium">Derived subregion: {derivedSubregionLabel}</span>
                        ) : derivedSubregionResult.status === 'ambiguous' ? (
                            <span className="text-amber-700">Postal code matches multiple subregions. Boundary data needs cleanup.</span>
                        ) : derivedSubregionResult.status === 'missing' ? (
                            <span className="text-red-700">Postal code does not match any configured subregion boundary.</span>
                        ) : (
                            <span className="text-slate-500">Enter a valid 6-digit postal code to derive the user&apos;s subregion automatically.</span>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium opacity-70">Temporary Password</label>
                    <input
                        type="password"
                        required
                        className="input-field w-full mt-1"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium opacity-70">Role</label>
                    <select
                        className="input-field w-full mt-1"
                        disabled={!isSuperAdmin}
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                        {creatableRoles.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                        ))}
                    </select>
                </div>

                {isSuperAdmin && requiredManagerRole ? (
                    <div>
                        <label className="block text-sm font-medium opacity-70">Managed By ({ROLE_LABELS[requiredManagerRole]})</label>
                        <select
                            className="input-field w-full mt-1"
                            value={formData.managerUserId}
                            onChange={(e) => setFormData({ ...formData, managerUserId: e.target.value })}
                        >
                            <option value="">Select manager</option>
                            {managerOptions.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} (@{candidate.username})
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}

                {!isSuperAdmin ? (
                    <div className="bg-slate-50 p-3 rounded-xl text-sm border border-slate-100">
                        <span className="opacity-60">Ownership:</span>
                        <div className="mt-2 font-medium text-slate-700">
                            {isRegionalAdmin ? 'New partner will be managed directly by this regional admin account.' : null}
                            {isPartner ? 'New user will be managed directly by this partner account.' : null}
                        </div>
                    </div>
                ) : null}

                {(isRegionalAdmin || isPartner) && (
                    <p className="text-xs text-slate-500">
                        {isRegionalAdmin ? 'Regional admins can create Partner accounts only.' : 'Partners can create User accounts only.'}
                    </p>
                )}

                {message && (
                    <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full py-2">
                    {loading ? 'Creating...' : 'Create Account'}
                </button>
            </form>
        </div>
    );
}
