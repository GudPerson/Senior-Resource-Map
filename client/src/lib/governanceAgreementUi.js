export const AGREEMENT_TYPE_OPTIONS = [
    { value: 'data_sharing', label: 'Data sharing agreement' },
    { value: 'pilot_mou', label: 'Pilot MOU / collaboration agreement' },
    { value: 'listing_consent', label: 'Public listing consent' },
    { value: 'restricted_content', label: 'Restricted content agreement' },
    { value: 'analytics_use', label: 'Analytics use agreement' },
    { value: 'notification_consent', label: 'Notification consent agreement' },
    { value: 'other', label: 'Other agreement' },
];

export const AGREEMENT_STATUS_HELP = {
    draft: 'Preparing or waiting for signature. Do not rely on this for live coverage yet.',
    active: 'Signed and usable for the allowed items below.',
    expired: 'Past its validity date. Keep for history, but renew before relying on it.',
    revoked: 'Cancelled or withdrawn. Keep for records only.',
};

export const AGREEMENT_USE_DETAILS = {
    publicListing: {
        label: 'Public listing',
        description: 'This organisation allows linked resources to appear in public discovery and shared views.',
    },
    restrictedFiles: {
        label: 'Restricted files',
        description: 'Authorised staff may store and view restricted notes or private files for linked resources.',
    },
    aggregateAnalytics: {
        label: 'Aggregate analytics',
        description: 'Linked resources may be counted in summary reporting without exposing personal records.',
    },
    aiAssistedEnrichment: {
        label: 'AI-assisted enrichment',
        description: 'AI may help clean, enrich, or summarise public resource information for linked resources.',
    },
    notifications: {
        label: 'Notifications',
        description: 'The organisation allows future in-app notification workflows for linked resources.',
    },
    externalSharing: {
        label: 'External sharing',
        description: 'Approved information may be shared outside CareAround SG under this agreement.',
    },
};

export const AGREEMENT_USE_ORDER = [
    'publicListing',
    'restrictedFiles',
    'aggregateAnalytics',
    'aiAssistedEnrichment',
    'notifications',
    'externalSharing',
];

function normalizeValue(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDate(value) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpired(agreement, now = new Date()) {
    if (!agreement?.expiresAt) return false;
    const expiresAt = new Date(agreement.expiresAt);
    const nowDate = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(expiresAt.getTime()) || Number.isNaN(nowDate.getTime())) return false;
    return expiresAt < nowDate;
}

export function getAgreementTypeLabel(value) {
    const normalized = normalizeValue(value || 'data_sharing');
    const option = AGREEMENT_TYPE_OPTIONS.find((item) => item.value === normalized);
    if (option) return option.label;
    return String(value || 'Agreement').trim().replaceAll('_', ' ');
}

export function getAgreementCoverageSummary(agreements = [], useKey, now = new Date()) {
    const use = AGREEMENT_USE_DETAILS[useKey] || { label: 'this use' };
    const active = agreements.filter((agreement) => normalizeValue(agreement?.status) === 'active');
    if (!active.length) {
        return {
            tone: 'warning',
            label: 'Not covered yet',
            description: `Add an active agreement that allows ${use.label.toLowerCase()}.`,
        };
    }

    const usable = active.filter((agreement) => !isExpired(agreement, now));
    if (!usable.length) {
        return {
            tone: 'danger',
            label: 'Expired',
            description: 'An agreement exists, but it has expired.',
        };
    }

    const covered = usable.some((agreement) => agreement?.allowedUses?.[useKey] === true);
    if (!covered) {
        return {
            tone: 'warning',
            label: 'Not allowed',
            description: `An active agreement exists, but ${use.label.toLowerCase()} is not included.`,
        };
    }

    return {
        tone: 'success',
        label: 'Covered',
        description: `An active agreement allows ${use.label.toLowerCase()}.`,
    };
}

function renderAllowedUseRows(allowedUses = {}) {
    return AGREEMENT_USE_ORDER.map((key) => {
        const use = AGREEMENT_USE_DETAILS[key];
        const enabled = allowedUses?.[key] === true;
        return `
            <tr>
                <td>${escapeHtml(use.label)}</td>
                <td>${enabled ? 'Allowed' : 'Not included'}</td>
                <td>${escapeHtml(use.description)}</td>
            </tr>
        `;
    }).join('');
}

function renderResourceRows(resourceLinks = []) {
    if (!resourceLinks.length) {
        return '<tr><td colspan="3">No linked resources recorded.</td></tr>';
    }
    return resourceLinks.map((resource) => `
        <tr>
            <td>${escapeHtml(resource.resourceName || `Resource ${resource.resourceId}`)}</td>
            <td>${escapeHtml(resource.resourceType || 'resource')}</td>
            <td>${escapeHtml(resource.resourceId || '')}</td>
        </tr>
    `).join('');
}

export function buildAgreementPrintHtml({ organization, agreement, resourceLinks = [] } = {}) {
    const org = organization || {};
    const record = agreement || {};
    const title = `${org.name || 'Organisation'} - ${record.agreementReference || 'Agreement draft'}`;

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 32px; color: #172033; font-family: Inter, Arial, sans-serif; line-height: 1.45; }
        .page { max-width: 920px; margin: 0 auto; }
        .header { border-bottom: 2px solid #0f766e; padding-bottom: 18px; margin-bottom: 24px; }
        .eyebrow { color: #0f766e; font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
        h1 { margin: 6px 0 6px; font-size: 28px; }
        h2 { margin: 28px 0 10px; font-size: 18px; }
        .muted { color: #64748b; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .box { border: 1px solid #dbe4ef; border-radius: 12px; padding: 14px; }
        .label { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .value { margin-top: 4px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #dbe4ef; padding: 10px; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
        .notice { margin-top: 20px; border: 1px solid #f5c542; background: #fff8db; border-radius: 12px; padding: 12px; color: #7a4100; }
        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 16px; }
        .signature { border: 1px solid #dbe4ef; border-radius: 12px; padding: 16px; min-height: 150px; }
        .line { border-bottom: 1px solid #94a3b8; height: 32px; margin-top: 18px; }
        @media print {
            body { padding: 18mm; }
            .no-print { display: none; }
            .page { max-width: none; }
        }
    </style>
</head>
<body>
    <main class="page">
        <section class="header">
            <div class="eyebrow">CareAround SG agreement summary</div>
            <h1>${escapeHtml(org.name || 'Organisation agreement')}</h1>
            <p class="muted">Generated from CareAround SG governance metadata for review, printing, or saving as PDF.</p>
        </section>

        <section class="grid">
            <div class="box"><div class="label">Reference/code</div><div class="value">${escapeHtml(record.agreementReference || 'Draft reference not set')}</div></div>
            <div class="box"><div class="label">Agreement type</div><div class="value">${escapeHtml(getAgreementTypeLabel(record.agreementType))}</div></div>
            <div class="box"><div class="label">Status</div><div class="value">${escapeHtml(record.status || 'draft')}</div></div>
            <div class="box"><div class="label">Signed copy reference</div><div class="value">${escapeHtml(record.fileUrl || record.fileName || 'Not attached yet')}</div></div>
            <div class="box"><div class="label">Effective date</div><div class="value">${escapeHtml(formatDate(record.effectiveAt))}</div></div>
            <div class="box"><div class="label">Expiry date</div><div class="value">${escapeHtml(formatDate(record.expiresAt))}</div></div>
            <div class="box"><div class="label">Data contact</div><div class="value">${escapeHtml(org.dataContactName || 'Not set')}</div></div>
            <div class="box"><div class="label">Data contact email</div><div class="value">${escapeHtml(org.dataContactEmail || 'Not set')}</div></div>
        </section>

        <section>
            <h2>Allowed uses</h2>
            <table>
                <thead><tr><th>Use</th><th>Status</th><th>Meaning</th></tr></thead>
                <tbody>${renderAllowedUseRows(record.allowedUses)}</tbody>
            </table>
        </section>

        <section>
            <h2>Linked resources covered by this organisation record</h2>
            <table>
                <thead><tr><th>Resource</th><th>Type</th><th>ID</th></tr></thead>
                <tbody>${renderResourceRows(resourceLinks)}</tbody>
            </table>
        </section>

        <section class="notice">
            This generated summary is an operational aid. It does not replace legal review. Organisation access does not grant resource edit rights in CareAround SG.
        </section>

        <section>
            <h2>Signatures</h2>
            <div class="signature-grid">
                <div class="signature">
                    <strong>Organisation authorised representative</strong>
                    <div class="line"></div><p class="muted">Name / title</p>
                    <div class="line"></div><p class="muted">Signature / date</p>
                </div>
                <div class="signature">
                    <strong>CareAround SG representative</strong>
                    <div class="line"></div><p class="muted">Name / title</p>
                    <div class="line"></div><p class="muted">Signature / date</p>
                </div>
            </div>
        </section>
    </main>
</body>
</html>`;
}

export function openPrintableAgreement({ organization, agreement, resourceLinks }) {
    if (typeof window === 'undefined') return false;
    const target = window.open('', '_blank');
    if (!target) return false;
    target.document.open();
    target.document.write(buildAgreementPrintHtml({ organization, agreement, resourceLinks }));
    target.document.close();
    target.opener = null;
    target.focus();
    window.setTimeout(() => target.print(), 250);
    return true;
}
