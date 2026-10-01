import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { organizationAccessMemberships } from '../db/schema.js';
import { ensureBoundarySchema } from './boundarySchema.js';
import { normalizeOrganizationAccessRole } from './governance.js';
import { normalizeRole } from './roles.js';

export function guideOrganizationAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:organisation|organization|org)\s+(?:workspace|admin(?:istration)?|access)\b|\b(?:organisation|organization)s?\b/.test(query)) return false;
    if (/\b(?:resources?|places?|programmes?|programs?|services?|offerings?|groups?)\b/.test(query)) return false;
    if (!/\b(?:can|could|may|do|am)\s+i\b|\bmy\s+(?:account|access|organisation|organization)\b|\bavailable\s+to\s+me\b/.test(query)) return false;
    return /\b(?:access|open|view|see|use|manage|admin|allowed|available)\b/.test(query)
        && !/\b(?:create|register|join|delete|archive|add\s+(?:a\s+)?member)\b/.test(query);
}

export async function loadGuideOrganizationAccess(actor, env) {
    const db = getDb(env);
    await ensureBoundarySchema(db, env);
    const rows = await db.select({ accessRole: organizationAccessMemberships.accessRole })
        .from(organizationAccessMemberships).where(and(
            eq(organizationAccessMemberships.userId, actor.id),
            isNull(organizationAccessMemberships.revokedAt),
        ));
    const roles = rows.map((row) => normalizeOrganizationAccessRole(row.accessRole));
    return {
        platformAdmin: normalizeRole(actor.role) === 'super_admin',
        workspaceAdmin: roles.includes('admin'),
        workspaceView: roles.includes('admin') || roles.includes('staff'),
    };
}

export function answerGuideOrganizationAccess(actor, access) {
    const base = { topicId: 'organization-access', answerSource: 'account' };
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return { ...base,
        message: 'Sign in to check whether this account can open Organisation Workspace. The Guide cannot grant organisation access.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    if (actor.isImpersonating) return { ...base,
        message: 'Exit User View before checking organisation access or making changes. The Guide cannot grant access from User View.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    if (!access) return null;
    if (typeof access.platformAdmin !== 'boolean' || typeof access.workspaceAdmin !== 'boolean'
        || typeof access.workspaceView !== 'boolean' || (access.workspaceAdmin && !access.workspaceView)) {
        throw new Error('Invalid organisation access scope.');
    }
    if (access.platformAdmin) return { ...base,
        message: 'This account is Super Admin and can manage organisation records in Admin → Organisations. Organisation Workspace appears separately when this account also has active organisation access. Organisation governance access does not by itself grant editing rights over a Place or Programme/service; the Guide cannot change organisation records in chat.',
        actions: [{ label: 'Open Admin', route: '/dashboard/admin' }] };
    if (access.workspaceAdmin) return { ...base,
        message: 'This account currently has active Organisation Admin access to at least one organisation. Open Organisation Workspace from the dashboard to review its profile and access; changes there are checked again by the server. Organisation governance access does not by itself grant editing rights over a Place or Programme/service. The Guide cannot change organisation records in chat.',
        actions: [{ label: 'Open Organisation Workspace', route: '/dashboard/organization' }] };
    if (access.workspaceView) return { ...base,
        message: 'This account currently has active Organisation Staff access. Open Organisation Workspace from the dashboard to view its assigned organisation context. Staff access there is read-only; it does not grant organisation administration or editing rights over a Place or Programme/service.',
        actions: [{ label: 'Open Organisation Workspace', route: '/dashboard/organization' }] };
    return { ...base,
        message: 'Organisation Workspace is not currently available to this account. It requires active organisation access; a Place staff or Region Admin title alone does not grant it. The Guide cannot grant access.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
}
