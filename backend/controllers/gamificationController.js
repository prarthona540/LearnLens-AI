import Gamification from '../models/Gamification.js';

// Level thresholds
const LEVEL_TIERS = [
  { minXp: 5000, title: 'AI Grandmaster' },
  { minXp: 2500, title: 'Cognitive Master' },
  { minXp: 1000, title: 'Insight Pioneer' },
  { minXp: 500, title: 'Knowledge Seeker' },
  { minXp: 250, title: 'Curious Apprentice' },
  { minXp: 0, title: 'Novice Scholar' },
];

/**
 * Determine level title based on total XP
 * @param {number} xp
 * @returns {string}
 */
const calculateLevel = (xp) => {
  const tier = LEVEL_TIERS.find((t) => xp >= t.minXp);
  return tier ? tier.title : 'Novice Scholar';
};

/**
 * Badge catalogue and trigger conditions
 */
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
];

/**
 * Evaluates conditions and awards unearned badges
 * @param {object} doc - Gamification document
 * @returns {Array<object>} Newly awarded badges
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
 * Calculate difference in calendar days between two dates
 * @param {Date} date1 - Earlier date
 * @param {Date} date2 - Later date
 * @returns {number} Difference in days
 */
const getCalendarDayDifference = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * @desc    Record a learning activity, calculate daily streaks, award XP and check badges
 * @route   POST /api/gamification/activity
 * @access  Private
 */
export const recordActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { activityType, xpEarned } = req.body;

    // Default XP based on activity type
    const DEFAULT_XP_MAP = {
      quiz_complete: 50,
      quiz_perfect: 100,
      note_create: 30,
      audio_transcribe: 40,
      focus_session: 25,
      boss_victory: 150,
      default: 20,
    };

    const points =
      typeof xpEarned === 'number' && xpEarned >= 0
        ? Math.round(xpEarned)
        : DEFAULT_XP_MAP[activityType] || DEFAULT_XP_MAP.default;

    let doc = await Gamification.findOne({ userId });

    if (!doc) {
      doc = new Gamification({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: new Date(),
        xpPoints: 0,
        currentLevel: 'Novice Scholar',
        badgesUnlocked: [],
      });
    }

    const now = new Date();

    // Streak calculation
    if (!doc.lastActiveDate) {
      doc.currentStreak = 1;
      doc.longestStreak = 1;
    } else {
      const diffDays = getCalendarDayDifference(doc.lastActiveDate, now);

      if (diffDays === 0) {
        // Active today: streak remains the same
      } else if (diffDays === 1) {
        // Active yesterday: increment streak
        doc.currentStreak += 1;
        doc.longestStreak = Math.max(doc.longestStreak, doc.currentStreak);
      } else if (diffDays > 1) {
        // Missed a day: reset streak to 1
        doc.currentStreak = 1;
      }
    }

    doc.lastActiveDate = now;
    doc.xpPoints += points;
    doc.currentLevel = calculateLevel(doc.xpPoints);

    // Evaluate badges
    const newlyUnlockedBadges = checkAndAwardBadges(doc);

    await doc.save();

    return res.status(200).json({
      success: true,
      message: 'Learning activity recorded successfully',
      xpEarned: points,
      currentStreak: doc.currentStreak,
      longestStreak: doc.longestStreak,
      totalXp: doc.xpPoints,
      currentLevel: doc.currentLevel,
      newlyUnlockedBadges,
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
 * @desc    Get user's full gamification profile: streak, XP, level, and earned badges
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
        badgesUnlocked: [],
      });
    }

    // Check if streak was broken since last active date
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
