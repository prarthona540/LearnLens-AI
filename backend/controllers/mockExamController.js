import MockExam from '../models/MockExam.js';
import {
  generateMockExamPaper,
  evaluateMockExamSubmission,
} from '../services/mockExamService.js';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Derive a letter grade and pass status from a percentage score.
 * Thresholds follow standard UK university conventions.
 * @param {number} pct - Score percentage (0–100)
 * @returns {{ grade: string, passStatus: string }}
 */
const deriveGrade = (pct) => {
  if (pct >= 70) return { grade: 'A (First Class)',         passStatus: 'Distinction' };
  if (pct >= 60) return { grade: 'B (Upper Second)',        passStatus: 'Merit'       };
  if (pct >= 50) return { grade: 'C (Lower Second)',        passStatus: 'Pass'        };
  if (pct >= 40) return { grade: 'D (Third Class)',         passStatus: 'Pass'        };
  return          { grade: 'F (Fail)',                      passStatus: 'Fail'        };
};

/**
 * Build a per-topic performance breakdown from graded submissions
 * and the original question set.
 * @param {Array} questions - Original exam questions (with marks & topicTag)
 * @param {Array} graded   - Graded submission objects (with marksAwarded)
 * @returns {{ breakdown: Array, weakTopics: string[] }}
 */
const buildTopicBreakdown = (questions, graded) => {
  const topicMap = {};

  questions.forEach((q) => {
    const topic = q.topicTag || 'Core Topic';
    if (!topicMap[topic]) {
      topicMap[topic] = { marksAvailable: 0, marksEarned: 0 };
    }
    topicMap[topic].marksAvailable += q.marks;

    const sub = graded.find(
      (g) => String(g.questionId) === String(q._id)
    );
    if (sub) {
      topicMap[topic].marksEarned += sub.marksAwarded || 0;
    }
  });

  const breakdown = Object.entries(topicMap).map(([topicTag, stats]) => ({
    topicTag,
    marksAvailable: stats.marksAvailable,
    marksEarned: stats.marksEarned,
    accuracyPercentage:
      stats.marksAvailable > 0
        ? Math.round((stats.marksEarned / stats.marksAvailable) * 100)
        : 0,
  }));

  const weakTopics = breakdown
    .filter((t) => t.accuracyPercentage < 60)
    .map((t) => t.topicTag);

  return { breakdown, weakTopics };
};

/**
 * Strip the idealAnswerOutline from each question object so that the
 * student cannot inspect the marking rubric before submitting answers.
 * @param {Array} questions
 * @returns {Array}
 */
const sanitizeQuestionsForClient = (questions) =>
  questions.map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    marks: q.marks,
    topicTag: q.topicTag,
    difficultyLevel: q.difficultyLevel,
  }));

// ─────────────────────────────────────────────
//  Controllers
// ─────────────────────────────────────────────

/**
 * @desc    Generate a timed, university-standard Mock Exam Paper from a
 *          syllabus description, topic list, or free-text prompt using
 *          Google Gemini AI.  Ideal answer rubrics are stored server-side
 *          and are never exposed to the client before submission.
 * @route   POST /api/mock/generate
 * @access  Private
 */
export const generateMockPaper = async (req, res) => {
  try {
    const {
      subjectName,
      syllabusOrTopics = '',
      durationAllowedMinutes = 60,
      examType = 'syllabus',
    } = req.body;

    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a subject or course name',
      });
    }

    const validExamTypes = ['syllabus', 'past_paper', 'topic_drill'];
    const resolvedExamType = validExamTypes.includes(examType) ? examType : 'syllabus';

    const duration = Math.min(300, Math.max(5, parseInt(durationAllowedMinutes, 10) || 60));

    // Parse syllabusOrTopics into an array for the syllabusTopics field
    const topicsArray = syllabusOrTopics
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    // ── Delegate to Gemini Service ──
    const paper = await generateMockExamPaper(
      subjectName.trim(),
      syllabusOrTopics.trim(),
      duration
    );

    // ── Persist to MongoDB ──
    const mockExam = await MockExam.create({
      userId: req.user._id,
      subjectName: subjectName.trim(),
      examType: resolvedExamType,
      syllabusTopics: topicsArray,
      durationAllowedMinutes: duration,
      totalMarks: paper.totalMarks || 100,
      questions: paper.questions,
      userSubmission: [],
      finalScore: 0,
      isCompleted: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Mock exam generated successfully',
      exam: {
        _id: mockExam._id,
        subjectName: mockExam.subjectName,
        examType: mockExam.examType,
        syllabusTopics: mockExam.syllabusTopics,
        durationAllowedMinutes: mockExam.durationAllowedMinutes,
        totalMarks: mockExam.totalMarks,
        // Sanitised — rubrics stripped for client
        questions: sanitizeQuestionsForClient(mockExam.questions),
        createdAt: mockExam.createdAt,
      },
    });
  } catch (error) {
    console.error(`[Generate Mock Paper Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating mock paper',
    });
  }
};

/**
 * @desc    Submit completed mock exam answers.  Each answer is graded by
 *          Gemini AI against the stored ideal rubric.  The controller then
 *          calculates per-topic performance, time efficiency, a letter grade,
 *          and comprehensive time-management feedback.
 * @route   POST /api/mock/submit
 * @access  Private
 *
 * Request body:
 *   {
 *     "examId": "<mockExam._id>",
 *     "submissions": [
 *       {
 *         "questionId": "<question._id>",
 *         "studentAnswer": "...",
 *         "timeSpentSeconds": 420
 *       }
 *     ]
 *   }
 */
export const submitMockExam = async (req, res) => {
  try {
    const { examId, submissions } = req.body;

    if (!examId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide examId for the exam being submitted',
      });
    }

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a non-empty submissions array',
      });
    }

    const mockExam = await MockExam.findOne({
      _id: examId,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!mockExam) {
      return res.status(404).json({
        success: false,
        message: 'Mock exam not found or you are not authorised to submit it',
      });
    }

    if (mockExam.isCompleted) {
      return res.status(409).json({
        success: false,
        message: 'This mock exam has already been submitted and graded',
        examId: mockExam._id,
      });
    }

    // ── Delegate grading to AI service ──────────────────────────────
    const evaluation = await evaluateMockExamSubmission(
      mockExam.questions,
      submissions,
      mockExam.durationAllowedMinutes
    );

    // ── Compute performance summary ──────────────────────────────────
    const percentage =
      mockExam.totalMarks > 0
        ? Math.round((evaluation.finalScore / mockExam.totalMarks) * 100)
        : 0;

    const { grade, passStatus } = deriveGrade(percentage);

    const { breakdown: topicBreakdown, weakTopics } = buildTopicBreakdown(
      mockExam.questions,
      evaluation.gradedSubmissions
    );

    const totalTimeUsedSeconds = submissions.reduce(
      (sum, s) => sum + (Number(s.timeSpentSeconds) || 0),
      0
    );
    const allowedSeconds = mockExam.durationAllowedMinutes * 60;
    const timeEfficiencyPercentage =
      allowedSeconds > 0
        ? Math.min(100, Math.round((totalTimeUsedSeconds / allowedSeconds) * 100))
        : 0;

    // ── Persist results ──────────────────────────────────────────────
    mockExam.userSubmission = evaluation.gradedSubmissions;
    mockExam.finalScore = evaluation.finalScore;
    mockExam.timeManagementFeedback = evaluation.timeManagementFeedback;
    mockExam.isCompleted = true;
    mockExam.performanceSummary = {
      percentageScore: percentage,
      grade,
      passStatus,
      topicBreakdown,
      totalTimeUsedSeconds,
      timeEfficiencyPercentage,
      weakTopicsIdentified: weakTopics,
    };

    await mockExam.save();

    return res.status(200).json({
      success: true,
      message: 'Mock exam evaluated and graded successfully',
      result: {
        examId: mockExam._id,
        subjectName: mockExam.subjectName,
        examType: mockExam.examType,
        finalScore: evaluation.finalScore,
        totalMarks: mockExam.totalMarks,
        percentage,
        grade,
        passStatus,
        timeManagementFeedback: evaluation.timeManagementFeedback,
        performanceSummary: mockExam.performanceSummary,
        gradedSubmissions: evaluation.gradedSubmissions,
      },
    });
  } catch (error) {
    console.error(`[Submit Mock Exam Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while evaluating mock exam',
    });
  }
};

/**
 * @desc    Get the authenticated user's full mock exam history,
 *          sorted newest-first.  Ideal answer rubrics are excluded.
 * @route   GET /api/mock/history
 * @access  Private
 *
 * Query params:
 *   page     {number} Pagination page (default: 1)
 *   limit    {number} Results per page (default: 10, max: 50)
 *   subject  {string} Optional subject name filter (case-insensitive)
 *   examType {string} Optional type filter: "syllabus" | "past_paper" | "topic_drill"
 */
export const getUserMockExams = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id, isDeleted: false };
    if (req.query.subject) {
      filter.subjectName = { $regex: req.query.subject.trim(), $options: 'i' };
    }
    if (req.query.examType) {
      filter.examType = req.query.examType.trim();
    }

    const [exams, total] = await Promise.all([
      MockExam.find(filter)
        .select('-questions.idealAnswerOutline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      MockExam.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: exams.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      exams,
    });
  } catch (error) {
    console.error(`[Get User Mock Exams Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching mock exams',
    });
  }
};

/**
 * @desc    Get the full detailed report for a single mock exam by ID.
 *          If the exam is not yet completed, the ideal answer rubric is
 *          stripped from the response to prevent early revelation.
 * @route   GET /api/mock/:id
 * @access  Private
 */
export const getMockExamById = async (req, res) => {
  try {
    const exam = await MockExam.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Mock exam not found or you are not authorised to view it',
      });
    }

    // Hide rubrics until the exam has been graded
    const responseExam = exam.toObject();
    if (!exam.isCompleted) {
      responseExam.questions = sanitizeQuestionsForClient(exam.questions);
    }

    return res.status(200).json({
      success: true,
      exam: responseExam,
    });
  } catch (error) {
    console.error(`[Get Mock Exam Detail Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching exam details',
    });
  }
};

/**
 * @desc    Soft-delete a mock exam from the authenticated user's history.
 *          The document is flagged isDeleted=true rather than permanently
 *          removed so that historical analytics remain intact.
 * @route   DELETE /api/mock/:id
 * @access  Private
 */
export const deleteMockExam = async (req, res) => {
  try {
    const exam = await MockExam.findOne({
      _id: req.params.id,
      userId: req.user._id,
      isDeleted: false,
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Mock exam not found or already deleted',
      });
    }

    exam.isDeleted = true;
    await exam.save();

    return res.status(200).json({
      success: true,
      message: 'Mock exam removed from your history successfully',
      examId: exam._id,
    });
  } catch (error) {
    console.error(`[Delete Mock Exam Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting mock exam',
    });
  }
};

/**
 * @desc    Get aggregate performance statistics for the authenticated user
 *          across all completed mock exams.  Returns subject-level breakdowns,
 *          average scores, pass rates, and trend data.
 * @route   GET /api/mock/stats
 * @access  Private
 */
export const getMockExamStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const completedExams = await MockExam.find({
      userId,
      isCompleted: true,
      isDeleted: false,
    }).select(
      'subjectName examType totalMarks finalScore performanceSummary durationAllowedMinutes createdAt'
    );

    if (completedExams.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No completed mock exams found',
        stats: {
          totalExamsCompleted: 0,
          overallAveragePercentage: 0,
          overallPassRate: 0,
          bySubject: [],
          recentTrend: [],
        },
      });
    }

    // ── Aggregate by subject ──────────────────────────────────────────
    const subjectMap = {};
    let totalPercentageSum = 0;
    let passCount = 0;

    completedExams.forEach((exam) => {
      const pct = exam.performanceSummary?.percentageScore ?? 0;
      const passed = ['Pass', 'Merit', 'Distinction'].includes(
        exam.performanceSummary?.passStatus
      );

      totalPercentageSum += pct;
      if (passed) passCount += 1;

      const key = exam.subjectName;
      if (!subjectMap[key]) {
        subjectMap[key] = { total: 0, percentageSum: 0, passCount: 0 };
      }
      subjectMap[key].total += 1;
      subjectMap[key].percentageSum += pct;
      if (passed) subjectMap[key].passCount += 1;
    });

    const bySubject = Object.entries(subjectMap).map(([subject, data]) => ({
      subject,
      examCount: data.total,
      averagePercentage: Math.round(data.percentageSum / data.total),
      passRate: Math.round((data.passCount / data.total) * 100),
    }));

    // ── Last 10 exams for trend chart ─────────────────────────────────
    const recentTrend = completedExams
      .slice(-10)
      .map((exam) => ({
        examId: exam._id,
        subjectName: exam.subjectName,
        percentageScore: exam.performanceSummary?.percentageScore ?? 0,
        grade: exam.performanceSummary?.grade ?? 'N/A',
        passStatus: exam.performanceSummary?.passStatus ?? 'Pending',
        date: exam.createdAt,
      }));

    return res.status(200).json({
      success: true,
      stats: {
        totalExamsCompleted: completedExams.length,
        overallAveragePercentage: Math.round(
          totalPercentageSum / completedExams.length
        ),
        overallPassRate: Math.round((passCount / completedExams.length) * 100),
        bySubject,
        recentTrend,
      },
    });
  } catch (error) {
    console.error(`[Get Mock Exam Stats Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while computing exam statistics',
    });
  }
};
