import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import * as resourceController from '../controllers/resourceController.js';

const router = express.Router();

// GET /api/resources — public
router.get('/', resourceController.getResources);

// GET /api/resources/:id — public
router.get('/:id', resourceController.getResourceById);

// POST /api/resources — partner or admin
router.post('/', authenticateToken, requireRole('partner', 'admin'), resourceController.createResource);

// PUT /api/resources/:id — partner (own) or admin (any)
router.put('/:id', authenticateToken, requireRole('partner', 'admin'), resourceController.updateResource);

// DELETE /api/resources/:id — partner (own) or admin (any)
router.delete('/:id', authenticateToken, requireRole('partner', 'admin'), resourceController.deleteResource);

export default router;
