import express from 'express';
import {
  generateMockPaper,
  submitMockExam,
  getUserMockExams,
  getMockExamById,
  deleteMockExam,
  getMockExamStats,
} from '../controllers/mockExamController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All mock exam endpoints require a valid JWT Bearer token.
 */
router.use(protect);

/**
 * @route   GET /api/mock/stats
 * @desc    Get aggregate performance statistics across all the authenticated
 *          user's completed mock exams: average score, pass rate,
 *          per-subject breakdowns, and a 10-exam trend series.
 * @access  Private
 *
 * NOTE: This route MUST be declared before /:id to prevent Express
 *       from treating "stats" as a MongoDB ObjectId parameter.
 */
router.get('/stats', getMockExamStats);

/**
 * @route   GET /api/mock/history
 * @desc    Get the authenticated user's paginated mock exam history.
 *          Ideal answer outlines are excluded from all history responses.
 *
 * Query params:
 *   page     {number} Page number (default: 1)
 *   limit    {number} Results per page (default: 10, max: 50)
 *   subject  {string} Optional subject name filter (case-insensitive)
 *   examType {string} Optional type filter: "syllabus" | "past_paper" | "topic_drill"
 * @access  Private
 */
router.get('/history', getUserMockExams);

/**
 * @route   POST /api/mock/generate
 * @desc    Generate a timed, university-grade mock exam paper using Gemini AI.
 *          Based on a subject name, optional syllabus/topic description, and
 *          the allowed exam duration.  Returns questions without rubrics.
 *
 * Request body:
 *   {
 *     "subjectName":            "Data Structures & Algorithms",
 *     "syllabusOrTopics":       "Sorting, Trees, Graph Theory, Dynamic Programming",
 *     "durationAllowedMinutes": 90,
 *     "examType":               "syllabus" | "past_paper" | "topic_drill"
 *   }
 * @access  Private
 */
router.post('/generate', generateMockPaper);

/**
 * @route   POST /api/mock/submit
 * @desc    Submit completed exam answers for AI grading.  Evaluates each
 *          answer against the stored ideal rubric, computes per-topic accuracy,
 *          derives a letter grade, and generates time-management feedback.
 *
 * Request body:
 *   {
 *     "examId": "<mockExam._id>",
 *     "submissions": [
 *       {
 *         "questionId":       "<question._id>",
 *         "studentAnswer":    "...",
 *         "timeSpentSeconds": 420
 *       }
 *     ]
 *   }
 * @access  Private
 */
router.post('/submit', submitMockExam);

/**
 * @route   GET /api/mock/:id
 * @desc    Get the full report for a specific mock exam.
 *          Before the exam is submitted, the ideal rubric is stripped.
 *          After grading, the full breakdown including evaluator feedback
 *          and the performance summary is returned.
 * @access  Private
 */
router.get('/:id', getMockExamById);

/**
 * @route   DELETE /api/mock/:id
 * @desc    Soft-delete a mock exam from the user's history.
 *          The document is flagged as deleted (not permanently removed)
 *          to preserve aggregate analytics integrity.
 * @access  Private
 */
router.delete('/:id', deleteMockExam);

export default router;
