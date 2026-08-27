"use client";
// PATH: apps/web/src/components/aiGuru/PracticalActivityCard.tsx
// Web mirror of apps/mobile/components/aiGuru/PracticalActivityCard.tsx

import { useState } from "react";
import { PracticalActivity } from "@/lib/aiGuru/types";

interface Props {
  activity: PracticalActivity;
  onSubmit: (response: string) => void;
  loading?: boolean;
}

export default function PracticalActivityCard({ activity, onSubmit, loading = false }: Props) {
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!response.trim() || submitted) return;
    setSubmitted(true);
    onSubmit(response.trim());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`.pac-btn{cursor:pointer;border:none}.pac-btn:disabled{cursor:default}`}</style>

      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔧</div>
        <span style={{ flex: 1, color: "#f1f5f9", fontSize: 17, fontWeight: 800 }}>{activity.title}</span>
      </div>

      {/* Instructions */}
      <div style={{ background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 4 }}>📋 Instructions</span>
        {activity.instructions.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>{i + 1}</span>
            </div>
            <span style={{ flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 1.4 }}>{step}</span>
          </div>
        ))}
      </div>

      {/* Expected output */}
      {activity.expectedOutput ? (
        <div style={{ background: "#132027", borderRadius: 14, padding: 14, borderLeft: "3px solid #06b6d4" }}>
          <span style={{ color: "#06b6d4", fontSize: 11, fontWeight: 800, marginBottom: 4, display: "block" }}>🎯 Expected Output</span>
          <span style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.4 }}>{activity.expectedOutput}</span>
        </div>
      ) : null}

      {/* Student response */}
      <div style={{ background: "#1e293b", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>✍️ Your Response</span>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Write your solution or answer here..."
          rows={5}
          disabled={submitted}
          style={{
            background: "#0f172a", borderRadius: 12, padding: 14, color: "#f1f5f9", fontSize: 14, lineHeight: 1.4,
            minHeight: 110, border: "1px solid #334155", outline: "none", resize: "vertical",
            opacity: submitted ? 0.6 : 1, fontFamily: "inherit",
          }}
        />
        <button
          className="pac-btn"
          onClick={handleSubmit}
          disabled={!response.trim() || submitted || loading}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: (!response.trim() || submitted) ? "#1e293b" : "#6366f1",
            border: (!response.trim() || submitted) ? "1px solid #334155" : "none",
            borderRadius: 12, padding: "14px 0",
          }}
        >
          {loading ? (
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Evaluating...</span>
          ) : submitted ? (
            <>
              <span style={{ fontSize: 16 }}>✅</span>
              <span style={{ color: "#10b981", fontSize: 15, fontWeight: 800 }}>Submitted!</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }}>➤</span>
              <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Submit for AI Evaluation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
