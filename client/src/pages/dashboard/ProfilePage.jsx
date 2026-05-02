import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { api } from '../../lib/api.js';
import { User, Phone, Lock, CheckCircle, Link2, MapPin } from 'lucide-react';
import {
    CHAS_CARD_OPTIONS,
    GENDER_OPTIONS,
    PROPERTY_TYPE_OPTIONS,
    YES_NO_OPTIONS,
    getProfileFieldLabel,
} from '../../lib/profileAttributes.js';

function normalizeReturnTo(value) {
    const text = String(value || '').trim();
    if (!text || !text.startsWith('/') || text.startsWith('//')) return '';
    return text;
}

const PROFILE_FIELD_I18N_KEYS = {
    dateOfBirth: 'dateOfBirth',
    chasCard: 'chasCard',
    caregiverStatus: 'caregiverStatus',
    gender: 'gender',
    propertyType: 'propertyType',
    volunteerInterest: 'volunteerInterest',
};

const PROFILE_OPTION_I18N_KEYS = {
    male: 'optionMale',
    female: 'optionFemale',
    green: 'optionGreen',
    orange: 'optionOrange',
    blue: 'optionBlue',
    yes: 'optionYes',
    no: 'optionNo',
    hdb_1_2_room: 'propertyHdb12',
    hdb_3_room: 'propertyHdb3',
    hdb_4_room: 'propertyHdb4',
    hdb_5_room_exec: 'propertyHdb5Exec',
    condominium: 'propertyCondominium',
    landed: 'propertyLanded',
    rental: 'propertyRental',
    other: 'propertyOther',
};

function profileFieldLabel(field, t) {
    const key = PROFILE_FIELD_I18N_KEYS[field];
    return key ? t(key) : getProfileFieldLabel(field);
}

function profileOptionLabel(option, t) {
    const key = PROFILE_OPTION_I18N_KEYS[option.value];
    return key ? t(key) : option.label;
}

export default function ProfilePage() {
    const { user, login } = useAuth();
    const { t } = useLocale();
    const location = useLocation();
    const [linkedPlaces, setLinkedPlaces] = useState([]);
    const [linkedPlacesLoading, setLinkedPlacesLoading] = useState(true);
    const [linkedPlacesError, setLinkedPlacesError] = useState('');
    const [form, setForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        postalCode: user?.postalCode || '',
        dateOfBirth: user?.dateOfBirth || '',
        chasCard: user?.chasCard || '',
        caregiverStatus: user?.caregiverStatus || '',
        gender: user?.gender || '',
        propertyType: user?.propertyType || '',
        volunteerInterest: user?.volunteerInterest || '',
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
        !form.chasCard ? 'chasCard' : null,
        !form.caregiverStatus ? 'caregiverStatus' : null,
        !form.gender ? 'gender' : null,
        !form.propertyType ? 'propertyType' : null,
        !form.volunteerInterest ? 'volunteerInterest' : null,
    ].filter(Boolean);

    function set(key) { return e => setForm(f => ({ ...f, [key]: e.target.value })); }

    useEffect(() => {
        setForm((current) => ({
            ...current,
            name: user?.name || '',
            phone: user?.phone || '',
            postalCode: user?.postalCode || '',
            dateOfBirth: user?.dateOfBirth || '',
            chasCard: user?.chasCard || '',
            caregiverStatus: user?.caregiverStatus || '',
            gender: user?.gender || '',
            propertyType: user?.propertyType || '',
            volunteerInterest: user?.volunteerInterest || '',
        }));
    }, [user?.caregiverStatus, user?.chasCard, user?.dateOfBirth, user?.gender, user?.name, user?.phone, user?.postalCode, user?.propertyType, user?.volunteerInterest]);

    useEffect(() => {
        let cancelled = false;

        async function loadLinkedPlaces() {
            if (!user?.id) {
                setLinkedPlaces([]);
                setLinkedPlacesLoading(false);
                return;
            }

            setLinkedPlacesLoading(true);
            setLinkedPlacesError('');
            try {
                const data = await api.getMyMemberships();
                if (!cancelled) {
                    setLinkedPlaces(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                if (!cancelled) {
                    setLinkedPlaces([]);
                    setLinkedPlacesError(err.message || t('linkedPlacesFailed'));
                }
            } finally {
                if (!cancelled) {
                    setLinkedPlacesLoading(false);
                }
            }
        }

        loadLinkedPlaces();
        return () => {
            cancelled = true;
        };
    }, [t, user?.id]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (form.password && form.password !== form.confirmPassword) {
            return setError(t('passwordMismatch'));
        }
        setSaving(true); setError(''); setSuccess(false);
        try {
            const updates = {
                name: form.name,
                phone: form.phone,
                postalCode: form.postalCode,
                dateOfBirth: form.dateOfBirth || null,
                chasCard: form.chasCard || null,
                caregiverStatus: form.caregiverStatus || null,
                gender: form.gender || null,
                propertyType: form.propertyType || null,
                volunteerInterest: form.volunteerInterest || null,
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
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{t('profileTitle')}</h1>
            <p className="text-slate-500 mb-6">{t('profileSubtitle')}</p>

            {user?.needsPostalCode ? (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {t('profileNeedsPostal')}
                </div>
            ) : null}

            {isEligibilityPrompt ? (
                <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                    {t('profileEligibilityPrompt')}
                    {returnTo ? (
                        <span className="ml-2">
                            <Link to={returnTo} className="font-semibold underline">
                                {t('returnToOffering')}
                            </Link>
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className=" card shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><User size={13} className="inline mr-1" />{t('name')}</label>
                        <input id="profile-name" required value={form.name} onChange={set('name')} className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('emailAddress')}</label>
                        <input type="email" value={user?.email} disabled className="input-field bg-slate-50 text-slate-400 cursor-not-allowed" />
                        <p className="text-xs text-slate-400 mt-1">{t('emailCannotChange')}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><Phone size={13} className="inline mr-1" />{t('phoneNumber')}</label>
                        <input id="profile-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="(312) 555-0000" className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{user?.role === 'standard' ? t('postalCodeRecommended') : t('postalCode')}</label>
                        <input id="profile-postal-code" type="text" value={form.postalCode} onChange={set('postalCode')} placeholder="680153" className=" input-field" autoComplete="postal-code" />
                        <p className="text-xs text-slate-400 mt-1">{t('profilePostalHelp')}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{t('profilePersonaliseTitle')}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {t('profilePersonaliseBody')}
                                </p>
                            </div>
                            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${missingEligibilityFields.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                                {missingEligibilityFields.length
                                    ? t(missingEligibilityFields.length === 1 ? 'optionalDetailCount' : 'optionalDetailsCount', { count: missingEligibilityFields.length })
                                    : t('complete')}
                            </div>
                        </div>

                        {missingEligibilityFields.length ? (
                            <div className="mt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t('profilePersonalisePrompt')}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {missingEligibilityFields.map((field) => (
                                        <span
                                            key={field}
                                            className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                                        >
                                            {profileFieldLabel(field, t)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('dateOfBirth')}</label>
                                <input id="profile-dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('chasCard')}</label>
                                <select id="profile-chas-card" value={form.chasCard} onChange={set('chasCard')} className="input-field">
                                    <option value="">{t('selectChasCard')}</option>
                                    {CHAS_CARD_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{profileOptionLabel(option, t)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('gender')}</label>
                                <select id="profile-gender" value={form.gender} onChange={set('gender')} className="input-field">
                                    <option value="">{t('selectGender')}</option>
                                    {GENDER_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{profileOptionLabel(option, t)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('propertyType')}</label>
                                <select id="profile-property-type" value={form.propertyType} onChange={set('propertyType')} className="input-field">
                                    <option value="">{t('selectPropertyType')}</option>
                                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{profileOptionLabel(option, t)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('caregiverQuestion')}</label>
                                <select id="profile-caregiver-status" value={form.caregiverStatus} onChange={set('caregiverStatus')} className="input-field">
                                    <option value="">{t('selectOption')}</option>
                                    {YES_NO_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{profileOptionLabel(option, t)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('volunteerQuestion')}</label>
                                <select id="profile-volunteer-interest" value={form.volunteerInterest} onChange={set('volunteerInterest')} className="input-field">
                                    <option value="">{t('selectOption')}</option>
                                    {YES_NO_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{profileOptionLabel(option, t)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <hr className="border-slate-100" />
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide"><Lock size={13} className="inline mr-1" />{t('changePasswordOptional')}</p>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('newPassword')}</label>
                        <input id="profile-password" type="password" value={form.password} onChange={set('password')} placeholder={t('leaveBlankPassword')} className=" input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">{t('confirmNewPassword')}</label>
                        <input id="profile-confirm-password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder={t('repeatNewPassword')} className=" input-field" />
                    </div>

                    {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                            <CheckCircle size={16} /> {t('profileUpdated')}
                        </div>
                    )}

                    <button id="profile-save" type="submit" disabled={saving} className=" btn-primary w-full justify-center">
                        {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : t('saveChanges')}
                    </button>
                </form>
            </div>

            <div className="card mt-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{t('linkedPlaces')}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {t('linkedPlacesDescription')}
                        </p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${linkedPlaces.length ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                        {t('linkedCount', { count: linkedPlaces.length })}
                    </div>
                </div>

                {linkedPlacesLoading ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        {t('loadingLinkedPlaces')}
                    </div>
                ) : linkedPlacesError ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                        {linkedPlacesError}
                    </div>
                ) : linkedPlaces.length ? (
                    <div className="mt-4 space-y-3">
                        {linkedPlaces.map((membership) => (
                            <div key={membership.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <Link2 size={14} className="text-brand-600" />
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                {membership.place?.name || t('unknownPlace')}
                                            </p>
                                        </div>
                                        {membership.place?.address ? (
                                            <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                                                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                                                <span>{membership.place.address}</span>
                                            </p>
                                        ) : null}
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {membership.place?.subCategory ? (
                                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                    {membership.place.subCategory}
                                                </span>
                                            ) : null}
                                            {membership.place?.partnerName ? (
                                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                                    {membership.place.partnerName}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-700">
                                            {String(membership.status || 'ACTIVE').replace(/_/g, ' ')}
                                        </span>
                                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                            {membership.joinMethod === 'QR_CODE' ? t('qrLink') : membership.joinMethod}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        {t('noLinkedPlacesYet')}
                    </div>
                )}
            </div>
        </div>
    );
}
