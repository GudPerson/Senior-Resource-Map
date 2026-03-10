const LEGACY_ROLE_MAP = {
    user: 'standard',
    standard_user: 'standard',
    standard: 'standard',
    guest: 'guest',
    admin: 'regional_admin',
    regional_admin: 'regional_admin',
    regionaladmin: 'regional_admin',
    super_admin: 'super_admin',
    superadmin: 'super_admin',
    partner: 'partner',
    partner_asset_owner: 'partner',
    asset_owner: 'partner',
};

const ROLE_META = {
    super_admin: {
        label: 'Super Admin',
        shortLabel: '⚡ Super Admin',
        pillClassName: 'bg-red-100 text-red-700',
        controlClassName: 'bg-red-50 text-red-700 border-red-200',
    },
    regional_admin: {
        label: 'Regional Admin',
        shortLabel: '🛡️ Reg. Admin',
        pillClassName: 'bg-orange-100 text-orange-700',
        controlClassName: 'bg-orange-50 text-orange-700 border-orange-200',
    },
    partner: {
        label: 'Partner',
        shortLabel: '🤝 Partner',
        pillClassName: 'bg-brand-100 text-brand-700',
        controlClassName: 'bg-brand-50 text-brand-700 border-brand-200',
    },
    standard: {
        label: 'User',
        shortLabel: '👤 User',
        pillClassName: 'bg-slate-100 text-slate-700',
        controlClassName: 'bg-slate-50 text-slate-700 border-slate-200',
    },
    guest: {
        label: 'Guest',
        shortLabel: 'Guest',
        pillClassName: 'bg-slate-100 text-slate-500',
        controlClassName: 'bg-slate-50 text-slate-500 border-slate-200',
    },
};

export function normalizeRole(role) {
    if (!role) return 'guest';
    const normalized = String(role)
        .trim()
        .toLowerCase()
        .replace(/[()]/g, ' ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');

    return LEGACY_ROLE_MAP[normalized] || normalized;
}

export function getRoleMeta(role) {
    return ROLE_META[normalizeRole(role)] || ROLE_META.guest;
}

export function isStandardUserRole(role) {
    return normalizeRole(role) === 'standard';
}

export function canAccessAdmin(role) {
    return ['super_admin', 'regional_admin', 'partner'].includes(normalizeRole(role));
}

export function canChangeUserRoles(role) {
    return normalizeRole(role) === 'super_admin';
}

export function getCreatableUserRoles(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return ['standard', 'partner', 'regional_admin', 'super_admin'];
        case 'regional_admin':
            return ['partner'];
        case 'partner':
            return ['standard'];
        default:
            return [];
    }
}

export function canManageUser(currentRole, targetRole) {
    const normalizedCurrentRole = normalizeRole(currentRole);
    const normalizedTargetRole = normalizeRole(targetRole);

    if (normalizedCurrentRole === 'super_admin') return true;
    if (normalizedCurrentRole === 'regional_admin') return normalizedTargetRole === 'partner';
    if (normalizedCurrentRole === 'partner') return normalizedTargetRole === 'standard';
    return false;
}

export function canManageUserRecord(currentUser, targetUser) {
    const currentRole = normalizeRole(currentUser?.role);
    if (!currentUser || !targetUser) return false;
    if (currentUser.id === targetUser.id) return false;
    if (currentRole === 'super_admin') return normalizeRole(targetUser.role) !== 'guest';
    return Number(targetUser.managerUserId) === Number(currentUser.id) && canManageUser(currentRole, targetUser.role);
}

export function getRequiredManagerRole(targetRole) {
    switch (normalizeRole(targetRole)) {
        case 'regional_admin':
            return 'super_admin';
        case 'partner':
            return 'regional_admin';
        case 'standard':
            return 'partner';
        default:
            return null;
    }
}

export function getAdminTabs(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return ['resources', 'users', 'subregions', 'subcats', 'datatools'];
        case 'regional_admin':
            return ['resources', 'users', 'subregions'];
        case 'partner':
            return ['users'];
        default:
            return [];
    }
}
