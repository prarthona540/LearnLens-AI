import express from 'express';
import {
  getUserGamificationProfile,
  recordActivity,
} from '../controllers/gamificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All gamification routes require JWT authentication
 */
router.use(protect);

/**
 * @route   GET /api/gamification
 * @desc    Get user's streak count, XP points, current level, and badges
 * @access  Private
 */
router.get('/', getUserGamificationProfile);

/**
 * @route   POST /api/gamification/activity
 * @desc    Record learning activity, update streaks, increment XP, and award badges
 * @access  Private
 */
router.post('/activity', recordActivity);

export default router;
