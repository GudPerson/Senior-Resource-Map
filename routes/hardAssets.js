import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import {
    getHardAssets, getHardAssetById,
    createHardAsset, updateHardAsset, deleteHardAsset
} from '../controllers/hardAssetsController.js';

const router = express.Router();

router.get('/', optionalAuth, getHardAssets);
router.get('/:id', optionalAuth, getHardAssetById);

// Protected routes
router.post('/', authenticateToken, createHardAsset);
router.put('/:id', authenticateToken, updateHardAsset);
router.delete('/:id', authenticateToken, deleteHardAsset);

export default router;
