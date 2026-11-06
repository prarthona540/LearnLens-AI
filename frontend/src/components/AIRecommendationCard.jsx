import React from 'react';
import { Sparkles, ArrowRight, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AIRecommendationCard = ({ recommendations = [], onActionClick }) => {
  return (
    <div className="relative rounded-2xl bg-gradient-to-br from-indigo-950/40 via-surface/90 to-purple-950/20 p-6 backdrop-blur-xl border border-indigo-500/30 shadow-neon-indigo overflow-hidden">
      {/* Dynamic ambient AI glow */}
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      {/* Header with AI Badge */}
      <div className="relative flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Gemini Learning Intelligence
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Live Analysis
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Prescriptive micro-actions tailored to patch detected knowledge gaps
            </p>
          </div>
        </div>
      </div>

      {/* Action items */}
      <div className="mt-4 space-y-3">
        {recommendations.map((action, idx) => (
          <div
            key={idx}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all duration-200 hover:bg-slate-800/50"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-bold">
                {idx + 1}
              </div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors leading-relaxed">
                {action}
              </p>
            </div>

            <button
              onClick={() => onActionClick && onActionClick(action)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-all duration-200 shadow-md shadow-indigo-500/20 group-hover:translate-x-0.5"
            >
              Take Action
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
