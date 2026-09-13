import { z } from 'zod';

import { getDb } from '../db/index.js';
import {
    approveOrganizationOnboardingRequest,
    decideOrganizationJoinRequest,
    listOrganizationJoinRequests,
    listOrganizationOnboardingRequests,
    rejectOrganizationOnboardingRequest,
    submitOrganizationJoinRequest,
    submitOrganizationOnboardingRequest,
} from '../utils/organizationOnboarding.js';
import {
    requiredOneLineTextSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { newPasswordSchema } from '../utils/passwordPolicy.js';

const httpsUrl = z.string().trim().url().max(2000).refine((value) => value.startsWith('https://'), {
    message: 'Use an https:// URL.',
});

const onboardingSchema = z.object({
    organizationName: requiredOneLineTextSchema('Organisation name', 255),
    emailDomain: requiredOneLineTextSchema('Organisation email domain', 255),
    websiteUrl: httpsUrl.optional().or(z.literal('')),
    applicantName: requiredOneLineTextSchema('Applicant name', 255),
    applicantEmail: z.string().trim().email().max(320),
    logoUrl: httpsUrl,
    bannerUrl: httpsUrl,
    termsAccepted: z.literal(true),
    digitalAssetUseGranted: z.literal(true),
});

const joinSchema = z.object({
    email: z.string().trim().email().max(320),
    name: requiredOneLineTextSchema('Name', 255),
    password: newPasswordSchema,
    termsAccepted: z.literal(true),
});

const reasonSchema = z.object({ reason: z.string().trim().min(10).max(2000) });
const approvalSchema = z.object({ accessRole: z.enum(['staff', 'admin']).optional().default('staff') });

function handleError(c, error, fallback) {
    if (!error?.status || error.status >= 500) console.error(`${fallback}:`, error);
    return c.json({
        error: error?.message || fallback,
        ...(error?.code ? { code: error.code } : {}),
    }, error?.status || 500);
}

export async function postOnboardingRequest(c) {
    try {
        const body = validateRequestBody(await c.req.json(), onboardingSchema, 'Organisation onboarding request');
        return c.json({ request: await submitOrganizationOnboardingRequest(getDb(c.env), body) }, 202);
    } catch (error) {
        return handleError(c, error, 'Failed to submit the organisation onboarding request.');
    }
}

export async function getOnboardingRequests(c) {
    try {
        return c.json({ requests: await listOrganizationOnboardingRequests(getDb(c.env)) });
    } catch (error) {
        return handleError(c, error, 'Failed to load organisation onboarding requests.');
    }
}

export async function postOnboardingApproval(c) {
    try {
        const result = await approveOrganizationOnboardingRequest(getDb(c.env), c.get('user'), c.req.param('requestId'));
        return c.json({ result });
    } catch (error) {
        return handleError(c, error, 'Failed to approve the organisation onboarding request.');
    }
}

export async function postOnboardingRejection(c) {
    try {
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Onboarding rejection');
        const result = await rejectOrganizationOnboardingRequest(
            getDb(c.env),
            c.get('user'),
            c.req.param('requestId'),
            body.reason,
        );
        return c.json({ result });
    } catch (error) {
        return handleError(c, error, 'Failed to reject the organisation onboarding request.');
    }
}

export async function postJoinRequest(c) {
    try {
        const body = validateRequestBody(await c.req.json(), joinSchema, 'Organisation access request');
        return c.json({ request: await submitOrganizationJoinRequest(getDb(c.env), body) }, 202);
    } catch (error) {
        return handleError(c, error, 'Failed to submit the organisation access request.');
    }
}

export async function getJoinRequests(c) {
    try {
        return c.json({ requests: await listOrganizationJoinRequests(getDb(c.env), c.get('user')) });
    } catch (error) {
        return handleError(c, error, 'Failed to load organisation access requests.');
    }
}

export async function postJoinApproval(c) {
    try {
        const body = validateRequestBody(await c.req.json().catch(() => ({})), approvalSchema, 'Access approval');
        const result = await decideOrganizationJoinRequest(getDb(c.env), c.get('user'), c.req.param('requestId'), {
            approve: true,
            accessRole: body.accessRole,
        });
        return c.json({ result });
    } catch (error) {
        return handleError(c, error, 'Failed to approve the organisation access request.');
    }
}

export async function postJoinRejection(c) {
    try {
        const body = validateRequestBody(await c.req.json(), reasonSchema, 'Access rejection');
        const result = await decideOrganizationJoinRequest(getDb(c.env), c.get('user'), c.req.param('requestId'), {
            approve: false,
            reason: body.reason,
        });
        return c.json({ result });
    } catch (error) {
        return handleError(c, error, 'Failed to reject the organisation access request.');
    }
}
