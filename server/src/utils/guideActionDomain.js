import { z } from 'zod';
import { sign, verify } from 'hono/jwt';
import { getSessionSecret } from './sessionAuth.js';
import { cleanText, cleanOneLineText } from './inputValidation.js';
import { normalizeOfferingSchedulePlanInput } from './offeringSchedule.js';

export const GUIDE_ACTION_CONTEXT = Symbol('reviewed Guide programme creation');
const line = (max) =>
    z
        .string()
        .max(max)
        .default('')
        .transform((v) => cleanOneLineText(v, max));
const text = (max) =>
    z
        .string()
        .max(max)
        .default('')
        .transform((v) => cleanText(v, max));
const scheduleEntry = z
    .object({
        key: z.string().max(80),
        type: z.enum(['once', 'weekly']),
        startsAt: z.string().max(40),
        endsAt: z.string().max(40).nullable().default(null),
        weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
        repeatUntil: z.string().max(40).nullable().default(null),
        timezone: z.literal('Asia/Singapore').default('Asia/Singapore'),
        status: z.enum(['active', 'cancelled']).default('active'),
        note: z.string().max(1000).default(''),
    })
    .strict();
const schedulePlanSchema = z
    .object({
        enabled: z.boolean(),
        notes: z.string().max(3000).default(''),
        entries: z.array(scheduleEntry).max(20),
    })
    .strict()
    .default({ enabled: false, notes: '', entries: [] })
    .transform((value, ctx) => {
        try {
            return normalizeOfferingSchedulePlanInput(value);
        } catch (err) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: err.message });
            return z.NEVER;
        }
    });
export const guideProgrammeDraftSchema = z
    .object({
        schedulePlan: schedulePlanSchema,
        bucket: z.enum(['Programmes', 'Services']).default('Programmes'),
        name: line(255),
        description: text(6000),
        schedule: text(2000),
        contactPhone: line(50),
        contactEmail: line(255).refine(
            (v) => !v || z.string().email().safeParse(v).success,
            'Enter a valid contact email.',
        ),
        locationId: z.number().int().positive().nullable().default(null),
        visibility: z.enum(['hidden', 'public']).default('hidden'),
    })
    .strict();
export const guideRequestIdSchema = z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase());
export const guideReviewSchema = z
    .object({ draft: guideProgrammeDraftSchema, requestId: guideRequestIdSchema })
    .strict();
export const guideCreateSchema = guideReviewSchema
    .extend({ reviewToken: z.string().min(20).max(3000) })
    .strict();
export function guideActionError(message, status = 400, code) {
    return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}
export function missingGuideFields(draft) {
    return [
        !draft.name && 'name',
        !draft.locationId && 'locationId',
        draft.schedule && !draft.schedulePlan.enabled && 'schedulePlan',
    ].filter(Boolean);
}
export async function fingerprintGuideDraft(draft) {
    const data = new TextEncoder().encode(JSON.stringify(guideProgrammeDraftSchema.parse(draft)));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) =>
        b.toString(16).padStart(2, '0'),
    ).join('');
}
export function guideExternalKey(actorId, requestId) {
    return `guide-programme-${actorId}-${requestId}`;
}
export async function createGuideReview(c, draft, requestId, routing) {
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    const fingerprint = await fingerprintGuideDraft(draft);
    const reviewToken = await sign(
        { purpose: 'guide-programme-v1', actorId: c.get('user').id, requestId, fingerprint, routing, exp },
        `${getSessionSecret(c)}:guide-review-v1`,
        'HS256',
    );
    return { reviewToken, expiresAt: new Date(exp * 1000).toISOString() };
}
export async function verifyGuideReview(c, { draft, requestId, reviewToken }) {
    let claims;
    try {
        claims = await verify(reviewToken, `${getSessionSecret(c)}:guide-review-v1`, {
            alg: 'HS256',
            exp: false,
        });
    } catch {
        throw guideActionError(
            'This preview has expired or changed. Review the programme again.',
            409,
            'GUIDE_REVIEW_REQUIRED',
        );
    }
    const fingerprint = await fingerprintGuideDraft(draft);
    if (
        claims.purpose !== 'guide-programme-v1' ||
        claims.actorId !== c.get('user').id ||
        claims.requestId !== requestId ||
        claims.fingerprint !== fingerprint
    ) {
        throw guideActionError(
            'This preview does not match your changes. Review the programme again.',
            409,
            'GUIDE_REVIEW_REQUIRED',
        );
    }
    return {
        requestId,
        fingerprint,
        externalKey: guideExternalKey(c.get('user').id, requestId),
        locationId: draft.locationId,
        routing: claims.routing,
        expired: !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000),
    };
}
export function buildGuideProgrammePayload(draft) {
    return {
        name: draft.name,
        description: draft.description,
        schedule: draft.schedule,
        contactPhone: draft.contactPhone,
        contactEmail: draft.contactEmail,
        locationIds: [draft.locationId],
        assetMode: 'standalone',
        bucket: draft.bucket,
        subCategory: draft.bucket,
        isHidden: draft.visibility === 'hidden',
        audienceMode: 'public',
        isMemberOnly: false,
        schedulePlan: draft.schedulePlan,
    };
}
