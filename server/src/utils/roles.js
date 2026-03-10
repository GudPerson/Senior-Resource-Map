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

export const ASSIGNABLE_ROLES = ['standard', 'partner', 'regional_admin', 'super_admin'];

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

export function getCreatableRoles(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return [...ASSIGNABLE_ROLES];
        case 'regional_admin':
            return ['partner'];
        case 'partner':
            return ['standard'];
        default:
            return [];
    }
}

export function getManageableRoles(role) {
    switch (normalizeRole(role)) {
        case 'super_admin':
            return [...ASSIGNABLE_ROLES];
        case 'regional_admin':
            return ['partner'];
        case 'partner':
            return ['standard'];
        default:
            return [];
    }
}

export function canManageRole(managerRole, targetRole) {
    return getManageableRoles(managerRole).includes(normalizeRole(targetRole));
}
