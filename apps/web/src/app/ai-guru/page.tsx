// apps/web/src/app/ai-guru/page.tsx
// AI Guru on web — uses shared aiGuruApi service.
// Video content uses Cloudflare iframe (not expo-av).

"use client";

import { useState } from "react";
import { generateLesson, useStudentProfile } from "@gloows/shared-logic";
import type { LessonSetup, GenerateLessonResult } from "@gloows/shared-logic";

type Mode = "explain" | "notes" | "exam" | "doubt" | "summarize" | "tip" | "language";

const MODES: { key: Mode; label: string; emoji: string }[] = [
  { key: "explain",   label: "Explain",   emoji: "💡" },
  { key: "notes",     label: "Notes",     emoji: "📝" },
  { key: "exam",      label: "Exam Prep", emoji: "📋" },
  { key: "doubt",     label: "Clear Doubt", emoji: "🤔" },
  { key: "summarize", label: "Summarize", emoji: "📌" },
  { key: "tip",       label: "Quick Tip", emoji: "✨" },
  { key: "language",  label: "Translate", emoji: "🌐" },
];

export default function AiGuruPage() {
  const { studentProfile } = useStudentProfile();
  const [question, setQuestion]   = useState("");
  const [mode, setMode]           = useState<Mode>("explain");
  const [result, setResult]       = useState<GenerateLessonResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const setup: LessonSetup = {
        subject:  "General",
        class:    studentProfile?.class ?? "10",
        board:    studentProfile?.board ?? "CBSE",
        language: studentProfile?.preferredLanguage ?? "English",
        mode,
      };
      const res = await generateLesson(setup, question);
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        <span className="text-indigo-400">AI</span> Guru
      </h1>
      <p className="text-slate-400 mb-6">Ask anything about your syllabus</p>

      {/* Mode chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === m.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      {/* Question input */}
      <div className="flex gap-3 mb-6">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question here..."
          rows={3}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          {loading ? "..." : "Ask"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-300 rounded-xl p-4 mb-4">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-white font-bold text-xl mb-3">
            {result.lessonJson?.title ?? "Answer"}
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {result.lessonJson?.summary}
          </p>
        </div>
      )}
    </main>
  );
}
