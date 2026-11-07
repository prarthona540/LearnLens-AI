import mongoose from 'mongoose';

const skillNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Locked', 'Unlocked', 'Mastered'],
      default: 'Locked',
    },
    parentId: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: 'General',
    },
  },
  { _id: false }
);

const bossRecordSchema = new mongoose.Schema(
  {
    bossTitle: {
      type: String,
      required: true,
    },
    scoreAchieved: {
      type: Number,
      required: true,
    },
    damageDealt: {
      type: Number,
      default: 0,
    },
    defeatedAt: {
      type: Date,
      default: Date.now,
    },
    badgeAwarded: {
      type: String,
      default: null,
    },
  },
  { _id: true }
);

const badgeSchema = new mongoose.Schema(
  {
    badgeId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'Award' },
    unlockedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const activeBossQuestionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswerIndex: { type: Number, required: true },
    explanation: { type: String, default: '' },
    topicTag: { type: String, required: true },
    damage: { type: Number, default: 10 },
  },
  { _id: true }
);

const activeBossFightSchema = new mongoose.Schema(
  {
    battleId: { type: String, required: true },
    bossTitle: { type: String, required: true },
    bossSubtitle: { type: String, default: '' },
    bossLore: { type: String, default: '' },
    bossHealth: { type: Number, default: 100 },
    timeLimitSeconds: { type: Number, default: 300 },
    questions: [activeBossQuestionSchema],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const skillTreeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    nodes: {
      type: [skillNodeSchema],
      default: [],
    },
    bossHistory: {
      type: [bossRecordSchema],
      default: [],
    },
    unlockedBadges: {
      type: [badgeSchema],
      default: [],
    },
    activeBossFight: {
      type: activeBossFightSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SkillTree = mongoose.model('SkillTree', skillTreeSchema);

export default SkillTree;
