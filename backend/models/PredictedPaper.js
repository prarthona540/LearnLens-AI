import mongoose from 'mongoose';

const highYieldTopicSchema = new mongoose.Schema(
  {
    topicName: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: Number,
      default: 1,
      min: 0,
    },
    probability: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { _id: false }
);

const predictedQuestionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    questionType: {
      type: String,
      enum: ['Short Answer', 'Long Essay', 'Problem Solving', 'Multiple Choice', 'Conceptual Analysis'],
      default: 'Problem Solving',
    },
    probability: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    reasonForPrediction: {
      type: String,
      default: '',
      trim: true,
    },
    suggestedAnswerOutline: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const predictedPaperSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    subjectName: {
      type: String,
      required: [true, 'Please provide the subject or course name'],
      trim: true,
      maxlength: [150, 'Subject name cannot exceed 150 characters'],
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: [0, 'Confidence score cannot be less than 0'],
      max: [100, 'Confidence score cannot exceed 100'],
      default: 75,
    },
    highYieldTopics: {
      type: [highYieldTopicSchema],
      default: [],
    },
    predictedQuestions: {
      type: [predictedQuestionSchema],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A predicted paper must contain at least one question',
      },
    },
    rawHistoricalInputSample: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const PredictedPaper = mongoose.model('PredictedPaper', predictedPaperSchema);

export default PredictedPaper;
