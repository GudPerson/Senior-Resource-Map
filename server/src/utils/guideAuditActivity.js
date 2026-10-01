import { Hono } from 'hono';
import { listAuditLogs } from '../controllers/governanceController.js';
import { loadGuideAuditAccess } from './guideAuditAccess.js';
import { normalizeRole } from './roles.js';
import { sanitizeSupportText } from './supportDomain.js';

const DISPLAY_LIMIT = 5;
const DAY = 24 * 60 * 60 * 1000;
const SINGAPORE_OFFSET = 8 * 60 * 60 * 1000;
const AUDIT_ROUTE = '/dashboard/audit';
const RESOURCE_WORD = '(?:resources?|places?|programmes?|programs?|services?|offerings?)';
const PERIOD_WORD = '(?:today|yesterday|recently|(?:in |over |during )?(?:the )?(?:last|past) (?:7|seven) days)';

export function guideAuditActivityIntent(question = '') {
    const query = String(question).toLowerCase().replace(/[’']/g, '').replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
    const who = /\bwho\b.*\b(?:edited|updated|changed)\b/.test(query);
    const list = /\b(?:show|list)\b.*\b(?:edits|updates|changes)\b/.test(query);
    if (!(who || list) || !new RegExp(`\\b${RESOURCE_WORD}\\b`).test(query)
        || /\b(?:saved|planned|attendees|registration|booking|permissions?|access)\b/.test(query)) return null;
    // Only an explicit generic query may load records. Never silently discard
    // a listing name, possessive, custom date, or other requested constraint.
    const broadList = new RegExp(`^(?:show|list) (?:me )?(?:the )?(?:recent |recorded )?${RESOURCE_WORD} (?:edits|updates|changes)(?: (?:from |for )?${PERIOD_WORD})?$`);
    const broadWho = new RegExp(`^who (?:has )?(?:edited|updated|changed) (?:any |all )?(?:resources|places|programmes|programs|services|offerings)(?: ${PERIOD_WORD})?$`);
    const resourceType = /\bplaces?\b/.test(query) ? 'hard'
        : /\b(?:programmes?|programs?|services?|offerings?)\b/.test(query) ? 'soft' : null;
    const broad = broadList.test(query) || broadWho.test(query);
    return {
        resourceType,
        period: /\byesterday\b/.test(query) ? 'yesterday' : /\btoday\b/.test(query) ? 'today' : 'recent',
        // Audit Trail's soft type includes Resource Groups. The existing reader
        // does not expose an Offering-only filter, so do not widen that request.
        canSummarize: broad && resourceType !== 'soft',
        needsTypeFilter: broad && resourceType === 'soft',
    };
}

export function guideAuditActivityRange(period, now = new Date()) {
    const end = new Date(now).getTime();
    if (!Number.isFinite(end) || !['today', 'yesterday', 'recent'].includes(period))
        throw new Error('Invalid audit period.');
    const midnight = Math.floor((end + SINGAPORE_OFFSET) / DAY) * DAY - SINGAPORE_OFFSET;
    return {
        from: new Date(period === 'yesterday' ? midnight - DAY : period === 'today' ? midnight : end - 7 * DAY).toISOString(),
        to: new Date(period === 'yesterday' ? midnight - 1 : end).toISOString(),
    };
}

function displayName(value, fallback) {
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!name || /@|https?:|www\.|[<>]|^(?:user|resource)\s+\d+$/i.test(name)
        || sanitizeSupportText(name) !== name) return fallback;
    return name.slice(0, 100);
}

export function createGuideAuditActivityLoader({ audit = listAuditLogs, access = loadGuideAuditAccess, now = () => new Date() } = {}) {
    return async (actor, env, intent) => {
        if (!actor?.id || normalizeRole(actor.role) === 'guest' || actor.isImpersonating
            || !intent || ![null, 'hard', 'soft'].includes(intent.resourceType)
            || (intent.canSummarize && intent.resourceType === 'soft')
            || !['today', 'yesterday', 'recent'].includes(intent.period)) throw new Error('Audit updates are unavailable.');
        if (!intent.canSummarize) {
            const scope = await access(actor, env);
            if (!['all', 'organizations', 'none'].includes(scope?.mode)
                || (scope.mode === 'all' && normalizeRole(actor.role) !== 'super_admin')) throw new Error('Audit updates are unavailable.');
            return { scope: scope.mode, needsSelection: true };
        }
        const range = guideAuditActivityRange(intent.period, now());
        const params = new URLSearchParams({ limit: String(DISPLAY_LIMIT), actionType: 'resource_updated', ...range });
        if (intent.resourceType) params.set('resourceType', intent.resourceType);
        const internal = new Hono();
        internal.use('*', async (c, next) => { c.set('user', actor); await next(); });
        internal.get('/updates', audit);
        const response = await internal.fetch(new Request(`http://guide.internal/updates?${params}`), env);
        if (response.status === 403) return { scope: 'none' };
        if (!response.ok) throw new Error('Audit updates are unavailable.');
        const payload = await response.json();
        if (!['all', 'organizations'].includes(payload?.scope) || !Array.isArray(payload.logs)
            || payload.logs.length > DISPLAY_LIMIT || payload.limit !== DISPLAY_LIMIT
            || (payload.scope === 'all' && normalizeRole(actor.role) !== 'super_admin')
            || (payload.scope === 'organizations' && (!Array.isArray(payload.organizationIds)
                || !payload.organizationIds.length || payload.organizationIds.some((id) => !Number.isSafeInteger(id) || id <= 0))))
            throw new Error('Audit updates are unavailable.');
        const entries = payload.logs.map((log) => {
            const at = new Date(log?.createdAt).getTime();
            if (log?.actionType !== 'resource_updated' || !['hard', 'soft', 'template'].includes(log.resourceType)
                || (intent.resourceType && log.resourceType !== intent.resourceType)
                || !Number.isFinite(at) || at < new Date(range.from).getTime() || at > new Date(range.to).getTime()
                || (payload.scope === 'organizations' && !payload.organizationIds.includes(log.organizationId)))
                throw new Error('Audit updates are unavailable.');
            return {
                editor: displayName(log.actor?.name, 'Recorded editor'),
                resource: displayName(log.resource?.name, 'Recorded resource'),
                createdAt: new Date(at).toISOString(),
            };
        });
        // No IDs, email, target, organisation label, or metadata leaves this adapter.
        return { scope: payload.scope, ...range, entries, hasMore: Boolean(payload.nextCursor) };
    };
}

export function answerGuideAuditActivity({ actor, intent, activity } = {}) {
    const base = { topicId: 'audit-activity', answerSource: 'account' };
    if (!actor?.id || normalizeRole(actor.role) === 'guest') return { ...base,
        message: 'Sign in to check whether this account may read recorded resource updates in Audit Trail.',
        actions: [{ label: 'Sign in', route: '/login' }] };
    if (actor.isImpersonating) return { ...base,
        message: 'Exit User View before checking recorded resource updates. No Audit Trail records were loaded.', actions: [] };
    if (!activity) return null;
    if (activity.scope === 'none') return { ...base,
        message: 'Audit Trail is not currently available to this account. It requires Super Admin or active organisation-admin access; a Place staff or Region Admin title alone does not grant it. I cannot identify an editor without permitted records.',
        actions: [{ label: 'Open dashboard', route: '/dashboard' }] };
    const actions = [{ label: 'Open Audit Trail', route: AUDIT_ROUTE }];
    if (activity.needsSelection && intent.needsTypeFilter) return { ...base,
        message: 'Audit Trail uses the same resource type for Programmes/services and Resource Groups. I cannot reliably narrow these records to Programmes/services in chat. Open Audit Trail to review the permitted records, or ask “Show resource updates yesterday” for a broader scoped summary. No update records were loaded for this question.', actions };
    if (activity.needsSelection) return { ...base,
        message: 'This account can open Audit Trail, but I cannot match an exact listing or custom date from this chat. I will not attribute an edit to “my Programme”, “this Place” or a named resource without a verified selection. Open Audit Trail to review permitted records. For a scoped overview, ask “Show resource updates yesterday”, “Show Place edits today” or “Show recent resource updates”.', actions };
    const type = intent.resourceType === 'hard' ? 'Place' : 'resource';
    const period = intent.period === 'recent' ? 'over the last seven days' : intent.period;
    const date = (value) => new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(new Date(value));
    const scope = activity.scope === 'all' ? 'across CareAround SG' : 'within this account’s active organisation-admin scope';
    const recorded = activity.entries.length
        ? `Recorded ${type} updates ${period} ${scope} (Singapore time):\n${activity.entries.map((entry) => `${entry.editor} — ${entry.resource} — ${date(entry.createdAt)}`).join('\n')}\n${activity.hasMore ? 'Only the latest five matching records are shown. ' : ''}`
        : `I found no recorded ${type} updates ${period} ${scope} (Singapore time). `;
    return { ...base, message: `${recorded}This checks “Resource updated” audit entries only; it does not prove that no other changes occurred. Open Audit Trail for the permitted record details.`, actions };
}
