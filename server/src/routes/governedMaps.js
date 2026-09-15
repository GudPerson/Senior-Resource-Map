import { Hono } from 'hono';

import {
    getEmbedConfig,
    getMap,
    getMaps,
    getNotifications,
    getPublicEmbedMap,
    getPublicMap,
    getRegions,
    patchMap,
    postArchiveDue,
    postMap,
    postNotificationRead,
    postPublish,
    postResource,
    postResourceWithdrawal,
    postRestore,
    postRetirement,
} from '../controllers/governedMapsController.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import {
    requireGovernedMapLifecycle,
    requireGovernedMaps,
} from '../utils/governedPilotRelease.js';

const router = new Hono();
router.use('*', requireGovernedMaps);

router.get('/public/:token', getPublicMap);
router.get('/public/:token/embed', getPublicEmbedMap);
router.get('/public/:token/embed-config', getEmbedConfig);

router.post('/archive-due', requireGovernedMapLifecycle, authenticateToken, authorize('super_admin'), postArchiveDue);
router.post('/:mapId/retire', requireGovernedMapLifecycle, authenticateToken, postRetirement);
router.post('/:mapId/restore', requireGovernedMapLifecycle, authenticateToken, postRestore);

router.use('*', authenticateToken);
router.get('/regions', getRegions);
router.get('/notifications', getNotifications);
router.post('/notifications/:notificationId/read', postNotificationRead);
router.get('/', getMaps);
router.post('/', postMap);
router.get('/:mapId', getMap);
router.patch('/:mapId', patchMap);
router.post('/:mapId/resources', postResource);
router.post('/:mapId/resources/withdraw', postResourceWithdrawal);
router.post('/:mapId/publish', postPublish);

export default router;
