import {
    canAccessAdmin,
    canAccessAuditTrail,
    canAccessManagedResources,
    canAccessOrganizationWorkspace,
    normalizeRole,
} from './roles.js';

export const INITIAL_HELP_SUGGESTIONS = [
    { id: 'discover-resources', label: 'Find resources' },
    { id: 'save-resource', label: 'Save a resource' },
    { id: 'my-directory', label: 'Use My Directory' },
    { id: 'connection-problem', label: 'Fix a loading problem' },
];

function isSignedIn(user) {
    return Boolean(user?.id) && normalizeRole(user?.role) !== 'guest';
}

export function canUseHelpRoute(user, route = '') {
    if (['/discover', '/login', '/privacy', '/terms'].includes(route)) return true;
    if (!isSignedIn(user)) return false;
    if (route === '/dashboard' || route === '/dashboard/profile' || route === '/my-directory') return true;
    if (route === '/dashboard/resources') return canAccessManagedResources(user);
    if (route === '/dashboard/admin') return canAccessAdmin(user?.role);
    if (route === '/dashboard/audit') return canAccessAuditTrail(user);
    if (route === '/dashboard/organization') return canAccessOrganizationWorkspace(user);
    return false;
}

export function filterHelpActions(user, actions = []) {
    return actions.filter((action) => (
        action?.kind === 'reload'
        || (action?.kind === 'navigate' && canUseHelpRoute(user, action.route))
    ));
}
