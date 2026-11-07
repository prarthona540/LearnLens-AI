import mongoose from 'mongoose';

// ─────────────────────────────────────────────
//  Exam Question Sub-Schema
//  Stores each AI-generated question, its mark
//  weighting, the ideal rubric for grading, and
//  the topic it tests.
// ─────────────────────────────────────────────
const examQuestionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    marks: {
      type: Number,
      required: [true, 'Mark allocation is required for each question'],
      min: [1, 'Each question must be worth at least 1 mark'],
    },
    /**
     * idealAnswerOutline is NEVER sent to the client before submission.
     * The controller strips it from pre-submission responses.
     */
    idealAnswerOutline: {
      type: String,
      required: [true, 'Ideal answer outline is required for grading'],
      trim: true,
    },
    topicTag: {
      type: String,
      default: 'Core Curriculum',
      trim: true,
    },
    difficultyLevel: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Expert'],
      default: 'Medium',
    },
  },
  { _id: true }
);

// ─────────────────────────────────────────────
//  User Submission Sub-Schema
//  One entry per exam question capturing the
//  student's written answer, time spent, the
//  AI-awarded marks, and evaluator feedback.
// ─────────────────────────────────────────────
const userSubmissionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'questionId is required in each submission'],
    },
    studentAnswer: {
      type: String,
      default: '',
      trim: true,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
      min: [0, 'Time spent cannot be negative'],
    },
    marksAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    evaluatorFeedback: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  Performance Summary Sub-Schema
//  Computed after grading to provide at-a-glance
//  stats for dashboard widgets and history views.
// ─────────────────────────────────────────────
const performanceSummarySchema = new mongoose.Schema(
  {
    percentageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    grade: {
      type: String,
      default: 'N/A',
      trim: true,
    },
    passStatus: {
      type: String,
      enum: ['Pass', 'Fail', 'Distinction', 'Merit', 'Pending'],
      default: 'Pending',
    },
    topicBreakdown: {
      type: [
        {
          topicTag: { type: String, trim: true },
          marksAvailable: { type: Number, default: 0 },
          marksEarned: { type: Number, default: 0 },
          accuracyPercentage: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    totalTimeUsedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    timeEfficiencyPercentage: {
      type: Number,
      default: 0,
    },
    weakTopicsIdentified: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────
//  MockExam Root Schema
// ─────────────────────────────────────────────
const mockExamSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Mock exam must belong to a user'],
      index: true,
    },

    // ── Exam identity ────────────────────────
    subjectName: {
      type: String,
      required: [true, 'Please provide the subject or course name'],
      trim: true,
      maxlength: [150, 'Subject name cannot exceed 150 characters'],
    },
    examType: {
      type: String,
      enum: ['syllabus', 'past_paper', 'topic_drill'],
      default: 'syllabus',
    },
    syllabusTopics: {
      type: [String],
      default: [],
    },

    // ── Exam configuration ───────────────────
    durationAllowedMinutes: {
      type: Number,
      required: [true, 'Please specify the allowed exam duration in minutes'],
      min: [5, 'Exam duration must be at least 5 minutes'],
      max: [300, 'Exam duration cannot exceed 300 minutes (5 hours)'],
      default: 60,
    },
    totalMarks: {
      type: Number,
      default: 100,
      min: [1, 'Total marks must be at least 1'],
    },

    // ── Questions (populated by AI generator) ──
    questions: {
      type: [examQuestionSchema],
      required: [true, 'Mock exam must contain questions'],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A mock exam must contain at least one question',
      },
    },

    // ── Student submission (populated on submit) ──
    userSubmission: {
      type: [userSubmissionSchema],
      default: [],
    },

    // ── Grading results ──────────────────────
    finalScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    timeManagementFeedback: {
      type: String,
      default: 'Awaiting exam submission and AI grading.',
      trim: true,
    },
    overallPerformanceFeedback: {
      type: String,
      default: '',
      trim: true,
    },

    // ── Computed performance summary ─────────
    performanceSummary: {
      type: performanceSummarySchema,
      default: () => ({}),
    },

    // ── Status flags ─────────────────────────
    isCompleted: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────
mockExamSchema.index({ userId: 1, createdAt: -1 });
mockExamSchema.index({ userId: 1, isCompleted: 1 });

// ─────────────────────────────────────────────
//  Pre-save Hook
//  Synchronise totalMarks from the questions
//  array whenever the document is saved.
// ─────────────────────────────────────────────
mockExamSchema.pre('save', function (next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  }
  next();
});

// ─────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────

/** Percentage score as a computed virtual (available after grading) */
mockExamSchema.virtual('scorePercentage').get(function () {
  if (!this.isCompleted || this.totalMarks === 0) return 0;
  return Math.round((this.finalScore / this.totalMarks) * 100);
});

mockExamSchema.set('toJSON', { virtuals: true });
mockExamSchema.set('toObject', { virtuals: true });

const MockExam = mongoose.model('MockExam', mockExamSchema);

export default MockExam;
