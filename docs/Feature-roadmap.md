# Feature Roadmap

LearnLens AI is delivered in phases. Each phase ends with a working, demo-ready product.

## Phase 1: MVP (Core Learning Loop)

| Feature | Description |
|---------|-------------|
| Authentication | Register, login, JWT-protected routes |
| Smart Note Capture | Create notes from typed text, images (photos of handwritten notes or boards), and PDF/lecture slides using Gemini multimodal input |
| Note Summarization | AI summary and key concept extraction |
| Quiz Generation | Topic-tagged quizzes generated from notes |
| Gap Detection | Weak topic identification from quiz results |
| Recommendations | Prioritized study suggestions |
| Exam Readiness and Learning DNA | Readiness score plus strengths, weaknesses, gaps |

## Phase 2: Personalization

| Feature | Description |
|---------|-------------|
| Bilingual Explanations | Hard topics explained in both Bangla and English |
| Confidence Tracker | Learner rates confidence before answering; compares confidence vs correctness to expose overconfidence and hidden strengths |
| Topic to Starter Note | Enter a topic or syllabus list; AI drafts a note outline the learner can edit |

## Phase 3: Active Learning

| Feature | Description |
|---------|-------------|
| Spaced Revision Planner | Revision schedule for weak topics (for example after 1, 3 and 7 days), plus a daily plan from the exam date |
| Teach-it-Back (Feynman Mode) | Learner explains a topic in their own words; AI compares it with the source note and flags what is correct, missing or wrong |
| Flashcards and Mistake Journal | Missed quiz questions automatically become flashcards and collect in a mistake journal |

## Phase 4: Advanced

| Feature | Description |
|---------|-------------|
| Voice to Note | Turn recorded lectures or spoken explanations into structured notes |
| Past Paper Analyzer | Upload previous exam papers to find frequently tested topics and generate targeted quizzes |
| Ask Your Notes | Chat that answers only from the learner's own notes to reduce made-up answers |
| Progress Dashboard and Streaks | Charts for readiness over time and daily study consistency |

## Design Principles

- The learner always stays in control: every AI output (OCR text, summary, plan) can be edited
- Notes are private to their owner
- Each phase is released only when it works end to end