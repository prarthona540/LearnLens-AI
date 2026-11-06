import React from 'react';

export const StatsCard = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon: Icon,
  color = 'indigo',
  subtext,
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20 hover:border-indigo-500/40',
      text: 'text-indigo-400',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)]',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      text: 'text-emerald-400',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20 hover:border-amber-500/40',
      text: 'text-amber-400',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.25)]',
    },
    rose: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20 hover:border-rose-500/40',
      text: 'text-rose-400',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(244,63,94,0.25)]',
    },
    violet: {
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20 hover:border-violet-500/40',
      text: 'text-violet-400',
      glow: 'group-hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.25)]',
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-surface/80 p-5 backdrop-blur-xl border ${scheme.border} transition-all duration-300 hover:-translate-y-1 ${scheme.glow}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {value}
            </span>
            {change && (
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  trend === 'up'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : trend === 'down'
                    ? 'text-rose-400 bg-rose-500/10'
                    : 'text-slate-400 bg-slate-800'
                }`}
              >
                {change}
              </span>
            )}
          </div>
          {subtext && <p className="mt-1 text-xs text-slate-400">{subtext}</p>}
        </div>

        {Icon && (
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${scheme.bg} ${scheme.text} ring-1 ring-white/10 transition-transform group-hover:scale-110 duration-300`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Decorative subtle ambient gradient strip */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
};
