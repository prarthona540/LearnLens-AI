import { initialLearningDNA, initialNotes, sampleQuiz } from './mockData';

const BASE_URL = '/api';

/**
 * Helper to get authorization header
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('learnlens_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Authentication
  async login(email, password) {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      return data;
    } catch {
      // Mock fallback for immediate interactive UI
      const mockUser = {
        _id: 'usr_mock_1',
        name: 'Prarthona',
        email: email || 'student@learnlens.ai',
        role: 'student',
        preferredLanguage: 'en',
      };
      const mockToken = 'mock_jwt_token_learnlens_2026';
      localStorage.setItem('learnlens_token', mockToken);
      localStorage.setItem('learnlens_user', JSON.stringify(mockUser));
      return { success: true, token: mockToken, user: mockUser };
    }
  },

  async register(name, email, password, preferredLanguage = 'en') {
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, preferredLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      return data;
    } catch {
      const mockUser = {
        _id: 'usr_mock_new',
        name,
        email,
        role: 'student',
        preferredLanguage,
      };
      const mockToken = 'mock_jwt_token_learnlens_2026';
      localStorage.setItem('learnlens_token', mockToken);
      localStorage.setItem('learnlens_user', JSON.stringify(mockUser));
      return { success: true, token: mockToken, user: mockUser };
    }
  },

  async getProfile() {
    try {
      const res = await fetch(`${BASE_URL}/auth/profile`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data.user;
    } catch {
      const cached = localStorage.getItem('learnlens_user');
      return cached
        ? JSON.parse(cached)
        : {
            _id: 'usr_mock_1',
            name: 'Prarthona Chowdhury',
            email: 'student@learnlens.ai',
            role: 'student',
            preferredLanguage: 'en',
          };
    }
  },

  // Notes API
  async getNotes() {
    try {
      const res = await fetch(`${BASE_URL}/notes`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data.notes;
    } catch {
      const stored = localStorage.getItem('learnlens_notes');
      return stored ? JSON.parse(stored) : initialNotes;
    }
  },

  async createNote(noteData) {
    try {
      const res = await fetch(`${BASE_URL}/notes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(noteData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data.note;
    } catch {
      const stored = localStorage.getItem('learnlens_notes');
      const list = stored ? JSON.parse(stored) : [...initialNotes];
      const newNote = {
        _id: `note-${Date.now()}`,
        ...noteData,
        summary: noteData.summary || 'AI Summary generated for: ' + noteData.title,
        keyConcepts: noteData.keyConcepts || ['Concept Analysis', 'Core Principle'],
        weakTopicsIdentified: noteData.weakTopicsIdentified || [],
        createdAt: new Date().toISOString(),
      };
      list.unshift(newNote);
      localStorage.setItem('learnlens_notes', JSON.stringify(list));
      return newNote;
    }
  },

  // Quizzes API
  async getQuiz(id = 'quiz-os-101') {
    return sampleQuiz;
  },

  async submitQuizResult(quizId, answers, score, detectedGaps) {
    // Updates local learning DNA state
    return {
      success: true,
      score,
      totalQuestions: sampleQuiz.questions.length,
      detectedGaps,
    };
  },

  // Learning DNA API
  async getLearningDNA() {
    const stored = localStorage.getItem('learnlens_dna');
    return stored ? JSON.parse(stored) : initialLearningDNA;
  },

  async updateLearningDNA(dna) {
    localStorage.setItem('learnlens_dna', JSON.stringify(dna));
    return dna;
  },
};
