import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { User, Phone, Lock, CheckCircle } from 'lucide-react';
import {
    GENDER_OPTIONS,
    PROPERTY_TYPE_OPTIONS,
    getProfileFieldLabel,
} from '../../lib/profileAttributes.js';

function normalizeReturnTo(value) {
    const text = String(value || '').trim();
    if (!text || !text.startsWith('/') || text.startsWith('//')) return '';
    return text;
}

export default function ProfilePage() {
    const { user, login } = useAuth();
    const location = useLocation();
    const [form, setForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        postalCode: user?.postalCode || '',
        dateOfBirth: user?.dateOfBirth || '',
        gender: user?.gender || '',
        propertyType: user?.propertyType || '',
        password: '',
        confirmPassword: '',
    });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const searchParams = new URLSearchParams(location.search);
    const isEligibilityPrompt = searchParams.get('eligibility') === '1';
    const returnTo = normalizeReturnTo(searchParams.get('returnTo'));
    const missingEligibilityFields = [
        !form.dateOfBirth ? 'dateOfBirth' : null,
        !form.gender ? 'gender' : null,
        !form.propertyType ? 'propertyType' : null,
    ].filter(Boolean);

    function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

    useEffect(() => {
        setForm((current) => ({
            ...current,
            name: user?.name || '',
            phone: user?.phone || '',
            postalCode: user?.postalCode || '',
            dateOfBirth: user?.dateOfBirth || '',
            gender: user?.gender || '',
            propertyType: user?.propertyType || '',
        }));
    }, [user?.dateOfBirth, user?.gender, user?.name, user?.phone, user?.postalCode, user?.propertyType]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.password && form.password !== form.confirmPassword) {
            return setError('Passwords do not match.');
        }
        setSaving(true); setError(''); setSuccess(false);
        try {
            const updates = {
                name: form.name,
                phone: form.phone,
                postalCode: form.postalCode,
                dateOfBirth: form.dateOfBirth || null,
                gender: form.gender || null,
                propertyType: form.propertyType || null,
            };
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
            <p className="text-slate-500 mb-6">Update your details and contact information.</p>

            {user?.needsPostalCode ? (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Add your postal code to personalize nearby results and unlock any partner-boundary offerings you qualify for.
                </div>
            ) : null}

            {isEligibilityPrompt ? (
                <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                    Complete your profile details to check whether you qualify for locked offerings.
                    {returnTo ? (
                        <span className="ml-2">
                            <Link to={returnTo} className="font-semibold underline">
                                Return to the offering
                            </Link>
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className=" card shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><User size={13} className="inline mr-1" />Name</label>
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
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Postal Code {user?.role === 'standard' ? '(recommended)' : ''}</label>
                        <input id="profile-postal-code" type="text" value={form.postalCode} onChange={set('postalCode')} placeholder="680153" className=" input-field" autoComplete="postal-code" />
                        <p className="text-xs text-slate-400 mt-1">Optional. Used to check whether you are inside the postal-code boundary assigned to your subregion.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Eligibility profile</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    These details help determine whether you qualify for restricted offerings.
                                </p>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${missingEligibilityFields.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                                {missingEligibilityFields.length ? `${missingEligibilityFields.length} field${missingEligibilityFields.length === 1 ? '' : 's'} missing` : 'Complete'}
                            </div>
                        </div>

                        {missingEligibilityFields.length ? (
                            <p className="mt-3 text-xs text-amber-700">
                                Missing: {missingEligibilityFields.map((field) => getProfileFieldLabel(field)).join(', ')}
                            </p>
                        ) : null}

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Date of birth</label>
                                <input id="profile-dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                                <select id="profile-gender" value={form.gender} onChange={set('gender')} className="input-field">
                                    <option value="">Select gender</option>
                                    {GENDER_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Property type</label>
                                <select id="profile-property-type" value={form.propertyType} onChange={set('propertyType')} className="input-field">
                                    <option value="">Select property type</option>
                                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
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
