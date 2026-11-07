import { GoogleGenAI } from '@google/genai';

/**
 * Get configured Google Gemini AI client
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is not configured in backend/.env. Please provide a valid Google Gemini API key.'
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Strip Markdown code fences and whitespace from AI JSON output
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

/**
 * Validates and normalizes generated quiz question objects
 * @param {Array} rawQuestions
 * @returns {Array} Clean question objects
 */
const validateAndFormatQuestions = (rawQuestions) => {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error('AI failed to generate a valid list of questions');
  }

  return rawQuestions.map((q, idx) => {
    if (!q.questionText || typeof q.questionText !== 'string') {
      throw new Error(`Question #${idx + 1} is missing a valid questionText string`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question #${idx + 1} must have an array of at least 2 options`);
    }

    const correctIndex = Number(q.correctAnswerIndex);
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= q.options.length) {
      throw new Error(
        `Question #${idx + 1} has invalid correctAnswerIndex: ${q.correctAnswerIndex}`
      );
    }

    return {
      questionText: q.questionText.trim(),
      options: q.options.map((opt) => String(opt).trim()),
      correctAnswerIndex: correctIndex,
      explanation: q.explanation ? String(q.explanation).trim() : 'No explanation provided.',
      topicTag: q.topicTag ? String(q.topicTag).trim() : 'General Concept',
    };
  });
};

/**
 * Generate a topic-tagged multiple choice quiz from student note content
 * @param {string} noteContent - Raw or summarized note content
 * @param {number} questionCount - Number of questions to generate (default: 5)
 * @returns {Promise<Array>} Array of structured question objects
 */
export const generateQuizFromNote = async (noteContent, questionCount = 5) => {
  if (!noteContent || typeof noteContent !== 'string' || noteContent.trim().length === 0) {
    throw new Error('Note content cannot be empty');
  }

  const ai = getGeminiClient();
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = `You are a Senior Learning Intelligence and Assessment Engine.
Your task is to analyze the following student notes and generate a diagnostic multiple-choice quiz of exactly ${questionCount} high-yield questions.

CRITICAL INSTRUCTIONS:
1. Every question must test comprehension, concept application, or common edge-case misconceptions from the notes.
2. Provide exactly 4 distinct, plausible options per question.
3. Mark the exact zero-based index of the correct answer in "correctAnswerIndex" (0, 1, 2, or 3).
4. Provide a clear pedagogical "explanation" justifying why the correct answer is right and why distractors are wrong.
5. Provide a specific, concise "topicTag" for every question (e.g. "Coffman Conditions", "Graph Traversal", "CAP Theorem"). These tags are strictly required for our automated Knowledge Gap Detection Engine.
6. OUTPUT FORMAT: Respond ONLY with a valid JSON array of objects. Do NOT include markdown code fences, headers, or any conversational text.

JSON Schema to follow:
[
  {
    "questionText": "string",
    "options": ["string", "string", "string", "string"],
    "correctAnswerIndex": 0,
    "explanation": "string",
    "topicTag": "string"
  }
]

STUDENT NOTES:
"""
${noteContent.slice(0, 8000)}
"""`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const rawText = response.text;
    const sanitizedText = sanitizeJsonResponse(rawText);

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(sanitizedText);
    } catch (parseError) {
      console.error('[Gemini Service] JSON parse failed on raw text:', rawText);
      throw new Error(`Failed to parse AI quiz response as JSON: ${parseError.message}`);
    }

    return validateAndFormatQuestions(parsedQuestions);
  } catch (error) {
    console.error(`[Gemini Service Error]: ${error.message}`);
    throw error;
  }
};

/**
 * Generate Learning DNA insights, knowledge gaps, and prioritized study recommendations
 * @param {Array} quizHistory - Array of quiz attempt summaries
 * @param {Array<string>} weakTopics - Aggregate array of detected weak topics
 * @returns {Promise<{ knowledgeGaps: string[], recommendedActions: Array<{ action: string, priority: string, resourceType: string }> }>}
 */
export const generateLearningDNAInsights = async (quizHistory = [], weakTopics = []) => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = `You are a Principal Learning Intelligence and Cognitive Diagnostic Architect for LearnLens AI.
Analyze the student's historical quiz performance, accuracy patterns, and identified weak topics to generate high-yield learning insights.

PERFORMANCE DATA:
- Overall Quizzes Analyzed: ${quizHistory.length}
- Quiz History Summary: ${JSON.stringify(quizHistory, null, 2)}
- Identified Weak Topics / Misconceptions: ${JSON.stringify(weakTopics)}

OUTPUT REQUIREMENTS:
Return ONLY a strict JSON object with this exact schema:
{
  "knowledgeGaps": ["topic/concept name"],
  "recommendedActions": [
    {
      "action": "string",
      "priority": "High",
      "resourceType": "Review Note"
    }
  ]
}

STRICT CONSTRAINTS:
1. "knowledgeGaps": An array of 3 to 6 specific, conceptual knowledge gaps synthesized from the student's errors.
2. "recommendedActions": 3 to 5 prioritized, prescriptive micro-steps (e.g., "Review Coffman Conditions notes to master Deadlock Invariants", "Take a targeted 5-question quiz on Circular Wait").
3. "priority" must be strictly one of: "High", "Medium", or "Low".
4. "resourceType" must be strictly one of: "Review Note" or "Practice Quiz".
5. OUTPUT VALID JSON ONLY. Do not wrap in markdown code fences or conversational commentary.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const rawText = response.text;
    const sanitizedText = sanitizeJsonResponse(rawText);
    const parsed = JSON.parse(sanitizedText);

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('AI response was not a valid JSON object');
    }

    const knowledgeGaps = Array.isArray(parsed.knowledgeGaps)
      ? parsed.knowledgeGaps.map((g) => String(g).trim()).filter(Boolean)
      : weakTopics.slice(0, 5);

    const validPriorities = ['High', 'Medium', 'Low'];
    const validResourceTypes = ['Review Note', 'Practice Quiz'];

    const recommendedActions = Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions
          .filter((a) => a && a.action)
          .map((a) => ({
            action: String(a.action).trim(),
            priority: validPriorities.includes(a.priority) ? a.priority : 'Medium',
            resourceType: validResourceTypes.includes(a.resourceType)
              ? a.resourceType
              : 'Review Note',
          }))
      : [];

    return {
      knowledgeGaps: knowledgeGaps.length > 0 ? knowledgeGaps : weakTopics.slice(0, 5),
      recommendedActions:
        recommendedActions.length > 0
          ? recommendedActions
          : generateFallbackRecommendations(weakTopics),
    };
  } catch (error) {
    console.warn(`[Gemini Learning DNA Notice]: ${error.message}. Using intelligent heuristic fallback.`);
    return {
      knowledgeGaps: weakTopics.length > 0 ? [...new Set(weakTopics)].slice(0, 5) : ['Core Foundations'],
      recommendedActions: generateFallbackRecommendations(weakTopics),
    };
  }
};

/**
 * Intelligent deterministic fallback generator for recommendations when AI API is unavailable
 * @param {Array<string>} weakTopics
 * @returns {Array<{ action: string, priority: string, resourceType: string }>}
 */
const generateFallbackRecommendations = (weakTopics = []) => {
  const uniqueWeak = [...new Set(weakTopics)];
  if (uniqueWeak.length === 0) {
    return [
      {
        action: 'Complete your first diagnostic quiz to establish your baseline Learning DNA',
        priority: 'High',
        resourceType: 'Practice Quiz',
      },
      {
        action: 'Review existing study notes to identify potential revision areas',
        priority: 'Medium',
        resourceType: 'Review Note',
      },
    ];
  }

  const actions = [];
  uniqueWeak.slice(0, 3).forEach((topic, idx) => {
    actions.push({
      action: `Review study notes and core definitions for "${topic}"`,
      priority: idx === 0 ? 'High' : 'Medium',
      resourceType: 'Review Note',
    });
    actions.push({
      action: `Attempt a targeted 5-question micro-quiz on "${topic}"`,
      priority: idx === 0 ? 'High' : 'Medium',
      resourceType: 'Practice Quiz',
    });
  });

  return actions.slice(0, 4);
};


/**
 * Generate a high-intensity 10-question RPG-style Boss Fight Challenge targeting student weak topics
 * @param {Array<string>} weakTopics
 * @returns {Promise<{ bossTitle: string, bossSubtitle: string, bossLore: string, bossHealth: number, timeLimitSeconds: number, questions: Array<{ questionText: string, options: string[], correctAnswerIndex: number, explanation: string, topicTag: string, damage: number }> }>}
 */
export const generateBossChallenge = async (weakTopics = []) => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const targetTopics = weakTopics.length > 0 ? weakTopics.slice(0, 5) : ['Core Problem Solving', 'Algorithmic Optimization'];

  const prompt = `You are a Principal RPG Gamification Designer and Technical Assessment Architect for LearnLens AI.
Your objective is to generate an epic, high-intensity "Boss Battle" diagnostic exam for a student struggling with specific technical concepts.

TARGET WEAK TOPICS:
${JSON.stringify(targetTopics)}

TASK:
1. Create a memorable, technically thematic Boss Title (e.g., "The Distributed Split-Brain Hydra", "The Deadlock Dragon", "The Asynchronous Event Loop Colossus", "The Memory Leak Behemoth").
2. Create an engaging subtitle and brief 2-sentence lore motivating the learner to conquer their weaknesses.
3. Generate exactly 10 challenging scenario-based multiple-choice questions targeting these exact weak topics.
4. Each question deals 10 damage to the Boss when answered correctly.

STRICT JSON OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "bossTitle": "string",
  "bossSubtitle": "string",
  "bossLore": "string",
  "bossHealth": 100,
  "timeLimitSeconds": 300,
  "questions": [
    {
      "questionText": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswerIndex": 0,
      "explanation": "string",
      "topicTag": "string",
      "damage": 10
    }
  ]
}

DO NOT include markdown code blocks (\`\`\`json). Provide clean, parseable JSON only.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const rawText = response.text;
    const sanitized = sanitizeJsonResponse(rawText);
    const parsed = JSON.parse(sanitized);

    const questions = validateAndFormatQuestions(parsed.questions || []);

    return {
      bossTitle: parsed.bossTitle || 'The Cognitive Sentinel',
      bossSubtitle: parsed.bossSubtitle || 'Guardian of Unmastered Concepts',
      bossLore:
        parsed.bossLore ||
        'This legendary entity feeds on unaddressed misconceptions. Answer correctly to deplete its health bar and master the skill tree!',
      bossHealth: 100,
      timeLimitSeconds: parsed.timeLimitSeconds || 300,
      questions: questions.map((q) => ({
        ...q,
        damage: 10,
      })),
    };
  } catch (error) {
    console.warn(`[Boss Generation Notice]: ${error.message}. Using intelligent heuristic Boss Fight.`);
    const primaryWeak = targetTopics[0] || 'System Fundamentals';
    return {
      bossTitle: `The ${primaryWeak.split(' ')[0]} Titan`,
      bossSubtitle: `Master of ${primaryWeak}`,
      bossLore: `A formidable challenge manifests around your detected vulnerabilities in ${primaryWeak}. Vanquish this adversary to unlock the next branch in your skill tree!`,
      bossHealth: 100,
      timeLimitSeconds: 300,
      questions: Array.from({ length: 10 }).map((_, idx) => ({
        questionText: `[Boss Challenge Q${idx + 1}] When addressing complex constraints in ${primaryWeak}, which approach ensures correct invariant preservation?`,
        options: [
          'Enforcing strict ordering and validating edge boundary conditions',
          'Ignoring state transitions and relying solely on optimistic recovery',
          'Allocating unbounded buffers without backpressure management',
          'Disabling all concurrent synchronization mechanisms',
        ],
        correctAnswerIndex: 0,
        explanation: 'Enforcing ordering and verifying edge boundaries strictly preserves system invariants against failure states.',
        topicTag: primaryWeak,
        damage: 10,
      })),
    };
  }
};


/**
 * Generate adaptive Pomodoro smart break and mood remediation recommendation
 * @param {Array<object>} recentSessions - Recent study sessions with duration, focus, distractions & mood
 * @param {string} currentMood - Most recent mood state reported by user
 * @returns {Promise<{ breakType: string, recommendedBreakMinutes: number, burnoutRiskLevel: string, activityGuidance: string, recommendedNextAction: string, motivationalInsight: string }>}
 */
export const generateFocusBreakRecommendation = async (recentSessions = [], currentMood = 'Focused') => {
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = `You are a Principal Cognitive Ergonomist and Student Psychology Specialist for LearnLens AI.
Analyze the student's recent Pomodoro focus intervals, distraction spikes, and emotional mood states to prescribe an adaptive, evidence-based study break and cognitive reset.

RECENT SESSIONS HISTORY:
${JSON.stringify(recentSessions.slice(0, 5), null, 2)}

CURRENT MOOD STATE:
"${currentMood}"

TASK:
1. Evaluate fatigue levels, screen strain, distraction accumulation, and burnout risk.
2. Select the optimal break type: "Physical Stretch", "Breathing Exercise", "Hydration & Nutrition", "Cognitive Topic Switch", or "Deep Rest".
3. Assign a realistic break duration in minutes (5, 10, 15, or 25).
4. Provide concrete, step-by-step activity guidance for the student during this break.
5. Provide actionable guidance on what the student should do next.
6. Provide an empathetic, motivating cognitive reframe.

STRICT JSON OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching this schema:
{
  "breakType": "Physical Stretch",
  "recommendedBreakMinutes": 10,
  "burnoutRiskLevel": "Low",
  "activityGuidance": "string",
  "recommendedNextAction": "string",
  "motivationalInsight": "string"
}

BurnoutRiskLevel must be: "Low", "Moderate", or "High".
Do NOT include markdown fences (\`\`\`json) or conversational text.`;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.25,
      },
    });

    const rawText = response.text;
    const sanitized = sanitizeJsonResponse(rawText);
    const parsed = JSON.parse(sanitized);

    return {
      breakType: parsed.breakType || (currentMood === 'Tired' ? 'Deep Rest' : 'Physical Stretch'),
      recommendedBreakMinutes: Number(parsed.recommendedBreakMinutes) || 10,
      burnoutRiskLevel: ['Low', 'Moderate', 'High'].includes(parsed.burnoutRiskLevel)
        ? parsed.burnoutRiskLevel
        : 'Low',
      activityGuidance:
        parsed.activityGuidance ||
        'Step away from all screens. Stand up, roll your shoulders, and drink a tall glass of cold water.',
      recommendedNextAction:
        parsed.recommendedNextAction ||
        'Return to your next 25-minute Pomodoro session with single-tasking focus.',
      motivationalInsight:
        parsed.motivationalInsight ||
        'Consistent learning happens in pulses of intensity followed by intentional recovery.',
    };
  } catch (error) {
    console.warn(`[Focus Service Notice]: ${error.message}. Using cognitive heuristic break model.`);

    // Heuristic rule-based fallback
    switch (currentMood) {
      case 'Tired':
        return {
          breakType: 'Deep Rest',
          recommendedBreakMinutes: 15,
          burnoutRiskLevel: 'Moderate',
          activityGuidance:
            'Close your eyes in a dimly lit room, practice non-sleep deep rest (NSDR) or progressive muscle relaxation for 15 minutes. Avoid looking at your phone.',
          recommendedNextAction:
            'If energy is still low, switch to passive review (listening to lecture audio) or conclude study for today.',
          motivationalInsight:
            'Memory consolidation and synaptic pruning occur during rest, not during chronic exhaustion.',
        };
      case 'Anxious':
        return {
          breakType: 'Breathing Exercise',
          recommendedBreakMinutes: 10,
          burnoutRiskLevel: 'Moderate',
          activityGuidance:
            'Practice 4-7-8 physiological sigh breathing: Double inhale through the nose (one deep, one short top-off), followed by a prolonged, relaxed mouth exhale. Repeat 6 cycles.',
          recommendedNextAction:
            'Break down your next study topic into a tiny 5-minute milestone to eliminate cognitive overwhelm.',
          motivationalInsight:
            'Anxiety is simply unchanneled arousal. Ground yourself in physical sensations and re-engage one concept at a time.',
        };
      case 'Distracted':
        return {
          breakType: 'Cognitive Topic Switch',
          recommendedBreakMinutes: 5,
          burnoutRiskLevel: 'Low',
          activityGuidance:
            'Do 15 bodyweight squats or a brisk 3-minute walk to release dopamine and reset attention circuits.',
          recommendedNextAction:
            'Switch to an interactive Quiz or RPG Boss Battle rather than passive reading to force active retrieval.',
          motivationalInsight:
            'When focus wanes on dry text, active diagnostic challenges instantly re-engage task engagement.',
        };
      case 'Energized':
        return {
          breakType: 'Hydration & Nutrition',
          recommendedBreakMinutes: 5,
          burnoutRiskLevel: 'Low',
          activityGuidance:
            'Drink 250ml of water, stretch your neck and forearms, and prepare your workspace for another sprint.',
          recommendedNextAction:
            'Tackle your hardest pending conceptual topic while executive attention is at peak capacity.',
          motivationalInsight:
            'You are in a prime cognitive flow state. Protect this momentum by eliminating external notifications.',
        };
      default: // 'Focused'
        return {
          breakType: 'Physical Stretch',
          recommendedBreakMinutes: 5,
          burnoutRiskLevel: 'Low',
          activityGuidance:
            'Gaze at an object 20 feet away for 20 seconds to relieve ciliary eye muscle spasm, and do a gentle neck stretch.',
          recommendedNextAction:
            'Continue your structured Pomodoro interval on the current note topic.',
          motivationalInsight:
            'Disciplined short breaks preserve sustained high-fidelity focus across multi-hour study sessions.',
        };
    }
  }
};
