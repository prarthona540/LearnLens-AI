import express from 'express';
import {
  getUserGamificationProfile,
  recordActivity,
  getXpHistory,
  getLeaderboard,
  grantStreakFreeze,
  syncBadges,
} from '../controllers/gamificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All gamification routes require a valid JWT Bearer token.
 */
router.use(protect);

/**
 * @route   GET /api/gamification
 * @desc    Get the authenticated user's full gamification profile:
 *          streak data, XP points, current level, earned badges,
 *          weekly XP ledger, and aggregate activity counters.
 * @access  Private
 */
router.get('/', getUserGamificationProfile);

/**
 * @route   POST /api/gamification/activity
 * @desc    Record a learning activity. Updates the daily streak,
 *          credits XP, increments category counters, and evaluates
 *          badge unlock conditions.
 *
 * Request body:
 *   {
 *     "activityType": "quiz_complete" | "quiz_perfect" | "note_create" |
 *                     "audio_transcribe" | "focus_session" | "boss_victory" |
 *                     "mock_exam_complete" | "mock_exam_pass" | "daily_login",
 *     "xpEarned": 50     // Optional override; defaults to activity-type defaults
 *   }
 * @access  Private
 */
router.post('/activity', recordActivity);

/**
 * @route   GET /api/gamification/history
 * @desc    Get the authenticated user's recent XP activity log
 *          (most recent first) and the rolling 7-day weekly XP breakdown.
 *
 * Query params:
 *   limit {number} - Max entries to return (default: 50, max: 200)
 * @access  Private
 */
router.get('/history', getXpHistory);

/**
 * @route   GET /api/gamification/leaderboard
 * @desc    Get the global student leaderboard ranked by total XP (all-time)
 *          or weekly XP, with the requesting user's own rank highlighted.
 *
 * Query params:
 *   mode  {string} - "alltime" (default) | "weekly"
 *   limit {number} - Max leaderboard rows to return (default: 20, max: 50)
 * @access  Private
 */
router.get('/leaderboard', getLeaderboard);

/**
 * @route   POST /api/gamification/freeze
 * @desc    Grant one streak freeze to the authenticated user (max 3 banked).
 *          A streak freeze auto-consumes when a single day is missed, preserving
 *          the existing streak count.
 * @access  Private
 */
router.post('/freeze', grantStreakFreeze);

/**
 * @route   POST /api/gamification/badges/sync
 * @desc    Re-evaluate all badge unlock conditions against the user's current
 *          gamification state and award any newly qualifying badges.
 *          Useful after bulk XP imports or retroactive data corrections.
 * @access  Private
 */
router.post('/badges/sync', syncBadges);

export default router;
