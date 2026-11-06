import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Plus,
  BookOpen,
  Tag,
  AlertCircle,
  CheckCircle,
  Copy,
  ChevronRight,
  Search,
} from 'lucide-react';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { api } from '../services/api';

export const NotesPage = () => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const loadNotes = async () => {
      const data = await api.getNotes();
      setNotes(data);
      if (data.length > 0) {
        setSelectedNote(data[0]);
      }
    };
    loadNotes();
  }, []);

  const handleCreateNoteWithAI = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsAnalyzing(true);
    setIsCreating(false);

    // Simulate Gemini 2.5 API latency & structured extraction
    setTimeout(async () => {
      // Extract key concept keywords
      const words = newContent.split(/\s+/).filter((w) => w.length > 5);
      const generatedConcepts = [
        ...new Set(words.slice(0, 4).map((w) => w.replace(/[^\w]/g, ''))),
      ];

      const created = await api.createNote({
        title: newTitle,
        rawContent: newContent,
        summary: `Gemini AI Synthesis: ${newContent.slice(0, 180)}... Key takeaways focus on modular mechanics and practical application.`,
        keyConcepts: generatedConcepts.length ? generatedConcepts : ['Core Principles', 'Foundational Logic'],
        weakTopicsIdentified: ['Edge-case Invariants'],
        tags: ['AI Generated', 'Study Notes'],
      });

      const updated = await api.getNotes();
      setNotes(updated);
      setSelectedNote(created);
      setIsAnalyzing(false);
      setNewTitle('');
      setNewContent('');
    }, 1400);
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.keyConcepts.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-400" />
            <span>Smart Notes & Gemini Synthesis</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Raw study material turned into structured key concepts, summaries, and diagnostic points
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all duration-200"
        >
          <Plus className="h-4 w-4" />
          <span>{isCreating ? 'Cancel Note' : 'Add New Note'}</span>
        </button>
      </div>

      {/* AI Ingestion Loading State */}
      {isAnalyzing && (
        <LoadingSkeleton
          message="Gemini AI is analyzing your study notes..."
          submessage="Extracting concepts, building structured takeaways, and mapping knowledge relationships"
        />
      )}

      {/* Note Creation Form Drawer/Panel */}
      {isCreating && (
        <form
          onSubmit={handleCreateNoteWithAI}
          className="rounded-2xl bg-surface/90 border border-indigo-500/30 p-6 backdrop-blur-xl shadow-neon-indigo space-y-4 animate-fadeIn"
        >
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-4 w-4 animate-spin-slow" />
            <span>AI-Assisted Note Capture</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Topic or Lecture Title
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Distributed Consensus & Raft Algorithm"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Raw Notes / Text Content
            </label>
            <textarea
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Paste lecture notes, textbook excerpts, or personal thoughts here..."
              className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/30 transition-all duration-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Summarize & Extract with Gemini</span>
            </button>
          </div>
        </form>
      )}

      {/* Split-Pane Layout: List on Left (4 cols), Detail/Comparison on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Notes Master List */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter notes by topic or keyword..."
              className="w-full rounded-xl bg-surface/80 border border-slate-800 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredNotes.map((note) => {
              const isSelected = selectedNote?._id === note._id;
              return (
                <div
                  key={note._id}
                  onClick={() => setSelectedNote(note)}
                  className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                      : 'bg-surface/70 border-slate-800/80 hover:border-slate-700 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-xs font-bold line-clamp-1 ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                      {note.title}
                    </h3>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'}`} />
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {note.summary || note.rawContent}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {note.keyConcepts.slice(0, 2).map((concept, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Split Reader View (Raw Notes vs AI Structured Summary) */}
        <div className="lg:col-span-8">
          {selectedNote ? (
            <div className="space-y-6">
              {/* Note Header & Badges */}
              <div className="rounded-2xl bg-surface/80 p-6 backdrop-blur-xl border border-slate-800/80">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Study Material
                    </span>
                    <h2 className="text-xl font-bold text-white mt-0.5">
                      {selectedNote.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(selectedNote.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Key Concepts Pills */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-indigo-400" />
                    <span>AI-Extracted Key Concepts</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNote.keyConcepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                      >
                        <CheckCircle className="h-3 w-3 text-indigo-400" />
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Weak Topics Identified Pills */}
                {selectedNote.weakTopicsIdentified?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <h4 className="text-xs font-semibold text-rose-300 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Weak Topics Flagged For Practice</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNote.weakTopicsIdentified.map((topic, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium px-3 py-1 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Side-by-Side Content Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Panel 1: Raw Student Notes */}
                <div className="rounded-2xl bg-surface/60 p-5 backdrop-blur-xl border border-slate-800/80">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      Raw Note Content
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">Input</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {selectedNote.rawContent}
                  </div>
                </div>

                {/* Panel 2: Gemini AI Structured Summary */}
                <div className="rounded-2xl bg-gradient-to-br from-indigo-950/30 to-purple-950/20 p-5 backdrop-blur-xl border border-indigo-500/30">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      Gemini Executive Summary
                    </span>
                    <span className="text-[10px] text-indigo-400 uppercase font-semibold">AI Synthesized</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-200 leading-relaxed max-h-96 overflow-y-auto">
                    {selectedNote.summary}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-surface/50 border border-slate-800 text-center text-slate-400">
              <FileText className="h-10 w-10 text-slate-600 mb-3" />
              <p className="text-sm">Select a note from the left to view the AI summary</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
