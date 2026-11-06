import mongoose from 'mongoose';

const learningDNASchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learning DNA must belong to a user'],
      unique: true,
      index: true,
    },
    examReadinessScore: {
      type: Number,
      default: 0,
      min: [0, 'Readiness score cannot be less than 0'],
      max: [100, 'Readiness score cannot exceed 100'],
    },
    strongTopics: {
      type: [String],
      default: [],
    },
    weakTopics: {
      type: [String],
      default: [],
    },
    knowledgeGaps: {
      type: [String],
      default: [],
    },
    recommendedActions: {
      type: [String],
      default: [],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Update lastUpdated before saving
learningDNASchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

const LearningDNA = mongoose.model('LearningDNA', learningDNASchema);

export default LearningDNA;
