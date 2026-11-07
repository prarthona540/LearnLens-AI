import mongoose from 'mongoose';

// ─────────────────────────────────────────────
//  Badge Sub-Schema
// ─────────────────────────────────────────────
const badgeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
      default: 'Award',
    },
    description: {
      type: String,
      default: '',
    },
    unlockedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Activity Log Sub-Schema
//  Keeps a rolling journal of every XP event for
//  weekly recap, graphs, and streak-freeze audits.
// ─────────────────────────────────────────────
const activityLogSchema = new mongoose.Schema(
  {
    activityType: {
      type: String,
      required: true,
      trim: true,
    },
    xpEarned: {
      type: Number,
      required: true,
      min: 0,
    },
    streakAtEvent: {
      type: Number,
      default: 0,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─────────────────────────────────────────────
//  Streak Freeze Sub-Schema
//  Streak freezes are consumable items that
//  preserve a user's streak for one missed day.
// ─────────────────────────────────────────────
const streakFreezeSchema = new mongoose.Schema(
  {
    consumedAt: {
      type: Date,
      default: Date.now,
    },
    streakPreserved: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Weekly XP Sub-Schema
//  Tracks per-day XP for the rolling 7-day
//  leaderboard and progress charts.
// ─────────────────────────────────────────────
const weeklyXpEntrySchema = new mongoose.Schema(
  {
    date: {
      type: String, // YYYY-MM-DD calendar date
      required: true,
    },
    xp: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Gamification Root Schema
// ─────────────────────────────────────────────
const gamificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // ── Streak tracking ──
    currentStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActiveDate: {
      type: Date,
      default: null,
    },

    // ── Streak freeze inventory ──
    streakFreezesAvailable: {
      type: Number,
      default: 0,
      min: 0,
      max: 3, // Maximum 3 freezes can be banked
    },
    streakFreezeHistory: {
      type: [streakFreezeSchema],
      default: [],
    },

    // ── XP & levelling ──
    xpPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    xpToNextLevel: {
      type: Number,
      default: 250, // XP required to reach next tier
    },
    currentLevel: {
      type: String,
      default: 'Novice Scholar',
      trim: true,
    },
    levelNumeric: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ── Weekly leaderboard data (rolling 7-day window) ──
    weeklyXp: {
      type: [weeklyXpEntrySchema],
      default: [],
    },
    totalWeeklyXp: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Badges ──
    badgesUnlocked: {
      type: [badgeSchema],
      default: [],
    },

    // ── Activity journal (capped at 200 recent entries) ──
    activityLog: {
      type: [activityLogSchema],
      default: [],
    },

    // ── Aggregate counters ──
    totalActivitiesCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuizzesCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMockExamsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalFocusSessionsCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────

// Compound index for leaderboard queries (top N by weeklyXp desc)
gamificationSchema.index({ totalWeeklyXp: -1 });
// General XP leaderboard
gamificationSchema.index({ xpPoints: -1 });

// ─────────────────────────────────────────────
//  Virtual: XP progress percentage toward next level
// ─────────────────────────────────────────────
gamificationSchema.virtual('xpProgressPercentage').get(function () {
  const tiers = [0, 250, 500, 1000, 2500, 5000];
  let lower = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (this.xpPoints >= tiers[i]) {
      lower = tiers[i];
      break;
    }
  }
  const upper =
    tiers.find((t) => t > this.xpPoints) || tiers[tiers.length - 1];
  if (upper === lower) return 100;
  return Math.round(((this.xpPoints - lower) / (upper - lower)) * 100);
});

gamificationSchema.set('toJSON', { virtuals: true });
gamificationSchema.set('toObject', { virtuals: true });

const Gamification = mongoose.model('Gamification', gamificationSchema);

export default Gamification;
