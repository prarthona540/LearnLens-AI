import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  startVivaSession,
  submitVivaAnswer,
  getVivaSessionById,
  getUserVivaSessions,
  abandonVivaSession,
  getVivaStats,
} from '../controllers/vivaController.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  All routes below require a valid JWT (Bearer token).
// ─────────────────────────────────────────────────────────────────────────────
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
//  Aggregate / Collection Routes
//  IMPORTANT: static path segments (/history, /stats) must be declared BEFORE
//  the parameterised route (/:id) to prevent Express matching "history" or
//  "stats" as an ObjectId string.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/viva/stats
 * Aggregate performance statistics for the authenticated user across all
 * Completed viva sessions (score trends, grade distribution, common fallacies).
 */
router.get('/stats', getVivaStats);

/**
 * GET /api/viva/history
 * Paginated list of the authenticated user's viva sessions.
 * Query params: page, limit, status (InProgress|Completed|Abandoned)
 */
router.get('/history', getUserVivaSessions);

// ─────────────────────────────────────────────────────────────────────────────
//  Session Lifecycle Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/viva/start
 * Initialise a new Autonomous Socratic Viva session and generate the
 * examiner's dynamic AI opening question via Gemini.
 *
 * Body: { topic, difficulty?, maxTurns? }
 */
router.post('/start', startVivaSession);

/**
 * POST /api/viva/answer
 * Submit the student's answer to the current examiner question.
 * Either returns the next Socratic question (InProgress) or the
 * complete AI-generated executive scorecard (Completed).
 *
 * Body: { sessionId, studentAnswer, thinkingTimeSeconds? }
 */
router.post('/answer', submitVivaAnswer);

// ─────────────────────────────────────────────────────────────────────────────
//  Single Session Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/viva/:id
 * Retrieve full details of a single viva session by its MongoDB ObjectId.
 */
router.get('/:id', getVivaSessionById);

/**
 * PATCH /api/viva/:id/abandon
 * Mark an InProgress session as Abandoned (preserves the record for audit).
 */
router.patch('/:id/abandon', abandonVivaSession);

export default router;
