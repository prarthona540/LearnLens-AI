import React from 'react';
import { Sparkles, Brain, Cpu } from 'lucide-react';

export const LoadingSkeleton = ({
  message = "Gemini AI is analyzing your study notes...",
  submessage = "Extracting key concepts, tagging topics, and recalculating your Learning DNA",
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface/90 border border-indigo-500/30 p-8 backdrop-blur-xl">
      {/* Animated laser glow sweep */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent pointer-events-none" />

      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {/* Pulsing AI Icon Hub */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl animate-ping" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/40">
            <Sparkles className="h-8 w-8 animate-spin-slow" />
          </div>
        </div>

        <div>
          <h4 className="text-base font-bold text-white tracking-wide flex items-center justify-center gap-2">
            <span>{message}</span>
          </h4>
          <p className="mt-1 text-xs text-slate-400 max-w-md">
            {submessage}
          </p>
        </div>

        {/* Skeleton content blocks */}
        <div className="w-full max-w-md space-y-2.5 pt-2">
          <div className="h-3 w-full rounded-full bg-slate-800/80 animate-pulse" />
          <div className="h-3 w-5/6 mx-auto rounded-full bg-slate-800/60 animate-pulse" />
          <div className="h-3 w-4/6 mx-auto rounded-full bg-slate-800/40 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
