import Gamification from '../models/Gamification.js';
import User from '../models/User.js';

// ─────────────────────────────────────────────
//  Level Tier Configuration
//  Each tier specifies its minimum XP threshold,
//  display title, numeric rank, and XP to the
//  next tier (used for progress bar calculation).
// ─────────────────────────────────────────────
const LEVEL_TIERS = [
  { minXp: 5000, title: 'AI Grandmaster',      numericLevel: 6, xpToNext: null   },
  { minXp: 2500, title: 'Cognitive Master',     numericLevel: 5, xpToNext: 2500  },
  { minXp: 1000, title: 'Insight Pioneer',      numericLevel: 4, xpToNext: 1500  },
  { minXp: 500,  title: 'Knowledge Seeker',     numericLevel: 3, xpToNext: 500   },
  { minXp: 250,  title: 'Curious Apprentice',   numericLevel: 2, xpToNext: 250   },
  { minXp: 0,    title: 'Novice Scholar',        numericLevel: 1, xpToNext: 250   },
];

/**
 * Determine level title and numeric rank based on total XP
 * @param {number} xp
 * @returns {{ title: string, numericLevel: number, xpToNext: number|null }}
 */
const calculateLevel = (xp) => {
  const tier = LEVEL_TIERS.find((t) => xp >= t.minXp);
  return tier
    ? { title: tier.title, numericLevel: tier.numericLevel, xpToNext: tier.xpToNext }
    : { title: 'Novice Scholar', numericLevel: 1, xpToNext: 250 };
};

// ─────────────────────────────────────────────
//  Badge Catalogue
//  Each badge has an unlock condition evaluated
//  against the live Gamification document.
// ─────────────────────────────────────────────
const BADGE_RULES = [
  {
    title: 'First Spark',
    icon: 'Zap',
    description: 'Recorded your first learning activity on LearnLens AI',
    condition: (doc) => doc.xpPoints > 0,
  },
  {
    title: 'Consistency Wizard',
    icon: 'Flame',
    description: 'Maintained a 3-day consecutive study streak',
    condition: (doc) => doc.currentStreak >= 3,
  },
  {
    title: 'Habitual Titan',
    icon: 'Calendar',
    description: 'Maintained a 7-day consecutive study streak',
    condition: (doc) => doc.currentStreak >= 7,
  },
  {
    title: 'Unstoppable Force',
    icon: 'Rocket',
    description: 'Maintained a 14-day consecutive study streak',
    condition: (doc) => doc.currentStreak >= 14,
  },
  {
    title: 'Iron Will',
    icon: 'Shield',
    description: 'Maintained a 30-day consecutive study streak',
    condition: (doc) => doc.currentStreak >= 30,
  },
  {
    title: 'Knowledge Seeker',
    icon: 'BookOpen',
    description: 'Accumulated 500+ XP in study and quiz activities',
    condition: (doc) => doc.xpPoints >= 500,
  },
  {
    title: 'AI Mastermind',
    icon: 'Brain',
    description: 'Accumulated 1,000+ XP through deep learning and diagnostics',
    condition: (doc) => doc.xpPoints >= 1000,
  },
  {
    title: 'Legendary Scholar',
    icon: 'Crown',
    description: 'Accumulated 2,500+ XP and mastered foundational branches',
    condition: (doc) => doc.xpPoints >= 2500,
  },
  {
    title: 'Grandmaster Ascendant',
    icon: 'Sparkles',
    description: 'Accumulated 5,000+ XP to reach the highest cognitive rank',
    condition: (doc) => doc.xpPoints >= 5000,
  },
  {
    title: 'Quiz Champion',
    icon: 'Trophy',
    description: 'Completed 10 or more diagnostic quizzes',
    condition: (doc) => doc.totalQuizzesCompleted >= 10,
  },
  {
    title: 'Exam Warrior',
    icon: 'Sword',
    description: 'Completed 5 or more mock exam sittings',
    condition: (doc) => doc.totalMockExamsCompleted >= 5,
  },
  {
    title: 'Focus Monk',
    icon: 'Sunrise',
    description: 'Completed 20+ Pomodoro focus sessions',
    condition: (doc) => doc.totalFocusSessionsCompleted >= 20,
  },
];

// ─────────────────────────────────────────────
//  Default XP Awards per Activity Type
// ─────────────────────────────────────────────
const DEFAULT_XP_MAP = {
  quiz_complete:     50,
  quiz_perfect:      100,
  note_create:       30,
  audio_transcribe:  40,
  focus_session:     25,
  boss_victory:      150,
  mock_exam_pass:    80,
  mock_exam_complete:60,
  daily_login:       10,
  default:           20,
};

// ─────────────────────────────────────────────
//  Counter Mapping – which activities increment
//  which aggregate counter on the document.
// ─────────────────────────────────────────────
const COUNTER_MAP = {
  quiz_complete:      'totalQuizzesCompleted',
  quiz_perfect:       'totalQuizzesCompleted',
  mock_exam_complete: 'totalMockExamsCompleted',
  mock_exam_pass:     'totalMockExamsCompleted',
  focus_session:      'totalFocusSessionsCompleted',
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Evaluate badge conditions and push newly earned badges onto the doc.
 * @param {object} doc - Gamification Mongoose document
 * @returns {Array<object>} Newly awarded badge objects
 */
export const checkAndAwardBadges = (doc) => {
  const existingTitles = new Set(doc.badgesUnlocked.map((b) => b.title));
  const newlyAwarded = [];

  BADGE_RULES.forEach((rule) => {
    if (!existingTitles.has(rule.title) && rule.condition(doc)) {
      const newBadge = {
        title: rule.title,
        icon: rule.icon,
        description: rule.description,
        unlockedAt: new Date(),
      };
      doc.badgesUnlocked.push(newBadge);
      newlyAwarded.push(newBadge);
    }
  });

  return newlyAwarded;
};

/**
 * Calculate the absolute difference in calendar days between two Date objects.
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number}
 */
const getCalendarDayDifference = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Returns the ISO calendar date string (YYYY-MM-DD) for a given Date.
 * @param {Date} date
 * @returns {string}
 */
const toDateString = (date) => date.toISOString().split('T')[0];

/**
 * Update the rolling 7-day weekly XP ledger for the given date and XP amount.
 * Prunes entries older than 7 days and recalculates totalWeeklyXp.
 * @param {object} doc - Gamification document
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} xp
 */
const updateWeeklyXpLedger = (doc, dateStr, xp) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = toDateString(sevenDaysAgo);

  // Prune stale entries
  doc.weeklyXp = doc.weeklyXp.filter((entry) => entry.date >= cutoff);

  // Add XP to today's entry (upsert)
  const todayEntry = doc.weeklyXp.find((e) => e.date === dateStr);
  if (todayEntry) {
    todayEntry.xp += xp;
  } else {
    doc.weeklyXp.push({ date: dateStr, xp });
  }

  // Recalculate aggregate
  doc.totalWeeklyXp = doc.weeklyXp.reduce((sum, e) => sum + e.xp, 0);
};

// ─────────────────────────────────────────────
//  Controllers
// ─────────────────────────────────────────────

/**
 * @desc    Record a learning activity, calculate daily streaks, award XP,
 *          update counters, and check for newly unlocked achievement badges.
 * @route   POST /api/gamification/activity
 * @access  Private
 */
export const recordActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { activityType, xpEarned } = req.body;

    if (!activityType || typeof activityType !== 'string' || !activityType.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid activityType string',
      });
    }

    const type = activityType.trim().toLowerCase();

    // Resolve XP: use caller-supplied value if valid, otherwise fall back to defaults
    const points =
      typeof xpEarned === 'number' && xpEarned >= 0
        ? Math.round(xpEarned)
        : DEFAULT_XP_MAP[type] || DEFAULT_XP_MAP.default;

    // Fetch or create the user's gamification document
    let doc = await Gamification.findOne({ userId });

    if (!doc) {
      doc = new Gamification({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        xpPoints: 0,
        currentLevel: 'Novice Scholar',
        levelNumeric: 1,
        xpToNextLevel: 250,
        badgesUnlocked: [],
        activityLog: [],
        weeklyXp: [],
        totalWeeklyXp: 0,
        streakFreezesAvailable: 0,
      });
    }

    const now = new Date();
    const todayStr = toDateString(now);

    // ── Streak Calculation ──────────────────────
    if (!doc.lastActiveDate) {
      // First ever activity
      doc.currentStreak = 1;
      doc.longestStreak = 1;
    } else {
      const diffDays = getCalendarDayDifference(doc.lastActiveDate, now);

      if (diffDays === 0) {
        // Already active today — streak stays the same
      } else if (diffDays === 1) {
        // Active on the consecutive calendar day
        doc.currentStreak += 1;
        doc.longestStreak = Math.max(doc.longestStreak, doc.currentStreak);
      } else {
        // Missed one or more days
        if (doc.streakFreezesAvailable > 0 && diffDays === 2) {
          // Auto-consume a streak freeze for exactly one missed day
          doc.streakFreezesAvailable -= 1;
          doc.streakFreezeHistory.push({
            consumedAt: now,
            streakPreserved: doc.currentStreak,
          });
          // Streak value is preserved — just update lastActiveDate
        } else {
          // Reset streak
          doc.currentStreak = 1;
        }
      }
    }

    doc.lastActiveDate = now;

    // ── XP & Level ─────────────────────────────
    doc.xpPoints += points;
    const levelInfo = calculateLevel(doc.xpPoints);
    doc.currentLevel = levelInfo.title;
    doc.levelNumeric = levelInfo.numericLevel;
    doc.xpToNextLevel = levelInfo.xpToNext;

    // ── Weekly XP ledger ───────────────────────
    updateWeeklyXpLedger(doc, todayStr, points);

    // ── Aggregate counters ─────────────────────
    doc.totalActivitiesCompleted += 1;
    const counterField = COUNTER_MAP[type];
    if (counterField) {
      doc[counterField] += 1;
    }

    // ── Activity Log (cap at 200 entries) ──────
    doc.activityLog.push({
      activityType: type,
      xpEarned: points,
      streakAtEvent: doc.currentStreak,
      recordedAt: now,
    });
    if (doc.activityLog.length > 200) {
      doc.activityLog = doc.activityLog.slice(-200);
    }

    // ── Badge Evaluation ───────────────────────
    const newlyUnlockedBadges = checkAndAwardBadges(doc);

    // ── Award a streak freeze every 7-day milestone ──
    if (
      doc.currentStreak > 0 &&
      doc.currentStreak % 7 === 0 &&
      doc.streakFreezesAvailable < 3
    ) {
      doc.streakFreezesAvailable = Math.min(3, doc.streakFreezesAvailable + 1);
    }

    await doc.save();

    return res.status(200).json({
      success: true,
      message: 'Learning activity recorded successfully',
      xpEarned: points,
      currentStreak: doc.currentStreak,
      longestStreak: doc.longestStreak,
      totalXp: doc.xpPoints,
      currentLevel: doc.currentLevel,
      levelNumeric: doc.levelNumeric,
      xpToNextLevel: doc.xpToNextLevel,
      streakFreezesAvailable: doc.streakFreezesAvailable,
      newlyUnlockedBadges,
      weeklyXp: doc.weeklyXp,
      totalWeeklyXp: doc.totalWeeklyXp,
      profile: doc,
    });
  } catch (error) {
    console.error(`[Record Activity Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while recording activity',
    });
  }
};

/**
 * @desc    Get authenticated user's full gamification profile:
 *          streak, XP, level, badges, weekly XP, and activity log.
 * @route   GET /api/gamification
 * @access  Private
 */
export const getUserGamificationProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    let doc = await Gamification.findOne({ userId });

    if (!doc) {
      doc = await Gamification.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        xpPoints: 0,
        currentLevel: 'Novice Scholar',
        levelNumeric: 1,
        xpToNextLevel: 250,
        badgesUnlocked: [],
        activityLog: [],
        weeklyXp: [],
        totalWeeklyXp: 0,
        streakFreezesAvailable: 0,
      });
    }

    // Auto-decay streak if the user has been inactive for more than 1 day
    // (and has no freeze available to cover the gap)
    if (doc.lastActiveDate) {
      const diffDays = getCalendarDayDifference(doc.lastActiveDate, new Date());
      if (diffDays > 1 && doc.currentStreak > 0) {
        doc.currentStreak = 0;
        await doc.save();
      }
    }

    return res.status(200).json({
      success: true,
      profile: doc,
    });
  } catch (error) {
    console.error(`[Get Gamification Profile Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching gamification profile',
    });
  }
};

/**
 * @desc    Get the authenticated user's XP activity history
 *          (last N activity log entries, most recent first).
 * @route   GET /api/gamification/history
 * @access  Private
 */
export const getXpHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const doc = await Gamification.findOne({ userId }).select('activityLog weeklyXp totalWeeklyXp');

    if (!doc) {
      return res.status(200).json({
        success: true,
        recentActivity: [],
        weeklyXp: [],
        totalWeeklyXp: 0,
      });
    }

    const recentActivity = [...doc.activityLog]
      .reverse()
      .slice(0, limit);

    return res.status(200).json({
      success: true,
      count: recentActivity.length,
      recentActivity,
      weeklyXp: doc.weeklyXp,
      totalWeeklyXp: doc.totalWeeklyXp,
    });
  } catch (error) {
    console.error(`[Get XP History Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching XP history',
    });
  }
};

/**
 * @desc    Get the global XP-based leaderboard (top 20 users by all-time XP).
 *          Returns anonymised display names and their stats.
 * @route   GET /api/gamification/leaderboard
 * @access  Private
 */
export const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const mode = req.query.mode === 'weekly' ? 'totalWeeklyXp' : 'xpPoints';

    // Fetch top N users sorted by selected metric
    const topDocs = await Gamification.find({})
      .sort({ [mode]: -1 })
      .limit(limit)
      .select('userId xpPoints totalWeeklyXp currentLevel levelNumeric currentStreak badgesUnlocked')
      .populate('userId', 'name');

    // Build leaderboard response with rank
    const leaderboard = topDocs.map((doc, index) => ({
      rank: index + 1,
      userId: doc.userId?._id || doc.userId,
      name: doc.userId?.name || 'Scholar',
      xpPoints: doc.xpPoints,
      weeklyXp: doc.totalWeeklyXp,
      currentLevel: doc.currentLevel,
      levelNumeric: doc.levelNumeric,
      currentStreak: doc.currentStreak,
      badgeCount: doc.badgesUnlocked.length,
      isCurrentUser: String(doc.userId?._id || doc.userId) === String(req.user._id),
    }));

    // Determine the requesting user's own rank if not in top N
    let currentUserRank = null;
    const currentUserInTop = leaderboard.find((e) => e.isCurrentUser);
    if (!currentUserInTop) {
      const userDoc = await Gamification.findOne({ userId: req.user._id }).select(mode);
      if (userDoc) {
        const higherCount = await Gamification.countDocuments({
          [mode]: { $gt: userDoc[mode] },
        });
        currentUserRank = higherCount + 1;
      }
    }

    return res.status(200).json({
      success: true,
      mode: mode === 'totalWeeklyXp' ? 'weekly' : 'alltime',
      leaderboard,
      currentUserRank: currentUserInTop ? currentUserInTop.rank : currentUserRank,
    });
  } catch (error) {
    console.error(`[Get Leaderboard Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching leaderboard',
    });
  }
};

/**
 * @desc    Award a streak freeze to the authenticated user (max 3 banked).
 *          Used when the user earns a freeze via a reward or achievement.
 * @route   POST /api/gamification/freeze
 * @access  Private
 */
export const grantStreakFreeze = async (req, res) => {
  try {
    const userId = req.user._id;

    let doc = await Gamification.findOne({ userId });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Gamification profile not found. Complete at least one activity first.',
      });
    }

    if (doc.streakFreezesAvailable >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum streak freeze capacity (3) already reached',
        streakFreezesAvailable: doc.streakFreezesAvailable,
      });
    }

    doc.streakFreezesAvailable = Math.min(3, doc.streakFreezesAvailable + 1);
    await doc.save();

    return res.status(200).json({
      success: true,
      message: 'Streak freeze granted successfully',
      streakFreezesAvailable: doc.streakFreezesAvailable,
    });
  } catch (error) {
    console.error(`[Grant Streak Freeze Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while granting streak freeze',
    });
  }
};

/**
 * @desc    Re-evaluate and award all eligible badges for the
 *          authenticated user's current profile state.
 *          Useful after external data imports or manual XP adjustments.
 * @route   POST /api/gamification/badges/sync
 * @access  Private
 */
export const syncBadges = async (req, res) => {
  try {
    const userId = req.user._id;

    const doc = await Gamification.findOne({ userId });

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Gamification profile not found',
      });
    }

    const newlyUnlocked = checkAndAwardBadges(doc);

    if (newlyUnlocked.length > 0) {
      await doc.save();
    }

    return res.status(200).json({
      success: true,
      message:
        newlyUnlocked.length > 0
          ? `${newlyUnlocked.length} new badge(s) awarded`
          : 'All eligible badges already unlocked',
      newlyUnlocked,
      allBadges: doc.badgesUnlocked,
    });
  } catch (error) {
    console.error(`[Sync Badges Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while syncing badges',
    });
  }
};
