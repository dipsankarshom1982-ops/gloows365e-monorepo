"use client";

// PATH: apps/web/src/app/(app)/settings/feedback/page.tsx
// Mirrors mobile app/feedback.tsx
//
// Lets a student star-rate (1-5) whichever admin-configured features they
// want, plus leave one free-text improvement suggestion. One doc per
// student (feedback/{uid}) — editable, upsert: revisiting this screen
// pre-fills the last submission, resubmitting overwrites it.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { useStudentProfile } from "@gloows/shared-logic";
import StarRatingInput from "@/components/StarRatingInput";
import {
  getFeedbackFeatures,
  getMyFeedback,
  submitFeedback,
  type FeedbackFeature,
} from "@/services/feedbackService";

function Icon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const icons: Record<string, JSX.Element> = {
    "arrow-back": (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
        <path d="M328 400L184 256l144-144" stroke={color} strokeWidth={48} strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return icons[name] ?? <svg width={size} height={size}/>;
}

export default function FeedbackPage() {
  const { isDarkMode, colors } = useTheme();
  const { user } = useStudentProfile();
  const router = useRouter();

  const textMain  = isDarkMode ? "#f1f5f9" : "#1e293b";
  const textSec   = isDarkMode ? "#94a3b8" : "#64748b";
  const surfaceBg = isDarkMode ? "#1e293b" : "#f8fafc";
  const borderCol = isDarkMode ? "#334155" : "#e2e8f0";
  const accent    = "#f59e0b";
  const pageBg    = isDarkMode ? "linear-gradient(180deg, #060612 0%, #0d0d24 50%, #060612 100%)" : colors.background;

  const [loading, setLoading]       = useState(true);
  const [features, setFeatures]     = useState<FeedbackFeature[]>([]);
  const [ratings, setRatings]       = useState<Record<string, number>>({});
  const [suggestion, setSuggestion] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const [feats, mine] = await Promise.all([
          getFeedbackFeatures(),
          getMyFeedback(user.uid),
        ]);
        setFeatures(feats);
        if (mine) {
          setRatings(mine.ratings);
          setSuggestion(mine.suggestion);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const setRating = (featureId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [featureId]: value }));
    setSaved(false);
  };

  const handleSubmit = async () => {
    if (!user?.uid || saving) return;
    setSaving(true);
    try {
      await submitFeedback(user.uid, { ratings, suggestion });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: pageBg, minHeight: "100vh", paddingBottom: 40 }}>

      {/* Title */}
      <div style={{ padding: "16px 20px 20px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: accent, marginBottom: 6 }}>⭐ Feedback & Ratings</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: textSec, lineHeight: "20px" }}>
          Rate the features you use and tell us how to make Gloows365E better.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "0 20px", color: textSec, fontSize: 13 }}>Loading…</div>
      ) : features.length === 0 ? (
        <div style={{ margin: "0 20px", padding: 24, borderRadius: 16, border: `1px solid ${borderCol}`, background: surfaceBg, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: textSec }}>No features open for rating just yet.</div>
        </div>
      ) : (
        <>
          {/* Feature ratings */}
          <div style={{ margin: "0 20px 12px", padding: 16, borderRadius: 16, border: `1px solid ${borderCol}`, background: surfaceBg, display: "flex", flexDirection: "column", gap: 16 }}>
            {features.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {f.icon && <span style={{ fontSize: 16 }}>{f.icon}</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: textMain }}>{f.name}</span>
                  </div>
                  {f.description && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: textSec, marginTop: 2 }}>{f.description}</div>
                  )}
                </div>
                <StarRatingInput
                  value={ratings[f.id] ?? 0}
                  onChange={(v) => setRating(f.id, v)}
                  size={22}
                  color={accent}
                  emptyColor={borderCol}
                />
              </div>
            ))}
          </div>

          {/* Suggestion */}
          <div style={{ margin: "0 20px 20px", padding: 16, borderRadius: 16, border: `1px solid ${borderCol}`, background: surfaceBg }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: textMain, marginBottom: 10 }}>💡 Suggest an improvement</div>
            <textarea
              value={suggestion}
              onChange={(e) => { setSuggestion(e.target.value); setSaved(false); }}
              maxLength={1000}
              rows={4}
              placeholder="What would make Gloows365E better for you?"
              style={{
                width: "100%", resize: "none", padding: 12, borderRadius: 12,
                border: `1px solid ${borderCol}`, background: isDarkMode ? "#0f172a" : "#ffffff",
                color: textMain, fontSize: 13, fontFamily: "inherit",
              }}
            />
            <div style={{ textAlign: "right", fontSize: 11, color: textSec, marginTop: 4 }}>{suggestion.length}/1000</div>
          </div>

          {saved && (
            <div style={{ margin: "0 20px 12px", padding: 12, borderRadius: 12, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>✓ Thanks for your feedback!</span>
            </div>
          )}

          {/* Submit */}
          <div style={{ padding: "0 20px" }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
                background: accent, color: "#fff", fontSize: 15, fontWeight: 700,
              }}
            >
              {saving ? "Saving…" : "Submit Feedback"}
            </button>
          </div>
        </>
      )}

      {/* Back */}
      <div style={{ padding: "20px 20px 0" }}>
        <button
          onClick={() => router.back()}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 0", borderRadius: 12, border: `1px solid ${borderCol}`, cursor: "pointer",
            background: "transparent", color: textSec, fontSize: 14, fontWeight: 700,
          }}
        >
          <Icon name="arrow-back" size={18} color={textSec}/>
          Back to Settings
        </button>
      </div>
    </div>
  );
}
