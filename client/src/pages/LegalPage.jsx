import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import BrandLockup from '../components/layout/BrandLockup.jsx';

const UPDATED_DATE = '3 May 2026';

const PRIVACY_SECTIONS = [
    {
        title: '1. Purpose of this notice',
        body: [
            'This Privacy & Cookies Notice explains how CareAround SG collects, uses, discloses, stores, and protects personal data when you use this beta service.',
            'CareAround SG is intended to help users discover senior-related places, programmes, services, promotions, saved resources, and private or shared directories. It is also used by authorised partners and administrators to manage resource information.',
        ],
    },
    {
        title: '2. Personal data we may collect',
        body: [
            'Depending on how you use the service, we may collect account details such as your name, username, email address, phone number, login method, role, and account status.',
            'We may collect location-related details such as postal code, saved places, saved offerings, My Maps, Shared Maps, membership links, and resource interactions needed to provide the directory and map features.',
            'If you choose to provide them, we may collect optional profile details such as date of birth, CHAS card type, gender, property type, caregiver status, and volunteer interest. These details are used to personalise recommendations or check restricted offerings.',
            'For partners and administrators, we may collect operational records such as resource edits, partner-only notes and files, private file uploads, import/export activity, service-area boundaries, and user-management actions.',
            'We may also collect technical information such as device/browser details, request logs, security events, error logs, IP-related metadata, and usage information needed to operate, protect, and troubleshoot the service.',
        ],
    },
    {
        title: '3. How we use personal data',
        body: [
            'We use personal data to create and secure accounts, keep users signed in, provide maps and directories, save resources, support My Maps and Shared Maps, link memberships, and show information that may be relevant to a user.',
            'We use partner and administrator data to manage resources, approve or restrict access, support imports and exports, maintain service areas, troubleshoot issues, and protect the integrity of CareAround SG.',
            'We may use data to support translation, AI-assisted import or enrichment, media upload, private partner-only files, and other operational features, but only where those features are part of the service workflow.',
            'We may use data for security, abuse prevention, audit, compliance, legal obligations, business continuity, and service improvement.',
        ],
    },
    {
        title: '4. Who may access or receive personal data',
        body: [
            'Your data may be accessed by you, authorised CareAround SG administrators, and authorised partners where access is needed for the relevant resource, membership, service area, or user-support workflow.',
            'We may use service providers for hosting, database storage, authentication, maps, translation, media upload, email or communication support, security, and diagnostics. These providers may process data for CareAround SG according to their service roles.',
            'We may disclose data where required by law, regulation, court order, public authority request, legal claim, safety need, or to protect CareAround SG, users, partners, or the public.',
        ],
    },
    {
        title: '5. Cookies and browser storage',
        body: [
            'CareAround SG uses an essential session cookie named sc_token to keep signed-in users authenticated. This cookie is required for account access and is protected with security settings appropriate to the environment.',
            'CareAround SG stores language, contrast, and text-size preferences in your browser so the app can remember your accessibility and language choices.',
            'The current app code does not load advertising, remarketing, heatmap, or marketing-pixel cookies. If non-essential analytics or marketing tools are introduced later, CareAround SG should add a consent banner or preferences control before those tools load.',
            'You can clear cookies and local browser storage through your browser settings, but doing so may sign you out or reset your preferences.',
        ],
    },
    {
        title: '6. Optional and sensitive profile details',
        body: [
            'Some profile details are optional. You may choose not to provide them, but the app may then be unable to personalise certain recommendations or check whether restricted offerings may be relevant to you.',
            'CareAround SG should handle optional profile and eligibility details with care and use them only for the purposes explained in this notice or otherwise notified to you.',
        ],
    },
    {
        title: '7. Retention',
        body: [
            'CareAround SG should retain personal data only for as long as reasonably needed for account management, service delivery, security, audit, legal, compliance, operational, or dispute-resolution purposes.',
            'When data is no longer needed, CareAround SG should delete, anonymise, or otherwise stop using it where reasonably practicable and lawful.',
        ],
    },
    {
        title: '8. Access, correction, and withdrawal',
        body: [
            'You may request access to or correction of personal data held about you, subject to identity verification and exceptions allowed by law.',
            'You may withdraw consent for certain uses of personal data. Withdrawal may affect your ability to use account, map, membership, eligibility, partner, or administrative features.',
        ],
    },
    {
        title: '9. Overseas processing and safeguards',
        body: [
            'CareAround SG may use cloud and technology service providers that process or store data outside Singapore. Where this happens, CareAround SG should take reasonable steps to ensure appropriate protection for the transferred data.',
        ],
    },
    {
        title: '10. Security',
        body: [
            'CareAround SG uses technical and organisational measures intended to protect personal data, including access controls, authenticated routes, protected partner-only file access, security headers, request validation, and safer session handling.',
            'No online service can guarantee perfect security. Users and partners are responsible for protecting their account credentials and reporting suspected unauthorised access promptly.',
        ],
    },
    {
        title: '11. Contact and beta notice',
        body: [
            'Privacy contact: to be confirmed by CareAround SG.',
            'This placeholder contact is a launch blocker before wider public rollout. CareAround SG should confirm and publish an appropriate business contact for data protection requests.',
            'CareAround SG is in beta. This notice may be updated as features, operations, service providers, or legal requirements change.',
        ],
    },
];

const TERMS_SECTIONS = [
    {
        title: '1. Acceptance of these terms',
        body: [
            'By accessing or using CareAround SG, you agree to these Terms of Use. If you do not agree, you should not use the service.',
            'If you use CareAround SG on behalf of an organisation, partner, care provider, or administrator, you represent that you are authorised to do so and that your organisation is responsible for your use.',
        ],
    },
    {
        title: '2. Nature of the service',
        body: [
            'CareAround SG is an informational directory and planning tool for senior-related places, programmes, services, promotions, saved resources, and maps.',
            'CareAround SG is not an emergency service, medical service, financial adviser, legal adviser, government agency, or replacement for professional advice.',
            'If you need urgent help, medical care, safety support, or official government assistance, contact the relevant emergency service, healthcare provider, agency, or qualified professional directly.',
        ],
    },
    {
        title: '3. Verify information before relying on it',
        body: [
            'Resource information may be incomplete, outdated, imported, partner-submitted, AI-assisted, or subject to change by the relevant provider.',
            'You should verify details such as availability, pricing, eligibility, opening hours, location, programme dates, service scope, and registration requirements with the relevant provider before relying on them.',
        ],
    },
    {
        title: '4. User responsibilities',
        body: [
            'You are responsible for providing accurate account and profile information, keeping your login credentials secure, and using CareAround SG lawfully and respectfully.',
            'You must not impersonate another person, access another account without permission, interfere with the service, misuse membership links, or use exported or shared information for improper purposes.',
        ],
    },
    {
        title: '5. Partner and administrator responsibilities',
        body: [
            'Partners and administrators are responsible for ensuring that resource listings, descriptions, schedules, pricing, private notes, files, eligibility rules, and service-area settings they manage are accurate, lawful, and kept reasonably up to date.',
            'Partners and administrators must upload only content they are authorised to use, protect personal data and confidential information, and avoid placing sensitive information in public fields.',
            'Partner-only notes and files are intended for authorised reference use only and must not be used to bypass legal, privacy, consent, confidentiality, or organisational obligations.',
        ],
    },
    {
        title: '6. Acceptable use',
        body: [
            'You must not scrape, overload, probe, reverse engineer, attack, disrupt, or attempt unauthorised access to CareAround SG or its connected systems.',
            'You must not upload malware, unlawful content, misleading content, confidential content without authority, or content that infringes intellectual property, privacy, or other rights.',
            'You must not use CareAround SG to harass, discriminate, defraud, spam, profile people unlawfully, or make decisions that require professional judgment without appropriate verification.',
        ],
    },
    {
        title: '7. Saved maps, shared maps, and user content',
        body: [
            'You are responsible for the directories, notes, selections, and shared map links you create or distribute through CareAround SG.',
            'Shared map links may allow others to view a prepared directory. Share links only with appropriate recipients and review the content before sharing.',
        ],
    },
    {
        title: '8. Intellectual property',
        body: [
            'CareAround SG, its design, software, branding, and original content are owned by or licensed to the relevant CareAround SG operator, except for third-party content and partner-submitted materials.',
            'You may use CareAround SG for its intended personal, caregiving, partner, or administrative purposes. You may not copy, resell, redistribute, or exploit the service beyond those purposes without permission.',
        ],
    },
    {
        title: '9. Service availability and beta status',
        body: [
            'CareAround SG is currently in beta and may change, contain errors, experience downtime, or have features added, changed, restricted, or removed.',
            'CareAround SG may suspend access, remove content, correct listings, restrict features, or take other reasonable action to protect users, partners, the public, or the service.',
        ],
    },
    {
        title: '10. Disclaimers and limitation of liability',
        body: [
            'CareAround SG is provided on an as-is and as-available basis to the extent permitted by law.',
            'To the extent permitted by Singapore law, CareAround SG and its operators are not liable for indirect, incidental, special, consequential, or punitive loss, or for loss arising from reliance on unverified resource information, third-party services, partner-submitted content, downtime, or user misuse.',
            'Nothing in these terms excludes liability that cannot be excluded under applicable law.',
        ],
    },
    {
        title: '11. Governing law',
        body: [
            'These Terms of Use are governed by the laws of Singapore. Any dispute should be handled according to Singapore law and the competent courts or dispute-resolution forum in Singapore, unless otherwise required by law.',
        ],
    },
    {
        title: '12. Contact',
        body: [
            'General and legal contact: to be confirmed by CareAround SG.',
            'This placeholder should be replaced before wider public rollout.',
        ],
    },
];

const PAGE_CONFIG = {
    privacy: {
        eyebrow: 'Privacy & Cookies Notice',
        title: 'Privacy & Cookies Notice',
        subtitle: 'How CareAround SG handles personal data, essential cookies, and browser preferences.',
        icon: ShieldCheck,
        sections: PRIVACY_SECTIONS,
    },
    terms: {
        eyebrow: 'Terms of Use',
        title: 'Terms of Use',
        subtitle: 'The rules and responsibilities for using CareAround SG.',
        icon: FileText,
        sections: TERMS_SECTIONS,
    },
};

function LegalSection({ section }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600 sm:text-base">
                {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
        </section>
    );
}

export default function LegalPage({ type }) {
    const config = PAGE_CONFIG[type];
    if (!config) return <Navigate to="/" replace />;

    const Icon = config.icon;
    const alternateType = type === 'privacy' ? 'terms' : 'privacy';
    const alternate = PAGE_CONFIG[alternateType];

    return (
        <main className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 lg:px-8" style={{ background: 'var(--page-gradient)' }}>
            <div className="mx-auto max-w-4xl">
                <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700">
                    <ArrowLeft size={16} />
                    Back to CareAround SG
                </Link>

                <header className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <BrandLockup showTagline />
                            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-brand-700">{config.eyebrow}</p>
                            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{config.title}</h1>
                            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{config.subtitle}</p>
                        </div>
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                            <Icon size={28} />
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                        <p className="font-bold">Important legal review note</p>
                        <p className="mt-1">
                            This page is an operational beta baseline for PDPA/privacy readiness. It should be reviewed by an appropriate legal or data-protection adviser before wider public rollout.
                        </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                            Last updated: {UPDATED_DATE}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-600">
                            English version is authoritative in V1
                        </span>
                    </div>
                </header>

                <div className="mt-6 space-y-4">
                    {config.sections.map((section) => (
                        <LegalSection key={section.title} section={section} />
                    ))}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
                    Looking for the {alternate.title.toLowerCase()}?{' '}
                    <Link to={`/${alternateType}`} className="font-bold text-brand-700 underline">
                        Open {alternate.title}
                    </Link>
                    .
                </div>
            </div>
        </main>
    );
}
