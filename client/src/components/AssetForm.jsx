import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { Loader2, Globe, MapPin, Phone, Clock, FileText } from 'lucide-react';
import { api } from '../lib/api.js';
import ImageUpload from './ImageUpload.jsx';

export default function AssetForm({ type = 'hard', initialData, onSave, onCancel, partnerHardAssets = [] }) {
    const isHard = type === 'hard';

    const [form, setForm] = useState(() => {
        const fmtDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        };
        if (initialData) return {
            ...initialData,
            newTags: initialData.tags || [],
            locationIds: initialData.locations?.map(l => l.id) || (initialData.locationId ? [initialData.locationId] : []),
            hideFrom: fmtDate(initialData.hideFrom),
            hideUntil: fmtDate(initialData.hideUntil)
        };
        return isHard ? {
            name: '', subCategory: 'Places', country: 'SG', postalCode: '', address: '', phone: '', hours: '', description: '', logoUrl: '', bannerUrl: '', newTags: [], isHidden: false, hideFrom: '', hideUntil: ''
        } : {
            name: '', subCategory: 'Programmes', locationIds: [], description: '', schedule: '', logoUrl: '', bannerUrl: '', newTags: [], isMemberOnly: false, isHidden: false, hideFrom: '', hideUntil: ''
        };
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [availableTags, setAvailableTags] = useState([]);
    const [availableSubCategories, setAvailableSubCategories] = useState([]);

    // Fetch existing tags and subcategories
    useEffect(() => {
        api.searchTags('').then(tags => {
            setAvailableTags(tags.map(t => ({ value: t, label: t })));
        }).catch(console.error);
        api.getSubCategories().then(setAvailableSubCategories).catch(console.error);
    }, []);

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = { ...form };
            if (payload.hideFrom) payload.hideFrom = new Date(payload.hideFrom).toISOString();
            if (payload.hideUntil) payload.hideUntil = new Date(payload.hideUntil).toISOString();
            if (!isHard) {
                payload.locationIds = form.locationIds || [];
            }
            if (initialData?.id) {
                isHard ? await api.updateHardAsset(initialData.id, payload) : await api.updateSoftAsset(initialData.id, payload);
            } else {
                isHard ? await api.createHardAsset(payload) : await api.createSoftAsset(payload);
            }
            onSave();
        } catch (err) {
            setError(err.message || 'Failed to save asset');
            setSaving(false);
        }
    };

    const tagOptions = availableTags;
    const currentTags = form.newTags.map(t => ({ value: t, label: t }));

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
                {/* Media */}
                <div className="col-span-2 grid grid-cols-2 gap-4">
                    <ImageUpload
                        label="Logo / Icon"
                        value={form.logoUrl}
                        onChange={(url) => setField('logoUrl', url)}
                    />
                    <ImageUpload
                        label="Hero Banner"
                        value={form.bannerUrl}
                        onChange={(url) => setField('bannerUrl', url)}
                    />
                </div>

                <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                    <input required value={form.name} onChange={e => setField('name', e.target.value)} placeholder={isHard ? "Place name" : "Offering name"} className="input-field" />
                </div>

                {/* Soft Asset: Location Dropdown */}
                {!isHard && (
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-Category *</label>
                            <select required value={form.subCategory || 'Programmes'} onChange={e => setField('subCategory', e.target.value)} className="input-field">
                                {availableSubCategories.filter(sc => sc.type === 'soft').map(sc => (
                                    <option key={sc.id} value={sc.name}>{sc.name}</option>
                                ))}
                                {availableSubCategories.filter(sc => sc.type === 'soft').length === 0 && (
                                    <optgroup label="Default">
                                        <option value="Programmes">Programmes</option>
                                        <option value="Services">Services</option>
                                        <option value="Promotions">Promotions</option>
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Host Locations (Optional)</label>
                            <Select
                                isMulti
                                options={partnerHardAssets.map(ha => ({ value: ha.id, label: `${ha.name} (${ha.address})` }))}
                                value={form.locationIds?.map(id => {
                                    const matched = partnerHardAssets.find(ha => ha.id === id);
                                    return matched ? { value: id, label: `${matched.name} (${matched.address})` } : null;
                                }).filter(Boolean) || []}
                                onChange={(selected) => setField('locationIds', selected.map(s => s.value))}
                                className="react-select-container"
                                classNamePrefix="react-select"
                                placeholder="Select places..."
                            />
                        </div>
                    </div>
                )}


                {/* Hard Asset: Fields */}
                {isHard && (
                    <>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Sub-Category *</label>
                            <select required value={form.subCategory || 'Places'} onChange={e => setField('subCategory', e.target.value)} className="input-field">
                                {availableSubCategories.filter(sc => sc.type === 'hard').map(sc => (
                                    <option key={sc.id} value={sc.name}>{sc.name}</option>
                                ))}
                                {availableSubCategories.filter(sc => sc.type === 'hard').length === 0 && (
                                    <optgroup label="Default">
                                        <option value="Active Ageing Centres">Active Ageing Centres</option>
                                        <option value="Community Hospitals">Community Hospitals</option>
                                        <option value="Gyms">Gyms</option>
                                    </optgroup>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Globe size={13} className="inline mr-1" />Country *</label>
                            <select required value={form.country} onChange={e => setField('country', e.target.value)} className="input-field">
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="SG">Singapore</option>
                                <option value="MY">Malaysia</option>
                                <option value="IN">India</option>
                                <option value="PH">Philippines</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Postal Code *</label>
                            <input required value={form.postalCode} onChange={e => setField('postalCode', e.target.value)} placeholder="60612" className="input-field" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><MapPin size={13} className="inline mr-1" />Street Address *</label>
                            <input required value={form.address} onChange={e => setField('address', e.target.value)} placeholder="123 Main St, Region" className="input-field" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Phone size={13} className="inline mr-1" />Phone</label>
                            <input type="tel" value={form.phone || ''} onChange={e => setField('phone', e.target.value)} placeholder="(312) 555-0000" className="input-field" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1"><Clock size={13} className="inline mr-1" />Hours</label>
                            <input value={form.hours || ''} onChange={e => setField('hours', e.target.value)} placeholder="Mon–Fri 9am–5pm" className="input-field" />
                        </div>
                    </>
                )}

                {/* Soft Asset: Schedule Field */}
                {!isHard && (
                    <div className="col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1"><Clock size={13} className="inline mr-1" />Schedule</label>
                        <input value={form.schedule || ''} onChange={e => setField('schedule', e.target.value)} placeholder="e.g. Every Tuesday at 10 AM" className="input-field" />
                    </div>
                )}

                {/* Description */}
                <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1"><FileText size={13} className="inline mr-1" />Description</label>
                    <textarea rows={3} value={form.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Brief description of the service or location..." className="input-field resize-none" />
                </div>

                {/* Dynamic Tags */}
                <div className="col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tags (Press enter to add)</label>
                    <CreatableSelect
                        isMulti
                        options={tagOptions}
                        value={currentTags}
                        onChange={(selected) => setField('newTags', selected.map(s => s.value))}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Search or create tags..."
                    />
                </div>
            </div>

            {/* Visibility Settings */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-6 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Globe size={16} className="text-brand-600" />
                    Visibility Settings
                </h3>

                {!isHard && (
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Member Only</p>
                            <p className="text-xs text-slate-500">Require users to be logged in to view this offering</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={form.isMemberOnly} onChange={e => setField('isMemberOnly', e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                        </label>
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-700">Hide from App</p>
                        <p className="text-xs text-slate-500">Temporarily or permanently remove from discovery</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={form.isHidden} onChange={e => setField('isHidden', e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Hide (From)</label>
                        <input type="datetime-local" value={form.hideFrom} onChange={e => setField('hideFrom', e.target.value)} className="input-field text-sm p-2" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Hide (Until)</label>
                        <input type="datetime-local" value={form.hideUntil} onChange={e => setField('hideUntil', e.target.value)} className="input-field text-sm p-2" />
                    </div>
                </div>
            </div>

            {isHard && <p className="text-xs text-slate-400">📍 Map coordinates are parsed automatically from country + postal code.</p>}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onCancel} className="btn-ghost flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Asset'}
                </button>
            </div>
        </form >
    );
}
