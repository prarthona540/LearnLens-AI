import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  Dna,
  Sparkles,
  BookMarked,
  Settings,
  X,
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    {
      to: '/',
      label: 'Learning Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/notes',
      label: 'Smart Notes & AI',
      icon: FileText,
      badge: 'Gemini',
    },
    {
      to: '/quiz',
      label: 'Diagnostic Quiz',
      icon: HelpCircle,
      badge: 'Active',
    },
    {
      to: '/learning-dna',
      label: 'Learning DNA',
      icon: Dna,
      badge: 'Live',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-surface/95 border-r border-slate-800/80 p-5 backdrop-blur-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="space-y-6">
            {/* Mobile close button */}
            <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Platform Subheading */}
            <div className="px-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Study Intelligence
              </p>
            </div>

            {/* Navigation links */}
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => onClose && onClose()}
                    className={({ isActive }) =>
                      `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600/30 to-violet-600/20 text-white border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-300 border border-indigo-500/20">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Bottom Card: Study Streak & Gemini Engine */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-500/20 p-4 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-indigo-400 font-bold mb-1">
              <Sparkles className="h-4 w-4" />
              <span>Personalized Loop</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Summaries generate quizzes $\rightarrow$ Quiz errors update your Learning DNA $\rightarrow$ Recommendations focus your study.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
