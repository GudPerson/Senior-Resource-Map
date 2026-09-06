import { z } from 'zod';
import { normalizeRole } from './roles.js';

export const SUPPORT_STATUSES = ['open', 'in_progress', 'awaiting_user', 'fix_available', 'resolved'];
export const SUPPORT_MESSAGE_KINDS = ['user', 'staff', 'system'];
export const SUPPORT_GUEST_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class SupportError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export function canReviewSupport(user) {
    const id = Number(user?.id);
    return Number.isSafeInteger(id) && id > 0 && normalizeRole(user.role) === 'super_admin' && !user.isImpersonating;
}

export function requireSupportReviewer(user) {
    if (!canReviewSupport(user)) throw new SupportError('Support review is not available to this account.', 403);
}

export function sanitizeSupportText(value = '') {
    return String(value)
        .replace(/\u0000/g, '')
        .replace(/https?:\/\/\S+/gi, '[link removed]')
        .replace(/(?:^|\s)\/(?:shared\/maps|embed\/maps|membership\/link|auth\/transition)(?:[/#?]\S*)?/gi, ' [private link removed]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
        .replace(/\b[STFGM]\d{7}[A-Z]\b/gi, '[identity number removed]')
        .replace(/\b(?:password|passcode|otp|token|secret|verifier|challenge[_-]?verifier|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S+/gi, '[secret removed]')
        .replace(/(?:\+65[ .-]?|\b)[689]\d{7}\b/g, '[phone number removed]')
        .trim();
}

export function sanitizeSupportContext(value = {}) {
    const path = String(value.pathname || '').split(/[?#]/)[0];
    // Capture a page family, never a private map, shared link, resource ID, or postal code.
    const pathname = [
        '/discover', '/login', '/partner-login', '/my-directory',
        '/dashboard/calendar', '/dashboard/resources', '/dashboard/profile',
        '/dashboard/admin', '/dashboard/support', '/inbox', '/help',
    ].includes(path) ? path
        : path.startsWith('/my-directory/maps/') ? '/my-directory/maps'
            : path.startsWith('/shared/maps/') ? '/shared/maps'
                : path.startsWith('/resource/') ? '/resource' : '/';
    const appVersion = /^[a-f0-9]{7,40}$/.test(value.appVersion || '') ? value.appVersion : '';
    const requestId = /^[a-zA-Z0-9-]{8,80}$/.test(value.requestId || '') ? value.requestId : '';
    return { pathname, appVersion, requestId };
}

export const supportIdSchema = z.string().uuid();
export const supportRevisionSchema = z.number().int().positive();
const plainText = (maximum) => z.string().trim().min(1).max(maximum).transform(sanitizeSupportText)
    .refine((value) => value.length > 0, 'Enter a message without private details.');

export const supportReportSchema = z.object({
    id: supportIdSchema,
    title: plainText(120),
    description: plainText(4000),
    expected: z.string().max(2000).optional().default('').transform(sanitizeSupportText),
    context: z.object({
        pathname: z.string().max(1000).optional(),
        appVersion: z.string().max(40).optional(),
        requestId: z.string().max(80).optional(),
    }).optional().default({}).transform(sanitizeSupportContext),
}).strict();

export const supportReplySchema = z.object({
    requestId: supportIdSchema,
    revision: supportRevisionSchema,
    body: plainText(4000),
}).strict();

export const supportStatusSchema = z.object({
    requestId: supportIdSchema,
    revision: supportRevisionSchema,
    status: z.enum(['open', 'in_progress', 'awaiting_user', 'resolved']),
}).strict();

export const supportProposalSchema = z.object({
    id: supportIdSchema,
    revision: supportRevisionSchema,
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/, 'Enter the full source revision.'),
    target: z.enum(['client', 'server', 'both']),
    summary: plainText(2000),
    testEvidence: plainText(4000),
}).strict();

export const supportVerificationSchema = z.object({
    proposalId: supportIdSchema, revision: supportRevisionSchema,
    testedInProduction: z.literal(true), productionCheck: plainText(2000),
}).strict();

export function parseSupportInput(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) throw new SupportError(result.error.issues[0]?.message || 'Check the submitted details.');
    return result.data;
}

export function validateSupportStatusChange({ currentStatus, nextStatus, reviewer }) {
    if (!SUPPORT_STATUSES.includes(currentStatus)) throw new SupportError('Report state is unavailable.', 409);
    const allowed = reviewer ? ['open', 'in_progress', 'awaiting_user'] : ['open', 'resolved'];
    if (!allowed.includes(nextStatus)) throw new SupportError('This status change is not available.', 403);
    if (currentStatus === nextStatus) return;
    if (reviewer && currentStatus === 'fix_available' && nextStatus !== 'open') {
        throw new SupportError('Reopen the report before starting another investigation.', 409);
    }
}

export async function hashSupportCredential(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createSupportGuestCredential() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateReleaseEvidence(proposal, evidence) {
    if (!proposal?.approved_by_user_id || !proposal.approved_at) {
        throw new SupportError('A human must approve this fix before release verification.', 409);
    }
    const targets = proposal.target === 'both' ? ['client', 'server'] : [proposal.target];
    for (const target of targets) {
        const release = evidence?.[target];
        if (release?.sourceRevision !== proposal.source_revision || release?.healthy !== true) {
            throw new SupportError('The approved fix is not yet verified on production.', 409);
        }
    }
    return Object.fromEntries(targets.map((target) => [target, {
        sourceRevision: evidence[target].sourceRevision,
        checkedAt: evidence[target].checkedAt,
        deploymentId: evidence[target].deploymentId || null,
        verificationMethod: ['client-entry-integrity', 'worker-runtime-version'].includes(evidence[target].verificationMethod)
            ? evidence[target].verificationMethod : null,
        artifactSha256: /^[a-f0-9]{64}$/.test(evidence[target].artifactSha256 || '') ? evidence[target].artifactSha256 : null,
    }]));
}
