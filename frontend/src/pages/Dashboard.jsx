import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  FileText,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
} from 'lucide-react';
import { ProgressRing } from '../components/ProgressRing';
import { StatsCard } from '../components/StatsCard';
import { AIRecommendationCard } from '../components/AIRecommendationCard';
import { api } from '../services/api';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [dna, setDna] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dnaData, notesData] = await Promise.all([
          api.getLearningDNA(),
          api.getNotes(),
        ]);
        setDna(dnaData);
        setNotes(notesData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const readinessScore = dna?.examReadinessScore ?? 78;
  const knowledgeGapsCount = dna?.knowledgeGaps?.length ?? 3;
  const strongTopicsCount = dna?.strongTopics?.length ?? 4;
  const totalNotesCount = notes.length || 3;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-purple-950/40 p-6 sm:p-8 border border-slate-800/80 shadow-2xl">
        {/* Glow gradients */}
        <div className="absolute top-0 right-1/4 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Continuous Learning Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Welcome back to <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">LearnLens AI</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your Learning DNA was updated from your latest quiz attempts. You have{' '}
              <span className="text-amber-400 font-semibold">{knowledgeGapsCount} active knowledge gaps</span>{' '}
              detected that need targeted review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/notes')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-lighter hover:bg-slate-700/80 text-white text-xs font-semibold border border-slate-700 transition-all duration-200 hover:scale-105"
            >
              <FileText className="h-4 w-4 text-indigo-400" />
              <span>Upload Notes</span>
            </button>
            <button
              onClick={() => navigate('/quiz')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:scale-105"
            >
              <Zap className="h-4 w-4" />
              <span>Take Diagnostic Quiz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Exam Readiness"
          value={`${readinessScore}%`}
          change="+6% this week"
          trend="up"
          icon={TrendingUp}
          color="emerald"
          subtext="Targeting 85% for Midterms"
        />
        <StatsCard
          title="Detected Gaps"
          value={knowledgeGapsCount}
          change="3 Priority"
          trend="down"
          icon={AlertTriangle}
          color="amber"
          subtext="Topics flagged for review"
        />
        <StatsCard
          title="Mastered Topics"
          value={strongTopicsCount}
          change="+2 Confirmed"
          trend="up"
          icon={CheckCircle2}
          color="indigo"
          subtext="High quiz confidence"
        />
        <StatsCard
          title="Synthesized Notes"
          value={totalNotesCount}
          change="AI Summarized"
          trend="neutral"
          icon={FileText}
          color="violet"
          subtext="Gemini structured concepts"
        />
      </div>

      {/* Main Insights Grid: Readiness Dial & AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Exam Readiness Dial Card (4 Cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-surface/80 p-6 backdrop-blur-xl border border-slate-800/80 shadow-xl flex flex-col items-center justify-between min-h-[380px]">
          <div className="w-full text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-400" />
              <span>Exam Readiness Dial</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Dynamic score computed from quiz accuracy & concept coverage
            </p>
          </div>

          <div className="my-6">
            <ProgressRing
              score={readinessScore}
              size={190}
              strokeWidth={14}
              label="Overall Readiness"
              subtext="DNA Index"
            />
          </div>

          <button
            onClick={() => navigate('/learning-dna')}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700/80 transition-colors"
          >
            <span>Inspect Full Learning DNA Matrix</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right Column: AI Actionable Recommendation Widget (8 Cols) */}
        <div className="lg:col-span-8">
          <AIRecommendationCard
            recommendations={dna?.recommendedActions || []}
            onActionClick={(action) => {
              if (action.includes('quiz') || action.includes('micro-test')) {
                navigate('/quiz');
              } else {
                navigate('/notes');
              }
            }}
          />

          {/* Quick Note Ingestion Preview */}
          <div className="mt-6 rounded-2xl bg-surface/80 p-5 backdrop-blur-xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                <span>Recent Smart Notes</span>
              </h3>
              <button
                onClick={() => navigate('/notes')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {notes.slice(0, 2).map((note) => (
                <div
                  key={note._id}
                  onClick={() => navigate('/notes')}
                  className="cursor-pointer group p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {note.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {note.summary}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {note.keyConcepts.slice(0, 2).map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
