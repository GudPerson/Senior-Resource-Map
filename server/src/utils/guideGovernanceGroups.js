import { normalizeRole } from './roles.js';

export function guideGovernanceGroupCreationIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:governance|coordination|org|organisation|organization|region)\s+groups?\b/.test(query)
        || /\b(?:resource|public)\s+groups?\b/.test(query)
        || /\b(?:members?|resources?|places?|programmes?|programs?|services?|offerings?)\b/.test(query)
        || !/\b(?:can|could|may|do|am)\s+i\b|\bmy\s+account\b/.test(query)
        || !/\b(?:create|make|start|set\s+up)\b/.test(query)) return null;
    if (/\bregion\s+groups?\b/.test(query)) return 'region';
    if (/\b(?:org|organisation|organization)\s+groups?\b/.test(query)) return 'org';
    return 'unspecified';
}

export function answerGuideGovernanceGroupCreation(actor, access, groupType) {
    const base = { topicId: 'governance-group-access', answerSource: 'account' };
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return { ...base,
        message: 'Sign in to check whether this account may create a governance coordination group. Public Resource Groups use a different workflow.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    if (actor.isImpersonating) return { ...base,
        message: 'Exit User View before checking your own governance-group access. The Guide cannot create a group from chat.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    if (!access) return null;
    if (typeof access.platformAdmin !== 'boolean' || typeof access.workspaceAdmin !== 'boolean'
        || typeof access.workspaceView !== 'boolean' || (access.workspaceAdmin && !access.workspaceView)) {
        throw new Error('Invalid governance group access scope.');
    }
    if (groupType === 'region') return access.platformAdmin ? { ...base,
        message: 'This Super Admin account can open Admin → Region Groups and choose New Group. The server checks the selected Region and request before creating it. A Region Admin title alone does not grant Region Group creation. The Guide cannot create the group in chat.',
        actions: [{ label: 'Open Admin', route: '/dashboard/admin' }] } : { ...base,
        message: 'This account cannot create a Region Group. That workflow requires Super Admin; a Region Admin title or Organisation Admin access alone is insufficient.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    if (groupType === 'org') return access.platformAdmin || access.workspaceAdmin ? { ...base,
        message: access.platformAdmin
            ? 'This Super Admin account can open Admin → Organisations, select an organisation, then use Org Groups → New Group. The server checks the selected organisation and its current status before Create Group; this answer does not grant access to a specific record. The Guide cannot create the group in chat.'
            : 'This account has active Organisation Admin access to at least one organisation. Open Organisation Workspace, select an organisation you administer, then use Org Groups → New Group. The server checks the selected organisation and its current status before Create Group; this answer does not grant access to another organisation. The Guide cannot create the group in chat.',
        actions: [{ label: access.platformAdmin ? 'Open Admin' : 'Open Organisation Workspace',
            route: access.platformAdmin ? '/dashboard/admin' : '/dashboard/organization' }] } : { ...base,
        message: 'This account cannot currently create an Org Group from its active organisation access. Creation requires Organisation Admin access for the selected organisation or Super Admin. Organisation Staff can view context; a public Resource Group is a different workflow.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    if (groupType !== 'unspecified') throw new Error('Invalid governance group type.');
    if (access.platformAdmin) return { ...base,
        message: 'This Super Admin account can create Org Groups through Admin → Organisations and Region Groups through Admin → Region Groups. Select the exact scope and review it before Create Group; the server checks that scope and status. These are coordination groups, not public Resource Groups, and the Guide cannot create them in chat.',
        actions: [{ label: 'Open Admin', route: '/dashboard/admin' }] };
    if (access.workspaceAdmin) return { ...base,
        message: 'This account has active Organisation Admin access to at least one organisation, so it may create an Org Group for an eligible selected organisation in Organisation Workspace → Org Groups. The server checks that organisation and its current status. Only Super Admin can create Region Groups. The Guide cannot create either group in chat.',
        actions: [{ label: 'Open Organisation Workspace', route: '/dashboard/organization' }] };
    return { ...base,
        message: 'This account cannot currently create an Org Group or Region Group from its active access. Org Group creation requires Organisation Admin access for the selected organisation or Super Admin; Region Group creation requires Super Admin. A public Resource Group is a different workflow.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
}
