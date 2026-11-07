import express from 'express';
import {
  generatePrediction,
  getUserPredictions,
  getPredictionById,
} from '../controllers/predictionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All prediction routes require JWT authentication
 */
router.use(protect);

/**
 * @route   POST /api/predictions/generate
 * @desc    Analyze historical exam papers (PYQs) and predict upcoming questions
 * @access  Private
 */
router.post('/generate', generatePrediction);

/**
 * @route   GET /api/predictions
 * @desc    Get user's history of predicted question papers
 * @access  Private
 */
router.get('/', getUserPredictions);

/**
 * @route   GET /api/predictions/:id
 * @desc    Get details of a specific predicted paper
 * @access  Private
 */
router.get('/:id', getPredictionById);

export default router;
