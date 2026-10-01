import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { organizationAccessMemberships } from '../db/schema.js';
import { ensureBoundarySchema } from './boundarySchema.js';
import { buildAuditAccessScope } from './auditTrail.js';
import { normalizeRole } from './roles.js';

export function guideAuditAccessIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').trim();
    if (!/\b(?:audit\s+trail|audit\s+logs?)\b/.test(query)) return false;
    return /\b(?:can|could|may|do|am)\s+i\b|\b(?:my|me)\s+(?:account|access)\b|\bavailable\s+to\s+me\b/.test(query)
        && /\b(?:access|open|view|see|use|allowed|available)\b/.test(query);
}

export async function loadGuideAuditAccess(actor, env) {
    const db = getDb(env);
    await ensureBoundarySchema(db, env);
    if (normalizeRole(actor?.role) === 'super_admin') return buildAuditAccessScope(actor);
    const rows = await db.select({
        userId: organizationAccessMemberships.userId,
        organizationId: organizationAccessMemberships.organizationId,
        accessRole: organizationAccessMemberships.accessRole,
        revokedAt: organizationAccessMemberships.revokedAt,
    }).from(organizationAccessMemberships).where(and(
        eq(organizationAccessMemberships.userId, actor.id),
        eq(organizationAccessMemberships.accessRole, 'admin'),
        isNull(organizationAccessMemberships.revokedAt),
    ));
    return buildAuditAccessScope(actor, rows);
}

export function answerGuideAuditAccess(actor, scope) {
    const base = { topicId: 'audit-access', answerSource: 'account' };
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return { ...base,
        message: 'Sign in to check whether this account can open Audit Trail. Audit records require current permitted access.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    if (actor.isImpersonating) return { ...base,
        message: 'Exit User View before checking Audit Trail access. No audit records were loaded.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    if (!scope) return null;
    if (scope.mode === 'all') return { ...base,
        message: 'This account can open Audit Trail across CareAround SG. In the dashboard, choose Audit Trail and use Category, Action type or Organisation to narrow the records. For a bounded current summary in the Guide, ask “Show resource updates yesterday” or “Show Place edits today”. The Guide does not display raw audit metadata.',
        actions: [{ label: 'Open Audit Trail', route: '/dashboard/audit' }] };
    if (scope.mode === 'organizations') return { ...base,
        message: 'This account can open Audit Trail for organisations where it currently has active admin access. The server limits the records to those organisations. In the dashboard, choose Audit Trail and use Category, Action type or Organisation to narrow them. For a bounded current summary in the Guide, ask “Show resource updates yesterday” or “Show Place edits today”. The Guide does not display raw audit metadata.',
        actions: [{ label: 'Open Audit Trail', route: '/dashboard/audit' }] };
    if (scope.mode === 'none') return { ...base,
        message: 'Audit Trail is not currently available to this account. It requires Super Admin or active organisation-admin access; a Place staff or Region Admin title alone does not grant it. The Guide cannot grant access or display audit records.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    throw new Error('Invalid Audit Trail access scope.');
}
