import express from 'express';
import {
  getLearningDNA,
  recalculateLearningDNA,
} from '../controllers/dnaController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All Learning DNA endpoints require authentication
 */
router.use(protect);

/**
 * @route   GET /api/dna
 * @desc    Get current user's Learning DNA profile (or auto-initialize)
 * @access  Private
 */
router.get('/', getLearningDNA);

/**
 * @route   POST /api/dna/recalculate
 * @desc    Recalculate exam readiness, gap analysis & AI recommendations
 * @access  Private
 */
router.post('/recalculate', recalculateLearningDNA);

export default router;
