import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
//  Client Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a configured GoogleGenAI client.  Throws immediately if the
 * API key is absent or still set to the placeholder value, so errors
 * surface at the service layer rather than silently returning garbage.
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is not configured in backend/.env. ' +
      'Please provide a valid Google Gemini API key.'
    );
  }
  return new GoogleGenAI({ apiKey });
};

// ─────────────────────────────────────────────────────────────────────────────
//  JSON Sanitizer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip any Markdown code-fence wrappers and extraneous whitespace from an
 * AI response before attempting JSON.parse().
 * @param {string} raw
 * @returns {string}
 */
const sanitizeJsonResponse = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};

// ─────────────────────────────────────────────────────────────────────────────
//  Enum Validators
// ─────────────────────────────────────────────────────────────────────────────

const VALID_NODE_CATEGORIES = ['Core Concept', 'Weak Area', 'Mastered', 'Bridge Needed'];
const VALID_EDGE_TYPES      = ['Prerequisite', 'Advanced By', 'Correlated', 'Gap Bridge'];
const VALID_PRIORITIES      = ['Critical', 'High', 'Medium', 'Low'];

// ─────────────────────────────────────────────────────────────────────────────
//  Payload Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates and normalises the raw AI constellation JSON into the exact shape
 * expected by the ConstellationMap Mongoose schema.
 *
 * @param {object} parsed   - Raw parsed JSON from AI response
 * @param {string} subject  - Subject title (used in fallback labels)
 * @returns {{ nodes: Array, edges: Array, aiSynthesizedInsights: string, gapBridgeRecommendations: Array }}
 * @throws {Error} if the payload is structurally invalid
 */
const validateAndNormaliseConstellation = (parsed, subject) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Constellation AI response is not a JSON object');
  }

  // ── Nodes ────────────────────────────────────────────────────────────────
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error('Constellation AI response contains no valid nodes array');
  }

  const usedNodeIds = new Set();

  const nodes = parsed.nodes.map((n, idx) => {
    const nodeId = n.nodeId
      ? String(n.nodeId).trim()
      : `node_${idx + 1}`;

    if (usedNodeIds.has(nodeId)) {
      // De-duplicate by suffixing index
      const unique = `${nodeId}_${idx}`;
      usedNodeIds.add(unique);
      return buildNode(n, unique, idx, subject);
    }

    usedNodeIds.add(nodeId);
    return buildNode(n, nodeId, idx, subject);
  }).slice(0, 150); // Hard-cap at model limit

  // ── Edges ────────────────────────────────────────────────────────────────
  const edges = Array.isArray(parsed.edges)
    ? parsed.edges
        .filter((e) => e && e.source && e.target)
        .map((e) => ({
          source: String(e.source).trim(),
          target: String(e.target).trim(),
          relationshipType: VALID_EDGE_TYPES.includes(e.relationshipType)
            ? e.relationshipType
            : 'Correlated',
          weight: Math.min(1, Math.max(0, Number(e.weight) || 0.5)),
          label: e.label ? String(e.label).trim().slice(0, 200) : '',
        }))
        // Drop edges referencing non-existent nodes
        .filter((e) => usedNodeIds.has(e.source) && usedNodeIds.has(e.target))
        .slice(0, 500)
    : [];

  // ── Insights & Recommendations ───────────────────────────────────────────
  const aiSynthesizedInsights =
    parsed.aiSynthesizedInsights && typeof parsed.aiSynthesizedInsights === 'string'
      ? parsed.aiSynthesizedInsights.trim().slice(0, 5000)
      : `Cognitive Holograph synthesized for "${subject}". Explore the constellation to identify mastered nodes (green), weak areas (red), and bridge concepts (orange) that unlock deeper understanding.`;

  const gapBridgeRecommendations = Array.isArray(parsed.gapBridgeRecommendations)
    ? parsed.gapBridgeRecommendations
        .filter((r) => r && r.recommendation)
        .map((r) => ({
          fromNode: String(r.fromNode || '').trim(),
          toNode: String(r.toNode || '').trim(),
          recommendation: String(r.recommendation).trim().slice(0, 400),
          priority: VALID_PRIORITIES.includes(r.priority) ? r.priority : 'High',
        }))
        .slice(0, 20)
    : [];

  return { nodes, edges, aiSynthesizedInsights, gapBridgeRecommendations };
};

/**
 * Construct a single normalised node object.
 * @private
 */
const buildNode = (n, nodeId, idx, subject) => ({
  nodeId,
  label: n.label
    ? String(n.label).trim().slice(0, 120)
    : `${subject} Concept ${idx + 1}`,
  category: VALID_NODE_CATEGORIES.includes(n.category)
    ? n.category
    : 'Core Concept',
  strengthScore: Math.min(100, Math.max(0, Math.round(Number(n.strengthScore) || 50))),
  description: n.description
    ? String(n.description).trim().slice(0, 500)
    : '',
  position: {
    x: Number(n.position?.x) || 0,
    y: Number(n.position?.y) || 0,
    z: Number(n.position?.z) || 0,
  },
  sourceTopics: Array.isArray(n.sourceTopics)
    ? n.sourceTopics.map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
    : [],
});

// ─────────────────────────────────────────────────────────────────────────────
//  Deterministic Fallback Constellation Generator
//
//  Invoked when the Gemini API is unavailable (quota exceeded, invalid key,
//  network error) so the UI always receives a structurally valid response.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a heuristic constellation from raw data without calling the AI.
 *
 * @param {string} subject
 * @param {string[]} keyConcepts   - Extracted from notes
 * @param {string[]} weakTopics    - From quiz gap analysis
 * @param {string[]} strongTopics  - From quiz performance
 * @returns {{ nodes: Array, edges: Array, aiSynthesizedInsights: string, gapBridgeRecommendations: Array }}
 */
const buildFallbackConstellation = (subject, keyConcepts, weakTopics, strongTopics) => {
  const nodes = [];
  const edges = [];
  const usedIds = new Set();

  const toId = (label, prefix = '') => {
    const base = `${prefix}${label.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`;
    if (!usedIds.has(base)) { usedIds.add(base); return base; }
    const unique = `${base}_${usedIds.size}`;
    usedIds.add(unique);
    return unique;
  };

  // Core root node
  const rootId = toId(subject, 'root_');
  nodes.push({
    nodeId: rootId,
    label: subject,
    category: 'Core Concept',
    strengthScore: 70,
    description: `Core foundational domain: ${subject}`,
    position: { x: 0, y: 0, z: 0 },
    sourceTopics: [],
  });

  // Strong / mastered concepts
  const uniqueStrong = [...new Set(strongTopics)].slice(0, 10);
  uniqueStrong.forEach((topic, i) => {
    const id = toId(topic, 'strong_');
    nodes.push({
      nodeId: id,
      label: topic,
      category: 'Mastered',
      strengthScore: 85 + Math.min(10, i),
      description: `Consistently demonstrated mastery of ${topic}`,
      position: { x: (i - 5) * 60, y: 100, z: (i % 3) * 40 },
      sourceTopics: [topic],
    });
    edges.push({ source: rootId, target: id, relationshipType: 'Advanced By', weight: 0.8, label: 'Mastered' });
  });

  // Weak areas
  const uniqueWeak = [...new Set(weakTopics)].slice(0, 10);
  uniqueWeak.forEach((topic, i) => {
    const id = toId(topic, 'weak_');
    nodes.push({
      nodeId: id,
      label: topic,
      category: 'Weak Area',
      strengthScore: 20 + Math.floor(Math.random() * 20),
      description: `Persistent errors detected in ${topic}. Targeted revision recommended.`,
      position: { x: (i - 5) * 60, y: -100, z: (i % 3) * 40 },
      sourceTopics: [topic],
    });
    edges.push({ source: rootId, target: id, relationshipType: 'Gap Bridge', weight: 0.4, label: 'Needs Work' });
  });

  // Key concepts from notes (may overlap — de-duped via usedIds)
  const uniqueConcepts = [...new Set(keyConcepts)]
    .filter((c) => !strongTopics.includes(c) && !weakTopics.includes(c))
    .slice(0, 15);

  uniqueConcepts.forEach((concept, i) => {
    const id = toId(concept, 'concept_');
    nodes.push({
      nodeId: id,
      label: concept,
      category: 'Core Concept',
      strengthScore: 55,
      description: `Concept identified from study notes: ${concept}`,
      position: { x: (i - 7) * 50, y: 0, z: 60 + i * 20 },
      sourceTopics: [concept],
    });

    // Link to previous concept to form a chain
    const prev = nodes.length >= 2 ? nodes[nodes.length - 2].nodeId : rootId;
    edges.push({ source: prev, target: id, relationshipType: 'Prerequisite', weight: 0.6, label: 'Prerequisite' });
  });

  // Bridge nodes for each weak area
  uniqueWeak.slice(0, 5).forEach((topic, i) => {
    const bridgeId = toId(`bridge_${topic}`, 'bridge_');
    const weakNodeId = `weak_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`;
    nodes.push({
      nodeId: bridgeId,
      label: `${topic} Fundamentals`,
      category: 'Bridge Needed',
      strengthScore: 10,
      description: `Missing prerequisite knowledge bridging toward ${topic}. Prioritise review.`,
      position: { x: (i - 2) * 70, y: -180, z: i * 30 },
      sourceTopics: [topic],
    });
    edges.push({ source: bridgeId, target: weakNodeId, relationshipType: 'Prerequisite', weight: 0.9, label: 'Must Learn First' });
  });

  const gapBridgeRecommendations = uniqueWeak.slice(0, 5).map((topic, i) => ({
    fromNode: `bridge_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
    toNode: `weak_${topic.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
    recommendation: `Review foundational materials for "${topic}" before attempting advanced quiz questions on this concept.`,
    priority: i === 0 ? 'Critical' : 'High',
  }));

  const aiSynthesizedInsights =
    `[Heuristic Constellation — AI Synthesis Unavailable]\n\n` +
    `Your Cognitive Holograph for "${subject}" has been constructed from your activity data.\n\n` +
    `Mastered Concepts (${uniqueStrong.length}): ${uniqueStrong.join(', ') || 'None yet — keep studying!'}\n\n` +
    `Weak Areas Requiring Attention (${uniqueWeak.length}): ${uniqueWeak.join(', ') || 'No weak areas detected.'}\n\n` +
    `Recommended Learning Path: Begin by bridging the foundational gaps in your weakest topics, ` +
    `then reinforce core concept connections before tackling advanced branches.`;

  return { nodes, edges, aiSynthesizedInsights, gapBridgeRecommendations };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Gemini Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the multi-part constellation synthesis prompt sent to Gemini.
 *
 * @param {string} subject
 * @param {string} notesSummaryText   - Compressed multi-note summary
 * @param {object[]} quizHistorySummary - Compact quiz performance records
 * @param {string[]} weakTopics
 * @param {string[]} strongTopics
 * @param {string[]} keyConcepts
 * @returns {string}
 */
const buildConstellationPrompt = (
  subject,
  notesSummaryText,
  quizHistorySummary,
  weakTopics,
  strongTopics,
  keyConcepts
) => `You are an AI Cognitive Architect and Knowledge Graph Specialist for LearnLens AI.
Your role is to synthesize a student's entire learning history into a semantic "Cognitive Holograph" —
a constellation of interconnected concept nodes that visually maps their current knowledge state.

═══════════════════════════════════════════════════════════════
STUDENT LEARNING PROFILE
Subject Domain: "${subject}"
═══════════════════════════════════════════════════════════════

── Study Notes Summary ──
${notesSummaryText.slice(0, 4000) || 'No notes available yet.'}

── Quiz Performance History ──
${JSON.stringify(quizHistorySummary.slice(0, 8), null, 2)}

── Identified Strong Topics (quiz accuracy ≥ 75%) ──
${JSON.stringify(strongTopics.slice(0, 15))}

── Identified Weak Areas (quiz accuracy < 75% or note-flagged) ──
${JSON.stringify(weakTopics.slice(0, 15))}

── Key Concepts Extracted from Notes ──
${JSON.stringify(keyConcepts.slice(0, 25))}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════
Synthesize this data into a cognitive constellation graph with the following requirements:

1. NODES (12 to 30 nodes total):
   - Every node must have a unique "nodeId" (snake_case, e.g., "binary_search_trees").
   - "label": A short human-readable concept name (max 8 words).
   - "category": MUST be exactly one of:
       "Core Concept"   → foundational pillar of the subject domain
       "Mastered"       → student consistently answers correctly
       "Weak Area"      → student has repeated errors or omissions
       "Bridge Needed"  → prerequisite gap: student hasn't encountered this yet
   - "strengthScore": Integer 0–100.
       Mastered → 80–100 | Core Concept → 55–79 | Weak Area → 10–45 | Bridge Needed → 0–20
   - "description": 1–2 sentences explaining this concept's role in the constellation.
   - "position": Suggest approximate 3D coordinates { "x": int, "y": int, "z": int } in range ±400.
     Use y=0 for core concepts, y>0 for mastered, y<0 for weak, z-axis for depth/clustering.
   - "sourceTopics": Array of relevant topic/tag strings from the student's data.

2. EDGES (8 to 60 edges total):
   - "source" and "target": nodeId strings from your nodes list.
   - "relationshipType": MUST be exactly one of:
       "Prerequisite"  → source must be learned before target
       "Advanced By"   → target is a deeper extension of source
       "Correlated"    → frequently co-appear in notes/quizzes
       "Gap Bridge"    → a bridging step needed between two concepts
   - "weight": Float 0.0–1.0 (strength of relationship).
   - "label": A short 2–5 word description of the relationship.
   - Only create edges between nodeIds that exist in your nodes array.

3. AI SYNTHESIZED INSIGHTS (aiSynthesizedInsights):
   Write a rich, 3–5 paragraph narrative addressing:
   a) The student's current cognitive topology: which clusters are strong vs fractured.
   b) The 2–3 most critical "gap bridges" blocking their progress.
   c) A concrete, prioritised learning path through the constellation.
   d) A motivational closing sentence.

4. GAP BRIDGE RECOMMENDATIONS (gapBridgeRecommendations):
   List 3–8 specific, actionable bridge recommendations:
   - "fromNode": nodeId of the prerequisite gap node
   - "toNode": nodeId of the target weak/bridge node
   - "recommendation": Concrete 1–2 sentence study action
   - "priority": "Critical" | "High" | "Medium" | "Low"

═══════════════════════════════════════════════════════════════
STRICT JSON OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
Respond ONLY with a valid JSON object exactly matching this schema.
Do NOT include markdown fences, comments, or any conversational text.

{
  "nodes": [
    {
      "nodeId": "string",
      "label": "string",
      "category": "Core Concept",
      "strengthScore": 70,
      "description": "string",
      "position": { "x": 0, "y": 0, "z": 0 },
      "sourceTopics": ["string"]
    }
  ],
  "edges": [
    {
      "source": "string",
      "target": "string",
      "relationshipType": "Prerequisite",
      "weight": 0.8,
      "label": "string"
    }
  ],
  "aiSynthesizedInsights": "string",
  "gapBridgeRecommendations": [
    {
      "fromNode": "string",
      "toNode": "string",
      "recommendation": "string",
      "priority": "High"
    }
  ]
}`;

// ─────────────────────────────────────────────────────────────────────────────
//  Primary Export: generateCognitiveConstellation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls Gemini AI to synthesize a cognitive constellation from a student's
 * learning data.  Falls back to a heuristic generator if the API is
 * unavailable, ensuring the endpoint always returns a valid graph payload.
 *
 * @param {object} params
 * @param {string}   params.subjectTitle      - Display name of the subject domain
 * @param {string}   params.notesSummaryText  - Concatenated summaries/key-concepts from notes
 * @param {object[]} params.quizHistorySummary - Compact quiz performance records
 * @param {string[]} params.weakTopics         - Topics with quiz accuracy < 75%
 * @param {string[]} params.strongTopics       - Topics with quiz accuracy ≥ 75%
 * @param {string[]} params.keyConcepts        - Key concepts extracted from notes
 *
 * @returns {Promise<{
 *   nodes: Array,
 *   edges: Array,
 *   aiSynthesizedInsights: string,
 *   gapBridgeRecommendations: Array,
 *   synthesisModel: string,
 *   synthesisTimeMs: number
 * }>}
 */
export const generateCognitiveConstellation = async ({
  subjectTitle = 'Computer Science & AI Core',
  notesSummaryText = '',
  quizHistorySummary = [],
  weakTopics = [],
  strongTopics = [],
  keyConcepts = [],
}) => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const startTime = Date.now();

  const prompt = buildConstellationPrompt(
    subjectTitle,
    notesSummaryText,
    quizHistorySummary,
    weakTopics,
    strongTopics,
    keyConcepts
  );

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.35,  // Slightly elevated for creative edge/node labelling
        maxOutputTokens: 8192,
      },
    });

    const rawText = response.text;

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Gemini returned an empty response for constellation synthesis');
    }

    const sanitized = sanitizeJsonResponse(rawText);

    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (parseError) {
      console.error('[Constellation Service] JSON parse failed. Raw response sample:', rawText.slice(0, 300));
      throw new Error(`Constellation AI response is not valid JSON: ${parseError.message}`);
    }

    const normalised = validateAndNormaliseConstellation(parsed, subjectTitle);
    const synthesisTimeMs = Date.now() - startTime;

    console.info(
      `[Constellation Service] Synthesis complete — ` +
      `${normalised.nodes.length} nodes, ${normalised.edges.length} edges, ` +
      `${synthesisTimeMs}ms`
    );

    return {
      ...normalised,
      synthesisModel: modelName,
      synthesisTimeMs,
    };
  } catch (error) {
    const synthesisTimeMs = Date.now() - startTime;

    // Determine whether this is a configuration / quota error or a logic error
    const isApiError =
      error.message.includes('GEMINI_API_KEY') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('quota') ||
      error.message.includes('503') ||
      error.message.includes('unavailable');

    if (isApiError) {
      console.warn(
        `[Constellation Service] Gemini API unavailable (${error.message}). ` +
        `Generating heuristic fallback constellation.`
      );
    } else {
      console.error(`[Constellation Service Error]: ${error.message}`);
    }

    // Always fall back gracefully — never propagate to a 500 from this layer
    const fallback = buildFallbackConstellation(
      subjectTitle,
      keyConcepts,
      weakTopics,
      strongTopics
    );

    return {
      ...fallback,
      synthesisModel: 'heuristic-fallback',
      synthesisTimeMs,
    };
  }
};
