"use client";
// PATH: apps/web/src/components/aiGuru/AiGuruAvatar.tsx
// Web mirror of apps/mobile/components/aiGuru/AiGuruAvatar.tsx

interface Props {
  speaking?: boolean;
  size?: number;
}

export default function AiGuruAvatar({ speaking = false, size = 64 }: Props) {
  const wrapSize = size + 24;
  return (
    <div style={{ position: "relative", width: wrapSize, height: wrapSize, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes aiguru-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes aiguru-glow { 0%,100% { background-color: rgba(99,102,241,0.3); } 50% { background-color: rgba(99,102,241,0.9); } }
      `}</style>
      <div
        style={{
          position: "absolute",
          width: wrapSize,
          height: wrapSize,
          borderRadius: wrapSize / 2,
          animation: speaking ? "aiguru-glow 0.8s ease-in-out infinite" : "none",
          backgroundColor: "rgba(99,102,241,0.3)",
        }}
      />
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          background: "#1e1b4b",
          border: "2px solid #6366f1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "aiguru-breathe 3.6s ease-in-out infinite",
        }}
      >
        <span style={{ fontSize: size * 0.55, textAlign: "center" }}>🤖</span>
      </div>
    </div>
  );
}
