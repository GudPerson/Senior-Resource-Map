import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { hardAssets, softAssets, subregions, subregionEnquiryContactFields, regionalEmbedEmailGrants } from '../db/schema.js';
import { normalizeRole } from '../utils/roles.js';
import { buildAuditLogInsert } from '../utils/auditTrail.js';
import { executeAtomicBatch } from '../utils/atomicWrites.js';
import { buildRegionalContactHref } from '../../../shared/regionalDiscoveryContactValues.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
const note = z.string().trim().min(1).max(2000).refine(value => !/[\u0000-\u001f\u007f]/.test(value));
const baseSchema = z.object({ revision: z.number().int().nonnegative().max(2147483646), status: z.enum(['approved', 'withdrawn']), provenance: note, withdrawalReason: note.optional() });
const contactSchema = baseSchema.extend({ value: z.string().max(254).optional() }).strict();
const emailSchema = baseSchema.extend({ approvedOriginalEmail: z.string().max(254).optional() }).strict();
function requireAdmin(actor) {
    if (!actor?.id) throw fail(401, 'Authentication required.');
    if (normalizeRole(actor.role) !== 'super_admin') throw fail(403, 'Super Admin approval is required.');
}
function positiveId(raw) {
    if (!/^[1-9]\d*$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 2147483647) throw fail(400, 'Invalid record identifier.');
    return Number(raw);
}
function canonical(field, value) {
    const candidate = typeof value === 'string' ? value.trim() : value;
    const href = buildRegionalContactHref(field, candidate);
    if (!href) throw fail(400, 'Invalid contact value.');
    return field === 'email' ? candidate : href.slice(4);
}
async function hash(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function target(db, kind, params) {
    if (kind === 'contact') {
        const subregionId = positiveId(params.id);
        const field = params.field;
        if (!['email', 'phone'].includes(field)) throw fail(400, 'Unsupported contact field.');
        const [sr] = await db.select().from(subregions).where(eq(subregions.id, subregionId)).limit(1);
        if (!sr) throw fail(404, 'Subregion not found.');
        if (!String(sr.subregionCode || '').trim() || /^(SIN|SG|SINGAPORE|NATIONAL)$/i.test(sr.subregionCode.trim())) throw fail(400, 'Choose a configured local subregion.');
        return { table: subregionEnquiryContactFields, identity: { subregionId, field }, where: and(eq(subregionEnquiryContactFields.subregionId, subregionId), eq(subregionEnquiryContactFields.field, field)), field, valueKey: 'value', lockKey: `contact:${subregionId}:${field}` };
    }
    const resourceType = params.resourceType, resourceId = positiveId(params.resourceId);
    if (!['hard', 'soft'].includes(resourceType)) throw fail(400, 'Unsupported resource type.');
    const table = resourceType === 'hard' ? hardAssets : softAssets;
    const [resource] = await db.select({ contactEmail: table.contactEmail }).from(table).where(eq(table.id, resourceId)).limit(1);
    if (!resource) throw fail(404, 'Resource not found.');
    return { table: regionalEmbedEmailGrants, identity: { resourceType, resourceId }, where: and(eq(regionalEmbedEmailGrants.resourceType, resourceType), eq(regionalEmbedEmailGrants.resourceId, resourceId)), field: 'email', valueKey: 'approvedOriginalEmail', currentEmail: resource.contactEmail, lockKey: `grant:${resourceType}:${resourceId}` };
}
function format(row, spec) {
    if (!row) return { ...spec.identity, revision: 0, status: 'absent' };
    const result = { ...spec.identity, revision: row.revision, status: row.status, provenance: row.provenance,
        approvedByUserId: row.approvedByUserId, approvedAt: row.approvedAt,
        withdrawnByUserId: row.withdrawnByUserId, withdrawnAt: row.withdrawnAt,
        withdrawalReason: row.withdrawalReason, updatedAt: row.updatedAt };
    if (row.status === 'approved') {
        result[spec.valueKey] = row[spec.valueKey];
        result.href = buildRegionalContactHref(spec.field, row[spec.valueKey]);
    }
    return result;
}

async function read(db, actor, kind, params) {
    requireAdmin(actor);
    const spec = await target(db, kind, params);
    const [row] = await db.select().from(spec.table).where(spec.where).limit(1);
    return format(row, spec);
}
async function write(db, actor, kind, params, raw) {
    requireAdmin(actor);
    const parsed = (kind === 'contact' ? contactSchema : emailSchema).safeParse(raw);
    if (!parsed.success) throw fail(400, 'Invalid approval request.');
    const body = parsed.data, spec = await target(db, kind, params);
    const approved = body.status === 'approved';
    if ((approved && body.withdrawalReason !== undefined) || (!approved && (body[spec.valueKey] !== undefined || !body.withdrawalReason))) throw fail(400, 'Approval or withdrawal fields do not match the requested status.');
    const value = approved ? canonical(spec.field, body[spec.valueKey]) : null;
    if (approved && kind === 'grant' && value !== canonical('email', spec.currentEmail)) throw fail(400, 'Approval must match the current original resource email.');
    const [current] = await db.select().from(spec.table).where(spec.where).limit(1);
    if ((current?.revision || 0) !== body.revision) throw fail(409, 'Approval changed. Reload before trying again.');
    const timestamp = new Date();
    const patch = { status: body.status, [spec.valueKey]: value, valueHash: value === null ? null : await hash(value), provenance: body.provenance, revision: body.revision + 1,
        approvedByUserId: approved ? actor.id : current?.approvedByUserId || null,
        approvedAt: approved ? timestamp : current?.approvedAt || null,
        withdrawnByUserId: approved ? null : actor.id, withdrawnAt: approved ? null : timestamp,
        withdrawalReason: approved ? null : body.withdrawalReason, updatedAt: timestamp };
    const predicate = body.revision === 0 ? sql`NOT EXISTS (SELECT 1 FROM ${spec.table} WHERE ${spec.where})`
        : sql`EXISTS (SELECT 1 FROM ${spec.table} WHERE ${spec.where} AND ${spec.table.revision} = ${body.revision} FOR UPDATE)`;
    const guard = db.select({ verified: sql`jsonb_array_length(CASE WHEN ${predicate} THEN '[]'::jsonb ELSE jsonb_build_object('error', 'regional_revision_conflict') END)` })
        .from(sql`(SELECT pg_advisory_xact_lock(43120, hashtext(${spec.lockKey})) AS locked) AS regional_approval_lock`);
    const mutation = current ? db.update(spec.table).set(patch).where(and(spec.where, eq(spec.table.revision, body.revision))).returning()
        : db.insert(spec.table).values({ ...spec.identity, ...patch }).returning();
    const audit = buildAuditLogInsert(db, actor, {
        actionType: `${kind === 'contact' ? 'regional_contact' : 'regional_original_email'}_${approved ? 'approved' : 'withdrawn'}`,
        entityType: kind === 'contact' ? 'subregion_enquiry_contact' : 'regional_embed_email_grant',
        entityId: kind === 'contact' ? spec.identity.subregionId : spec.identity.resourceId,
        ...(kind === 'grant' ? spec.identity : {}),
        metadata: { ...spec.identity, previousStatus: current?.status || 'absent', status: patch.status, revision: patch.revision, changedFields: [spec.valueKey, 'status', 'provenance'], valuePolicy: 'redacted' },
    });
    try {
        const [, result] = await executeAtomicBatch(db, [guard, mutation, audit], 'regional approval');
        if (!result?.[0]) throw fail(409, 'Approval changed. Reload before trying again.');
        return format(result[0], spec);
    } catch (error) {
        if (error.status) throw error;
        if (error.code === '22023' || error.code === '23505') throw fail(409, 'Approval changed. Reload before trying again.');
        throw fail(503, 'Regional approval is temporarily unavailable.');
    }
}

export function createRegionalDiscoveryGovernanceHandlers(getDatabase = getDb) {
    const handler = (kind, mutate) => async c => {
        c.header('Cache-Control', 'no-store');
        try {
            requireAdmin(c.get('user'));
            const db = getDatabase(c.env);
            const result = mutate ? await write(db, c.get('user'), kind, c.req.param(), await c.req.json()) : await read(db, c.get('user'), kind, c.req.param());
            return c.json(result);
        } catch (error) {
            // Do not log request bodies, recipient values or provenance notes.
            const status = error.status || (error instanceof SyntaxError ? 400 : 503);
            return c.json({ error: status >= 500 ? 'Regional approval is temporarily unavailable.' : error.message }, status);
        }
    };
    return { getContact: handler('contact', false), putContact: handler('contact', true), getEmailGrant: handler('grant', false), putEmailGrant: handler('grant', true) };
}
