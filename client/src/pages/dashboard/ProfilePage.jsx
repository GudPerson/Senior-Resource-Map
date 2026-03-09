import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { User, Phone, Lock, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
    const { user, login } = useAuth();
    const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', postalCode: user?.postalCode || '', password: '', confirmPassword: '' });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.password && form.password !== form.confirmPassword) {
            return setError('Passwords do not match.');
        }
        setSaving(true); setError(''); setSuccess(false);
        try {
            const updates = { name: form.name, phone: form.phone, postalCode: form.postalCode };
            if (form.password) updates.password = form.password;
            const updated = await api.updateMe(updates);
            login({ ...user, ...updated });
            setSuccess(true);
            setForm(f => ({ ...f, password: '', confirmPassword: '' }));
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-6 lg:p-8 max-w-xl">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">My Profile</h1>
            <p className="text-slate-500 mb-6">Update your organisation details and contact information.</p>

            <div className=" card shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><User size={13} className="inline mr-1" />Organisation Name</label>
                        <input id="profile-name" required value={form.name} onChange={set('name')} className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
                        <input type="email" value={user?.email} disabled className="input-field bg-slate-50 text-slate-400 cursor-not-allowed" />
                        <p className="text-xs text-slate-400 mt-1">Email cannot be changed after registration.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><Phone size={13} className="inline mr-1" />Phone Number</label>
                        <input id="profile-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(312) 555-0000" className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Postal Code</label>
                        <input id="profile-postal-code" type="text" value={form.postalCode} onChange={set('postalCode')} placeholder="680153" className=" input-field" />
                        <p className="text-xs text-slate-400 mt-1">Optional. Used to check whether you are inside your assigned service boundary.</p>
                    </div>

                    <hr className="border-slate-100" />
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide"><Lock size={13} className="inline mr-1" />Change Password (optional)</p>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">New Password</label>
                        <input id="profile-password" type="password" value={form.password} onChange={set('password')} placeholder="Leave blank to keep current" className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Confirm New Password</label>
                        <input id="profile-confirm-password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat new password" className=" input-field" />
                    </div>

                    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                            <CheckCircle size={16} /> Profile updated successfully!
                        </div>
                    )}

                    <button id="profile-save" type="submit" disabled={saving} className=" btn-primary w-full justify-center">
                        {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
