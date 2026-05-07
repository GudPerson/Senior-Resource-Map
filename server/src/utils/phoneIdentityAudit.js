import { normalizeSingaporePhoneIdentity } from './phoneIdentity.js';

export function maskPhoneIdentity(phoneE164) {
    const text = String(phoneE164 || '').trim();
    if (!text) return '';
    if (text.startsWith('+65') && text.length >= 7) {
        return `+65****${text.slice(-4)}`;
    }
    return `****${text.slice(-4)}`;
}

function serializeAuditUser(row) {
    return {
        id: row.id,
        username: row.username || '',
        email: row.email || '',
        name: row.name || '',
        role: row.role || '',
        managerUserId: row.managerUserId ?? null,
        postalCode: row.postalCode || '',
        createdAt: row.createdAt || null,
    };
}

export function buildPhoneIdentityDuplicateAudit(rows, options = {}) {
    const {
        maskPhones = true,
    } = options;

    const groupsByPhone = new Map();
    let invalidOrBlankRows = 0;

    for (const row of Array.isArray(rows) ? rows : []) {
        const normalizedPhone = normalizeSingaporePhoneIdentity(row?.phone);
        if (!normalizedPhone) {
            invalidOrBlankRows += 1;
            continue;
        }

        if (!groupsByPhone.has(normalizedPhone)) {
            groupsByPhone.set(normalizedPhone, []);
        }
        groupsByPhone.get(normalizedPhone).push(serializeAuditUser(row));
    }

    const groups = [...groupsByPhone.entries()]
        .filter(([, users]) => users.length > 1)
        .map(([normalizedPhone, users]) => ({
            phone: maskPhones ? maskPhoneIdentity(normalizedPhone) : normalizedPhone,
            ...(maskPhones ? {} : { normalizedPhone }),
            accountCount: users.length,
            users,
        }))
        .sort((left, right) => right.accountCount - left.accountCount || left.phone.localeCompare(right.phone));

    return {
        totalRows: Array.isArray(rows) ? rows.length : 0,
        validPhoneRows: [...groupsByPhone.values()].reduce((total, users) => total + users.length, 0),
        invalidOrBlankRows,
        duplicateGroupCount: groups.length,
        duplicateAccountCount: groups.reduce((total, group) => total + group.accountCount, 0),
        groups,
    };
}
