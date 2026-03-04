import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function AdminUserForm({ currentUser }) {
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        email: '',
        password: '',
        phone: '',
        role: currentUser?.role === 'regional_admin' ? 'partner' : 'standard',
        subregionId: currentUser?.subregionId || ''
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [subregionsList, setSubregionsList] = useState([]);

    useEffect(() => {
        async function loadSubregions() {
            try {
                const data = await api.getSubregions();
                setSubregionsList(data);
            } catch (err) {
                console.error('Failed to load subregions:', err);
            }
        }
        loadSubregions();
    }, []);

    const isRegionalAdmin = currentUser?.role === 'regional_admin';
    const isSuperAdmin = currentUser?.role === 'super_admin';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Validation: regional_admin can only create partners
            if (isRegionalAdmin && formData.role !== 'partner') {
                throw new Error('Regional admins can only create Partner accounts.');
            }

            await api.createUser(formData);
            setMessage({ type: 'success', text: 'User created successfully!' });
            setFormData({
                username: '',
                name: '',
                email: '',
                password: '',
                phone: '',
                role: isRegionalAdmin ? 'partner' : 'standard',
                subregionId: currentUser?.subregionId || ''
            });
        } catch (err) {
            setMessage({ type: 'error', text: err.message || 'Failed to create user' });
        } finally {
            setLoading(false);
        }
    };

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
                            onChange={e => setFormData({ ...formData, username: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium opacity-70">Contact Number</label>
                        <input
                            type="text"
                            className="input-field w-full mt-1"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+65 9XXX XXXX"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium opacity-70">Temporary Password</label>
                    <input
                        type="password"
                        required
                        className="input-field w-full mt-1"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium opacity-70">Role</label>
                    <select
                        className="input-field w-full mt-1"
                        disabled={isRegionalAdmin}
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                    >
                        {isSuperAdmin && (
                            <>
                                <option value="super_admin">Super Admin</option>
                                <option value="regional_admin">Regional Admin</option>
                                <option value="standard">Standard User</option>
                            </>
                        )}
                        <option value="partner">Partner (Asset Owner)</option>
                    </select>
                </div>

                {isSuperAdmin ? (
                    <div>
                        <label className="block text-sm font-medium opacity-70">Subregion Scope</label>
                        <select
                            className="input-field w-full mt-1"
                            required={formData.role === 'regional_admin' || formData.role === 'partner'}
                            value={formData.subregionId}
                            onChange={e => setFormData({ ...formData, subregionId: e.target.value })}
                        >
                            <option value="">Global (No Scope)</option>
                            {subregionsList.map(reg => (
                                <option key={reg.id} value={reg.id}>
                                    {reg.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs opacity-50 mt-1">Required for Regional Admins and Partners.</p>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-3 rounded-xl text-sm mb-4 border border-slate-100">
                        <span className="opacity-60">Subregion locked to:</span>
                        <strong className="ml-2 text-slate-800">
                            {subregionsList.find(r => r.id === parseInt(currentUser?.subregionId))?.name || 'Assigned Region'}
                        </strong>
                    </div>
                )}

                {message && (
                    <div className={`p-3 rounded text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-2"
                >
                    {loading ? 'Creating...' : 'Create Account'}
                </button>
            </form>
        </div>
    );
}
