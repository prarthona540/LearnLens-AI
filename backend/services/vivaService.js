import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
//  Client Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a configured GoogleGenAI client.
 * Throws early with a descriptive message if the key is missing.
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
 * Strips Markdown code-fence wrappers from raw AI output before JSON.parse().
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
//  Enum Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_QUESTION_TYPES = [
  'Opening',
  'Conceptual Probe',
  'Counterexample',
  'Edge Case',
  'Synthesis',
  'Misconception',
];

const VALID_CONCEPTUAL_CLARITY = ['High', 'Medium', 'Low'];
const VALID_GRADES             = ['S', 'A', 'B', 'C', 'D'];
const VALID_PRIORITIES         = ['Critical', 'High', 'Medium', 'Low'];

// ─────────────────────────────────────────────────────────────────────────────
//  Difficulty-to-Persona Mapping
//  Controls how strict and advanced the examiner persona is in the prompt.
// ─────────────────────────────────────────────────────────────────────────────
const DIFFICULTY_PERSONA = {
  'Undergraduate':    'a rigorous but supportive undergraduate-level viva examiner',
  'Postgraduate':     'an exacting postgraduate-level academic examiner with zero tolerance for vagueness',
  'Doctoral':         'a doctoral viva committee chair applying the highest standards of epistemological rigour',
  'Industry Expert':  'a world-class industry technical interviewer testing real-world system design and edge-case mastery',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Prompt Builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats the conversation transcript into a readable string for injection
 * into the AI prompt context window.
 * @param {object[]} turns - Array of vivaTurn objects
 * @returns {string}
 */
const formatTranscript = (turns) => {
  if (!turns || turns.length === 0) return 'No prior turns.';
  return turns
    .map(
      (t) =>
        `Turn ${t.turnNumber}:\n` +
        `  Examiner [${t.questionType}]: ${t.examinerQuestion}\n` +
        `  Student: ${t.studentAnswer || '(No answer provided)'}`
    )
    .join('\n\n');
};

/**
 * Builds the system+user prompt for the opening viva question.
 * @param {string} topic
 * @param {string} difficulty
 * @returns {string}
 */
const buildOpeningQuestionPrompt = (topic, difficulty) => {
  const persona = DIFFICULTY_PERSONA[difficulty] || DIFFICULTY_PERSONA['Undergraduate'];

  return `You are ${persona} conducting a formal oral viva examination for LearnLens AI.
The student has declared their study topic as: "${topic}"

Your task is to generate the opening viva question. This must:
1. Be a broad, open-ended probe that reveals the student's foundational understanding.
2. Avoid trivial definitions — push the student to explain the SIGNIFICANCE or MECHANISM.
3. Be clear, precise, and academically formal in tone.
4. Set a high intellectual bar from the first question.

Respond ONLY with a valid JSON object matching this EXACT schema:
{
  "examinerQuestion": "string",
  "questionType": "Opening",
  "examinerRationale": "string"
}

Rules:
- "examinerQuestion": The single opening question (1–3 sentences, academically rigorous).
- "questionType": MUST be exactly "Opening".
- "examinerRationale": A concise 1-sentence explanation of WHY you chose this as the opening probe.

Do NOT include markdown fences, comments, or any text outside the JSON object.`;
};

/**
 * Builds the system+user prompt for a mid-session Socratic follow-up question.
 * This is the core intelligence engine — it analyses the student's latest answer
 * for logical gaps, then formulates one precise cross-examination question.
 *
 * @param {string}   topic
 * @param {string}   difficulty
 * @param {object[]} previousTurns  - Full vivaTurn history up to but NOT including current turn
 * @param {string}   studentAnswer  - The student's latest answer being analysed
 * @param {number}   turnNumber     - The 1-based number of the CURRENT (new) question being generated
 * @param {number}   maxTurns       - Total allowed turns (for context-aware questioning)
 * @returns {string}
 */
const buildSocraticQuestionPrompt = (
  topic,
  difficulty,
  previousTurns,
  studentAnswer,
  turnNumber,
  maxTurns
) => {
  const persona = DIFFICULTY_PERSONA[difficulty] || DIFFICULTY_PERSONA['Undergraduate'];
  const isNearEnd = turnNumber >= maxTurns - 1;
  const transcript = formatTranscript(previousTurns);

  return `You are ${persona} conducting a formal oral viva examination for LearnLens AI.
Study Topic: "${topic}"

═══════════════════════════════════════
CONVERSATION TRANSCRIPT SO FAR
═══════════════════════════════════════
${transcript}

═══════════════════════════════════════
STUDENT'S LATEST ANSWER (to analyse)
═══════════════════════════════════════
"${studentAnswer || '(The student provided no response)'}"

═══════════════════════════════════════
YOUR TASK — Generate Turn ${turnNumber} of ${maxTurns}
═══════════════════════════════════════
Carefully analyse the student's latest answer for:
  a) Conceptual imprecision or over-simplification
  b) Missing edge cases, boundary conditions, or failure modes
  c) Logical fallacies, circular reasoning, or unsubstantiated assertions
  d) Oversights in mechanism, causality, or formal proof
  e) Inconsistencies with previously stated answers in the transcript

Then formulate EXACTLY ONE sharp, challenging follow-up question that:
  1. Directly confronts the most significant intellectual weakness you detected.
  2. Uses the Socratic method to force the student to reason more deeply — do NOT simply ask them to repeat themselves.
  3. Presents a counterexample, edge case, or deeper mechanism challenge if appropriate.
  ${isNearEnd ? '4. As this is near the final turn, escalate to a high-level SYNTHESIS question integrating all topics discussed.' : ''}

QUESTION TYPE SELECTION — Choose exactly one:
  "Conceptual Probe"  → test definitional or mechanistic depth
  "Counterexample"    → present a scenario that challenges their answer
  "Edge Case"         → probe system/algorithm behaviour at boundaries
  "Synthesis"         → integrate two or more concepts from the session
  "Misconception"     → directly name and challenge a detected logical error

Respond ONLY with a valid JSON object matching this EXACT schema:
{
  "examinerQuestion": "string",
  "questionType": "Conceptual Probe",
  "examinerRationale": "string",
  "fallacyDetected": "string | null"
}

Rules:
- "examinerQuestion": EXACTLY one question (1–3 sentences). Academically rigorous. No platitudes.
- "questionType": MUST be one of the five types above.
- "examinerRationale": 1-sentence explanation of the specific weakness you are probing.
- "fallacyDetected": If you detected a concrete logical fallacy or misconception, name it concisely (e.g., "Confused mutex semantics with semaphore signalling"). Otherwise null.

Do NOT include markdown fences, comments, or text outside the JSON object.`;
};

/**
 * Builds the evaluation prompt for post-session scorecard generation.
 * Processes the ENTIRE transcript and generates a comprehensive JSON scorecard.
 *
 * @param {string}   topic
 * @param {string}   difficulty
 * @param {object[]} turns   - Full completed vivaTurn array (with student answers)
 * @returns {string}
 */
const buildEvaluationPrompt = (topic, difficulty, turns) => {
  const persona = DIFFICULTY_PERSONA[difficulty] || DIFFICULTY_PERSONA['Undergraduate'];
  const transcript = formatTranscript(turns);
  const turnCount = turns.length;

  return `You are ${persona} who has just completed a formal oral viva examination for LearnLens AI.
Study Topic: "${topic}"
Total Turns Completed: ${turnCount}

═══════════════════════════════════════
COMPLETE VIVA TRANSCRIPT
═══════════════════════════════════════
${transcript}

═══════════════════════════════════════
YOUR TASK — Generate Executive Scorecard
═══════════════════════════════════════
Conduct a comprehensive post-viva analysis of the student's performance across the ENTIRE conversation.
Evaluate them against the five cognitive axes below, then synthesize a full executive scorecard.

FIVE COGNITIVE AXES (score each 0–10):
  1. conceptualDepth        — Depth of understanding beyond surface definitions
  2. reasoningRigour        — Formal logical consistency and proof-level thinking
  3. edgeCaseAwareness      — Recognition of failure modes, boundaries, and exceptions
  4. articulationClarity    — Precision and unambiguity of academic expression
  5. adaptabilityUnderPressure — Quality under examiner cross-questioning and challenge

GRADE BANDS:
  S → Exemplary   (90–100): Doctoral-level insight, zero logical fallacies, spontaneous synthesis
  A → Excellent   (80–89):  Strong across all axes with minor gaps
  B → Proficient  (65–79):  Solid core understanding, notable edge-case or rigour gaps
  C → Developing  (50–64):  Foundational grasp but significant conceptual limitations
  D → Insufficient(0–49):   Fundamental misconceptions or inability to defend positions

Respond ONLY with a valid JSON object matching this EXACT schema.
Do NOT include markdown fences, comments, or text outside the JSON object.

{
  "overallScore": 0,
  "vivaGrade": "D",
  "conceptualClarity": "Medium",
  "rubricBreakdown": {
    "conceptualDepth": 0,
    "reasoningRigour": 0,
    "edgeCaseAwareness": 0,
    "articulationClarity": 0,
    "adaptabilityUnderPressure": 0
  },
  "strengths": ["string"],
  "weakAreasIdentified": ["string"],
  "fallaciesDetected": ["string"],
  "examinerFeedback": "string",
  "recommendedStudyActions": [
    {
      "action": "string",
      "priority": "High"
    }
  ],
  "turnScores": [0]
}

Schema rules:
- "overallScore": Integer 0–100 derived from the five axes (weighted average).
- "vivaGrade": MUST be exactly one of: "S", "A", "B", "C", "D".
- "conceptualClarity": MUST be exactly one of: "High", "Medium", "Low".
- "rubricBreakdown": Each field is an integer 0–10.
- "strengths": 2–4 specific, substantive strengths observed in the transcript.
- "weakAreasIdentified": 2–5 specific conceptual gaps or deficiencies identified.
- "fallaciesDetected": Array of precise logical fallacy/misconception strings (empty array if none).
- "examinerFeedback": A rich 3–4 paragraph narrative covering: (a) overall assessment, (b) the 2 most critical weaknesses with specific transcript evidence, (c) a concrete remediation plan.
- "recommendedStudyActions": 2–4 actionable study steps, each with "action" (string) and "priority" (Critical|High|Medium|Low).
- "turnScores": Array of per-turn scores (0–10) with exactly ${turnCount} elements, one per turn in order.`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Fallback Generators
//  Invoked when the Gemini API is unavailable, ensuring the endpoint never
//  returns a 500 from the service layer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a deterministic opening question fallback.
 * @param {string} topic
 * @returns {{ examinerQuestion: string, questionType: string, examinerRationale: string }}
 */
const buildFallbackOpeningQuestion = (topic) => ({
  examinerQuestion: `Begin by explaining the fundamental mechanism of "${topic}". ` +
    `Do not define it — explain precisely HOW it works at the system or algorithmic level, ` +
    `and why that mechanism is necessary rather than a simpler alternative.`,
  questionType: 'Opening',
  examinerRationale: 'Establish whether the student understands the core mechanism rather than merely its surface definition.',
});

/**
 * Generates a deterministic Socratic follow-up fallback.
 * @param {string} topic
 * @param {string} studentAnswer
 * @param {number} turnNumber
 * @returns {{ examinerQuestion: string, questionType: string, examinerRationale: string, fallacyDetected: null }}
 */
const buildFallbackSocraticQuestion = (topic, studentAnswer, turnNumber) => {
  const probes = [
    {
      examinerQuestion: `You stated a valid high-level description, but consider this: what happens to the invariants of "${topic}" when the system operates under partial failure or network partition? Walk me through the failure mode step by step.`,
      questionType: 'Edge Case',
      examinerRationale: 'Edge-case stress testing of the stated mechanism under adversarial conditions.',
    },
    {
      examinerQuestion: `Here is a counterexample to your reasoning: if two processes simultaneously satisfy all conditions you described, your model would still permit a deadlock or race. How do you resolve this contradiction?`,
      questionType: 'Counterexample',
      examinerRationale: 'Direct contradiction to test whether the student can defend or revise their position.',
    },
    {
      examinerQuestion: `You have described individual components well. Now synthesise: how do the properties of "${topic}" interact with algorithmic complexity bounds when operating at scale? What breaks first?`,
      questionType: 'Synthesis',
      examinerRationale: 'Cross-concept integration test requiring system-level thinking.',
    },
    {
      examinerQuestion: `Your answer uses the concept correctly but your justification assumes a sequential execution model. How does your reasoning change in a concurrent or distributed execution context?`,
      questionType: 'Misconception',
      examinerRationale: 'Probing a common concurrent-systems misconception in the student\'s framing.',
    },
    {
      examinerQuestion: `Prove, with formal notation or a concrete invariant, that the system property you described always holds. Under what minimal set of assumptions does it break?`,
      questionType: 'Conceptual Probe',
      examinerRationale: 'Pushing from descriptive to formal proof-level rigour.',
    },
  ];

  const selected = probes[(turnNumber - 2) % probes.length];
  return { ...selected, fallacyDetected: null };
};

/**
 * Generates a deterministic evaluation scorecard fallback.
 * @param {string} topic
 * @param {object[]} turns
 * @returns {object} Scorecard matching the VivaSession evaluation schema
 */
const buildFallbackEvaluation = (topic, turns) => {
  const answeredTurns = turns.filter((t) => t.studentAnswer && t.studentAnswer.trim().length > 0);
  const totalTurns = turns.length;

  // Heuristic: score proportional to answer length and coverage
  const avgAnswerLength =
    answeredTurns.length > 0
      ? answeredTurns.reduce((s, t) => s + t.studentAnswer.length, 0) / answeredTurns.length
      : 0;

  let overallScore = 40;
  if (avgAnswerLength > 300) overallScore = 72;
  else if (avgAnswerLength > 150) overallScore = 60;
  else if (avgAnswerLength > 60) overallScore = 51;
  else if (answeredTurns.length === 0) overallScore = 20;

  const vivaGrade =
    overallScore >= 90 ? 'S' :
    overallScore >= 80 ? 'A' :
    overallScore >= 65 ? 'B' :
    overallScore >= 50 ? 'C' : 'D';

  const conceptualClarity =
    overallScore >= 70 ? 'High' : overallScore >= 50 ? 'Medium' : 'Low';

  const baseRubric = Math.round(overallScore / 10);
  const turnScores = turns.map((t) => {
    if (!t.studentAnswer || t.studentAnswer.trim().length === 0) return 1;
    if (t.studentAnswer.length > 300) return Math.min(10, baseRubric + 1);
    if (t.studentAnswer.length > 100) return baseRubric;
    return Math.max(2, baseRubric - 2);
  });

  return {
    overallScore,
    vivaGrade,
    conceptualClarity,
    rubricBreakdown: {
      conceptualDepth:           Math.min(10, baseRubric),
      reasoningRigour:           Math.max(1, baseRubric - 1),
      edgeCaseAwareness:         Math.max(1, baseRubric - 2),
      articulationClarity:       Math.min(10, baseRubric + 1),
      adaptabilityUnderPressure: Math.max(1, baseRubric - 1),
    },
    strengths: [
      answeredTurns.length > 0
        ? `Engaged with ${answeredTurns.length} out of ${totalTurns} viva questions`
        : 'Attempted to engage with the examination format',
      `Demonstrated awareness of core concepts within "${topic}"`,
    ],
    weakAreasIdentified: [
      `Insufficient depth in formal proof or invariant reasoning for "${topic}"`,
      'Edge-case and failure-mode analysis requires significant improvement',
      'Responses lacked structured argumentation and formal notation',
    ],
    fallaciesDetected: [],
    examinerFeedback:
      `[Heuristic Scorecard — AI Evaluation Unavailable]\n\n` +
      `The student completed ${totalTurns} viva turns on the topic of "${topic}". ` +
      `Based on response length and engagement analysis, an overall score of ${overallScore}/100 (Grade ${vivaGrade}) has been assigned.\n\n` +
      `Critical areas requiring improvement: formal proof-level reasoning, edge-case recognition, ` +
      `and structured argumentation under examiner challenge.\n\n` +
      `Recommended remediation: Review core invariants and failure modes of "${topic}", ` +
      `then practice articulating formal arguments with concrete counterexamples.`,
    recommendedStudyActions: [
      {
        action: `Review foundational invariants and formal definitions of "${topic}" with a focus on proof-level rigour`,
        priority: 'Critical',
      },
      {
        action: `Identify and study at least 3 real-world failure modes or edge cases in "${topic}"`,
        priority: 'High',
      },
      {
        action: 'Practice oral explanation of technical concepts with structured argumentation (claim → evidence → implication)',
        priority: 'High',
      },
    ],
    turnScores,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Primary Exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates the examiner's very first question to open a viva session.
 * This question establishes the intellectual baseline and tone for the entire
 * cross-examination.
 *
 * @param {string} topic      - The declared study topic
 * @param {string} difficulty - Viva difficulty level
 * @returns {Promise<{ examinerQuestion: string, questionType: string, examinerRationale: string }>}
 */
export const generateOpeningQuestion = async (topic, difficulty = 'Undergraduate') => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = buildOpeningQuestionPrompt(topic, difficulty);

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    });

    const rawText = response.text;
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Gemini returned an empty response for opening question generation');
    }

    const sanitized = sanitizeJsonResponse(rawText);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (parseError) {
      console.error('[Viva Service] Opening question JSON parse failed. Raw sample:', rawText.slice(0, 200));
      throw new Error(`Opening question AI response is not valid JSON: ${parseError.message}`);
    }

    if (!parsed.examinerQuestion || typeof parsed.examinerQuestion !== 'string') {
      throw new Error('AI response missing required examinerQuestion field');
    }

    return {
      examinerQuestion: parsed.examinerQuestion.trim(),
      questionType: VALID_QUESTION_TYPES.includes(parsed.questionType)
        ? parsed.questionType
        : 'Opening',
      examinerRationale: parsed.examinerRationale
        ? String(parsed.examinerRationale).trim()
        : 'Opening probe to establish foundational conceptual understanding.',
    };
  } catch (error) {
    const isApiError =
      error.message.includes('GEMINI_API_KEY') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('quota') ||
      error.message.includes('503') ||
      error.message.includes('unavailable');

    if (isApiError) {
      console.warn(`[Viva Service] Gemini unavailable (${error.message}). Using heuristic opening question.`);
    } else {
      console.error(`[Viva Service - Opening Question Error]: ${error.message}`);
    }

    return buildFallbackOpeningQuestion(topic);
  }
};

/**
 * Generates the next Socratic cross-examination question based on the student's
 * most recent answer and the full conversation history.
 *
 * The AI acts as a strict academic examiner — it identifies logical weaknesses,
 * unsubstantiated claims, missing edge cases, or conceptual fallacies in the
 * student's answer, then formulates one precise, targeted follow-up question.
 *
 * @param {string}   topic          - The viva study topic
 * @param {string}   difficulty     - Difficulty level
 * @param {object[]} previousTurns  - vivaTurn documents (all prior turns)
 * @param {string}   studentAnswer  - The student's latest answer to probe
 * @param {number}   nextTurnNumber - The 1-based number of the question being generated
 * @param {number}   maxTurns       - Session turn limit (for context-aware escalation)
 *
 * @returns {Promise<{
 *   examinerQuestion: string,
 *   questionType: string,
 *   examinerRationale: string,
 *   fallacyDetected: string | null
 * }>}
 */
export const generateNextSocraticQuestion = async (
  topic,
  difficulty = 'Undergraduate',
  previousTurns = [],
  studentAnswer = '',
  nextTurnNumber = 2,
  maxTurns = 5
) => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = buildSocraticQuestionPrompt(
    topic,
    difficulty,
    previousTurns,
    studentAnswer,
    nextTurnNumber,
    maxTurns
  );

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.5, // Slightly higher for creative cross-questioning variety
        maxOutputTokens: 768,
      },
    });

    const rawText = response.text;
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Gemini returned an empty response for Socratic question generation');
    }

    const sanitized = sanitizeJsonResponse(rawText);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (parseError) {
      console.error('[Viva Service] Socratic question JSON parse failed. Raw sample:', rawText.slice(0, 200));
      throw new Error(`Socratic question AI response is not valid JSON: ${parseError.message}`);
    }

    if (!parsed.examinerQuestion || typeof parsed.examinerQuestion !== 'string') {
      throw new Error('AI response missing required examinerQuestion field');
    }

    return {
      examinerQuestion: parsed.examinerQuestion.trim(),
      questionType: VALID_QUESTION_TYPES.includes(parsed.questionType)
        ? parsed.questionType
        : 'Conceptual Probe',
      examinerRationale: parsed.examinerRationale
        ? String(parsed.examinerRationale).trim()
        : 'Probing for deeper conceptual rigour.',
      fallacyDetected: parsed.fallacyDetected
        ? String(parsed.fallacyDetected).trim()
        : null,
    };
  } catch (error) {
    const isApiError =
      error.message.includes('GEMINI_API_KEY') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('quota') ||
      error.message.includes('503') ||
      error.message.includes('unavailable');

    if (isApiError) {
      console.warn(`[Viva Service] Gemini unavailable (${error.message}). Using heuristic Socratic question.`);
    } else {
      console.error(`[Viva Service - Socratic Question Error]: ${error.message}`);
    }

    return buildFallbackSocraticQuestion(topic, studentAnswer, nextTurnNumber);
  }
};

/**
 * Processes the entire completed viva session transcript through the Gemini
 * AI evaluator and returns a comprehensive executive scorecard.
 *
 * The scorecard includes:
 *   - Overall score (0–100) and grade (S/A/B/C/D)
 *   - Per-dimension rubric scores (5 cognitive axes, each 0–10)
 *   - Specific strengths and weakness areas from the transcript
 *   - Named logical fallacies detected during the session
 *   - Multi-paragraph examiner feedback narrative
 *   - Prioritised remediation study actions
 *   - Per-turn quality scores for detailed review display
 *
 * @param {object} vivaSessionData - The VivaSession Mongoose document
 * @returns {Promise<{
 *   overallScore: number,
 *   vivaGrade: string,
 *   conceptualClarity: string,
 *   rubricBreakdown: object,
 *   strengths: string[],
 *   weakAreasIdentified: string[],
 *   fallaciesDetected: string[],
 *   examinerFeedback: string,
 *   recommendedStudyActions: object[],
 *   turnScores: number[]
 * }>}
 */
export const generateVivaEvaluation = async (vivaSessionData) => {
  const { topic, difficulty = 'Undergraduate', turns } = vivaSessionData;
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!turns || turns.length === 0) {
    console.warn('[Viva Service] generateVivaEvaluation called with empty turns array — returning minimal scorecard.');
    return buildFallbackEvaluation(topic, []);
  }

  const prompt = buildEvaluationPrompt(topic, difficulty, turns);

  try {
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for consistent, objective scoring
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.text;
    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Gemini returned an empty response for viva evaluation');
    }

    const sanitized = sanitizeJsonResponse(rawText);
    let parsed;
    try {
      parsed = JSON.parse(sanitized);
    } catch (parseError) {
      console.error('[Viva Service] Evaluation JSON parse failed. Raw sample:', rawText.slice(0, 300));
      throw new Error(`Evaluation AI response is not valid JSON: ${parseError.message}`);
    }

    // ── Validate and normalise every field against the schema ───────────
    const overallScore = Math.min(100, Math.max(0, Math.round(Number(parsed.overallScore) || 40)));

    const vivaGrade = VALID_GRADES.includes(parsed.vivaGrade)
      ? parsed.vivaGrade
      : overallScore >= 90 ? 'S' : overallScore >= 80 ? 'A' : overallScore >= 65 ? 'B' : overallScore >= 50 ? 'C' : 'D';

    const conceptualClarity = VALID_CONCEPTUAL_CLARITY.includes(parsed.conceptualClarity)
      ? parsed.conceptualClarity
      : overallScore >= 70 ? 'High' : overallScore >= 50 ? 'Medium' : 'Low';

    const clampRubric = (v) => Math.min(10, Math.max(0, Math.round(Number(v) || 0)));
    const rb = parsed.rubricBreakdown || {};
    const rubricBreakdown = {
      conceptualDepth:           clampRubric(rb.conceptualDepth),
      reasoningRigour:           clampRubric(rb.reasoningRigour),
      edgeCaseAwareness:         clampRubric(rb.edgeCaseAwareness),
      articulationClarity:       clampRubric(rb.articulationClarity),
      adaptabilityUnderPressure: clampRubric(rb.adaptabilityUnderPressure),
    };

    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
      : ['Engaged with the oral examination format'];

    const weakAreasIdentified = Array.isArray(parsed.weakAreasIdentified)
      ? parsed.weakAreasIdentified.map((w) => String(w).trim()).filter(Boolean).slice(0, 8)
      : ['Insufficient conceptual depth observed'];

    const fallaciesDetected = Array.isArray(parsed.fallaciesDetected)
      ? parsed.fallaciesDetected.map((f) => String(f).trim()).filter(Boolean).slice(0, 10)
      : [];

    const examinerFeedback = parsed.examinerFeedback
      ? String(parsed.examinerFeedback).trim().slice(0, 5000)
      : 'AI evaluation complete. See rubric breakdown for details.';

    const recommendedStudyActions = Array.isArray(parsed.recommendedStudyActions)
      ? parsed.recommendedStudyActions
          .filter((a) => a && a.action)
          .map((a) => ({
            action: String(a.action).trim(),
            priority: VALID_PRIORITIES.includes(a.priority) ? a.priority : 'High',
          }))
          .slice(0, 5)
      : [{ action: `Review core invariants of "${topic}"`, priority: 'Critical' }];

    // Per-turn scores: validate array length matches turns count
    let turnScores = Array.isArray(parsed.turnScores)
      ? parsed.turnScores.map((s) => Math.min(10, Math.max(0, Math.round(Number(s) || 0))))
      : [];

    // Pad or trim to match actual turns length
    while (turnScores.length < turns.length) turnScores.push(Math.round(overallScore / 10));
    turnScores = turnScores.slice(0, turns.length);

    console.info(`[Viva Service] Evaluation complete — Score: ${overallScore}/100, Grade: ${vivaGrade}`);

    return {
      overallScore,
      vivaGrade,
      conceptualClarity,
      rubricBreakdown,
      strengths,
      weakAreasIdentified,
      fallaciesDetected,
      examinerFeedback,
      recommendedStudyActions,
      turnScores,
    };
  } catch (error) {
    const isApiError =
      error.message.includes('GEMINI_API_KEY') ||
      error.message.includes('API_KEY_INVALID') ||
      error.message.includes('quota') ||
      error.message.includes('503') ||
      error.message.includes('unavailable');

    if (isApiError) {
      console.warn(`[Viva Service] Gemini unavailable for evaluation (${error.message}). Using heuristic scorecard.`);
    } else {
      console.error(`[Viva Service - Evaluation Error]: ${error.message}`);
    }

    return buildFallbackEvaluation(topic, turns);
  }
};
