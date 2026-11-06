import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dna,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  BookOpen,
  HelpCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ProgressRing } from '../components/ProgressRing';
import { api } from '../services/api';

export const LearningDNAPage = () => {
  const navigate = useNavigate();
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDNA = async () => {
      const data = await api.getLearningDNA();
      setDna(data);
      setLoading(false);
    };
    loadDNA();
  }, []);

  const score = dna?.examReadinessScore ?? 78;
  const strongTopics = dna?.strongTopics ?? [];
  const knowledgeGaps = dna?.knowledgeGaps ?? [];
  const recommendedActions = dna?.recommendedActions ?? [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <Dna className="h-3.5 w-3.5" />
            <span>Living Learner Profile</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Learning DNA & Knowledge Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            An evolving map of your strengths, vulnerabilities, and targeted remediation steps
          </p>
        </div>

        <button
          onClick={() => navigate('/quiz')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all duration-200"
        >
          <Zap className="h-4 w-4" />
          <span>Refresh Profile via Quiz</span>
        </button>
      </div>

      {/* Top Banner: Readiness Dial & Overview Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center rounded-3xl bg-surface/80 p-6 sm:p-8 border border-slate-800/80 backdrop-blur-xl">
        <div className="lg:col-span-4 flex justify-center">
          <ProgressRing
            score={score}
            size={200}
            strokeWidth={16}
            label="Exam Readiness"
            subtext="DNA Composite"
          />
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Readiness Index Analysis</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {score >= 75 ? 'Competitive Level' : 'Needs Reinforcement'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your readiness score is synthesized continuously from your quiz attempts, concept extraction retention, and time-spaced revisions. Closing your current high-severity gaps is predicted to lift your score to <strong className="text-indigo-400">88%+</strong>.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-lg font-bold text-white">{strongTopics.length}</span>
              <p className="text-[11px] text-slate-400">Mastered Concepts</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-lg font-bold text-rose-400">{knowledgeGaps.length}</span>
              <p className="text-[11px] text-slate-400">Flagged Gaps</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-lg font-bold text-indigo-400">Gemini 2.5</span>
              <p className="text-[11px] text-slate-400">AI Scoring Engine</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Matrix: Strong Topics vs Knowledge Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Strong Topics Column */}
        <div className="rounded-3xl bg-surface/80 p-6 border border-slate-800/80 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Strong Topics</h3>
                <p className="text-[11px] text-slate-400">High accuracy on diagnostic assessments</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {strongTopics.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {strongTopics.map((topic, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-slate-200">
                  {topic}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Knowledge Gaps Column with Severity Indicators */}
        <div className="rounded-3xl bg-surface/80 p-6 border border-slate-800/80 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Knowledge Gaps</h3>
                <p className="text-[11px] text-slate-400">Vulnerabilities detected from quiz mistakes</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
              {knowledgeGaps.length}
            </span>
          </div>

          <div className="space-y-3">
            {knowledgeGaps.map((gap, idx) => {
              const topicTitle = typeof gap === 'string' ? gap : gap.topic;
              const severity = typeof gap === 'string' ? 'medium' : gap.severity || 'medium';
              const action = typeof gap === 'string' ? 'Review relevant notes' : gap.recommendedAction;

              const badgeColor =
                severity === 'high'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30';

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 hover:border-rose-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      {topicTitle}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}
                    >
                      {severity} Severity
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong className="text-indigo-400">Remediation:</strong> {action}
                  </p>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => navigate('/notes')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <span>Study Note</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
