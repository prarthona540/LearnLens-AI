import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
//  Constellation Node Sub-Schema
//
//  Each node represents a discrete concept in the student's cognitive graph.
//  Nodes are categorised by the AI into four semantic states that drive visual
//  rendering on the frontend:
//
//    Core Concept  — foundational pillar of the subject (usually high strength)
//    Mastered      — consistently answered correctly across quizzes
//    Weak Area     — repeated errors / low quiz accuracy detected
//    Bridge Needed — not yet studied but required to unlock adjacent concepts
// ─────────────────────────────────────────────────────────────────────────────
const constellationNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: [true, 'Each constellation node must have a unique nodeId'],
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Node label is required'],
      trim: true,
      maxlength: [120, 'Node label cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Node category is required'],
      enum: {
        values: ['Core Concept', 'Weak Area', 'Mastered', 'Bridge Needed'],
        message:
          'category must be one of: Core Concept, Weak Area, Mastered, Bridge Needed',
      },
      default: 'Core Concept',
    },
    /**
     * strengthScore: 0–100
     *   0–39   → weak / uncharted territory
     *  40–69   → developing understanding
     *  70–89   → proficient
     *  90–100  → mastered
     */
    strengthScore: {
      type: Number,
      required: [true, 'Strength score is required'],
      min: [0, 'Strength score cannot be less than 0'],
      max: [100, 'Strength score cannot exceed 100'],
      default: 0,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Node description cannot exceed 500 characters'],
    },
    /**
     * 3-D spatial coordinates for frontend Three.js / D3-Force rendering.
     * The AI optionally suggests relative positioning; the frontend may
     * override with a physics simulation.
     */
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },
    /**
     * Tracks which quiz topic tags and note key-concepts contributed to this
     * node's strength score during the last synthesis pass.
     */
    sourceTopics: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Constellation Edge Sub-Schema
//
//  Each edge represents a directed semantic relationship between two concept
//  nodes.  Edges are typed by the AI to allow the frontend to render different
//  visual link styles (e.g., dashed for gaps, bold for prerequisites).
//
//  Relationship Types:
//    Prerequisite  — `source` must be understood before `target` can be grasped
//    Advanced By   — `target` is a deeper extension of `source`
//    Correlated    — both concepts appear together frequently in notes/quizzes
//    Gap Bridge    — a missing conceptual step between two otherwise connected nodes
// ─────────────────────────────────────────────────────────────────────────────
const constellationEdgeSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: [true, 'Edge source nodeId is required'],
      trim: true,
    },
    target: {
      type: String,
      required: [true, 'Edge target nodeId is required'],
      trim: true,
    },
    relationshipType: {
      type: String,
      required: [true, 'Edge relationshipType is required'],
      enum: {
        values: ['Prerequisite', 'Advanced By', 'Correlated', 'Gap Bridge'],
        message:
          'relationshipType must be one of: Prerequisite, Advanced By, Correlated, Gap Bridge',
      },
      default: 'Correlated',
    },
    /**
     * weight: 0.0–1.0
     * Represents the semantic strength / confidence of the relationship.
     * Used by force-directed graph layouts to control edge spring tension.
     */
    weight: {
      type: Number,
      min: [0, 'Edge weight cannot be less than 0'],
      max: [1, 'Edge weight cannot exceed 1'],
      default: 0.5,
    },
    /**
     * Human-readable label for tooltip display on the constellation canvas.
     */
    label: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, 'Edge label cannot exceed 200 characters'],
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Synthesis Metadata Sub-Schema
//
//  Records provenance data about each synthesis pass so the constellation
//  can be diffed over time and stale maps can be detected.
// ─────────────────────────────────────────────────────────────────────────────
const synthesisMeta = new mongoose.Schema(
  {
    notesAnalysed: { type: Number, default: 0 },
    quizzesAnalysed: { type: Number, default: 0 },
    totalConceptsExtracted: { type: Number, default: 0 },
    weakAreasCount: { type: Number, default: 0 },
    masteredCount: { type: Number, default: 0 },
    bridgesNeededCount: { type: Number, default: 0 },
    synthesisModel: {
      type: String,
      default: 'gemini-2.5-flash',
      trim: true,
    },
    synthesisTimeMs: { type: Number, default: 0 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
//  ConstellationMap Root Schema
// ─────────────────────────────────────────────────────────────────────────────
const constellationMapSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Constellation map must belong to a user'],
      unique: true,  // One active constellation per user (upsert pattern)
      index: true,
    },

    // ── Identity ───────────────────────────────────────────────────────────
    subjectTitle: {
      type: String,
      default: 'Computer Science & AI Core',
      trim: true,
      maxlength: [200, 'Subject title cannot exceed 200 characters'],
    },

    // ── Graph data ─────────────────────────────────────────────────────────
    nodes: {
      type: [constellationNodeSchema],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length <= 150,
        message: 'Constellation cannot contain more than 150 nodes',
      },
    },
    edges: {
      type: [constellationEdgeSchema],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length <= 500,
        message: 'Constellation cannot contain more than 500 edges',
      },
    },

    // ── AI-generated narrative ─────────────────────────────────────────────
    /**
     * aiSynthesizedInsights: A multi-paragraph AI narrative that
     * (a) explains the student's current cognitive topology,
     * (b) highlights critical gap bridges needed,
     * (c) suggests a prioritised learning path through the constellation.
     */
    aiSynthesizedInsights: {
      type: String,
      default: 'Constellation not yet synthesized. Click "Synthesize Map" to generate your Cognitive Holograph.',
      trim: true,
    },

    /**
     * gapBridgeRecommendations: Structured action items extracted from the
     * AI insights, surfaced individually in the UI.
     */
    gapBridgeRecommendations: {
      type: [
        {
          fromNode: { type: String, trim: true },
          toNode: { type: String, trim: true },
          recommendation: { type: String, trim: true },
          priority: {
            type: String,
            enum: ['Critical', 'High', 'Medium', 'Low'],
            default: 'High',
          },
        },
      ],
      default: [],
    },

    // ── Timestamps & provenance ────────────────────────────────────────────
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    synthesisMeta: {
      type: synthesisMeta,
      default: () => ({}),
    },

    /**
     * Version counter incremented on each synthesis pass.
     * Allows the frontend to detect when a cached map is stale.
     */
    version: {
      type: Number,
      default: 0,
      min: 0,
    },

    /**
     * isSynthesizing: Optimistic lock flag set to true while the AI pipeline
     * is running, preventing duplicate concurrent synthesis requests.
     */
    isSynthesizing: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  Indexes
// ─────────────────────────────────────────────────────────────────────────────
constellationMapSchema.index({ userId: 1, lastUpdated: -1 });

// ─────────────────────────────────────────────────────────────────────────────
//  Pre-save Hook
//  Automatically keep lastUpdated in sync and increment version on changes
//  to nodes or edges (not on meta-only saves like isSynthesizing flag flips).
// ─────────────────────────────────────────────────────────────────────────────
constellationMapSchema.pre('save', function (next) {
  if (this.isModified('nodes') || this.isModified('edges')) {
    this.lastUpdated = new Date();
    this.version += 1;

    // Auto-populate synthesis meta counters from graph data
    if (this.nodes && this.nodes.length > 0) {
      this.synthesisMeta.totalConceptsExtracted = this.nodes.length;
      this.synthesisMeta.weakAreasCount = this.nodes.filter(
        (n) => n.category === 'Weak Area'
      ).length;
      this.synthesisMeta.masteredCount = this.nodes.filter(
        (n) => n.category === 'Mastered'
      ).length;
      this.synthesisMeta.bridgesNeededCount = this.nodes.filter(
        (n) => n.category === 'Bridge Needed'
      ).length;
    }
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
//  Virtuals
// ─────────────────────────────────────────────────────────────────────────────

/** Overall constellation health score: average strengthScore across all nodes */
constellationMapSchema.virtual('overallStrengthScore').get(function () {
  if (!this.nodes || this.nodes.length === 0) return 0;
  const total = this.nodes.reduce((sum, n) => sum + (n.strengthScore || 0), 0);
  return Math.round(total / this.nodes.length);
});

/** True if the map has been synthesized at least once */
constellationMapSchema.virtual('isSynthesized').get(function () {
  return this.nodes && this.nodes.length > 0;
});

constellationMapSchema.set('toJSON', { virtuals: true });
constellationMapSchema.set('toObject', { virtuals: true });

const ConstellationMap = mongoose.model('ConstellationMap', constellationMapSchema);

export default ConstellationMap;
