import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
//  Conversation Turn Sub-Schema
//
//  One entry is recorded per exchange round in the viva session.
//  The examiner's question and the student's response are stored together
//  with the ISO timestamp at which the student submitted their answer.
//  `turnNumber` (1-based) makes ordering and display trivial.
//  `questionType` signals the examiner's rhetorical intent for that turn,
//  enabling downstream analytics on Socratic depth and question variety.
//  `thinkingTimeSeconds` measures how long the student spent on each turn
//  — a proxy for cognitive load and confidence.
// ─────────────────────────────────────────────────────────────────────────────
const vivaTurnSchema = new mongoose.Schema(
  {
    turnNumber: {
      type: Number,
      required: true,
      min: [1, 'Turn number must be at least 1'],
    },
    examinerQuestion: {
      type: String,
      required: [true, 'Examiner question is required for each turn'],
      trim: true,
    },
    studentAnswer: {
      type: String,
      default: '',
      trim: true,
    },
    /**
     * Socratic question classification — the examiner's strategic intent:
     *   Opening          — the seed question establishing the topic
     *   Conceptual Probe — tests definitional / foundational clarity
     *   Counterexample   — challenges the student with a contradiction
     *   Edge Case        — probes behaviour at system/algorithm boundaries
     *   Synthesis        — asks the student to integrate across concepts
     *   Misconception    — directly confronts a detected logical fallacy
     */
    questionType: {
      type: String,
      enum: {
        values: [
          'Opening',
          'Conceptual Probe',
          'Counterexample',
          'Edge Case',
          'Synthesis',
          'Misconception',
        ],
        message: '{VALUE} is not a valid Socratic question type',
      },
      default: 'Conceptual Probe',
    },
    /**
     * Brief AI reasoning note on WHY this question was chosen —
     * exposed in the final scorecard to show the examiner's logic.
     */
    examinerRationale: {
      type: String,
      default: '',
      trim: true,
    },
    /**
     * Per-turn quality score (0–10) assigned during final evaluation.
     * Null while the session is InProgress.
     */
    turnScore: {
      type: Number,
      default: null,
      min: 0,
      max: 10,
    },
    thinkingTimeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Evaluation Sub-Schema
//
//  Populated only when status transitions to 'Completed'.
//  `rubricBreakdown` stores per-dimension scores so the frontend
//  can render a spider/radar chart of cognitive performance.
//  `fallaciesDetected` is an array of precise logical errors the
//  AI identified during the cross-examination.
// ─────────────────────────────────────────────────────────────────────────────
const vivaEvaluationSchema = new mongoose.Schema(
  {
    overallScore: {
      type: Number,
      default: 0,
      min: [0, 'Overall score cannot be less than 0'],
      max: [100, 'Overall score cannot exceed 100'],
    },
    conceptualClarity: {
      type: String,
      enum: {
        values: ['High', 'Medium', 'Low'],
        message: 'conceptualClarity must be High, Medium, or Low',
      },
      default: 'Medium',
    },
    /**
     * rubricBreakdown: per-dimension scores (0–10 each) covering the
     * five cognitive axes assessed by the Socratic examiner.
     */
    rubricBreakdown: {
      conceptualDepth:    { type: Number, default: 0, min: 0, max: 10 },
      reasoningRigour:    { type: Number, default: 0, min: 0, max: 10 },
      edgeCaseAwareness:  { type: Number, default: 0, min: 0, max: 10 },
      articulationClarity:{ type: Number, default: 0, min: 0, max: 10 },
      adaptabilityUnderPressure: { type: Number, default: 0, min: 0, max: 10 },
    },
    strengths: {
      type: [String],
      default: [],
    },
    weakAreasIdentified: {
      type: [String],
      default: [],
    },
    fallaciesDetected: {
      type: [String],
      default: [],
    },
    /**
     * examinerFeedback: a rich multi-paragraph narrative covering overall
     * performance, the most critical gaps, and a concrete remediation plan.
     */
    examinerFeedback: {
      type: String,
      default: '',
      trim: true,
    },
    /**
     * recommendedStudyActions: 2–4 prioritised, concrete next steps
     * the student should take to address the identified weaknesses.
     */
    recommendedStudyActions: {
      type: [
        {
          action:   { type: String, trim: true },
          priority: {
            type: String,
            enum: ['Critical', 'High', 'Medium', 'Low'],
            default: 'High',
          },
        },
      ],
      default: [],
    },
    /**
     * vivaGrade: Academic letter grade following the Socratic performance band.
     *   S → Exemplary (90–100)
     *   A → Excellent  (80–89)
     *   B → Proficient (65–79)
     *   C → Developing (50–64)
     *   D → Insufficient (< 50)
     */
    vivaGrade: {
      type: String,
      enum: {
        values: ['S', 'A', 'B', 'C', 'D'],
        message: 'vivaGrade must be one of S, A, B, C, D',
      },
      default: 'D',
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
//  VivaSession Root Schema
// ─────────────────────────────────────────────────────────────────────────────
const vivaSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Viva session must belong to a user'],
      index: true,
    },

    // ── Exam identity ──────────────────────────────────────────────────────
    topic: {
      type: String,
      required: [true, 'Please provide the viva examination topic'],
      trim: true,
      maxlength: [300, 'Topic cannot exceed 300 characters'],
    },
    /**
     * difficulty: Controls the aggressiveness of the Socratic cross-questioning
     * and the depth of edge-case probing in the AI prompts.
     */
    difficulty: {
      type: String,
      enum: {
        values: ['Undergraduate', 'Postgraduate', 'Doctoral', 'Industry Expert'],
        message: 'difficulty must be Undergraduate, Postgraduate, Doctoral, or Industry Expert',
      },
      default: 'Undergraduate',
    },

    // ── Session lifecycle ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['InProgress', 'Completed', 'Abandoned'],
        message: 'status must be InProgress, Completed, or Abandoned',
      },
      default: 'InProgress',
    },

    // ── Conversation history ───────────────────────────────────────────────
    turns: {
      type: [vivaTurnSchema],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length <= 15,
        message: 'A viva session cannot exceed 15 turns',
      },
    },

    // ── Configuration ──────────────────────────────────────────────────────
    /**
     * maxTurns: Configurable turn limit (default 5, max 10).
     * When turns.length reaches maxTurns after the student answers,
     * the session completes and the AI issues the final scorecard.
     */
    maxTurns: {
      type: Number,
      default: 5,
      min: [2, 'A viva must have at least 2 turns'],
      max: [10, 'A viva session cannot exceed 10 turns'],
    },

    // ── Final scorecard ────────────────────────────────────────────────────
    evaluation: {
      type: vivaEvaluationSchema,
      default: () => ({}),
    },

    // ── Session timing ─────────────────────────────────────────────────────
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    totalDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────
vivaSessionSchema.index({ userId: 1, createdAt: -1 });
vivaSessionSchema.index({ userId: 1, status: 1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

/** Current turn number (1-based) — the number of turns recorded so far + 1 */
vivaSessionSchema.virtual('currentTurnNumber').get(function () {
  return this.turns.length + 1;
});

/** How many answer turns remain before the session closes */
vivaSessionSchema.virtual('turnsRemaining').get(function () {
  return Math.max(0, this.maxTurns - this.turns.length);
});

/** True if the session has reached its maxTurns threshold */
vivaSessionSchema.virtual('isExhausted').get(function () {
  return this.turns.length >= this.maxTurns;
});

vivaSessionSchema.set('toJSON', { virtuals: true });
vivaSessionSchema.set('toObject', { virtuals: true });

const VivaSession = mongoose.model('VivaSession', vivaSessionSchema);

export default VivaSession;
