import express from 'express';
import {
  synthesizeConstellation,
  getConstellationMap,
  getConstellationSummary,
  patchConstellationNode,
  deleteConstellationMap,
} from '../controllers/constellationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All constellation endpoints require a valid JWT Bearer token.
 */
router.use(protect);

/**
 * @route   GET /api/constellation/summary
 * @desc    Get a lightweight dashboard snapshot of the user's constellation:
 *          overall strength score, category node counts, top gap-bridge
 *          recommendations, and a 500-char insight excerpt.
 *          Returns isSynthesized: false if no map exists yet.
 *
 * NOTE: Declared before /:nodeId to prevent Express treating "summary"
 *       as a nodeId path parameter.
 * @access  Private
 */
router.get('/summary', getConstellationSummary);

/**
 * @route   GET /api/constellation
 * @desc    Get the authenticated user's full Cognitive Holograph constellation
 *          map including all nodes, edges, AI insights, gap-bridge
 *          recommendations, and synthesis metadata.
 *          Returns a structured empty-state payload if no map exists yet
 *          (not a 404) so the frontend can render an onboarding prompt.
 * @access  Private
 */
router.get('/', getConstellationMap);

/**
 * @route   POST /api/constellation/synthesize
 * @desc    Trigger a full AI constellation synthesis for the authenticated user.
 *
 *          The pipeline:
 *            1. Fetches the user's last 10 notes and 15 completed quizzes
 *            2. Pulls weak/strong topic data from their LearningDNA profile
 *            3. Sends a structured prompt to Gemini AI acting as a Cognitive Architect
 *            4. Validates and normalises the returned graph (nodes, edges, insights)
 *            5. Upserts the ConstellationMap document in MongoDB
 *
 *          Includes an optimistic concurrency lock to prevent duplicate
 *          parallel synthesis requests for the same user.
 *
 * Request body (all optional):
 *   {
 *     "subjectTitle": "Data Structures & Algorithms"
 *   }
 * @access  Private
 */
router.post('/synthesize', synthesizeConstellation);

/**
 * @route   PATCH /api/constellation/node/:nodeId
 * @desc    Optimistically update a single concept node's strengthScore and/or
 *          category on the user's existing constellation map.
 *          Used by the frontend after real-time quiz results to reflect
 *          immediate progress without triggering a full re-synthesis.
 *
 * URL param:
 *   nodeId {string} — The node's nodeId string (not a MongoDB _id)
 *
 * Request body (at least one field required):
 *   {
 *     "strengthScore": 85,          // 0–100
 *     "category":      "Mastered"   // Core Concept | Weak Area | Mastered | Bridge Needed
 *   }
 * @access  Private
 */
router.patch('/node/:nodeId', patchConstellationNode);

/**
 * @route   DELETE /api/constellation
 * @desc    Hard-delete the authenticated user's constellation map document.
 *          Use this to reset the map before triggering a completely fresh synthesis.
 * @access  Private
 */
router.delete('/', deleteConstellationMap);

export default router;
