"use client";

// PATH: apps/web/src/app/restart-education/home/page.tsx
// Web port of apps/mobile/app/restart-education/home.tsx — dashboard with
// the same 6 module cards, same Firestore doc, same logout behaviour.
// Deliberately outside the (app) route group: restart-education users have
// no student profile, so they get this standalone shell instead of the
// Drawer/BottomNav chrome built for the main student app.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AuthGuard from "@/components/layout/AuthGuard";

interface UserProfile {
  name?: string;
  lastClassPassed?: string;
}

interface ModuleCard {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  route: string | null;
  disabled?: boolean;
}

const MODULES: ModuleCard[] = [
  { id: "pathways",        emoji: "🎓", title: "Continue Your Education", subtitle: "Open schooling, distance learning & more", gradient: ["#1e3a5f", "#1d4ed8"], route: "/restart-education/pathways" },
  { id: "ai-advisor",      emoji: "🤖", title: "AI Education Advisor",     subtitle: "Get personalised guidance instantly",     gradient: ["#1a1040", "#7c3aed"], route: "/restart-education/ai-advisor" },
  { id: "opportunities",   emoji: "🎯", title: "Education Opportunities",  subtitle: "Scholarships, schemes & free courses",    gradient: ["#0d2311", "#15803d"], route: "/restart-education/opportunities" },
  { id: "guidance",        emoji: "🤝", title: "My Guidance Requests",     subtitle: "Track your personal education support",   gradient: ["#1e1b4b", "#4338ca"], route: "/restart-education/guidance" },
  { id: "coming-soon",     emoji: "🚀", title: "Coming Soon",              subtitle: "More features on the way",                gradient: ["#1a1a1a", "#374151"], route: null, disabled: true },
];

function HomeContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => { if (snap.exists()) setProfile(snap.data() as UserProfile); },
      () => {}
    );
    return () => unsub();
  }, []);

  const firstName = profile.name?.split(" ")[0] || "there";

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch { /* ignore */ }
  };

  return (
    <div style={S.page}>
      <div style={S.scroll}>
        <div style={S.topBar}>
          <div>
            <div style={S.greeting}>Welcome back,</div>
            <div style={S.name}>{firstName} 👋</div>
          </div>
          <button style={S.logoutBtn} onClick={handleLogout} aria-label="Log out">⎋</button>
        </div>

        <div style={S.heroBanner}>
          <div style={S.heroEmoji}>🎓</div>
          <div style={S.heroTitle}>Restart My Education</div>
          <div style={S.heroQuote}>&ldquo;No dream should stop because of circumstances.&rdquo;</div>
          {profile.lastClassPassed && (
            <div style={S.lastClassBadge}>
              <span style={S.lastClassText}>Last studied: {profile.lastClassPassed}</span>
            </div>
          )}
        </div>

        <div style={S.sectionTitle}>Where would you like to start?</div>

        <div style={S.grid}>
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              style={{
                ...S.card,
                ...(mod.disabled ? S.cardDisabled : {}),
                background: `linear-gradient(135deg, ${mod.gradient[0]}, ${mod.gradient[1]})`,
              }}
              onClick={() => { if (!mod.disabled && mod.route) router.push(mod.route); }}
              disabled={mod.disabled}
            >
              <div style={S.cardEmoji}>{mod.emoji}</div>
              <div style={S.cardTitle}>{mod.title}</div>
              <div style={S.cardSubtitle}>{mod.subtitle}</div>
              {!mod.disabled && <div style={S.cardArrow}>→</div>}
            </button>
          ))}
        </div>

        <div style={S.motivationCard}>
          <div style={S.motivationEmoji}>💪</div>
          <div>
            <div style={S.motivationTitle}>Remember</div>
            <div style={S.motivationText}>
              Every day you take a step towards your education is a victory.
              Thousands of people have restarted — and so can you.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RestartHomePage() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "linear-gradient(160deg, #0a0a1a, #0d1a0d)" },
  scroll: { maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px" },

  topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  name: { color: "#fff", fontSize: 22, fontWeight: 800 },
  logoutBtn: {
    padding: 8, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10,
    color: "#9ca3af", fontSize: 16, cursor: "pointer",
  },

  heroBanner: {
    borderRadius: 20, padding: 24, marginBottom: 24, textAlign: "left",
    background: "linear-gradient(135deg, #14532d, #166534, #15803d)",
  },
  heroEmoji: { fontSize: 40, marginBottom: 8 },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 6 },
  heroQuote: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.5, fontStyle: "italic", marginBottom: 12 },
  lastClassBadge: {
    display: "inline-block", background: "rgba(255,255,255,0.15)", borderRadius: 20,
    padding: "4px 12px",
  },
  lastClassText: { color: "#fff", fontSize: 12, fontWeight: 600 },

  sectionTitle: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 700,
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12,
  },

  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12, marginBottom: 20,
  },
  card: {
    borderRadius: 18, padding: 18, minHeight: 140, textAlign: "left",
    border: "none", cursor: "pointer", position: "relative", display: "flex",
    flexDirection: "column", justifyContent: "flex-end",
  },
  cardDisabled: { opacity: 0.45, cursor: "default" },
  cardEmoji: { fontSize: 30, marginBottom: 8 },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 4, lineHeight: 1.3 },
  cardSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 11, lineHeight: 1.4 },
  cardArrow: {
    position: "absolute", top: 14, right: 14, width: 24, height: 24, borderRadius: 12,
    background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center",
    justifyContent: "center", color: "rgba(255,255,255,0.7)", fontSize: 13,
  },

  motivationCard: {
    display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(255,255,255,0.04)",
    borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.08)",
  },
  motivationEmoji: { fontSize: 28 },
  motivationTitle: { color: "#4ade80", fontSize: 13, fontWeight: 700, marginBottom: 4 },
  motivationText: { color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 1.5 },
};
