import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import {
    organizationAccessMemberships,
    organizationAgreements,
    organizationAssetPacks,
    organizationDomains,
    organizationJoinRequests,
    organizationOnboardingRequests,
    partnerOrganizations,
    users,
} from '../db/schema.js';
import { buildAuditLogInsert } from './auditTrail.js';
import { executeAtomicBatch, reserveSerialId } from './atomicWrites.js';
import { normalizeRole } from './roles.js';

export const ORGANIZATION_PILOT_TERMS_VERSION = 'organization-pilot-2026-09-v1';

const PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'googlemail.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'yahoo.com',
    'icloud.com',
    'proton.me',
    'protonmail.com',
]);

function httpError(status, message, code = null) {
    const error = new Error(message);
    error.status = status;
    if (code) error.code = code;
    return error;
}

function clean(value, maxLength = 1000) {
    return String(value || '').trim().slice(0, maxLength);
}

export function normalizeOrganizationDomain(value) {
    return clean(value, 255)
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .replace(/\.$/, '');
}

export function organizationDomainFromEmail(value) {
    const email = clean(value, 320).toLowerCase();
    const at = email.lastIndexOf('@');
    return at > 0 ? normalizeOrganizationDomain(email.slice(at + 1)) : '';
}

function assertOrganizationEmail(email, expectedDomain = '') {
    const domain = organizationDomainFromEmail(email);
    if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) {
        throw httpError(400, 'Use an organisation-issued email address.', 'organization_email_required');
    }
    if (expectedDomain && domain !== normalizeOrganizationDomain(expectedDomain)) {
        throw httpError(400, 'Applicant email must use the organisation domain.');
    }
    return domain;
}

function hasOrganizationAdminAccess(actor, organizationId) {
    if (normalizeRole(actor?.role) === 'super_admin') return true;
    return Array.isArray(actor?.organizationAccess) && actor.organizationAccess.some((entry) => (
        Number(entry?.organizationId) === Number(organizationId)
        && !entry?.revokedAt
        && String(entry?.accessRole || '').trim().toLowerCase() === 'admin'
    ));
}

async function requireOrganizationAdmin(actor, organizationId) {
    if (!hasOrganizationAdminAccess(actor, organizationId)) {
        throw httpError(403, 'Organisation Admin access is required.');
    }
}

function buildPendingDecisionGuard(db, tableName, requestId, namespace) {
    const id = Number.parseInt(String(requestId), 10);
    if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Invalid request id.');
    if (!['organization_onboarding_requests', 'organization_join_requests'].includes(tableName)) {
        throw new Error('Unsupported decision guard table.');
    }
    const table = sql.raw(`"${tableName}"`);
    return db.select({
        verified: sql`jsonb_array_length(
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM ${table}
                    WHERE id = ${id} AND status = 'pending'
                    FOR UPDATE
                ) THEN '[]'::jsonb
                ELSE jsonb_build_object('error', 'request_not_pending')
            END
        )`,
    }).from(sql`(
        SELECT pg_advisory_xact_lock(${namespace}, ${id}) AS locked
    ) AS carearound_decision_lock`);
}

export async function findVerifiedOrganizationForEmail(db, email) {
    const domain = organizationDomainFromEmail(email);
    if (!domain) return null;
    const [row] = await db.select({ domain: organizationDomains, organization: partnerOrganizations })
        .from(organizationDomains)
        .innerJoin(partnerOrganizations, eq(organizationDomains.organizationId, partnerOrganizations.id))
        .where(and(
            sql`lower(${organizationDomains.domain}) = ${domain}`,
            eq(organizationDomains.status, 'verified'),
            isNull(organizationDomains.revokedAt),
            eq(partnerOrganizations.governanceStatus, 'active'),
        ))
        .limit(1);
    return row || null;
}

export async function submitOrganizationOnboardingRequest(db, input) {
    const emailDomain = normalizeOrganizationDomain(input.emailDomain);
    if (!emailDomain || !emailDomain.includes('.')) throw httpError(400, 'Enter a valid organisation email domain.');
    assertOrganizationEmail(input.applicantEmail, emailDomain);
    if (input.termsAccepted !== true || input.digitalAssetUseGranted !== true) {
        throw httpError(400, 'Terms and digital asset use permission must be accepted.');
    }
    const [existingDomain] = await db.select({ id: organizationDomains.id })
        .from(organizationDomains)
        .where(and(sql`lower(${organizationDomains.domain}) = ${emailDomain}`, isNull(organizationDomains.revokedAt)))
        .limit(1);
    if (existingDomain) throw httpError(409, 'This organisation domain is already registered.', 'organization_already_registered');
    const [pending] = await db.select({ id: organizationOnboardingRequests.id })
        .from(organizationOnboardingRequests)
        .where(and(
            sql`lower(${organizationOnboardingRequests.emailDomain}) = ${emailDomain}`,
            eq(organizationOnboardingRequests.status, 'pending'),
        )).limit(1);
    if (pending) throw httpError(409, 'An onboarding request for this organisation is already under review.', 'organization_request_pending');
    const [request] = await db.insert(organizationOnboardingRequests).values({
        organizationName: clean(input.organizationName, 255),
        emailDomain,
        websiteUrl: clean(input.websiteUrl, 2000) || null,
        applicantName: clean(input.applicantName, 255),
        applicantEmail: clean(input.applicantEmail, 320).toLowerCase(),
        logoUrl: clean(input.logoUrl, 2000),
        bannerUrl: clean(input.bannerUrl, 2000),
        termsVersion: ORGANIZATION_PILOT_TERMS_VERSION,
        termsAcceptedAt: new Date(),
        digitalAssetUseGranted: true,
    }).returning();
    return {
        id: request.id,
        status: request.status,
        organizationName: request.organizationName,
        emailDomain: request.emailDomain,
        submittedAt: request.createdAt,
    };
}

export async function listOrganizationOnboardingRequests(db) {
    return db.select({
        id: organizationOnboardingRequests.id,
        organizationName: organizationOnboardingRequests.organizationName,
        emailDomain: organizationOnboardingRequests.emailDomain,
        websiteUrl: organizationOnboardingRequests.websiteUrl,
        applicantName: organizationOnboardingRequests.applicantName,
        applicantEmail: organizationOnboardingRequests.applicantEmail,
        logoUrl: organizationOnboardingRequests.logoUrl,
        bannerUrl: organizationOnboardingRequests.bannerUrl,
        termsVersion: organizationOnboardingRequests.termsVersion,
        termsAcceptedAt: organizationOnboardingRequests.termsAcceptedAt,
        status: organizationOnboardingRequests.status,
        reviewReason: organizationOnboardingRequests.reviewReason,
        createdOrganizationId: organizationOnboardingRequests.createdOrganizationId,
        createdAt: organizationOnboardingRequests.createdAt,
        reviewedAt: organizationOnboardingRequests.reviewedAt,
    }).from(organizationOnboardingRequests)
        .orderBy(desc(organizationOnboardingRequests.createdAt));
}

export async function approveOrganizationOnboardingRequest(db, actor, requestId) {
    if (normalizeRole(actor?.role) !== 'super_admin') throw httpError(403, 'Super Admin access is required.');
    const [request] = await db.select().from(organizationOnboardingRequests)
        .where(eq(organizationOnboardingRequests.id, Number(requestId))).limit(1);
    if (!request) throw httpError(404, 'Onboarding request was not found.');
    if (request.status !== 'pending') throw httpError(409, 'This onboarding request has already been decided.');
    const [existingDomain] = await db.select({ id: organizationDomains.id }).from(organizationDomains)
        .where(and(sql`lower(${organizationDomains.domain}) = ${request.emailDomain}`, isNull(organizationDomains.revokedAt))).limit(1);
    if (existingDomain) throw httpError(409, 'This organisation domain is already registered.');
    const now = new Date();
    const [organizationId, agreementId] = await Promise.all([
        reserveSerialId(db, 'partnerOrganizations'),
        reserveSerialId(db, 'organizationAgreements'),
    ]);
    const organization = {
        id: organizationId,
        name: request.organizationName,
        description: `Organisation-led CareAround SG pilot participant. Website: ${request.websiteUrl || 'not supplied'}`,
        governanceStatus: 'active',
        dataContactName: request.applicantName,
        dataContactEmail: request.applicantEmail,
        createdByUserId: actor.id,
        updatedByUserId: actor.id,
    };
    const agreement = {
        id: agreementId,
        organizationId: organization.id,
        agreementReference: `ONBOARD-${request.id}`,
        agreementType: 'content_and_digital_assets',
        status: 'active',
        effectiveAt: now,
        allowedUses: {
            publicListing: true,
            externalSharing: true,
            notifications: true,
            aiAssistedEnrichment: false,
            aggregateAnalytics: false,
            restrictedFiles: false,
        },
        reviewedByUserId: actor.id,
        approvedByUserId: actor.id,
        reviewedAt: now,
        approvedAt: now,
        createdByUserId: actor.id,
        updatedByUserId: actor.id,
    };
    await executeAtomicBatch(db, [
        buildPendingDecisionGuard(db, 'organization_onboarding_requests', request.id, 43110),
        db.insert(partnerOrganizations).values(organization),
        db.insert(organizationAgreements).values(agreement),
        db.insert(organizationDomains).values({
            organizationId: organization.id,
            domain: request.emailDomain,
            status: 'verified',
            verifiedByUserId: actor.id,
            verifiedAt: now,
            createdByUserId: actor.id,
        }),
        db.insert(organizationAssetPacks).values({
            organizationId: organization.id,
            agreementId: agreement.id,
            logoUrl: request.logoUrl,
            bannerUrl: request.bannerUrl,
            source: 'organization_supplied',
            status: 'active',
            licenseGrantedAt: request.termsAcceptedAt,
        }),
        db.update(organizationOnboardingRequests).set({
            status: 'approved',
            reviewedByUserId: actor.id,
            reviewedAt: now,
            createdOrganizationId: organization.id,
            updatedAt: now,
        }).where(and(
            eq(organizationOnboardingRequests.id, request.id),
            eq(organizationOnboardingRequests.status, 'pending'),
        )),
        buildAuditLogInsert(db, actor, {
            actionType: 'organization_onboarding_approved',
            entityType: 'organization_onboarding_request',
            entityId: request.id,
            organizationId: organization.id,
            metadata: { organizationName: organization.name, emailDomain: request.emailDomain },
        }),
    ], 'organization onboarding approval');
    return { requestId: request.id, organizationId: organization.id, status: 'approved' };
}

export async function rejectOrganizationOnboardingRequest(db, actor, requestId, reason) {
    if (normalizeRole(actor?.role) !== 'super_admin') throw httpError(403, 'Super Admin access is required.');
    const cleanReason = clean(reason, 2000);
    if (cleanReason.length < 10) throw httpError(400, 'A rejection reason of at least 10 characters is required.');
    const updateQuery = db.update(organizationOnboardingRequests).set({
        status: 'rejected',
        reviewedByUserId: actor.id,
        reviewedAt: new Date(),
        reviewReason: cleanReason,
        updatedAt: new Date(),
    }).where(and(
        eq(organizationOnboardingRequests.id, Number(requestId)),
        eq(organizationOnboardingRequests.status, 'pending'),
    )).returning();
    const [guardResult, updatedRows] = await executeAtomicBatch(db, [
        buildPendingDecisionGuard(db, 'organization_onboarding_requests', requestId, 43110),
        updateQuery,
        buildAuditLogInsert(db, actor, {
            actionType: 'organization_onboarding_rejected',
            entityType: 'organization_onboarding_request',
            entityId: Number(requestId),
            metadata: { reason: cleanReason },
        }),
    ], 'organization onboarding rejection');
    void guardResult;
    const [updated] = updatedRows || [];
    if (!updated) throw httpError(404, 'Pending onboarding request was not found.');
    return { id: updated.id, status: updated.status };
}

export async function submitOrganizationJoinRequest(db, input) {
    const email = clean(input.email, 320).toLowerCase();
    assertOrganizationEmail(email);
    const matched = await findVerifiedOrganizationForEmail(db, email);
    if (!matched) throw httpError(404, 'Register your organisation before creating a staff account.', 'organization_registration_required');
    const [existingUser] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existingUser) throw httpError(409, 'An account already exists for this email.');
    const [pending] = await db.select({ id: organizationJoinRequests.id }).from(organizationJoinRequests)
        .where(and(sql`lower(${organizationJoinRequests.email}) = ${email}`, eq(organizationJoinRequests.status, 'pending'))).limit(1);
    if (pending) throw httpError(409, 'Your access request is already awaiting organisation approval.', 'organization_approval_required');
    if (input.termsAccepted !== true) throw httpError(400, 'You must accept the CareAround SG terms.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const [request] = await db.insert(organizationJoinRequests).values({
        organizationId: matched.organization.id,
        email,
        name: clean(input.name, 255),
        passwordHash,
        termsVersion: ORGANIZATION_PILOT_TERMS_VERSION,
        termsAcceptedAt: new Date(),
    }).returning();
    return {
        id: request.id,
        status: request.status,
        organization: { id: matched.organization.id, name: matched.organization.name },
    };
}

export async function listOrganizationJoinRequests(db, actor) {
    const all = normalizeRole(actor?.role) === 'super_admin';
    const managedIds = new Set((actor?.organizationAccess || [])
        .filter((entry) => !entry?.revokedAt && entry?.accessRole === 'admin')
        .map((entry) => Number(entry.organizationId)));
    const rows = await db.select({ request: organizationJoinRequests, organization: partnerOrganizations })
        .from(organizationJoinRequests)
        .innerJoin(partnerOrganizations, eq(organizationJoinRequests.organizationId, partnerOrganizations.id))
        .orderBy(asc(organizationJoinRequests.createdAt));
    return rows.filter((row) => all || managedIds.has(Number(row.request.organizationId))).map(({ request, organization }) => ({
        id: request.id,
        organizationId: request.organizationId,
        organizationName: organization.name,
        email: request.email,
        name: request.name,
        status: request.status,
        termsVersion: request.termsVersion,
        termsAcceptedAt: request.termsAcceptedAt,
        decisionReason: request.decisionReason || null,
        createdAt: request.createdAt,
        decidedAt: request.decidedAt || null,
        createdUserId: request.createdUserId || null,
    }));
}

async function uniqueUsername(db, email) {
    const base = clean(email.split('@')[0], 100).replace(/[^a-z0-9._-]/gi, '') || 'member';
    let candidate = base;
    for (let counter = 1; counter < 10000; counter += 1) {
        const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${candidate.toLowerCase()}`).limit(1);
        if (!existing) return candidate;
        candidate = `${base}${counter}`;
    }
    throw httpError(409, 'Unable to allocate an account username.');
}

export async function decideOrganizationJoinRequest(db, actor, requestId, { approve, reason = '', accessRole = 'staff' }) {
    const [request] = await db.select().from(organizationJoinRequests)
        .where(eq(organizationJoinRequests.id, Number(requestId))).limit(1);
    if (!request || request.status !== 'pending') throw httpError(404, 'Pending access request was not found.');
    await requireOrganizationAdmin(actor, request.organizationId);
    const now = new Date();
    const cleanReason = clean(reason, 2000);
    if (!approve && cleanReason.length < 10) throw httpError(400, 'A rejection reason of at least 10 characters is required.');
    let createdUserId = null;
    const queries = [buildPendingDecisionGuard(db, 'organization_join_requests', request.id, 43111)];
    if (approve) {
        const grantedRole = accessRole === 'admin' && normalizeRole(actor?.role) === 'super_admin'
            ? 'admin'
            : 'staff';
        const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${request.email}`).limit(1);
        if (existing) throw httpError(409, 'An account already exists for this email.');
        const username = await uniqueUsername(db, request.email);
        createdUserId = await reserveSerialId(db, 'users');
        queries.push(db.insert(users).values({
            id: createdUserId,
            username,
            email: request.email,
            passwordHash: request.passwordHash,
            name: request.name,
            role: 'standard',
        }));
        queries.push(db.insert(organizationAccessMemberships).values({
            organizationId: request.organizationId,
            userId: createdUserId,
            accessRole: grantedRole,
            createdByUserId: actor.id,
            updatedByUserId: actor.id,
        }));
    }
    const status = approve ? 'approved' : 'rejected';
    queries.push(db.update(organizationJoinRequests).set({
        status,
        passwordHash: 'consumed',
        decidedByUserId: actor.id,
        decidedAt: now,
        decisionReason: cleanReason || null,
        createdUserId,
        updatedAt: now,
    }).where(and(
        eq(organizationJoinRequests.id, request.id),
        eq(organizationJoinRequests.status, 'pending'),
    )).returning());
    queries.push(buildAuditLogInsert(db, actor, {
        actionType: approve ? 'organization_join_approved' : 'organization_join_rejected',
        entityType: 'organization_join_request',
        entityId: request.id,
        targetUserId: createdUserId,
        organizationId: request.organizationId,
        metadata: { reason: cleanReason || null },
    }));
    const results = await executeAtomicBatch(db, queries, 'organization join decision');
    const updatedRows = results[approve ? 3 : 1] || [];
    if (!updatedRows[0]) throw httpError(404, 'Pending access request was not found.');
    return { id: request.id, status, createdUserId };
}
