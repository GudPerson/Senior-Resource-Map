import { useState } from 'react';
import { Building2, CheckCircle2, ShieldCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

import BrandLockup from '../components/layout/BrandLockup.jsx';
import { api } from '../lib/api.js';

const EMPTY_ORGANIZATION = {
    organizationName: '',
    emailDomain: '',
    websiteUrl: '',
    applicantName: '',
    applicantEmail: '',
    logoUrl: '',
    bannerUrl: '',
    termsAccepted: false,
    digitalAssetUseGranted: false,
};

const EMPTY_JOIN = { email: '', name: '', password: '', termsAccepted: false };

export default function OrganizationOnboardingPage({ mode = 'organization' }) {
    const isJoin = mode === 'join';
    const [form, setForm] = useState(isJoin ? EMPTY_JOIN : EMPTY_ORGANIZATION);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    function set(key) {
        return (event) => setForm((current) => ({
            ...current,
            [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
        }));
    }

    async function submit(event) {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = isJoin
                ? await api.submitOrganizationJoinRequest(form)
                : await api.submitOrganizationOnboardingRequest(form);
            setResult(response.request);
        } catch (submitError) {
            setError(submitError.message || 'Unable to submit this request.');
        } finally {
            setLoading(false);
        }
    }

    if (result) {
        return (
            <main className="min-h-screen px-4 py-12" style={{ background: 'var(--page-gradient)' }}>
                <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
                    <CheckCircle2 className="mx-auto text-emerald-600" size={46} />
                    <h1 className="mt-4 text-2xl font-black text-slate-950">Request submitted</h1>
                    <p className="mt-3 text-slate-600">{isJoin
                        ? `${result.organization?.name || 'Your organisation'} must approve your account before you can sign in.`
                        : 'CareAround SG will review the organisation domain, supplied assets and permission record before activating the workspace.'}</p>
                    <Link to="/partner-login" className="btn-primary mt-6 inline-flex">Go to organisation sign-in</Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen px-4 py-12" style={{ background: 'var(--page-gradient)' }}>
            <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                <BrandLockup className="justify-center" />
                <div className="mt-7 flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{isJoin ? <UserPlus size={24} /> : <Building2 size={24} />}</span><div><h1 className="text-2xl font-black text-slate-950">{isJoin ? 'Request organisation access' : 'Register an organisation'}</h1><p className="mt-1 text-sm leading-6 text-slate-600">{isJoin ? 'Use your organisation-issued email. Your Organisation Admin will approve the account.' : 'Provide an owner-controlled brand pack and permission for CareAround SG to use the submitted content in approved maps and embeds.'}</p></div></div>

                <form onSubmit={submit} className="mt-7 space-y-5">
                    {isJoin ? (
                        <>
                            <label className="block text-sm font-bold text-slate-700">Name<input className="input-field mt-1" required value={form.name} onChange={set('name')} autoComplete="name" /></label>
                            <label className="block text-sm font-bold text-slate-700">Organisation email<input className="input-field mt-1" required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
                            <label className="block text-sm font-bold text-slate-700">Password<input className="input-field mt-1" required minLength={12} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /><span className="mt-1 block text-xs font-normal text-slate-500">Use at least 12 characters.</span></label>
                        </>
                    ) : (
                        <>
                            <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Organisation name<input className="input-field mt-1" required value={form.organizationName} onChange={set('organizationName')} /></label><label className="block text-sm font-bold text-slate-700">Email domain<input className="input-field mt-1" required placeholder="example.org.sg" value={form.emailDomain} onChange={set('emailDomain')} /></label></div>
                            <label className="block text-sm font-bold text-slate-700">Official website<input className="input-field mt-1" type="url" placeholder="https://example.org.sg" value={form.websiteUrl} onChange={set('websiteUrl')} /></label>
                            <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Applicant name<input className="input-field mt-1" required value={form.applicantName} onChange={set('applicantName')} autoComplete="name" /></label><label className="block text-sm font-bold text-slate-700">Applicant organisation email<input className="input-field mt-1" required type="email" value={form.applicantEmail} onChange={set('applicantEmail')} autoComplete="email" /></label></div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 font-black text-slate-900"><ShieldCheck size={18} className="text-brand-700" /> Owner-supplied brand pack</div><p className="mt-1 text-xs leading-5 text-slate-500">Use HTTPS links controlled by the organisation. These records replace logos collected from image search.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Logo URL<input className="input-field mt-1" required type="url" placeholder="https://…/logo.png" value={form.logoUrl} onChange={set('logoUrl')} /></label><label className="block text-sm font-bold text-slate-700">Banner URL<input className="input-field mt-1" required type="url" placeholder="https://…/banner.jpg" value={form.bannerUrl} onChange={set('bannerUrl')} /></label></div></div>
                            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1" required checked={form.digitalAssetUseGranted} onChange={set('digitalAssetUseGranted')} /><span>I confirm that I am authorised to provide these digital assets and content, and grant CareAround SG permission to display them in approved resource listings, Care Maps, shared links and embeds.</span></label>
                        </>
                    )}
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1" required checked={form.termsAccepted} onChange={set('termsAccepted')} /><span>I agree to the <Link className="font-bold text-brand-700 hover:underline" to="/terms">Terms of Use</Link> and <Link className="font-bold text-brand-700 hover:underline" to="/privacy">Privacy Notice</Link>.</span></label>
                    {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
                    <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">{loading ? 'Submitting…' : isJoin ? 'Request access' : 'Submit organisation request'}</button>
                </form>
                <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold"><Link to="/partner-login" className="text-brand-700 hover:underline">Organisation sign-in</Link>{isJoin ? <Link to="/organization/register" className="text-brand-700 hover:underline">Organisation not registered?</Link> : <Link to="/organization/join" className="text-brand-700 hover:underline">Organisation already registered?</Link>}</div>
            </div>
        </main>
    );
}

