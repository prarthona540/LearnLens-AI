import express from 'express';
import {
  getSkillTree,
  generateBossFight,
  evaluateBossBattle,
} from '../controllers/bossQuizController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All boss and skill-tree routes require JWT authentication
 */
router.use(protect);

/**
 * @route   GET /api/boss/skill-tree
 * @desc    Get user's skill tree graph, badges, and boss history
 * @access  Private
 */
router.get('/skill-tree', getSkillTree);

/**
 * @route   POST /api/boss/challenge
 * @desc    Generate a 10-question timed Boss Fight targeting weak topics
 * @access  Private
 */
router.post('/challenge', generateBossFight);

/**
 * @route   POST /api/boss/submit
 * @desc    Submit Boss Fight answers, evaluate damage, award badges & unlock nodes
 * @access  Private
 */
router.post('/submit', evaluateBossBattle);

export default router;
