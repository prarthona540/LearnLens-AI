import React from 'react';

/**
 * ProgressRing Component
 * Highly aesthetic circular dial with SVG linear gradient strokes,
 * backdrop glow, and animated transition for Exam Readiness scores.
 */
export const ProgressRing = ({
  score = 0,
  size = 180,
  strokeWidth = 14,
  label = 'Exam Readiness',
  subtext = 'Mastery Index',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Determine dynamic gradient palette based on score
  const getGradientId = () => {
    if (score >= 80) return 'gradient-emerald';
    if (score >= 55) return 'gradient-indigo';
    return 'gradient-amber';
  };

  const getScoreColor = () => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 55) return 'text-indigo-400';
    return 'text-amber-400';
  };

  const getGlowColor = () => {
    if (score >= 80) return 'rgba(16, 185, 129, 0.25)';
    if (score >= 55) return 'rgba(99, 102, 241, 0.25)';
    return 'rgba(245, 158, 11, 0.25)';
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Background radial glow */}
      <div
        className="absolute w-40 h-40 rounded-full blur-2xl pointer-events-none transition-all duration-700"
        style={{ backgroundColor: getGlowColor() }}
      />

      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
          aria-label={`${label}: ${score}%`}
          role="img"
        >
          <defs>
            <linearGradient id="gradient-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="gradient-indigo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
            <linearGradient id="gradient-amber" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>

            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-800/80"
            fill="transparent"
          />

          {/* Animated Gradient Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${getGradientId()})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            filter="url(#glow)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-4xl font-extrabold tracking-tight ${getScoreColor()}`}>
            {score}%
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
            {subtext}
          </span>
        </div>
      </div>

      <div className="mt-3 text-center">
        <h4 className="text-sm font-semibold text-slate-200">{label}</h4>
        <p className="text-xs text-slate-400">
          {score >= 80 ? 'Exam Ready • Prime Condition' : score >= 60 ? 'Moderate Readiness • Revise Gaps' : 'Needs Reinforcement'}
        </p>
      </div>
    </div>
  );
};
