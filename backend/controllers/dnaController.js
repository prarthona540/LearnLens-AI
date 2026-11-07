import LearningDNA from '../models/LearningDNA.js';
import Quiz from '../models/Quiz.js';
import Note from '../models/Note.js';
import { generateLearningDNAInsights } from '../services/geminiService.js';

/**
 * @desc    Get or initialize authenticated user's Learning DNA profile
 * @route   GET /api/dna
 * @access  Private
 */
export const getLearningDNA = async (req, res) => {
  try {
    let dna = await LearningDNA.findOne({ userId: req.user._id });

    // Auto-initialize if first time accessing
    if (!dna) {
      dna = await LearningDNA.create({
        userId: req.user._id,
        examReadinessScore: 0,
        strongTopics: [],
        weakTopics: [],
        knowledgeGaps: [],
        recommendedActions: [
          {
            action: 'Take your first diagnostic quiz to initialize your Learning DNA baseline',
            priority: 'High',
            resourceType: 'Practice Quiz',
          },
          {
            action: 'Upload your first study note to enable AI summary and concept extraction',
            priority: 'Medium',
            resourceType: 'Review Note',
          },
        ],
        lastUpdated: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      learningDNA: dna,
    });
  } catch (error) {
    console.error(`[Get Learning DNA Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching Learning DNA',
    });
  }
};

/**
 * @desc    Recalculate Learning DNA: Exam Readiness Score, Gap Detection & AI Recommendations
 * @route   POST /api/dna/recalculate
 * @access  Private
 */
export const recalculateLearningDNA = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch all completed quizzes for this user, ordered by most recent first
    const completedQuizzes = await Quiz.find({
      userId,
      isCompleted: true,
    }).sort({ createdAt: -1 });

    // 2. Fetch notes to inspect historically flagged weak topics
    const notes = await Note.find({ userId }).select('title weakTopicsIdentified');

    let examReadinessScore = 0;
    const topicStats = {};
    const quizHistorySummaries = [];

    if (completedQuizzes.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;

      completedQuizzes.forEach((quiz, index) => {
        const totalQ = quiz.totalQuestions || quiz.questions.length || 1;
        const accuracy = Math.round(((quiz.score || 0) / totalQ) * 100);

        // Recency weighting: Quiz 0 (newest) has weight 1.0, decaying gradually
        const weight = 1 / (1 + 0.25 * index);
        weightedSum += accuracy * weight;
        totalWeight += weight;

        quizHistorySummaries.push({
          quizId: quiz._id,
          title: quiz.title,
          score: quiz.score,
          totalQuestions: totalQ,
          accuracyPercentage: accuracy,
          attemptedAt: quiz.updatedAt || quiz.createdAt,
        });

        // Topic-level tracking
        if (Array.isArray(quiz.userAnswers) && quiz.userAnswers.length > 0) {
          quiz.userAnswers.forEach((ans) => {
            const topic = ans.topicTag || 'General Concept';
            if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
            topicStats[topic].total += 1;
            if (ans.isCorrect) topicStats[topic].correct += 1;
          });
        } else if (Array.isArray(quiz.questions)) {
          // Fallback if detailed userAnswers array wasn't populated
          quiz.questions.forEach((q) => {
            const topic = q.topicTag || 'General Concept';
            if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
            topicStats[topic].total += 1;
            if (accuracy >= 80) {
              topicStats[topic].correct += 1;
            }
          });
        }
      });

      examReadinessScore = Math.min(
        100,
        Math.max(0, Math.round(weightedSum / totalWeight))
      );
    }

    // 3. Classify topics into Strong vs Weak based on diagnostic accuracy
    const strongTopics = [];
    const weakTopicsSet = new Set();

    Object.keys(topicStats).forEach((topic) => {
      const { correct, total } = topicStats[topic];
      const accuracy = total > 0 ? correct / total : 0;

      if (accuracy >= 0.75 && correct > 0) {
        strongTopics.push(topic);
      } else {
        weakTopicsSet.add(topic);
      }
    });

    // Also include any weak topics tagged directly in user notes
    notes.forEach((note) => {
      if (Array.isArray(note.weakTopicsIdentified)) {
        note.weakTopicsIdentified.forEach((wt) => {
          if (wt && !strongTopics.includes(wt)) {
            weakTopicsSet.add(wt);
          }
        });
      }
    });

    const weakTopics = Array.from(weakTopicsSet);

    // 4. Generate AI insights and prioritized recommendations via Gemini
    const { knowledgeGaps, recommendedActions } = await generateLearningDNAInsights(
      quizHistorySummaries.slice(0, 5),
      weakTopics
    );

    // 5. Update and persist Learning DNA document
    let dna = await LearningDNA.findOne({ userId });

    if (!dna) {
      dna = new LearningDNA({ userId });
    }

    dna.examReadinessScore = examReadinessScore;
    dna.strongTopics = strongTopics;
    dna.weakTopics = weakTopics;
    dna.knowledgeGaps = knowledgeGaps;
    dna.recommendedActions = recommendedActions;
    dna.lastUpdated = new Date();

    await dna.save();

    return res.status(200).json({
      success: true,
      message: 'Learning DNA recalculated successfully',
      learningDNA: dna,
      analytics: {
        completedQuizzesCount: completedQuizzes.length,
        topicAccuracyBreakdown: topicStats,
      },
    });
  } catch (error) {
    console.error(`[Recalculate Learning DNA Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while recalculating Learning DNA',
    });
  }
};
