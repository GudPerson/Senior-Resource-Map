import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import {
    getSoftAssets, getSoftAssetById,
    createSoftAsset, updateSoftAsset, deleteSoftAsset
} from '../controllers/softAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getSoftAssets);
router.get('/:id', optionalAuth, getSoftAssetById);

// Protected routes
router.post('/', authenticateToken, createSoftAsset);
router.put('/:id', authenticateToken, updateSoftAsset);
router.delete('/:id', authenticateToken, deleteSoftAsset);

export default router;
