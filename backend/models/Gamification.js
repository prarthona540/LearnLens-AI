import mongoose from 'mongoose';

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

const gamificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
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
    xpPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentLevel: {
      type: String,
      default: 'Novice Scholar',
      trim: true,
    },
    badgesUnlocked: {
      type: [badgeSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Gamification = mongoose.model('Gamification', gamificationSchema);

export default Gamification;
