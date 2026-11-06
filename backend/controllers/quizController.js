import Quiz from '../models/Quiz.js';
import Note from '../models/Note.js';
import { generateQuizFromNote } from '../services/geminiService.js';

/**
 * @desc    Generate a diagnostic quiz from a note using Google Gemini
 * @route   POST /api/quizzes/generate
 * @access  Private
 */
export const generateQuiz = async (req, res) => {
  try {
    const { noteId, questionCount = 5 } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide noteId to generate a quiz',
      });
    }

    // Ensure note exists and belongs to the authenticated user
    const note = await Note.findOne({ _id: noteId, userId: req.user._id });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found or you do not have permission to access it',
      });
    }

    const contentForQuiz = `${note.title}\n\n${note.rawContent}\n\nSummary:\n${note.summary || ''}`;
    const count = Math.min(Math.max(parseInt(questionCount, 10) || 5, 1), 10);

    // Call Gemini Service
    const questions = await generateQuizFromNote(contentForQuiz, count);

    // Persist new Quiz in MongoDB
    const quiz = await Quiz.create({
      userId: req.user._id,
      noteId: note._id,
      title: `${note.title} — Diagnostic Quiz`,
      questions,
      score: 0,
      totalQuestions: questions.length,
      isCompleted: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Quiz generated successfully from note',
      quiz,
    });
  } catch (error) {
    console.error(`[Quiz Generation Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating quiz',
    });
  }
};

/**
 * @desc    Submit quiz answers and evaluate topic-level gap analysis
 * @route   POST /api/quizzes/:id/submit
 * @access  Private
 */
export const submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body; // Expects array of { questionId, selectedOptionIndex } or { questionIndex, selectedOptionIndex }
    const quizId = req.params.id;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide answers as an array of selections',
      });
    }

    const quiz = await Quiz.findOne({ _id: quizId, userId: req.user._id });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found or unauthorized',
      });
    }

    let score = 0;
    const topicTracker = {};
    const detailedReview = [];

    // Evaluate each question
    quiz.questions.forEach((question, index) => {
      // Find matching user answer by question _id or array index
      const answerMatch = answers.find(
        (a) =>
          (a.questionId && String(a.questionId) === String(question._id)) ||
          a.questionIndex === index
      );

      const selectedOptionIndex =
        answerMatch !== undefined && answerMatch.selectedOptionIndex !== undefined
          ? Number(answerMatch.selectedOptionIndex)
          : null;

      const isCorrect =
        selectedOptionIndex !== null && selectedOptionIndex === question.correctAnswerIndex;

      if (isCorrect) {
        score += 1;
      }

      // Track topic-level diagnostics
      const topic = question.topicTag || 'General Concept';
      if (!topicTracker[topic]) {
        topicTracker[topic] = { total: 0, correct: 0 };
      }
      topicTracker[topic].total += 1;
      if (isCorrect) {
        topicTracker[topic].correct += 1;
      }

      detailedReview.push({
        questionId: question._id,
        questionText: question.questionText,
        options: question.options,
        selectedOptionIndex,
        correctAnswerIndex: question.correctAnswerIndex,
        isCorrect,
        explanation: question.explanation,
        topicTag: topic,
      });
    });

    // Compile topic analysis & identify weak gaps
    const topicAnalysis = Object.keys(topicTracker).map((topic) => {
      const stats = topicTracker[topic];
      const accuracy = Math.round((stats.correct / stats.total) * 100);
      return {
        topicTag: topic,
        total: stats.total,
        correct: stats.correct,
        accuracyPercentage: accuracy,
        isGap: accuracy < 75,
      };
    });

    const weakTopicsIdentified = topicAnalysis
      .filter((t) => t.isGap)
      .map((t) => t.topicTag);

    // Update Quiz status in database
    quiz.score = score;
    quiz.isCompleted = true;
    await quiz.save();

    // Optionally update linked note's weak topics
    if (weakTopicsIdentified.length > 0 && quiz.noteId) {
      await Note.findByIdAndUpdate(quiz.noteId, {
        $addToSet: { weakTopicsIdentified: { $each: weakTopicsIdentified } },
      });
    }

    const percentage = Math.round((score / quiz.totalQuestions) * 100) || 0;

    return res.status(200).json({
      success: true,
      message: 'Quiz submitted and evaluated successfully',
      result: {
        quizId: quiz._id,
        score,
        totalQuestions: quiz.totalQuestions,
        percentage,
        topicAnalysis,
        weakTopicsIdentified,
        detailedReview,
      },
    });
  } catch (error) {
    console.error(`[Quiz Submission Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while submitting quiz',
    });
  }
};

/**
 * @desc    Get all quiz attempts for the authenticated user
 * @route   GET /api/quizzes
 * @access  Private
 */
export const getUserQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.user._id })
      .populate('noteId', 'title tags')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: quizzes.length,
      quizzes,
    });
  } catch (error) {
    console.error(`[Get User Quizzes Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching quizzes',
    });
  }
};
