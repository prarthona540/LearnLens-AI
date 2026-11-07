import ConstellationMap from '../models/ConstellationMap.js';
import Note from '../models/Note.js';
import Quiz from '../models/Quiz.js';
import LearningDNA from '../models/LearningDNA.js';
import { generateCognitiveConstellation } from '../services/constellationService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compile a compact notes-summary string from the most recent N notes,
 * including their AI-generated summaries, key concepts, and weak topics.
 *
 * @param {object[]} notes - Mongoose Note documents
 * @returns {{ summaryText: string, keyConcepts: string[] }}
 */
const buildNotesSummary = (notes) => {
  const keyConcepts = [];
  const lines = [];

  notes.forEach((note, idx) => {
    // Collect key concepts for the graph
    if (Array.isArray(note.keyConcepts)) {
      note.keyConcepts.forEach((c) => {
        if (c && !keyConcepts.includes(c)) keyConcepts.push(c);
      });
    }

    lines.push(
      `--- Note ${idx + 1}: "${note.title}" ---\n` +
      (note.summary
        ? `Summary: ${note.summary}\n`
        : `Content Excerpt: ${(note.rawContent || '').slice(0, 300)}\n`) +
      (note.keyConcepts?.length
        ? `Key Concepts: ${note.keyConcepts.join(', ')}\n`
        : '') +
      (note.weakTopicsIdentified?.length
        ? `Weak Topics Flagged: ${note.weakTopicsIdentified.join(', ')}\n`
        : '')
    );
  });

  return {
    summaryText: lines.join('\n'),
    keyConcepts: keyConcepts.slice(0, 40),
  };
};

/**
 * Derive strong/weak topic arrays and compact quiz history summaries from
 * completed quiz documents.
 *
 * @param {object[]} quizzes - Mongoose Quiz documents (isCompleted: true)
 * @returns {{ weakTopics: string[], strongTopics: string[], quizHistorySummary: object[] }}
 */
const buildQuizAnalytics = (quizzes) => {
  const topicStats = {};
  const quizHistorySummary = [];

  quizzes.forEach((quiz, index) => {
    const totalQ = quiz.totalQuestions || quiz.questions?.length || 1;
    const accuracyPct = Math.round(((quiz.score || 0) / totalQ) * 100);

    quizHistorySummary.push({
      quizTitle: quiz.title,
      score: quiz.score,
      totalQuestions: totalQ,
      accuracyPercentage: accuracyPct,
      attemptedAt: (quiz.updatedAt || quiz.createdAt)?.toISOString?.() || '',
    });

    // Per-topic accuracy tracking
    if (Array.isArray(quiz.userAnswers) && quiz.userAnswers.length > 0) {
      quiz.userAnswers.forEach((ans) => {
        const topic = ans.topicTag || 'General Concept';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
        topicStats[topic].total += 1;
        if (ans.isCorrect) topicStats[topic].correct += 1;
      });
    } else if (Array.isArray(quiz.questions)) {
      quiz.questions.forEach((q) => {
        const topic = q.topicTag || 'General Concept';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
        topicStats[topic].total += 1;
        if (accuracyPct >= 75) topicStats[topic].correct += 1;
      });
    }
  });

  const weakTopics = [];
  const strongTopics = [];

  Object.entries(topicStats).forEach(([topic, { correct, total }]) => {
    const accuracy = total > 0 ? correct / total : 0;
    if (accuracy >= 0.75 && correct > 0) {
      strongTopics.push(topic);
    } else {
      weakTopics.push(topic);
    }
  });

  return { weakTopics, strongTopics, quizHistorySummary };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Synthesize (or re-synthesize) the authenticated user's AI Cognitive
 *          Holograph constellation map.
 *
 *          Pipeline:
 *            1. Fetch user's recent notes (last 10) and completed quizzes (last 15)
 *            2. Pull weak/strong topics from LearningDNA if available
 *            3. Compile compact summaries and analytics
 *            4. Call Gemini AI via constellationService
 *            5. Upsert ConstellationMap document in MongoDB
 *            6. Return full graph payload to client
 *
 * @route   POST /api/constellation/synthesize
 * @access  Private
 *
 * Optional request body:
 *   {
 *     "subjectTitle": "Data Structures & Algorithms"  // override default subject label
 *   }
 */
export const synthesizeConstellation = async (req, res) => {
  const userId = req.user._id;

  try {
    // ── Concurrency guard ────────────────────────────────────────────────
    // Check if a synthesis is already in-flight for this user.
    const existing = await ConstellationMap.findOne({ userId }).select(
      'isSynthesizing version lastUpdated'
    );

    if (existing?.isSynthesizing) {
      return res.status(409).json({
        success: false,
        message:
          'A constellation synthesis is already in progress for your account. ' +
          'Please wait for it to complete before triggering a new one.',
      });
    }

    // ── Acquire optimistic lock ──────────────────────────────────────────
    if (existing) {
      existing.isSynthesizing = true;
      await existing.save();
    }

    // ── Determine subject title ──────────────────────────────────────────
    const subjectTitle =
      (req.body?.subjectTitle && req.body.subjectTitle.trim()) ||
      existing?.subjectTitle ||
      'Computer Science & AI Core';

    // ── Fetch source data ────────────────────────────────────────────────
    const [notes, quizzes, dna] = await Promise.all([
      Note.find({ userId })
        .select('title rawContent summary keyConcepts weakTopicsIdentified')
        .sort({ updatedAt: -1 })
        .limit(10),
      Quiz.find({ userId, isCompleted: true })
        .select('title score totalQuestions questions userAnswers updatedAt createdAt')
        .sort({ createdAt: -1 })
        .limit(15),
      LearningDNA.findOne({ userId }).select(
        'strongTopics weakTopics knowledgeGaps'
      ),
    ]);

    // ── Build input payloads ─────────────────────────────────────────────
    const { summaryText, keyConcepts } = buildNotesSummary(notes);
    const { weakTopics: quizWeak, strongTopics: quizStrong, quizHistorySummary } =
      buildQuizAnalytics(quizzes);

    // Merge quiz-derived topics with LearningDNA topics (deduplicated)
    const weakTopics = [
      ...new Set([
        ...quizWeak,
        ...(dna?.weakTopics || []),
        ...(dna?.knowledgeGaps || []),
      ]),
    ].slice(0, 20);

    const strongTopics = [
      ...new Set([...quizStrong, ...(dna?.strongTopics || [])]),
    ].slice(0, 20);

    // ── Call AI synthesis service ────────────────────────────────────────
    const synthesisStartMs = Date.now();

    const constellationPayload = await generateCognitiveConstellation({
      subjectTitle,
      notesSummaryText: summaryText,
      quizHistorySummary,
      weakTopics,
      strongTopics,
      keyConcepts,
    });

    const synthesisTimeMs = Date.now() - synthesisStartMs;

    // ── Upsert ConstellationMap ──────────────────────────────────────────
    const upsertData = {
      subjectTitle,
      nodes: constellationPayload.nodes,
      edges: constellationPayload.edges,
      aiSynthesizedInsights: constellationPayload.aiSynthesizedInsights,
      gapBridgeRecommendations: constellationPayload.gapBridgeRecommendations,
      isSynthesizing: false,
      lastUpdated: new Date(),
      synthesisMeta: {
        notesAnalysed: notes.length,
        quizzesAnalysed: quizzes.length,
        totalConceptsExtracted: constellationPayload.nodes.length,
        weakAreasCount: constellationPayload.nodes.filter((n) => n.category === 'Weak Area').length,
        masteredCount: constellationPayload.nodes.filter((n) => n.category === 'Mastered').length,
        bridgesNeededCount: constellationPayload.nodes.filter((n) => n.category === 'Bridge Needed').length,
        synthesisModel: constellationPayload.synthesisModel,
        synthesisTimeMs,
      },
    };

    const constellationMap = await ConstellationMap.findOneAndUpdate(
      { userId },
      {
        $set: upsertData,
        $setOnInsert: { userId },
        $inc: { version: 1 },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Cognitive Holograph synthesized — ${constellationMap.nodes.length} concepts mapped across ${constellationMap.edges.length} semantic connections`,
      constellationMap,
      synthesisStats: {
        notesAnalysed: notes.length,
        quizzesAnalysed: quizzes.length,
        nodesGenerated: constellationMap.nodes.length,
        edgesGenerated: constellationMap.edges.length,
        weakAreasIdentified: upsertData.synthesisMeta.weakAreasCount,
        masteredConceptsCount: upsertData.synthesisMeta.masteredCount,
        bridgesNeededCount: upsertData.synthesisMeta.bridgesNeededCount,
        synthesisModel: constellationPayload.synthesisModel,
        synthesisTimeMs,
      },
    });
  } catch (error) {
    // ── Release lock on error ────────────────────────────────────────────
    try {
      await ConstellationMap.findOneAndUpdate(
        { userId },
        { $set: { isSynthesizing: false } }
      );
    } catch (_) {
      // Best-effort; do not mask the original error
    }

    console.error(`[Constellation Synthesize Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while synthesizing constellation map',
    });
  }
};

/**
 * @desc    Get the authenticated user's current Cognitive Holograph constellation map.
 *          Returns a lightweight "not synthesized" placeholder if no map exists yet.
 *
 * @route   GET /api/constellation
 * @access  Private
 */
export const getConstellationMap = async (req, res) => {
  try {
    const userId = req.user._id;

    const constellationMap = await ConstellationMap.findOne({ userId });

    if (!constellationMap) {
      // Return a structured empty-state response — not a 404 — so the
      // frontend can render an onboarding prompt without special-casing errors.
      return res.status(200).json({
        success: true,
        isSynthesized: false,
        message:
          'Your Cognitive Holograph has not been synthesized yet. ' +
          'Post to /api/constellation/synthesize to generate your constellation map.',
        constellationMap: null,
      });
    }

    return res.status(200).json({
      success: true,
      isSynthesized: constellationMap.nodes.length > 0,
      isSynthesizing: constellationMap.isSynthesizing,
      constellationMap,
    });
  } catch (error) {
    console.error(`[Get Constellation Map Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching constellation map',
    });
  }
};

/**
 * @desc    Get a compact, lightweight snapshot of the constellation suitable
 *          for dashboard widgets (node counts, overall strength, top insights).
 *          Avoids sending the full node/edge arrays to the dashboard.
 *
 * @route   GET /api/constellation/summary
 * @access  Private
 */
export const getConstellationSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const map = await ConstellationMap.findOne({ userId }).select(
      'subjectTitle nodes.category nodes.strengthScore aiSynthesizedInsights ' +
      'gapBridgeRecommendations lastUpdated version synthesisMeta isSynthesizing'
    );

    if (!map || map.nodes.length === 0) {
      return res.status(200).json({
        success: true,
        isSynthesized: false,
        summary: null,
      });
    }

    const totalStrength = map.nodes.reduce((s, n) => s + (n.strengthScore || 0), 0);
    const overallStrength = Math.round(totalStrength / map.nodes.length);

    const categoryBreakdown = {
      coreConceptCount: 0,
      masteredCount: 0,
      weakAreaCount: 0,
      bridgeNeededCount: 0,
    };

    map.nodes.forEach((n) => {
      if (n.category === 'Core Concept')   categoryBreakdown.coreConceptCount  += 1;
      if (n.category === 'Mastered')       categoryBreakdown.masteredCount      += 1;
      if (n.category === 'Weak Area')      categoryBreakdown.weakAreaCount      += 1;
      if (n.category === 'Bridge Needed')  categoryBreakdown.bridgeNeededCount  += 1;
    });

    return res.status(200).json({
      success: true,
      isSynthesized: true,
      isSynthesizing: map.isSynthesizing,
      summary: {
        subjectTitle: map.subjectTitle,
        overallStrengthScore: overallStrength,
        totalNodes: map.nodes.length,
        categoryBreakdown,
        topGapBridgeRecommendations: map.gapBridgeRecommendations
          .filter((r) => r.priority === 'Critical' || r.priority === 'High')
          .slice(0, 3),
        // Send first 500 chars of insights for the dashboard card
        insightExcerpt: map.aiSynthesizedInsights.slice(0, 500),
        lastUpdated: map.lastUpdated,
        version: map.version,
        synthesisMeta: map.synthesisMeta,
      },
    });
  } catch (error) {
    console.error(`[Get Constellation Summary Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching constellation summary',
    });
  }
};

/**
 * @desc    Patch a single node's strengthScore or category on the user's
 *          constellation map.  Useful when frontend receives real-time quiz
 *          results and wants to optimistically update node state without a
 *          full re-synthesis.
 *
 * @route   PATCH /api/constellation/node/:nodeId
 * @access  Private
 *
 * Request body (all fields optional):
 *   {
 *     "strengthScore": 85,
 *     "category":      "Mastered"
 *   }
 */
export const patchConstellationNode = async (req, res) => {
  try {
    const userId = req.user._id;
    const { nodeId } = req.params;
    const { strengthScore, category } = req.body;

    const VALID_CATEGORIES = ['Core Concept', 'Weak Area', 'Mastered', 'Bridge Needed'];

    if (!nodeId || !nodeId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a nodeId parameter',
      });
    }

    if (
      strengthScore === undefined &&
      category === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of: strengthScore, category',
      });
    }

    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    if (strengthScore !== undefined) {
      const score = Number(strengthScore);
      if (isNaN(score) || score < 0 || score > 100) {
        return res.status(400).json({
          success: false,
          message: 'strengthScore must be a number between 0 and 100',
        });
      }
    }

    const map = await ConstellationMap.findOne({ userId });

    if (!map) {
      return res.status(404).json({
        success: false,
        message: 'Constellation map not found. Please synthesize your map first.',
      });
    }

    const targetNode = map.nodes.find((n) => n.nodeId === nodeId.trim());

    if (!targetNode) {
      return res.status(404).json({
        success: false,
        message: `Node with nodeId "${nodeId}" not found in your constellation`,
      });
    }

    // Apply partial update
    if (strengthScore !== undefined) {
      targetNode.strengthScore = Math.min(100, Math.max(0, Math.round(Number(strengthScore))));
    }
    if (category !== undefined) {
      targetNode.category = category;
    }

    // Mark nodes array as modified so Mongoose detects the subdoc change
    map.markModified('nodes');
    map.lastUpdated = new Date();
    await map.save();

    return res.status(200).json({
      success: true,
      message: `Node "${targetNode.label}" updated successfully`,
      updatedNode: targetNode,
    });
  } catch (error) {
    console.error(`[Patch Constellation Node Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating constellation node',
    });
  }
};

/**
 * @desc    Delete (reset) the authenticated user's constellation map.
 *          Removes the document entirely so a fresh synthesis starts clean.
 *
 * @route   DELETE /api/constellation
 * @access  Private
 */
export const deleteConstellationMap = async (req, res) => {
  try {
    const userId = req.user._id;

    const deleted = await ConstellationMap.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'No constellation map found to delete',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Constellation map deleted successfully. You can re-synthesize at any time.',
    });
  } catch (error) {
    console.error(`[Delete Constellation Map Error]: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while deleting constellation map',
    });
  }
};
