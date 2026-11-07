import VivaSession from '../models/VivaSession.js';
import {
  generateOpeningQuestion,
  generateNextSocraticQuestion,
  generateVivaEvaluation,
} from '../services/vivaService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the client-safe representation of a viva session.
 * Always includes the full turn history and current status.
 * Evaluation fields are only included when the session is Completed.
 *
 * @param {object} session - Mongoose VivaSession document (toObject())
 * @returns {object}
 */
const formatSessionResponse = (session) => {
  const base = {
    sessionId:       session._id,
    topic:           session.topic,
    difficulty:      session.difficulty,
    status:          session.status,
    maxTurns:        session.maxTurns,
    turnsCompleted:  session.turns.length,
    turnsRemaining:  session.turnsRemaining,
    startedAt:       session.startedAt,
    turns: session.turns.map((t) => ({
      turnNumber:          t.turnNumber,
      examinerQuestion:    t.examinerQuestion,
      questionType:        t.questionType,
      examinerRationale:   t.examinerRationale,
      studentAnswer:       t.studentAnswer,
      thinkingTimeSeconds: t.thinkingTimeSeconds,
      turnScore:           t.turnScore,
      answeredAt:          t.answeredAt,
    })),
  };

  if (session.status === 'Completed') {
    base.completedAt          = session.completedAt;
    base.totalDurationSeconds = session.totalDurationSeconds;
    base.evaluation           = session.evaluation;
  }

  return base;
};

/**
 * Validates that the topic string is a non-empty, reasonably-sized string.
 * @param {string} topic
 * @returns {{ valid: boolean, message?: string }}
 */
const validateTopic = (topic) => {
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return { valid: false, message: 'Please provide a non-empty viva topic.' };
  }
  if (topic.trim().length > 300) {
    return { valid: false, message: 'Topic must not exceed 300 characters.' };
  }
  return { valid: true };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: startVivaSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Initialise a new Autonomous Socratic Viva session and generate
 *          the examiner's dynamic opening question via Gemini AI.
 *          If the user already has an active (InProgress) session on the same
 *          topic, it is returned instead of creating a duplicate.
 *
 * @route   POST /api/viva/start
 * @access  Private
 *
 * Request body:
 *   {
 *     "topic":      "Binary Search Trees",           // required
 *     "difficulty": "Postgraduate",                   // optional (default: Undergraduate)
 *     "maxTurns":   5                                 // optional (default: 5, range: 2–10)
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "message": "...",
 *     "session": { sessionId, topic, difficulty, status, maxTurns,
 *                  turnsCompleted, turnsRemaining, startedAt,
 *                  turns: [ { turnNumber, examinerQuestion, questionType,
 *                              examinerRationale, studentAnswer, ... } ] }
 *   }
 */
export const startVivaSession = async (req, res) => {
  try {
    const { topic, difficulty = 'Undergraduate', maxTurns } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    const topicValidation = validateTopic(topic);
    if (!topicValidation.valid) {
      return res.status(400).json({ success: false, message: topicValidation.message });
    }

    const VALID_DIFFICULTIES = ['Undergraduate', 'Postgraduate', 'Doctoral', 'Industry Expert'];
    const resolvedDifficulty = VALID_DIFFICULTIES.includes(difficulty)
      ? difficulty
      : 'Undergraduate';

    const resolvedMaxTurns = Math.min(10, Math.max(2, parseInt(maxTurns, 10) || 5));

    // ── Guard: prevent duplicate active sessions on identical topic ────────
    const existingSession = await VivaSession.findOne({
      userId: req.user._id,
      topic:  topic.trim(),
      status: 'InProgress',
    });

    if (existingSession) {
      console.info(
        `[Viva Controller] Resuming existing InProgress session ${existingSession._id} ` +
        `for user ${req.user._id} on topic "${topic.trim()}"`
      );
      return res.status(200).json({
        success: true,
        message: 'Resumed your existing active viva session for this topic.',
        resumed: true,
        session: formatSessionResponse(existingSession.toObject({ virtuals: true })),
      });
    }

    // ── Generate Gemini opening question ──────────────────────────────────
    console.info(
      `[Viva Controller] Generating opening question for topic="${topic.trim()}", ` +
      `difficulty=${resolvedDifficulty}, maxTurns=${resolvedMaxTurns}`
    );

    const openingQuestion = await generateOpeningQuestion(topic.trim(), resolvedDifficulty);

    // ── Persist new viva session ───────────────────────────────────────────
    const session = await VivaSession.create({
      userId:     req.user._id,
      topic:      topic.trim(),
      difficulty: resolvedDifficulty,
      maxTurns:   resolvedMaxTurns,
      status:     'InProgress',
      turns: [
        {
          turnNumber:        1,
          examinerQuestion:  openingQuestion.examinerQuestion,
          questionType:      openingQuestion.questionType,
          examinerRationale: openingQuestion.examinerRationale,
          studentAnswer:     '',
          thinkingTimeSeconds: 0,
          answeredAt:        null,
          turnScore:         null,
        },
      ],
    });

    console.info(`[Viva Controller] Session ${session._id} created for user ${req.user._id}`);

    return res.status(201).json({
      success: true,
      message: `Viva session started on "${topic.trim()}". The examiner is waiting for your answer.`,
      session: formatSessionResponse(session.toObject({ virtuals: true })),
    });
  } catch (error) {
    console.error(`[startVivaSession Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while starting viva session.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: submitVivaAnswer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Accept the student's answer to the current examiner question.
 *          The controller:
 *            1. Validates and records the answer on the most recent open turn.
 *            2. If turns < maxTurns → Generates the next Socratic question (Gemini).
 *            3. If turns === maxTurns → Runs the full AI evaluation, produces the
 *               executive scorecard, and marks the session Completed.
 *
 * @route   POST /api/viva/answer
 * @access  Private
 *
 * Request body:
 *   {
 *     "sessionId":           "<VivaSession._id>",
 *     "studentAnswer":       "The student's response text",
 *     "thinkingTimeSeconds": 42          // optional — client-measured answer time
 *   }
 *
 * Response (InProgress — next question):
 *   {
 *     "success": true,
 *     "status": "InProgress",
 *     "turnsRemaining": 3,
 *     "nextQuestion": { turnNumber, examinerQuestion, questionType, examinerRationale },
 *     "session": { ... }
 *   }
 *
 * Response (Completed — final scorecard):
 *   {
 *     "success": true,
 *     "status": "Completed",
 *     "message": "...",
 *     "evaluation": { overallScore, vivaGrade, conceptualClarity,
 *                     rubricBreakdown, strengths, weakAreasIdentified,
 *                     fallaciesDetected, examinerFeedback,
 *                     recommendedStudyActions },
 *     "session": { ... }
 *   }
 */
export const submitVivaAnswer = async (req, res) => {
  try {
    const { sessionId, studentAnswer, thinkingTimeSeconds = 0 } = req.body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a sessionId.',
      });
    }

    if (studentAnswer === undefined || studentAnswer === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a studentAnswer (may be an empty string).',
      });
    }

    const sanitizedAnswer = String(studentAnswer).trim();

    // ── Load & authorise session ───────────────────────────────────────────
    const session = await VivaSession.findOne({
      _id:    sessionId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Viva session not found or you are not authorised to access it.',
      });
    }

    if (session.status !== 'InProgress') {
      return res.status(409).json({
        success: false,
        message: `This viva session is already ${session.status}. No further answers can be submitted.`,
        sessionId: session._id,
        status: session.status,
      });
    }

    // ── Locate the latest unanswered turn ─────────────────────────────────
    //    Convention: the last turn in the array always has studentAnswer = ''
    //    when awaiting a response (posted by startVivaSession or the
    //    previous iteration of this controller).
    const lastTurnIndex = session.turns.length - 1;
    if (lastTurnIndex < 0) {
      return res.status(422).json({
        success: false,
        message: 'Session has no turns — this is an invalid session state.',
      });
    }

    const currentTurn = session.turns[lastTurnIndex];

    if (currentTurn.studentAnswer && currentTurn.studentAnswer.trim().length > 0) {
      return res.status(409).json({
        success: false,
        message:
          'The current turn already has an answer recorded. ' +
          'Please wait for the next examiner question.',
      });
    }

    // ── Record the student's answer on the current turn ───────────────────
    const answeredAt    = new Date();
    const thinkingTimeSec = Math.max(0, parseInt(thinkingTimeSeconds, 10) || 0);

    session.turns[lastTurnIndex].studentAnswer       = sanitizedAnswer;
    session.turns[lastTurnIndex].thinkingTimeSeconds = thinkingTimeSec;
    session.turns[lastTurnIndex].answeredAt          = answeredAt;

    const completedTurnCount = session.turns.length; // number of fully-answered turns now

    // ─────────────────────────────────────────────────────────────────────
    //  BRANCH A: Session complete — run AI evaluation
    // ─────────────────────────────────────────────────────────────────────
    if (completedTurnCount >= session.maxTurns) {
      console.info(
        `[Viva Controller] Session ${session._id} reached maxTurns (${session.maxTurns}). ` +
        `Running AI evaluation...`
      );

      // Generate executive scorecard via Gemini
      const scorecard = await generateVivaEvaluation({
        topic:      session.topic,
        difficulty: session.difficulty,
        turns:      session.turns,
      });

      // Apply per-turn scores from the scorecard back onto the turn sub-docs
      scorecard.turnScores.forEach((score, idx) => {
        if (session.turns[idx]) {
          session.turns[idx].turnScore = score;
        }
      });

      // Collect any per-turn fallacies from earlier turns that were detected
      // during Socratic questioning (stored in examinerRationale or as a
      // separate signal — here we also include session-level fallaciesDetected
      // from the scorecard).
      const sessionDurationSeconds = Math.round(
        (answeredAt - session.startedAt) / 1000
      );

      // Persist evaluation fields
      session.evaluation = {
        overallScore:            scorecard.overallScore,
        conceptualClarity:       scorecard.conceptualClarity,
        rubricBreakdown:         scorecard.rubricBreakdown,
        strengths:               scorecard.strengths,
        weakAreasIdentified:     scorecard.weakAreasIdentified,
        fallaciesDetected:       scorecard.fallaciesDetected,
        examinerFeedback:        scorecard.examinerFeedback,
        recommendedStudyActions: scorecard.recommendedStudyActions,
        vivaGrade:               scorecard.vivaGrade,
      };

      session.status               = 'Completed';
      session.completedAt          = answeredAt;
      session.totalDurationSeconds = sessionDurationSeconds;

      await session.save();

      console.info(
        `[Viva Controller] Session ${session._id} completed — ` +
        `Score: ${scorecard.overallScore}/100, Grade: ${scorecard.vivaGrade}`
      );

      return res.status(200).json({
        success: true,
        status:  'Completed',
        message:
          `Viva examination complete! You answered all ${session.maxTurns} questions. ` +
          `Your final score is ${scorecard.overallScore}/100 (Grade: ${scorecard.vivaGrade}).`,
        evaluation: session.evaluation,
        session:    formatSessionResponse(session.toObject({ virtuals: true })),
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    //  BRANCH B: Session ongoing — generate next Socratic question
    // ─────────────────────────────────────────────────────────────────────
    const nextTurnNumber = completedTurnCount + 1;

    console.info(
      `[Viva Controller] Session ${session._id} — generating Turn ${nextTurnNumber}/${session.maxTurns}`
    );

    const nextQuestion = await generateNextSocraticQuestion(
      session.topic,
      session.difficulty,
      session.turns.toObject ? session.turns.toObject() : [...session.turns],
      sanitizedAnswer,
      nextTurnNumber,
      session.maxTurns
    );

    // Append the new examiner turn (studentAnswer is blank, awaiting response)
    session.turns.push({
      turnNumber:        nextTurnNumber,
      examinerQuestion:  nextQuestion.examinerQuestion,
      questionType:      nextQuestion.questionType,
      examinerRationale: nextQuestion.examinerRationale,
      studentAnswer:     '',
      thinkingTimeSeconds: 0,
      answeredAt:        null,
      turnScore:         null,
    });

    // If a fallacy was detected, record it on the PREVIOUS turn for audit
    if (nextQuestion.fallacyDetected) {
      session.turns[lastTurnIndex].examinerRationale =
        `${session.turns[lastTurnIndex].examinerRationale} ` +
        `[Fallacy Detected: ${nextQuestion.fallacyDetected}]`;
    }

    await session.save();

    return res.status(200).json({
      success: true,
      status:  'InProgress',
      turnsCompleted: completedTurnCount,
      turnsRemaining: session.maxTurns - completedTurnCount,
      nextQuestion: {
        turnNumber:        nextTurnNumber,
        examinerQuestion:  nextQuestion.examinerQuestion,
        questionType:      nextQuestion.questionType,
        examinerRationale: nextQuestion.examinerRationale,
        fallacyDetected:   nextQuestion.fallacyDetected || null,
      },
      session: formatSessionResponse(session.toObject({ virtuals: true })),
    });
  } catch (error) {
    console.error(`[submitVivaAnswer Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while processing viva answer.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: getVivaSessionById
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Retrieve a single viva session by ID.
 *          Returns the full turn transcript and evaluation scorecard (if complete).
 *
 * @route   GET /api/viva/:id
 * @access  Private
 */
export const getVivaSessionById = async (req, res) => {
  try {
    const session = await VivaSession.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Viva session not found or you are not authorised to view it.',
      });
    }

    return res.status(200).json({
      success: true,
      session: formatSessionResponse(session.toObject({ virtuals: true })),
    });
  } catch (error) {
    console.error(`[getVivaSessionById Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching viva session.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: getUserVivaSessions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get the authenticated user's viva session history (paginated).
 *          Supports optional filtering by status.
 *
 * @route   GET /api/viva/history
 * @access  Private
 *
 * Query params:
 *   page   {number} Pagination page (default: 1)
 *   limit  {number} Results per page (default: 10, max: 50)
 *   status {string} Filter: "InProgress" | "Completed" | "Abandoned"
 */
export const getUserVivaSessions = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    const filter = { userId: req.user._id };

    const VALID_STATUSES = ['InProgress', 'Completed', 'Abandoned'];
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const [sessions, total] = await Promise.all([
      VivaSession.find(filter)
        .select('topic difficulty status maxTurns turns evaluation.overallScore evaluation.vivaGrade startedAt completedAt totalDurationSeconds createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VivaSession.countDocuments(filter),
    ]);

    // Build a lightweight summary for each session
    const sessionSummaries = sessions.map((s) => ({
      sessionId:           s._id,
      topic:               s.topic,
      difficulty:          s.difficulty,
      status:              s.status,
      maxTurns:            s.maxTurns,
      turnsCompleted:      s.turns.length,
      overallScore:        s.evaluation?.overallScore ?? null,
      vivaGrade:           s.evaluation?.vivaGrade    ?? null,
      startedAt:           s.startedAt,
      completedAt:         s.completedAt,
      totalDurationSeconds: s.totalDurationSeconds,
      createdAt:           s.createdAt,
    }));

    return res.status(200).json({
      success:    true,
      count:      sessions.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      sessions:   sessionSummaries,
    });
  } catch (error) {
    console.error(`[getUserVivaSessions Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching viva session history.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: abandonVivaSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Mark an InProgress viva session as Abandoned.
 *          An abandoned session is excluded from stats but preserved for audit.
 *
 * @route   PATCH /api/viva/:id/abandon
 * @access  Private
 */
export const abandonVivaSession = async (req, res) => {
  try {
    const session = await VivaSession.findOne({
      _id:    req.params.id,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Viva session not found or you are not authorised to modify it.',
      });
    }

    if (session.status !== 'InProgress') {
      return res.status(409).json({
        success: false,
        message: `Only InProgress sessions can be abandoned. Current status: ${session.status}.`,
      });
    }

    session.status      = 'Abandoned';
    session.completedAt = new Date();
    session.totalDurationSeconds = Math.round(
      (session.completedAt - session.startedAt) / 1000
    );

    await session.save();

    return res.status(200).json({
      success:   true,
      message:   'Viva session abandoned.',
      sessionId: session._id,
      status:    session.status,
    });
  } catch (error) {
    console.error(`[abandonVivaSession Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while abandoning viva session.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controller: getVivaStats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Return aggregate performance statistics across all of the
 *          authenticated user's Completed viva sessions.
 *          Includes: score trends, average grade, topic breakdown, and
 *          most-detected fallacy types.
 *
 * @route   GET /api/viva/stats
 * @access  Private
 */
export const getVivaStats = async (req, res) => {
  try {
    const completedSessions = await VivaSession.find({
      userId: req.user._id,
      status: 'Completed',
    }).select(
      'topic difficulty evaluation.overallScore evaluation.vivaGrade ' +
      'evaluation.conceptualClarity evaluation.fallaciesDetected ' +
      'evaluation.weakAreasIdentified maxTurns totalDurationSeconds createdAt'
    );

    if (completedSessions.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No completed viva sessions found.',
        stats: {
          totalCompleted:        0,
          averageScore:          0,
          gradeDistribution:     {},
          topicsExamined:        [],
          commonWeakAreas:       [],
          commonFallacies:       [],
          recentTrend:           [],
        },
      });
    }

    // ── Aggregate stats ────────────────────────────────────────────────────
    let scoreSum = 0;
    const gradeCount   = {};
    const topicMap     = {};
    const weakAreaFreq = {};
    const fallacyFreq  = {};

    completedSessions.forEach((s) => {
      const score = s.evaluation?.overallScore ?? 0;
      const grade = s.evaluation?.vivaGrade    ?? 'D';

      scoreSum += score;

      // Grade distribution
      gradeCount[grade] = (gradeCount[grade] || 0) + 1;

      // Per-topic averages
      const topic = s.topic;
      if (!topicMap[topic]) {
        topicMap[topic] = { count: 0, scoreSum: 0 };
      }
      topicMap[topic].count   += 1;
      topicMap[topic].scoreSum += score;

      // Weak area frequency
      (s.evaluation?.weakAreasIdentified || []).forEach((w) => {
        weakAreaFreq[w] = (weakAreaFreq[w] || 0) + 1;
      });

      // Fallacy frequency
      (s.evaluation?.fallaciesDetected || []).forEach((f) => {
        fallacyFreq[f] = (fallacyFreq[f] || 0) + 1;
      });
    });

    const averageScore = Math.round(scoreSum / completedSessions.length);

    const topicsExamined = Object.entries(topicMap)
      .map(([topic, data]) => ({
        topic,
        examCount:    data.count,
        averageScore: Math.round(data.scoreSum / data.count),
      }))
      .sort((a, b) => b.examCount - a.examCount);

    const commonWeakAreas = Object.entries(weakAreaFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([area, count]) => ({ area, occurrences: count }));

    const commonFallacies = Object.entries(fallacyFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([fallacy, count]) => ({ fallacy, occurrences: count }));

    // Last 10 sessions for trend chart
    const recentTrend = completedSessions
      .slice(-10)
      .map((s) => ({
        sessionId:   s._id,
        topic:       s.topic,
        score:       s.evaluation?.overallScore ?? 0,
        grade:       s.evaluation?.vivaGrade    ?? 'D',
        completedAt: s.createdAt,
      }));

    return res.status(200).json({
      success: true,
      stats: {
        totalCompleted:    completedSessions.length,
        averageScore,
        gradeDistribution: gradeCount,
        topicsExamined,
        commonWeakAreas,
        commonFallacies,
        recentTrend,
      },
    });
  } catch (error) {
    console.error(`[getVivaStats Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while computing viva statistics.',
    });
  }
};
