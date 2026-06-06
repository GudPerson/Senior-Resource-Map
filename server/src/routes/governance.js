import { Hono } from 'hono';

import {
    addOrganizationAccess,
    addGovernanceGroupMember,
    createGovernanceGroup,
    createGovernanceOrganization,
    createOrganizationAgreement,
    deleteGovernanceOrganization,
    getGovernanceOrganization,
    getMyConsentStatus,
    getMyNotificationPreferences,
    getOrganizationAccessCandidates,
    getOrganizationResourceCandidates,
    linkOrganizationResource,
    linkGovernanceGroupOrganization,
    linkGovernanceGroupResource,
    listAuditLogs,
    listGovernanceGroups,
    listGovernanceOrganizations,
    listRetentionQueue,
    recordMyConsent,
    recordMyOptOut,
    revokeGovernanceGroupMember,
    revokeOrganizationAccess,
    revokeOrganizationAgreement,
    unlinkGovernanceGroupOrganization,
    unlinkGovernanceGroupResource,
    unlinkOrganizationResource,
    updateGovernanceGroup,
    updateGovernanceOrganization,
    updateMyNotificationPreferences,
    updateOrganizationAgreement,
    updateResourceFreshness,
    updateRetentionRecord,
} from '../controllers/governanceController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = new Hono();

router.use('*', authenticateToken);

router.get('/organizations', listGovernanceOrganizations);
router.post('/organizations', createGovernanceOrganization);
router.get('/organizations/:id', getGovernanceOrganization);
router.put('/organizations/:id', updateGovernanceOrganization);
router.delete('/organizations/:id', deleteGovernanceOrganization);
router.get('/organizations/:id/access-candidates', getOrganizationAccessCandidates);
router.get('/organizations/:id/resource-candidates', getOrganizationResourceCandidates);
router.post('/organizations/:id/access', addOrganizationAccess);
router.delete('/organizations/:id/access/:membershipId', revokeOrganizationAccess);
router.post('/organizations/:id/agreements', createOrganizationAgreement);
router.put('/organizations/:id/agreements/:agreementId', updateOrganizationAgreement);
router.delete('/organizations/:id/agreements/:agreementId', revokeOrganizationAgreement);
router.post('/organizations/:id/resources', linkOrganizationResource);
router.delete('/organizations/:id/resources/:linkId', unlinkOrganizationResource);

router.get('/groups', listGovernanceGroups);
router.post('/groups', createGovernanceGroup);
router.put('/groups/:id', updateGovernanceGroup);
router.post('/groups/:id/members', addGovernanceGroupMember);
router.delete('/groups/:id/members/:membershipId', revokeGovernanceGroupMember);
router.post('/groups/:id/organizations', linkGovernanceGroupOrganization);
router.delete('/groups/:id/organizations/:linkId', unlinkGovernanceGroupOrganization);
router.post('/groups/:id/resources', linkGovernanceGroupResource);
router.delete('/groups/:id/resources/:linkId', unlinkGovernanceGroupResource);

router.get('/me/consents', getMyConsentStatus);
router.post('/me/consents', recordMyConsent);
router.get('/me/notification-preferences', getMyNotificationPreferences);
router.put('/me/notification-preferences', updateMyNotificationPreferences);
router.post('/me/opt-outs', recordMyOptOut);

router.get('/audit-logs', listAuditLogs);
router.get('/retention', listRetentionQueue);
router.patch('/retention/:id', updateRetentionRecord);
router.patch('/resources/:type/:id/freshness', updateResourceFreshness);

export default router;
