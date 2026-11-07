import express from 'express';
import {
  logSession,
  getSmartBreakRecommendation,
  getFocusHistory,
} from '../controllers/focusController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All focus tracker endpoints require JWT authentication
 */
router.use(protect);

/**
 * @route   POST /api/focus/log
 * @desc    Log completed Pomodoro interval, distraction count & mood
 * @access  Private
 */
router.post('/log', logSession);

/**
 * @route   GET /api/focus/recommendation
 * @desc    Get dynamic AI-guided smart break recommendation & burnout evaluation
 * @access  Private
 */
router.get('/recommendation', getSmartBreakRecommendation);

/**
 * @route   GET /api/focus/history
 * @desc    Get past focus sessions and cumulative productivity analytics
 * @access  Private
 */
router.get('/history', getFocusHistory);

export default router;
