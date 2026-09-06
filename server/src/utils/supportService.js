import {
    SUPPORT_GUEST_LIFETIME_MS, SupportError, hashSupportCredential, parseSupportInput,
    requireSupportReviewer, supportIdSchema, supportProposalSchema, supportReplySchema,
    supportReportSchema, supportStatusSchema, supportVerificationSchema, validateReleaseEvidence, validateSupportStatusChange,
} from './supportDomain.js';

function serializeConversation(row, reviewer = false) {
    return {
        id: row.id,
        title: row.title,
        status: row.status,
        revision: row.revision,
        context: row.context,
        unreadCount: row.unread_count ?? 0,
        readSequence: reviewer ? row.staff_read_sequence : row.user_read_sequence,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(reviewer ? { currentProposalId: row.current_proposal_id } : {}),
    };
}

export async function resolveSupportPrincipal(user, guestCredential = '', reviewer = false, guestMode = false) {
    if (user?.isImpersonating) throw new SupportError('Exit User View before opening support messages.', 403);
    if (reviewer) {
        requireSupportReviewer(user);
        return { reviewer: true, userId: Number(user.id), guestHash: null };
    }
    if (!guestMode && Number.isSafeInteger(Number(user?.id)) && Number(user.id) > 0 && user?.role !== 'guest') {
        return { reviewer: false, userId: Number(user.id), guestHash: null };
    }
    if (!/^[a-f0-9]{64}$/.test(guestCredential)) {
        throw new SupportError('Sign in or use your private report recovery code.', 401);
    }
    return { reviewer: false, userId: null, guestHash: await hashSupportCredential(guestCredential) };
}

export function createSupportService(repository, verifyProduction, now = () => new Date()) {
    return {
        async create(input, principal) {
            if (principal.reviewer) throw new SupportError('Use your own inbox to submit a report.');
            const report = parseSupportInput(supportReportSchema, input);
            const expires = principal.guestHash ? new Date(now().getTime() + SUPPORT_GUEST_LIFETIME_MS) : null;
            return serializeConversation(await repository.create(report, principal, expires));
        },

        async list(principal, pagination) {
            return (await repository.list(principal, pagination)).map((row) => serializeConversation(row, principal.reviewer));
        },

        async unreadCount(principal) {
            return repository.unreadCount(principal);
        },

        async detail(id, principal, after = 0) {
            parseSupportInput(supportIdSchema, id);
            const conversation = await repository.get(id, principal);
            const messages = await repository.messages(id, principal, after, 51);
            return {
                conversation: serializeConversation(conversation, principal.reviewer),
                messages: messages.slice(0, 50).map((message) => ({
                    sequence: message.sequence, author: message.author_kind, body: message.body,
                    eventType: message.event_type, createdAt: message.created_at,
                })),
                hasMore: messages.length > 50,
            };
        },

        async markRead(id, principal, sequence) {
            if (!Number.isSafeInteger(sequence) || sequence < 0) throw new SupportError('Invalid read position.');
            return serializeConversation(await repository.markRead(id, principal, sequence), principal.reviewer);
        },

        async reply(id, principal, input) {
            const data = parseSupportInput(supportReplySchema, input);
            const conversation = await repository.get(id, principal);
            if (conversation.status === 'resolved') throw new SupportError('Reopen this report before replying.', 409);
            const status = !principal.reviewer && conversation.status === 'awaiting_user' ? 'open' : null;
            return serializeConversation(await repository.append(id, principal, {
                revision: data.revision, requestKey: data.requestId,
                kind: principal.reviewer ? 'staff' : 'user', body: data.body, status,
            }), principal.reviewer);
        },

        async changeStatus(id, principal, input) {
            const data = parseSupportInput(supportStatusSchema, input);
            const current = await repository.get(id, principal);
            validateSupportStatusChange({ currentStatus: current.status, nextStatus: data.status, reviewer: principal.reviewer });
            const labels = {
                open: 'The report has been reopened for review.',
                resolved: 'You marked this report as resolved. You can reopen it if the problem returns.',
                in_progress: 'The support team is investigating this report.',
                awaiting_user: 'The support team is waiting for your reply.',
            };
            return serializeConversation(await repository.append(id, principal, {
                revision: data.revision, requestKey: data.requestId, kind: 'system',
                body: labels[data.status], eventType: `status_${data.status}`, status: data.status,
            }), principal.reviewer);
        },

        async propose(id, principal, input) {
            if (!principal.reviewer) throw new SupportError('Support review is not available to this account.', 403);
            const proposal = parseSupportInput(supportProposalSchema, input);
            return serializeConversation(await repository.propose(id, principal, proposal), true);
        },

        async proposal(id, principal, proposalId) {
            parseSupportInput(supportIdSchema, proposalId);
            return repository.getProposal(id, principal, proposalId);
        },

        async approve(id, principal, { proposalId, revision }) {
            if (!principal.reviewer) throw new SupportError('Support review is not available to this account.', 403);
            const current = await repository.get(id, principal);
            if (current.current_proposal_id !== proposalId) throw new SupportError('This proposal has been replaced or reopened.', 409);
            return serializeConversation(await repository.approve(id, principal, { proposalId, revision }), true);
        },

        async verify(id, principal, input) {
            if (!principal.reviewer) throw new SupportError('Support review is not available to this account.', 403);
            const { proposalId, revision, productionCheck } = parseSupportInput(supportVerificationSchema, input);
            const current = await repository.get(id, principal);
            if (current.current_proposal_id !== proposalId) throw new SupportError('This proposal has been replaced or reopened.', 409);
            const proposal = await repository.getProposal(id, principal, proposalId);
            if (!proposal.approved_at || !proposal.approved_by_user_id) {
                throw new SupportError('A human must approve this fix before release verification.', 409);
            }
            // Evidence is obtained by the server, never accepted in request JSON.
            const observed = await verifyProduction(proposal.target);
            const evidence = validateReleaseEvidence(proposal, observed);
            evidence.humanProductionCheck = { reviewerUserId: principal.userId, sourceRevision: proposal.source_revision,
                details: productionCheck, checkedAt: now().toISOString() };
            return serializeConversation(await repository.verify(id, principal, { revision, proposalId, evidence }), true);
        },
    };
}
