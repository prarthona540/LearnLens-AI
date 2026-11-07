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
