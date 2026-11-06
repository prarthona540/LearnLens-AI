import express from 'express';
import {
  generateQuiz,
  submitQuiz,
  getUserQuizzes,
} from '../controllers/quizController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All quiz endpoints require JWT authentication
 */
router.use(protect);

/**
 * @route   POST /api/quizzes/generate
 * @desc    Generate AI multiple-choice quiz from note content
 * @access  Private
 */
router.post('/generate', generateQuiz);

/**
 * @route   POST /api/quizzes/:id/submit
 * @desc    Submit quiz answers and compute topic gaps
 * @access  Private
 */
router.post('/:id/submit', submitQuiz);

/**
 * @route   GET /api/quizzes
 * @desc    Get all quiz attempt history for the user
 * @access  Private
 */
router.get('/', getUserQuizzes);

export default router;
