import { neon } from '@neondatabase/serverless';
import { SupportError } from './supportDomain.js';

// All input is bound as parameters. Each write and its conversation event share
// one SQL statement, so retries cannot leave a status without its message.
const ACCESS = `( $2::boolean OR
    ($3::integer IS NOT NULL AND c.owner_user_id = $3::integer) OR
    ($4::text IS NOT NULL AND c.guest_token_hash = $4::text AND c.guest_expires_at > NOW()) )`;

function accessParams(id, principal) {
    return [id, principal.reviewer === true, principal.userId || null, principal.guestHash || null];
}

export function createRuntimeSupportRepository(env = {}) {
    const databaseUrl = env.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
    if (!databaseUrl) throw new SupportError('Support is temporarily unavailable. Please try again later.', 503);
    const query = neon(databaseUrl);
    return createSupportRepository((text, params) => query(text, params));
}

export function createSupportRepository(query) {
    const repository = {
        async create(report, principal, guestExpiresAt = null) {
            const body = report.expected
                ? `${report.description}\n\nWhat I expected:\n${report.expected}` : report.description;
            const rows = await query(`WITH created AS (
                INSERT INTO support_conversations
                    (id, owner_user_id, guest_token_hash, guest_expires_at, title, context)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                ON CONFLICT (id) DO NOTHING RETURNING *
            ), messages AS (
                INSERT INTO support_messages
                    (conversation_id, sequence, request_key, author_kind, author_user_id, body, event_type)
                SELECT id, 1, 'report', 'user', owner_user_id, $7, 'report_created' FROM created
                UNION ALL
                SELECT id, 2, 'acknowledgement', 'system', NULL,
                    'Your report has been received. Replies and updates will appear in this conversation.',
                    'report_acknowledged' FROM created
                RETURNING conversation_id
            ) SELECT * FROM created`, [report.id, principal.userId || null, principal.guestHash || null,
                guestExpiresAt, report.title, JSON.stringify(report.context), body]);
            if (rows[0]) return rows[0];
            const existing = await repository.get(report.id, principal);
            const messages = await repository.messages(report.id, principal, 0, 1);
            const sameContext = ['pathname', 'appVersion', 'requestId']
                .every((field) => (existing.context?.[field] || '') === (report.context?.[field] || ''));
            if (existing.title !== report.title || messages[0]?.body !== body || !sameContext) {
                throw new SupportError('This report reference is already in use. Start a new report.', 409);
            }
            return existing;
        },

        async get(id, principal) {
            const rows = await query(`SELECT c.*,
                (SELECT count(*)::integer FROM support_messages m
                 WHERE m.conversation_id = c.id
                 AND m.sequence > CASE WHEN $2::boolean THEN c.staff_read_sequence ELSE c.user_read_sequence END
                 AND m.author_kind != CASE WHEN $2::boolean THEN 'staff' ELSE 'user' END) AS unread_count
                FROM support_conversations c WHERE c.id = $1 AND ${ACCESS}`, accessParams(id, principal));
            if (!rows[0]) throw new SupportError('Report not found or access has expired.', 404);
            return rows[0];
        },

        async list(principal, { before = null, beforeId = null, limit = 30 } = {}) {
            return query(`SELECT c.*,
                (SELECT count(*)::integer FROM support_messages m
                 WHERE m.conversation_id = c.id
                 AND m.sequence > CASE WHEN $2::boolean THEN c.staff_read_sequence ELSE c.user_read_sequence END
                 AND m.author_kind != CASE WHEN $2::boolean THEN 'staff' ELSE 'user' END) AS unread_count
                FROM support_conversations c WHERE ${ACCESS}
                AND ($1::timestamptz IS NULL OR (c.updated_at, c.id) < ($1::timestamptz, $6::text))
                ORDER BY c.updated_at DESC, c.id DESC LIMIT $5`,
            [...accessParams(before, principal), limit, beforeId]);
        },

        async messages(id, principal, after = 0, limit = 50) {
            await repository.get(id, principal);
            return query(`SELECT m.sequence, m.author_kind, m.body, m.event_type, m.created_at
                FROM support_messages m JOIN support_conversations c ON c.id = m.conversation_id
                WHERE c.id = $1 AND ${ACCESS} AND m.sequence > $5
                ORDER BY m.sequence ASC LIMIT $6`, [...accessParams(id, principal), after, limit]);
        },

        async unreadCount(principal) {
            const rows = await query(`SELECT count(*)::integer AS count
                FROM support_conversations c WHERE ${ACCESS}
                AND ($1::text IS NULL) AND EXISTS (SELECT 1 FROM support_messages m
                    WHERE m.conversation_id = c.id
                    AND m.sequence > CASE WHEN $2::boolean THEN c.staff_read_sequence ELSE c.user_read_sequence END
                    AND m.author_kind != CASE WHEN $2::boolean THEN 'staff' ELSE 'user' END)`, accessParams(null, principal));
            return rows[0]?.count || 0;
        },

        async markRead(id, principal, sequence) {
            const readColumn = principal.reviewer ? 'staff_read_sequence' : 'user_read_sequence';
            const rows = await query(`UPDATE support_conversations c
                SET ${readColumn} = GREATEST(${readColumn}, LEAST(revision, $5::integer))
                WHERE c.id = $1 AND ${ACCESS} RETURNING c.*`, [...accessParams(id, principal), sequence]);
            if (!rows[0]) throw new SupportError('Report not found or access has expired.', 404);
            return rows[0];
        },

        async append(id, principal, { revision, requestKey, kind, body, eventType = null, status = null }) {
            const rows = await query(`WITH changed AS (
                UPDATE support_conversations c SET revision = revision + 1,
                    status = COALESCE($10::text, status), updated_at = NOW(),
                    current_proposal_id = CASE WHEN $11::boolean THEN NULL ELSE current_proposal_id END
                WHERE c.id = $1 AND ${ACCESS} AND c.revision = $5
                AND NOT EXISTS (SELECT 1 FROM support_messages WHERE conversation_id = c.id AND request_key = $6)
                RETURNING c.*
            ), message AS (
                INSERT INTO support_messages
                    (conversation_id, sequence, request_key, author_kind, author_user_id, body, event_type)
                SELECT id, revision, $6, $7, $3, $8, $9 FROM changed RETURNING conversation_id
            ) SELECT * FROM changed`, [...accessParams(id, principal), revision, requestKey, kind, body,
                eventType, status, status === 'open']);
            if (rows[0]) return rows[0];
            return repository.retryResult(id, principal, requestKey, { body, kind, eventType });
        },

        async retryResult(id, principal, requestKey, expected = null) {
            const conversation = await repository.get(id, principal);
            const messages = await query(`SELECT body, author_kind, event_type FROM support_messages
                WHERE conversation_id = $1 AND request_key = $2`, [id, requestKey]);
            const message = messages[0];
            if (message && (!expected || (message.body === expected.body
                && message.author_kind === expected.kind && message.event_type === expected.eventType))) {
                return conversation;
            }
            throw new SupportError('This conversation changed. Refresh it before trying again.', 409);
        },

        async propose(id, principal, proposal) {
            const rows = await query(`WITH changed AS (
                UPDATE support_conversations c SET revision = revision + 1, updated_at = NOW(),
                    current_proposal_id = $6, status = 'in_progress'
                WHERE c.id = $1 AND ${ACCESS} AND $2::boolean AND c.revision = $5
                AND NOT EXISTS (SELECT 1 FROM support_fix_proposals WHERE id = $6)
                RETURNING c.*
            ), proposal AS (
                INSERT INTO support_fix_proposals
                    (id, conversation_id, source_revision, target, summary, test_evidence, proposed_by_user_id)
                SELECT $6, id, $7, $8, $9, $10, $3 FROM changed RETURNING id
            ), message AS (
                INSERT INTO support_messages
                    (conversation_id, sequence, request_key, author_kind, author_user_id, body, event_type)
                SELECT id, revision, 'proposal:' || $6, 'system', $3,
                    'A proposed fix is being reviewed. It is not yet available in the app.', 'fix_proposed'
                FROM changed RETURNING conversation_id
            ) SELECT * FROM changed`, [...accessParams(id, principal), proposal.revision, proposal.id,
                proposal.sourceRevision, proposal.target, proposal.summary, proposal.testEvidence]);
            if (rows[0]) return rows[0];
            const current = await repository.getProposal(id, principal, proposal.id);
            if (current.source_revision !== proposal.sourceRevision || current.target !== proposal.target
                || current.summary !== proposal.summary || current.test_evidence !== proposal.testEvidence) {
                throw new SupportError('A proposed fix cannot be edited. Submit a new version for review.', 409);
            }
            return repository.retryResult(id, principal, `proposal:${proposal.id}`);
        },

        async getProposal(id, principal, proposalId) {
            if (!principal.reviewer) throw new SupportError('Support review is not available to this account.', 403);
            const rows = await query(`SELECT p.* FROM support_fix_proposals p
                JOIN support_conversations c ON c.id = p.conversation_id
                WHERE c.id = $1 AND ${ACCESS} AND p.id = $5`, [...accessParams(id, principal), proposalId]);
            if (!rows[0]) throw new SupportError('Proposed fix not found.', 404);
            return rows[0];
        },

        async approve(id, principal, { revision, proposalId }) {
            const rows = await query(`WITH changed AS (
                UPDATE support_conversations c SET revision = revision + 1, updated_at = NOW()
                WHERE c.id = $1 AND ${ACCESS} AND $2::boolean AND c.revision = $5
                AND c.current_proposal_id = $6 AND c.status = 'in_progress'
                AND EXISTS (SELECT 1 FROM support_fix_proposals p
                    WHERE p.id = $6 AND p.conversation_id = c.id AND p.approved_at IS NULL)
                RETURNING c.*
            ), approved AS (
                UPDATE support_fix_proposals SET approved_by_user_id = $3, approved_at = NOW()
                WHERE id = $6 AND conversation_id IN (SELECT id FROM changed) RETURNING id
            ), message AS (
                INSERT INTO support_messages
                    (conversation_id, sequence, request_key, author_kind, author_user_id, body, event_type)
                SELECT id, revision, 'approved:' || $6, 'system', $3,
                    'The fix has been approved. We will update you after it is released and checked.', 'fix_approved'
                FROM changed RETURNING conversation_id
            ) SELECT * FROM changed`, [...accessParams(id, principal), revision, proposalId]);
            if (rows[0]) return rows[0];
            return repository.retryResult(id, principal, `approved:${proposalId}`);
        },

        async verify(id, principal, { revision, proposalId, evidence }) {
            const rows = await query(`WITH changed AS (
                UPDATE support_conversations c SET revision = revision + 1, updated_at = NOW(), status = 'fix_available'
                WHERE c.id = $1 AND ${ACCESS} AND $2::boolean AND c.revision = $5
                AND c.current_proposal_id = $6 AND c.status = 'in_progress'
                AND EXISTS (SELECT 1 FROM support_fix_proposals p WHERE p.id = $6
                    AND p.conversation_id = c.id AND p.approved_by_user_id IS NOT NULL
                    AND p.approved_at IS NOT NULL AND p.verified_at IS NULL)
                RETURNING c.*
            ), verified AS (
                UPDATE support_fix_proposals SET verified_at = NOW(), release_evidence = $7::jsonb
                WHERE id = $6 AND conversation_id IN (SELECT id FROM changed) RETURNING id
            ), message AS (
                INSERT INTO support_messages
                    (conversation_id, sequence, request_key, author_kind, author_user_id, body, event_type)
                SELECT id, revision, 'verified:' || $6, 'system', $3,
                    'The fix for your report has been released and checked in production. Please try it and tell us whether it works.',
                    'fix_available' FROM changed RETURNING conversation_id
            ) SELECT * FROM changed`, [...accessParams(id, principal), revision, proposalId, JSON.stringify(evidence)]);
            if (rows[0]) return rows[0];
            return repository.retryResult(id, principal, `verified:${proposalId}`);
        },
    };
    return repository;
}
