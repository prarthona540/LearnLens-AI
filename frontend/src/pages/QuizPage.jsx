import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Award,
  BookOpen,
} from 'lucide-react';
import { sampleQuiz } from '../services/mockData';
import { api } from '../services/api';

export const QuizPage = () => {
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45); // 45 seconds per question
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  const currentQuestion = sampleQuiz.questions[currentIdx];
  const total = sampleQuiz.questions.length;

  // Countdown timer per question
  useEffect(() => {
    if (quizFinished || isAnswerSubmitted || isTimerPaused) return;

    if (timeLeft === 0) {
      handleOptionSelect(null); // Timeout auto-submit
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizFinished, isAnswerSubmitted, isTimerPaused]);

  const handleOptionSelect = (idx) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(idx);
    setIsAnswerSubmitted(true);

    const isCorrect = idx === currentQuestion.correctAnswerIndex;
    setUserAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        topicTag: currentQuestion.topicTag,
        selectedIdx: idx,
        isCorrect,
      },
    ]);
  };

  const handleNextQuestion = () => {
    if (currentIdx + 1 < total) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setTimeLeft(45);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    setQuizFinished(true);
    // Identify gaps from wrong answers
    const wrongAnswers = userAnswers.filter((a) => !a.isCorrect);
    const gaps = wrongAnswers.map((a) => a.topicTag);

    // Update Learning DNA in mock storage
    const currentDNA = await api.getLearningDNA();
    const updatedGaps = [
      ...new Set([
        ...currentDNA.knowledgeGaps.map((g) => (typeof g === 'string' ? g : g.topic)),
        ...gaps,
      ]),
    ];

    const newScore = Math.max(
      40,
      Math.min(95, Math.round((userAnswers.filter((a) => a.isCorrect).length / total) * 100))
    );

    await api.updateLearningDNA({
      ...currentDNA,
      examReadinessScore: Math.round((currentDNA.examReadinessScore + newScore) / 2),
      knowledgeGaps: updatedGaps.map((topic) => ({
        topic,
        severity: 'high',
        detectedAt: new Date().toISOString().split('T')[0],
        recommendedAction: `Focus revision on ${topic}`,
      })),
    });
  };

  const restartQuiz = () => {
    setCurrentIdx(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setUserAnswers([]);
    setQuizFinished(false);
    setTimeLeft(45);
  };

  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const scorePercent = Math.round((correctCount / total) * 100) || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
            Self-Diagnostic Session
          </span>
          <h1 className="text-xl font-bold text-white mt-0.5">
            {sampleQuiz.title}
          </h1>
        </div>

        {!quizFinished && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-semibold">
            <Clock className={`h-4 w-4 ${timeLeft < 15 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className={timeLeft < 15 ? 'text-rose-400' : 'text-slate-200'}>
              00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </span>
          </div>
        )}
      </div>

      {!quizFinished ? (
        <div className="space-y-6">
          {/* Progress stepped bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Question {currentIdx + 1} of {total}</span>
              <span className="text-indigo-400">Topic: {currentQuestion.topicTag}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card */}
          <div className="relative rounded-3xl bg-surface/90 border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
            <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
              {currentQuestion.questionText}
            </h2>

            {/* Options list */}
            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentQuestion.correctAnswerIndex;

                let stateClasses = 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-indigo-500/50 hover:bg-slate-800/60';

                if (isAnswerSubmitted) {
                  if (isCorrect) {
                    stateClasses = 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-neon-emerald';
                  } else if (isSelected && !isCorrect) {
                    stateClasses = 'bg-rose-950/40 border-rose-500/80 text-rose-200 shadow-neon-rose';
                  } else {
                    stateClasses = 'bg-slate-900/40 border-slate-800/50 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswerSubmitted}
                    onClick={() => handleOptionSelect(idx)}
                    className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all duration-200 flex items-center justify-between gap-3 ${stateClasses}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface border border-slate-700 text-xs font-bold font-mono">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{option}</span>
                    </div>

                    {isAnswerSubmitted && isCorrect && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    )}
                    {isAnswerSubmitted && isSelected && !isCorrect && (
                      <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant AI Explanation Drawer */}
            {isAnswerSubmitted && (
              <div className="mt-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 p-4 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wide">
                  <Sparkles className="h-4 w-4" />
                  <span>Gemini Explanation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentQuestion.explanation}
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleNextQuestion}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/30 transition-all duration-200"
                  >
                    <span>{currentIdx + 1 === total ? 'View Diagnostic Results' : 'Next Question'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Results & Gap Report Card */
        <div className="rounded-3xl bg-surface/90 border border-slate-800 p-8 backdrop-blur-xl shadow-2xl text-center space-y-6 animate-fadeIn">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-neon-indigo">
              <Award className="h-8 w-8" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-white">
              Quiz Diagnostic Complete!
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Your performance has been evaluated topic-by-topic.
            </p>
          </div>

          {/* Score Box */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-sm mx-auto flex items-center justify-around">
            <div>
              <span className="text-3xl font-extrabold text-white">{correctCount}/{total}</span>
              <p className="text-xs text-slate-400 mt-0.5">Correct Answers</p>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div>
              <span className={`text-3xl font-extrabold ${scorePercent >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {scorePercent}%
              </span>
              <p className="text-xs text-slate-400 mt-0.5">Accuracy</p>
            </div>
          </div>

          {/* Gaps Detected list */}
          {userAnswers.some((a) => !a.isCorrect) && (
            <div className="text-left rounded-2xl bg-rose-950/20 border border-rose-500/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <AlertTriangle className="h-4 w-4" />
                <span>Knowledge Gaps Flagged For Learning DNA</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {userAnswers
                  .filter((a) => !a.isCorrect)
                  .map((a, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      <span>{a.topicTag}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={restartQuiz}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Quiz</span>
            </button>
            <button
              onClick={() => navigate('/learning-dna')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/30 transition-all duration-200"
            >
              <span>Inspect Updated Learning DNA</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
