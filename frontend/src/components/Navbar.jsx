import React from 'react';
import { Sparkles, Brain, Bell, User as UserIcon, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Menu & Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30">
              <Brain className="h-5 w-5 text-white" />
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-surface animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                LearnLens <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">AI</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: AI Engine Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/40 border border-indigo-500/30 text-xs font-medium text-indigo-300 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
          <span>Gemini Intelligence Active</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </div>

        {/* Right: Notifications & User Profile */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-white leading-none">
                  {user.name}
                </span>
                <span className="text-[10px] font-medium text-slate-400 capitalize mt-1">
                  {user.role} • {user.preferredLanguage?.toUpperCase() || 'EN'}
                </span>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-700 text-indigo-300 font-bold text-xs ring-2 ring-indigo-500/20">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>

              <button
                onClick={logout}
                title="Log Out"
                className="rounded-lg p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-400">Guest Mode</div>
          )}
        </div>
      </div>
    </header>
  );
};
