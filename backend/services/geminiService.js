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
