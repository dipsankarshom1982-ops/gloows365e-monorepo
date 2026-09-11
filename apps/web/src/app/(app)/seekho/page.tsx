"use client";

// PATH: apps/web/src/app/(app)/seekho/page.tsx
// Exact mirror of mobile app/(drawer)/(tabs)/seekho.tsx
// Subject grid (2 columns), continue learning, revision due banner, upgrade banner

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useStudentProfile } from "@gloows/shared-logic";
import { SEEKHO_SUBJECTS, type SeekhoSubject } from "@/lib/seekhoSubjects";

// ─── Constants (mirrors mobile lib/seekho/constants.ts) ───────

const SUBJECT_META: Record<SeekhoSubject, { emoji: string; shortName: string; gradient: [string, string] }> = {
  "Mathematics":        { emoji: "📐", shortName: "Maths",    gradient: ["#1e1b4b", "#4f46e5"] },
  "Science":            { emoji: "🔬", shortName: "Science",  gradient: ["#052e16", "#16a34a"] },
  "Social Science":     { emoji: "🌍", shortName: "SST",      gradient: ["#451a03", "#b45309"] },
  "English":            { emoji: "📝", shortName: "English",  gradient: ["#0c1a2e", "#0369a1"] },
  "Hindi":              { emoji: "🪷", shortName: "Hindi",    gradient: ["#2e1065", "#7c3aed"] },
  "Sanskrit":           { emoji: "📜", shortName: "Sanskrit", gradient: ["#450a0a", "#9f1239"] },
  "Computer Science":   { emoji: "💻", shortName: "CS",       gradient: ["#0f172a", "#0284c7"] },
  "Physical Education": { emoji: "🏃", shortName: "PE",       gradient: ["#14532d", "#15803d"] },
};

// ─── Main ─────────────────────────────────────────────────────
export default function SeekhoPage() {
  const { studentProfile, authLoading, user } = useStudentProfile();
  const [loading, setLoading] = useState(false);

  const selectedClass = studentProfile?.class ?? 10;
  const selectedBoard = studentProfile?.board ?? "CBSE";
  const isFreeUser    = true; // simplified — integrate useSeekhoAccess later

  if (!authLoading && !user) {
    return (
      <div className="page-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <p style={{ color: "var(--text)", fontSize: 16, fontWeight: 700 }}>
          Please sign in to access Seekho.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* ── Title row ── */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "12px 16px 4px",
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", margin: 0 }}>
            📖 Seekho
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, marginTop: 2 }}>
            Curriculum-aligned video lessons
          </p>
        </div>
        {loading ? (
          <div style={{ width: 20, height: 20, border: "2px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        ) : (
          <div style={{
            background: "#4f46e5", borderRadius: 12,
            padding: "8px 12px", textAlign: "center",
          }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>Class {selectedClass}</div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: 600, marginTop: 1 }}>{selectedBoard}</div>
          </div>
        )}
      </div>

      {/* ── Subjects label ── */}
      <div style={{
        padding: "16px 16px 8px",
        fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: 0.8,
      }}>
        Subjects
      </div>

      {/* ── Subject grid (2 columns, square aspect ratio) ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        padding: "0 16px",
      }}>
        {SEEKHO_SUBJECTS.map((subject) => {
          const meta = SUBJECT_META[subject];
          return (
            <Link
              key={subject}
              href={`/seekho/${encodeURIComponent(subject)}`}
              style={{ textDecoration: "none", aspectRatio: "1 / 1" }}
            >
              <div style={{
                height: "100%",
                background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
                borderRadius: 20,
                padding: 16,
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                transition: "transform 0.15s",
              }}>
                <span style={{ fontSize: 34, marginBottom: 8 }}>{meta.emoji}</span>
                <div style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>{meta.shortName}</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                  {subject}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Revision due banner (placeholder) ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <Link href="/seekho/revision" style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            background: "linear-gradient(90deg, #7c2d12, #dc2626)",
            borderRadius: 16, padding: 14,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 22 }}>🔄</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>Revision Due</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 500, marginTop: 2 }}>
                Review your spaced-repetition queue
              </div>
            </div>
            <span style={{ color: "#fff", fontSize: 18 }}>›</span>
          </div>
        </Link>
      </div>

      {/* ── Upgrade banner (for free users) ── */}
      {isFreeUser && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            background: "linear-gradient(90deg, #1e1b4b, #4f46e5)",
            borderRadius: 16, padding: 16,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: 28 }}>🚀</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Unlock Full Curriculum</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                Starting ₹149/month · Cancel anytime
              </div>
            </div>
            <button style={{
              background: "#fff", color: "#4f46e5",
              border: "none", borderRadius: 10,
              padding: "8px 14px", fontSize: 13, fontWeight: 800,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              Upgrade
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}