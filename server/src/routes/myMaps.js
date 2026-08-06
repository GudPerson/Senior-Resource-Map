import { Hono } from 'hono';

import { authenticateToken } from '../middleware/auth.js';
import {
    deleteMyMapShare,
    deleteMyMap,
    deleteMyMapAsset,
    deleteMyMapPersonalPlaceRoute,
    getMyMap,
    getMyMaps,
    patchMyMap,
    patchMyMapCategoryOrder,
    patchMyMapAssetShortDescriptor,
    patchMyMapAssetNotes,
    patchMyMapPersonalPlace,
    patchMyMapPersonalPlaceShortDescriptor,
    postMyMap,
    postMyMapAsset,
    postMyMapPersonalPlace,
    postMyMapShare,
} from '../controllers/myMapsController.js';
import {
    postMyMapDuplicate,
} from '../controllers/myMapCopiesController.js';
import {
    getMyMapPrintAnnotations,
    putMyMapPrintAnnotations,
} from '../controllers/printAnnotationsController.js';

const router = new Hono();

router.get('/', authenticateToken, getMyMaps);
router.post('/', authenticateToken, postMyMap);
router.get('/:id', authenticateToken, getMyMap);
router.patch('/:id', authenticateToken, patchMyMap);
router.patch('/:id/category-order', authenticateToken, patchMyMapCategoryOrder);
router.delete('/:id', authenticateToken, deleteMyMap);
router.post('/:id/duplicate', authenticateToken, postMyMapDuplicate);
router.post('/:id/share', authenticateToken, postMyMapShare);
router.delete('/:id/share', authenticateToken, deleteMyMapShare);
router.get('/:id/print-annotations', authenticateToken, getMyMapPrintAnnotations);
router.put('/:id/print-annotations', authenticateToken, putMyMapPrintAnnotations);
router.post('/:id/personal-places', authenticateToken, postMyMapPersonalPlace);
router.patch('/:id/personal-places/:placeId', authenticateToken, patchMyMapPersonalPlace);
router.patch('/:id/personal-places/:placeId/short-description', authenticateToken, patchMyMapPersonalPlaceShortDescriptor);
router.delete('/:id/personal-places/:placeId', authenticateToken, deleteMyMapPersonalPlaceRoute);
router.post('/:id/assets', authenticateToken, postMyMapAsset);
router.patch('/:id/assets/:resourceType/:resourceId/short-description', authenticateToken, patchMyMapAssetShortDescriptor);
router.patch('/:id/assets/:resourceType/:resourceId/notes', authenticateToken, patchMyMapAssetNotes);
router.delete('/:id/assets/:resourceType/:resourceId', authenticateToken, deleteMyMapAsset);

export default router;
