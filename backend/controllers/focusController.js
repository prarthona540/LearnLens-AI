import FocusSession from '../models/FocusSession.js';
import { generateFocusBreakRecommendation } from '../services/geminiService.js';

/**
 * @desc    Log a completed Pomodoro focus session & mood state
 * @route   POST /api/focus/log
 * @access  Private
 */
export const logSession = async (req, res) => {
  try {
    const {
      durationMinutes,
      focusScore = 80,
      moodState = 'Focused',
      distractionCount = 0,
      subjectTopic = 'General Study',
      notes = '',
    } = req.body;

    if (!durationMinutes || Number(durationMinutes) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid session duration in minutes',
      });
    }

    const validMoods = ['Focused', 'Tired', 'Anxious', 'Energized', 'Distracted'];
    if (!validMoods.includes(moodState)) {
      return res.status(400).json({
        success: false,
        message: `Invalid moodState. Must be one of: ${validMoods.join(', ')}`,
      });
    }

    const session = await FocusSession.create({
      userId: req.user._id,
      durationMinutes: Math.round(Number(durationMinutes)),
      focusScore: Math.min(100, Math.max(0, Number(focusScore))),
      moodState,
      distractionCount: Math.max(0, Number(distractionCount)),
      subjectTopic: subjectTopic.trim(),
      notes: notes.trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'Focus session logged successfully',
      session,
    });
  } catch (error) {
    console.error(`[Log Focus Session Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while logging focus session',
    });
  }
};

/**
 * @desc    Get dynamic AI-guided smart break recommendation based on recent fatigue & mood
 * @route   GET /api/focus/recommendation
 * @access  Private
 */
export const getSmartBreakRecommendation = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user's recent sessions (last 5 sessions or within the last 24h)
    const recentSessions = await FocusSession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Allow overriding or explicit mood pass via query string, otherwise take latest session's mood
    const latestMood =
      req.query.mood ||
      (recentSessions.length > 0 ? recentSessions[0].moodState : 'Focused');

    // Calculate total study minutes in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const daySessions = await FocusSession.find({
      userId,
      createdAt: { $gte: oneDayAgo },
    });

    const totalStudyMinutesToday = daySessions.reduce(
      (acc, s) => acc + (s.durationMinutes || 0),
      0
    );

    // Call Gemini AI focus analysis
    const recommendation = await generateFocusBreakRecommendation(
      recentSessions.map((s) => ({
        durationMinutes: s.durationMinutes,
        focusScore: s.focusScore,
        moodState: s.moodState,
        distractionCount: s.distractionCount,
        subjectTopic: s.subjectTopic,
        createdAt: s.createdAt,
      })),
      latestMood
    );

    return res.status(200).json({
      success: true,
      currentMood: latestMood,
      totalStudyMinutesToday,
      recentSessionsCount: recentSessions.length,
      recommendation,
    });
  } catch (error) {
    console.error(`[Smart Break Recommendation Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating break recommendation',
    });
  }
};

/**
 * @desc    Get user's focus session history and cumulative productivity metrics
 * @route   GET /api/focus/history
 * @access  Private
 */
export const getFocusHistory = async (req, res) => {
  try {
    const sessions = await FocusSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
    const avgScore =
      sessions.length > 0
        ? Math.round(sessions.reduce((acc, s) => acc + s.focusScore, 0) / sessions.length)
        : 0;
    const totalDistractions = sessions.reduce((acc, s) => acc + s.distractionCount, 0);

    // Calculate dominant mood
    const moodCounts = {};
    sessions.forEach((s) => {
      moodCounts[s.moodState] = (moodCounts[s.moodState] || 0) + 1;
    });

    let dominantMood = 'Focused';
    let maxCount = 0;
    Object.entries(moodCounts).forEach(([mood, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    });

    return res.status(200).json({
      success: true,
      count: sessions.length,
      metrics: {
        totalStudyMinutes: totalMinutes,
        averageFocusScore: avgScore,
        totalDistractionsRecorded: totalDistractions,
        dominantMood,
      },
      sessions,
    });
  } catch (error) {
    console.error(`[Get Focus History Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching focus history',
    });
  }
};
