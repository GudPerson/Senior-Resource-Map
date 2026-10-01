import { Hono } from 'hono';
import { getHardAssets } from '../controllers/hardAssetsController.js';
import { getSoftAssets } from '../controllers/softAssetsController.js';
import { canRequestManagedResourceList } from './resourceListScope.js';
import { normalizeRole } from './roles.js';

const PAGE_SIZE = 5;
const ACCESS_PAGE_SIZE = 10;
const MANAGED_SOURCES = [
    { type: 'hard', path: 'hard' },
    { type: 'soft', path: 'soft', assetMode: 'offerings' },
    { type: 'group', path: 'soft', assetMode: 'group' },
];

function managedListRouter(actor, hard, soft) {
    const internal = new Hono();
    internal.use('*', async (c, next) => { c.set('user', actor); await next(); });
    internal.get('/hard', hard);
    internal.get('/soft', soft);
    return internal;
}

function requireManagedActor(actor) {
    if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating
        || !canRequestManagedResourceList(actor)) throw new Error('Managed resource access unavailable');
}

export function guideManagedResourceIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (/\bpersonal\s+places?\b|\bmy\s+places\b|\bprivate\s+planning\s+places?\b/.test(query)) return null;
    if (/\b(?:governance|coordination)\s+groups?\b/.test(query)) return null;
    if (/^how\b/.test(query) && /\b(?:add|create|make|start|set\s+up)\b/.test(query)) return null;
    const currentAccount = /\b(?:this|(?:the\s+)?current)\s+account\b/.test(query);
    if ((!/\b(?:i|me|my)\b/.test(query) && !currentAccount)
        || !/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|groups?)\b/.test(query)) return null;
    const ownEditAccess = /\bi\s+(?:currently\s+)?have\s+(?:edit(?:ing)?\s+(?:access|permissions?)|permission\s+to\s+edit)\b|\bmy\s+edit(?:ing)?\s+(?:access|permissions?)\b|\b(?:what|which)\b.*\bcan\s+i\s+edit\b/.test(query);
    if (ownEditAccess && /\b(?:what|which|list|show)\b/.test(query))
        return /\bgroups?\b/.test(query) ? 'groups-with-access' : 'list';
    if (!/\b(?:manage|managed|assigned|own|owned)\b/.test(query)) return null;
    if (/\b(?:where|which page|navigate|go to|how (?:can|do) i (?:find|see|check))\b/.test(query)) return 'navigation';
    if (/^how many\b/.test(query)) return 'list';
    if (/^how\b/.test(query)) return null;
    if (/\b(?:resource\s+)?groups?\b/.test(query)) return /\b(?:delete|remove|hide|unhide|edit|change|update)\b/.test(query)
        ? 'groups-with-access' : 'groups';
    if (/\b(?:what|which|list|show|any|have|do i)\b/.test(query)) return 'list';
    return null;
}

export function createGuideManagedResourceLoader({ hard = getHardAssets, soft = getSoftAssets } = {}) {
    return async (actor, env) => {
        requireManagedActor(actor);
        const internal = managedListRouter(actor, hard, soft);
        const groups = await Promise.all(MANAGED_SOURCES.map(async ({ type, path, assetMode }) => {
            const params = new URLSearchParams({ scope: 'managed', page: '1', pageSize: String(PAGE_SIZE), summary: 'true' });
            if (assetMode) params.set('assetMode', assetMode);
            const response = await internal.fetch(new Request(`http://guide.internal/${path}?${params}`), env);
            if (!response.ok) throw new Error('Managed resource list unavailable');
            const payload = await response.json();
            if (!Array.isArray(payload?.data) || !Number.isSafeInteger(payload?.pagination?.totalCount))
                throw new Error('Managed resource list unavailable');
            return {
                type,
                totalCount: payload.pagination.totalCount,
                names: payload.data.slice(0, PAGE_SIZE).map((item) => String(item?.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)).filter(Boolean),
            };
        }));
        return groups;
    };
}

// Explicit, read-only lookup for a listing the person chooses in the Guide.
// The existing managed list remains the authority for both scope and permissions.
export function createGuideManagedAccessLoader({ hard = getHardAssets, soft = getSoftAssets } = {}) {
    return async (actor, query, env) => {
        requireManagedActor(actor);
        const internal = managedListRouter(actor, hard, soft);
        const groups = await Promise.all(MANAGED_SOURCES.map(async ({ type, path, assetMode }) => {
            const params = new URLSearchParams({ scope: 'managed', summary: 'true', q: query,
                page: '1', pageSize: String(ACCESS_PAGE_SIZE) });
            if (assetMode) params.set('assetMode', assetMode);
            const response = await internal.fetch(new Request(`http://guide.internal/${path}?${params}`), env);
            if (!response.ok) throw new Error('Managed resource access unavailable');
            const payload = await response.json();
            if (!Array.isArray(payload?.data) || !Number.isSafeInteger(payload?.pagination?.totalCount))
                throw new Error('Managed resource access unavailable');
            const resources = payload.data.map((item) => {
                const permissions = item?.permissions;
                if (!Number.isSafeInteger(item?.id) || item.id <= 0 || typeof item?.name !== 'string'
                    || !permissions || ['canEdit', 'canHide', 'canDelete'].some((key) => typeof permissions[key] !== 'boolean'))
                    throw new Error('Managed resource access unavailable');
                return { id: item.id, type, name: item.name.replace(/\s+/g, ' ').trim().slice(0, 120),
                    permissions: { canEdit: permissions.canEdit, canHide: permissions.canHide,
                        canDelete: permissions.canDelete } };
            });
            return { resources, totalCount: payload.pagination.totalCount };
        }));
        return { resources: groups.flatMap((group) => group.resources),
            hasMore: groups.some((group) => group.totalCount > ACCESS_PAGE_SIZE) };
    };
}

export function answerGuideManagedResources({ question, actor, groups } = {}) {
    const intent = guideManagedResourceIntent(question);
    if (!intent) return null;
    const actions = [{ label: 'Open Manage My Resources', route: '/dashboard/resources' }];
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return {
        topicId: 'managed-resources', message: 'Sign in to check the resources assigned to your account. My Directory holds resources you saved for yourself; it is separate from Manage My Resources.',
        actions: [{ label: 'Sign in', route: '/login' }],
    };
    if (actor.isImpersonating) return {
        topicId: 'managed-resources', message: 'Exit User View to check resources assigned to your own account.', actions: [],
    };
    if (!canRequestManagedResourceList(actor)) return {
        topicId: 'managed-resources', message: 'This account does not currently have access to manage resources. My Directory shows resources you saved for yourself, not resources assigned to manage.', actions: [],
    };
    if (intent === 'navigation') return {
        topicId: 'managed-resources', message: 'Open Manage My Resources from the dashboard to see Places, Programmes/services and Resource Groups you can manage. My Directory is for resources you saved for yourself.', actions,
    };
    if (!groups) return null;
    const place = groups.find((group) => group.type === 'hard');
    const offering = groups.find((group) => group.type === 'soft');
    const resourceGroup = groups.find((group) => group.type === 'group');
    if (intent === 'groups' || intent === 'groups-with-access') return resourceGroup?.totalCount ? {
        topicId: 'managed-resources',
        message: `This account can manage ${resourceGroup.totalCount} Resource Group${resourceGroup.totalCount === 1 ? '' : 's'}: ${resourceGroup.names.join('; ')}${resourceGroup.totalCount > resourceGroup.names.length ? '; and more' : ''}. Open Manage My Resources → Groups for the full, current list.${intent === 'groups-with-access' ? ' Being assigned a Group does not prove you can edit, hide or delete it. Choose an exact Group below to check its current permissions.' : ''}`,
        actions, ...(intent === 'groups-with-access' ? { canCheckManagedListing: true } : {}),
    } : {
        topicId: 'managed-resources', message: 'I found no Resource Groups assigned to this account right now. Open Manage My Resources → Groups to check the current list.', actions,
    };
    const total = (place?.totalCount || 0) + (offering?.totalCount || 0) + (resourceGroup?.totalCount || 0);
    if (!total) return {
        topicId: 'managed-resources', message: 'I found no Places, Programmes/services or Resource Groups assigned to this account right now. Open Manage My Resources to check the current list.', actions,
    };
    const lines = [
        `This account can manage ${place?.totalCount || 0} Place${place?.totalCount === 1 ? '' : 's'}, ${offering?.totalCount || 0} ${offering?.totalCount === 1 ? 'Programme/service' : 'Programmes/services'} and ${resourceGroup?.totalCount || 0} Resource Group${resourceGroup?.totalCount === 1 ? '' : 's'}.`,
        ...(place?.names.length ? [`Places: ${place.names.join('; ')}${place.totalCount > place.names.length ? '; and more' : ''}.`] : []),
        ...(offering?.names.length ? [`Programmes/services: ${offering.names.join('; ')}${offering.totalCount > offering.names.length ? '; and more' : ''}.`] : []),
        ...(resourceGroup?.names.length ? [`Resource Groups: ${resourceGroup.names.join('; ')}${resourceGroup.totalCount > resourceGroup.names.length ? '; and more' : ''}.`] : []),
        'Open Manage My Resources for the full, current list. My Directory holds resources you saved for yourself.',
    ];
    return { topicId: 'managed-resources', message: lines.join('\n'), actions };
}
