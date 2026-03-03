import express from 'express';
import { getTags } from '../controllers/tagsController.js';

const router = express.Router();

router.get('/', getTags);

export default router;
