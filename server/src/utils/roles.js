const LEGACY_ROLE_MAP = {
    user: 'standard',
    admin: 'regional_admin',
};

export const ASSIGNABLE_ROLES = ['standard', 'partner', 'regional_admin', 'super_admin'];

export function normalizeRole(role) {
    if (!role) return 'guest';
    return LEGACY_ROLE_MAP[role] || role;
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
