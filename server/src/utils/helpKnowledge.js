import { normalizeRole } from './roles.js';
import { hasOrganizationAdminAccess } from './organizationAccess.js';

function hasActiveAccess(user, key) {
    return Array.isArray(user?.[key]) && user[key].some((entry) => !entry?.revokedAt);
}

export function getHelpCapabilities(user = {}) {
    const role = normalizeRole(user?.role);
    const isAuthenticated = role !== 'guest' && Boolean(user?.id);
    const hasManagedAccess = ['super_admin', 'regional_admin', 'partner'].includes(role)
        || ['partnerStaffAccess', 'hardAssetStaffAccess', 'softAssetStaffAccess']
            .some((key) => hasActiveAccess(user, key));
    const hasOrganizationAccess = hasActiveAccess(user, 'organizationAccess');

    return {
        authenticated: isAuthenticated,
        directory: isAuthenticated,
        managedResources: isAuthenticated && hasManagedAccess,
        admin: isAuthenticated && ['super_admin', 'regional_admin'].includes(role),
        audit: isAuthenticated && (role === 'super_admin' || hasOrganizationAdminAccess(user)),
        organization: isAuthenticated && hasOrganizationAccess,
    };
}

export function normalizeHelpRouteContext(pathname = '') {
    const path = String(pathname || '').split(/[?#]/)[0];
    if (path === '/' || path === '/list' || path.startsWith('/discover')) return 'discover';
    if (path.startsWith('/resource/')) return 'resource';
    if (path.startsWith('/shared/maps/')) return 'shared-map';
    if (path.startsWith('/my-directory/maps/')) return 'my-map';
    if (path.startsWith('/my-directory')) return 'my-directory';
    if (path.startsWith('/membership/link')) return 'membership';
    if (path.startsWith('/dashboard/resources')) return 'managed-resources';
    if (path.startsWith('/dashboard/profile')) return 'profile';
    if (path.startsWith('/dashboard/admin')) return 'admin';
    if (path.startsWith('/dashboard/audit')) return 'audit';
    if (path.startsWith('/dashboard/organization')) return 'organization';
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/login') || path.startsWith('/partner-login')) return 'login';
    if (path.startsWith('/privacy') || path.startsWith('/terms')) return 'legal';
    return 'other';
}

export const HELP_KNOWLEDGE_VERSION = '2026-07-16.1';

export const HELP_KNOWLEDGE = [
    {
        id: 'discover-resources',
        title: 'Find resources',
        keywords: ['discover', 'find resource', 'search resource', 'postal code', 'near me', 'browse', 'filter'],
        routeContexts: ['discover'],
        answer: 'Open Discover to browse public places, programmes, and services. Search by a keyword or postal code, then open a result to review its current details.',
        actions: [{ kind: 'navigate', label: 'Open Discover', route: '/discover' }],
        sources: ['client/src/App.jsx', 'client/src/pages/DiscoverPage.jsx'],
    },
    {
        id: 'save-resource',
        title: 'Save a resource',
        keywords: ['save', 'save resource', 'bookmark', 'favourite', 'favorite', 'keep resource', 'saved resource'],
        routeContexts: ['discover', 'resource'],
        answer: 'Open a resource from Discover and select Save. Saved resources appear in My Directory. Saving a resource does not register you for a programme or service.',
        unavailableAnswer: 'You can browse resources without an account, but you need to sign in before you can save one. After signing in, saved resources appear in My Directory.',
        capability: 'directory',
        actions: [
            { kind: 'navigate', label: 'Open My Directory', route: '/my-directory', capability: 'directory' },
            { kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' },
        ],
        sources: ['client/src/contexts/SavedAssetsContext.jsx', 'client/src/App.jsx'],
    },
    {
        id: 'my-directory',
        title: 'Use My Directory',
        keywords: ['my directory', 'saved list', 'where are saved', 'saved resources', 'my saved'],
        routeContexts: ['my-directory', 'dashboard'],
        answer: 'My Directory contains the resources you saved and your personal maps. Open it from your account menu or dashboard.',
        unavailableAnswer: 'My Directory is available after you sign in. It keeps your saved resources and personal maps with your account.',
        capability: 'directory',
        actions: [
            { kind: 'navigate', label: 'Open My Directory', route: '/my-directory', capability: 'directory' },
            { kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' },
        ],
        sources: ['client/src/App.jsx', 'client/src/pages/MyDirectoryPage.jsx'],
    },
    {
        id: 'create-map',
        title: 'Create a personal map',
        keywords: ['create map', 'new map', 'my map', 'care map', 'planning map', 'add to map'],
        routeContexts: ['my-directory', 'my-map'],
        answer: 'Save the resources you want first, then open My Directory and create a map from My Maps. Open the new map to add or remove saved resources and edit its details.',
        unavailableAnswer: 'Personal maps are available after you sign in. Save useful resources first, then create a map from My Directory.',
        capability: 'directory',
        actions: [
            { kind: 'navigate', label: 'Open My Directory', route: '/my-directory', capability: 'directory' },
            { kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' },
        ],
        sources: ['client/src/pages/MyDirectoryPage.jsx', 'client/src/pages/MyMapDetailPage.jsx'],
    },
    {
        id: 'share-map',
        title: 'Share or stop sharing a map',
        keywords: ['share map', 'sharing link', 'publish map', 'unpublish', 'stop sharing', 'share link'],
        routeContexts: ['my-map'],
        answer: 'Open your map and use its sharing controls to publish a view-only link. You can return to the same controls later to stop sharing. Review the map before sharing because anyone with the link can open it.',
        unavailableAnswer: 'You need to sign in and open one of your own maps before you can create or stop a sharing link.',
        capability: 'directory',
        actions: [{ kind: 'navigate', label: 'Open My Directory', route: '/my-directory', capability: 'directory' }],
        sources: ['client/src/pages/MyMapDetailPage.jsx', 'server/src/routes/myMaps.js'],
    },
    {
        id: 'copy-shared-map',
        title: 'Keep a copy of a shared map',
        keywords: ['copy shared map', 'shared map copy', 'save shared map', 'someone shared', 'view shared map'],
        routeContexts: ['shared-map'],
        answer: 'A shared map is view-only. If you are signed in, use the copy option on the shared map to create your own editable copy in My Maps.',
        unavailableAnswer: 'You can view a shared map without signing in. Sign in if you want to copy it into your own My Maps.',
        capability: 'directory',
        actions: [{ kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' }],
        sources: ['client/src/pages/SharedMapPage.jsx', 'server/src/routes/sharedMaps.js'],
    },
    {
        id: 'update-profile',
        title: 'Update profile and location',
        keywords: ['profile', 'postal code', 'personal details', 'change name', 'update account', 'location'],
        routeContexts: ['profile', 'dashboard'],
        answer: 'Open Profile from your dashboard to update your account details, postal code, and optional personalisation information.',
        unavailableAnswer: 'Profile settings are available after you sign in.',
        capability: 'directory',
        actions: [
            { kind: 'navigate', label: 'Open Profile', route: '/dashboard/profile', capability: 'directory' },
            { kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' },
        ],
        sources: ['client/src/App.jsx', 'client/src/pages/dashboard/ProfilePage.jsx'],
    },
    {
        id: 'phone-access',
        title: 'Use or link WhatsApp access',
        keywords: ['phone login', 'whatsapp', 'verify phone', 'link phone', 'phone verification', 'mobile number'],
        routeContexts: ['login', 'profile'],
        answer: 'Use the WhatsApp option on the sign-in page to access an account by phone. If you already use email or Google, sign in with that account first and link WhatsApp from Profile to avoid creating a separate account.',
        actions: [
            { kind: 'navigate', label: 'Open sign in', route: '/login' },
            { kind: 'navigate', label: 'Open Profile', route: '/dashboard/profile', capability: 'directory' },
        ],
        sources: ['client/src/components/PhoneLoginPanel.jsx', 'client/src/pages/dashboard/ProfilePage.jsx'],
    },
    {
        id: 'sign-in-problem',
        title: 'Troubleshoot sign in',
        keywords: ['cant login', 'cannot login', 'cannot sign in', 'sign in failed', 'login failed', 'session expired', 'google sign in', 'invalid token'],
        routeContexts: ['login'],
        answer: 'If your session expired, sign in again. If Google sign-in does not work, retry once or use another sign-in method already linked to your account. For WhatsApp access, use the retry option shown on the phone sign-in screen and do not start several attempts at the same time.',
        actions: [
            { kind: 'navigate', label: 'Open sign in', route: '/login' },
            { kind: 'reload', label: 'Refresh app' },
        ],
        sources: ['client/src/lib/api.js', 'client/src/components/PhoneLoginPanel.jsx', 'client/src/pages/AuthPage.jsx'],
    },
    {
        id: 'membership-link',
        title: 'Link a place membership',
        keywords: ['membership', 'member link', 'membership qr', 'link place', 'member only'],
        routeContexts: ['membership', 'profile'],
        answer: 'Open the membership link or QR code provided by the place, sign in if asked, and confirm the link. Linking a membership does not automatically register you for every programme.',
        unavailableAnswer: 'You need to sign in before a place membership can be linked to your account.',
        capability: 'directory',
        actions: [{ kind: 'navigate', label: 'Sign in', route: '/login', whenCapabilityMissing: 'directory' }],
        sources: ['client/src/pages/MembershipLinkPage.jsx', 'server/src/routes/memberships.js'],
    },
    {
        id: 'page-update',
        title: 'Refresh after an app update',
        keywords: ['page update needed', 'refresh page', 'page could not load', 'chunk', 'blank page', 'stuck loading'],
        routeContexts: [],
        answer: 'The app may have been updated while your tab was open. Refresh the app once to load the latest version. If the page still does not open, return to Discover and try again.',
        actions: [
            { kind: 'reload', label: 'Refresh app' },
            { kind: 'navigate', label: 'Open Discover', route: '/discover' },
        ],
        sources: ['client/src/App.jsx'],
    },
    {
        id: 'connection-problem',
        title: 'Troubleshoot a connection problem',
        keywords: ['offline', 'connection', 'network', 'cannot load', 'failed to load', 'request failed', 'try again'],
        routeContexts: [],
        answer: 'Check that your device is online, then retry the page. If the app was already open during an update, refresh it once. Avoid repeating save or edit actions until the page confirms whether the first attempt succeeded.',
        actions: [{ kind: 'reload', label: 'Refresh app' }],
        sources: ['client/src/lib/resourceLoadState.js', 'client/src/lib/api.js'],
    },
    {
        id: 'saved-resources-loading',
        title: 'Saved resources did not load',
        keywords: ['saved resources failed', 'saved resources not loading', 'cannot save', 'cannot remove saved', 'favorites failed'],
        routeContexts: ['discover', 'my-directory'],
        answer: 'Your saved resources may still be safe even when the list cannot load. Refresh the page and wait for the saved list to return before saving or removing more items.',
        actions: [
            { kind: 'reload', label: 'Refresh app' },
            { kind: 'navigate', label: 'Open My Directory', route: '/my-directory', capability: 'directory' },
        ],
        sources: ['client/src/contexts/SavedAssetsContext.jsx', 'client/src/lib/i18n.js'],
    },
    {
        id: 'detailed-map-unavailable',
        title: 'Detailed map is unavailable',
        keywords: ['detailed map unavailable', 'standard map', 'map unavailable', 'outside detailed area', 'town map'],
        routeContexts: ['my-map', 'shared-map'],
        answer: 'If the detailed map is unavailable or the location is outside its supported area, keep using the standard map. Your map and directory information remain available.',
        sources: ['client/src/pages/MyMapDetailPage.jsx', 'client/src/pages/SharedMapPage.jsx'],
    },
    {
        id: 'managed-resources',
        title: 'Manage places, programmes, and services',
        keywords: ['my resources', 'manage resource', 'edit resource', 'resource owner', 'resource staff', 'programme material'],
        routeContexts: ['managed-resources', 'dashboard'],
        answer: 'Open My Resources from the dashboard to work with places, programmes, and services you are allowed to manage.',
        unavailableAnswer: 'My Resources only appears when your account has an admin, owner, or staff assignment for managed resources. Organisation access by itself does not grant resource editing.',
        capability: 'managedResources',
        actions: [
            { kind: 'navigate', label: 'Open My Resources', route: '/dashboard/resources', capability: 'managedResources' },
            { kind: 'navigate', label: 'Open Dashboard', route: '/dashboard', capability: 'directory' },
        ],
        sources: ['client/src/components/dashboard/DashboardNavigation.jsx', 'client/src/lib/roles.js'],
    },
    {
        id: 'organization-workspace',
        title: 'Use the Organisation workspace',
        keywords: ['organisation', 'organization', 'organisation workspace', 'agreement', 'governance group'],
        routeContexts: ['organization', 'dashboard'],
        answer: 'Open Organisation from the dashboard to view the governance records available to your account. Organisation access provides governance context; resource editing still requires direct owner or staff access.',
        unavailableAnswer: 'The Organisation workspace appears only when your account has active organisation access. It is separate from permission to edit resources.',
        capability: 'organization',
        actions: [
            { kind: 'navigate', label: 'Open Organisation', route: '/dashboard/organization', capability: 'organization' },
            { kind: 'navigate', label: 'Open Dashboard', route: '/dashboard', capability: 'directory' },
        ],
        sources: ['client/src/components/dashboard/DashboardNavigation.jsx', 'client/src/lib/roles.js'],
    },
    {
        id: 'audit-trail',
        title: 'View the Audit Trail',
        keywords: ['audit', 'audit trail', 'activity log', 'change history', 'who changed'],
        routeContexts: ['audit', 'dashboard'],
        answer: 'Open Audit Trail from the dashboard to review governance and resource activity within the scope available to your account.',
        unavailableAnswer: 'Audit Trail appears only for Super Admins and Organisation Admins with the required access.',
        capability: 'audit',
        actions: [
            { kind: 'navigate', label: 'Open Audit Trail', route: '/dashboard/audit', capability: 'audit' },
            { kind: 'navigate', label: 'Open Dashboard', route: '/dashboard', capability: 'directory' },
        ],
        sources: ['client/src/components/dashboard/DashboardNavigation.jsx', 'client/src/lib/roles.js'],
    },
    {
        id: 'admin-tools',
        title: 'Use Admin tools',
        keywords: ['admin', 'admin tools', 'manage users', 'regional admin', 'super admin', 'data tools'],
        routeContexts: ['admin', 'dashboard'],
        answer: 'Open Admin from the dashboard to use the administrative tools available to your role. The tabs shown depend on whether you are an Admin or Super Admin.',
        unavailableAnswer: 'Admin tools only appear for Admin and Super Admin accounts. Resource or organisation staff access does not automatically grant platform administration.',
        capability: 'admin',
        actions: [
            { kind: 'navigate', label: 'Open Admin', route: '/dashboard/admin', capability: 'admin' },
            { kind: 'navigate', label: 'Open Dashboard', route: '/dashboard', capability: 'directory' },
        ],
        sources: ['client/src/App.jsx', 'client/src/lib/roles.js'],
    },
    {
        id: 'access-permission',
        title: 'Understand missing access',
        keywords: ['permission', 'access denied', 'cannot access', 'missing menu', 'not allowed', 'why cannot edit', 'why cant i edit', 'cant edit', 'cannot edit'],
        routeContexts: [],
        answer: 'CareAround only shows restricted workspaces and editing tools when your current account has the matching role or direct access assignment. Return to the dashboard to see the sections currently available to you.',
        actions: [{ kind: 'navigate', label: 'Open Dashboard', route: '/dashboard', capability: 'directory' }],
        sources: ['client/src/App.jsx', 'client/src/lib/roles.js'],
    },
    {
        id: 'resource-information',
        title: 'Check current resource information',
        keywords: ['resource unavailable', 'no longer available', 'opening hours', 'eligibility', 'register', 'fees', 'resource wrong'],
        routeContexts: ['resource', 'discover'],
        answer: 'CareAround helps you find and organise information, but provider details can change. Check the provider’s latest opening hours, dates, registration steps, fees, eligibility, and availability before relying on a resource.',
        actions: [{ kind: 'navigate', label: 'Open Discover', route: '/discover' }],
        sources: ['docs/user-guide.md', 'client/src/pages/ResourcePage.jsx'],
    },
    {
        id: 'privacy-help',
        title: 'Review privacy and terms',
        keywords: ['privacy', 'personal data', 'cookies', 'terms', 'data safety'],
        routeContexts: ['legal'],
        answer: 'Use the Privacy and Terms pages for the current CareAround policies. Do not enter passwords, identity numbers, medical details, private notes, or access links into the help assistant.',
        actions: [
            { kind: 'navigate', label: 'Open Privacy', route: '/privacy' },
            { kind: 'navigate', label: 'Open Terms', route: '/terms' },
        ],
        sources: ['client/src/pages/LegalPage.jsx', 'client/src/App.jsx'],
    },
];

function actionIsAvailable(action, capabilities) {
    if (action.capability && !capabilities[action.capability]) return false;
    if (action.whenCapabilityMissing && capabilities[action.whenCapabilityMissing]) return false;
    return true;
}

export function materializeHelpEntry(entry, capabilities) {
    const hasRequiredCapability = !entry.capability || capabilities[entry.capability];
    return {
        id: entry.id,
        title: entry.title,
        message: hasRequiredCapability ? entry.answer : entry.unavailableAnswer || entry.answer,
        actions: (entry.actions || [])
            .filter((action) => actionIsAvailable(action, capabilities))
            .map(({ kind, label, route }) => ({
                kind,
                label,
                ...(route ? { route } : {}),
            })),
        sources: entry.sources,
    };
}

export function getHelpSuggestions({ routeContext, capabilities, limit = 4 } = {}) {
    const preferredIds = {
        discover: ['discover-resources', 'save-resource', 'connection-problem', 'resource-information'],
        resource: ['save-resource', 'resource-information', 'connection-problem', 'my-directory'],
        'my-directory': ['my-directory', 'create-map', 'saved-resources-loading', 'share-map'],
        'my-map': ['share-map', 'detailed-map-unavailable', 'connection-problem', 'my-directory'],
        'shared-map': ['copy-shared-map', 'detailed-map-unavailable', 'resource-information', 'connection-problem'],
        dashboard: ['my-directory', 'update-profile', 'managed-resources', 'access-permission'],
        'managed-resources': ['managed-resources', 'access-permission', 'connection-problem', 'audit-trail'],
        profile: ['update-profile', 'phone-access', 'membership-link', 'privacy-help'],
        admin: ['admin-tools', 'access-permission', 'audit-trail', 'connection-problem'],
        audit: ['audit-trail', 'access-permission', 'organization-workspace', 'connection-problem'],
        organization: ['organization-workspace', 'managed-resources', 'audit-trail', 'access-permission'],
        login: ['sign-in-problem', 'phone-access', 'my-directory', 'connection-problem'],
        legal: ['privacy-help', 'resource-information', 'discover-resources', 'connection-problem'],
    };
    const ids = preferredIds[routeContext] || ['discover-resources', 'save-resource', 'my-directory', 'connection-problem'];

    return ids
        .map((id) => HELP_KNOWLEDGE.find((entry) => entry.id === id))
        .filter(Boolean)
        .map((entry) => materializeHelpEntry(entry, capabilities))
        .filter((entry) => entry.message)
        .slice(0, limit)
        .map(({ id, title }) => ({ id, label: title }));
}
