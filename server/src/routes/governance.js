import { Hono } from 'hono';

import {
    addOrganizationAccess,
    createGovernanceOrganization,
    createOrganizationAgreement,
    deleteGovernanceOrganization,
    getGovernanceOrganization,
    getMyConsentStatus,
    getMyNotificationPreferences,
    getOrganizationAccessCandidates,
    getOrganizationResourceCandidates,
    linkOrganizationResource,
    listAuditLogs,
    listGovernanceOrganizations,
    listRetentionQueue,
    recordMyConsent,
    recordMyOptOut,
    revokeOrganizationAccess,
    revokeOrganizationAgreement,
    unlinkOrganizationResource,
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
