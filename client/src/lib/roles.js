const LEGACY_ROLE_MAP = {
    user: 'standard',
    admin: 'regional_admin',
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
    return LEGACY_ROLE_MAP[role] || role;
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

export function getAdminTabs(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return ['resources', 'users', 'subregions', 'subcats', 'datatools'];
        case 'regional_admin':
            return ['resources', 'users'];
        case 'partner':
            return ['users'];
        default:
            return [];
    }
}
