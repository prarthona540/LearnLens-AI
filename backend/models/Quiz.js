import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: [true, 'Options are required'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length >= 2;
        },
        message: 'A quiz question must provide at least 2 options',
      },
    },
    correctAnswerIndex: {
      type: Number,
      required: [true, 'Correct answer index is required'],
      min: [0, 'Index cannot be negative'],
    },
    explanation: {
      type: String,
      default: '',
      trim: true,
    },
    topicTag: {
      type: String,
      required: [true, 'Topic tag is required for gap detection'],
      trim: true,
    },
  },
  { _id: true }
);

const quizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Quiz must belong to a user'],
      index: true,
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Note',
      required: [true, 'Quiz must be linked to a note'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a title for the quiz'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    questions: {
      type: [questionSchema],
      required: [true, 'Quiz must have questions'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Quiz must contain at least one question',
      },
    },
    score: {
      type: Number,
      default: 0,
      min: [0, 'Score cannot be negative'],
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: [0, 'Total questions cannot be negative'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to automatically ensure totalQuestions matches questions array length
quizSchema.pre('save', function (next) {
  if (this.questions && this.questions.length > 0) {
    this.totalQuestions = this.questions.length;
  }
  next();
});

const Quiz = mongoose.model('Quiz', quizSchema);

export default Quiz;
