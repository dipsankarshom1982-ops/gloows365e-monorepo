"use client";
// PATH: apps/web/src/app/(app)/discover/page.tsx
// Discover AI — mirror of mobile app/discover/index.tsx
// Search bar + trending/recent chips + 10 horizontal discovery rails.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import type { TrendingTerm } from "@/lib/discover/types";
import { getTrending } from "@/services/discoverApi";
import { useDiscoverStore } from "@/store/discoverStore";

const DISCOVERY_SECTIONS = [
  {
    sectionId: "trending_careers", title: "Trending Careers", emoji: "🔥",
    cards: [
      { id: "1", emoji: "🤖", title: "AI Engineer", subtitle: "₹12–40 LPA", gradient: ["#1e3a5f", "#2563eb"], query: "AI engineer career India" },
      { id: "2", emoji: "📱", title: "App Developer", subtitle: "₹8–30 LPA", gradient: ["#312e81", "#4f46e5"], query: "app developer career India" },
      { id: "3", emoji: "🎮", title: "Game Developer", subtitle: "₹6–20 LPA", gradient: ["#4c1d95", "#7c3aed"], query: "game developer career India" },
      { id: "4", emoji: "🧬", title: "Bioinformatics", subtitle: "₹8–25 LPA", gradient: ["#064e3b", "#059669"], query: "bioinformatics career India" },
    ],
  },
  {
    sectionId: "future_tech", title: "Future Tech Skills", emoji: "⚡",
    cards: [
      { id: "1", emoji: "⚛️", title: "Quantum Computing", subtitle: "High Demand", gradient: ["#1e1b4b", "#4338ca"], query: "quantum computing career India" },
      { id: "2", emoji: "🔗", title: "Blockchain", subtitle: "₹10–35 LPA", gradient: ["#1a3a1a", "#15803d"], query: "blockchain developer career India" },
      { id: "3", emoji: "🥽", title: "AR/VR Developer", subtitle: "₹8–22 LPA", gradient: ["#4c1d95", "#9333ea"], query: "AR VR developer career India" },
      { id: "4", emoji: "🤖", title: "Robotics", subtitle: "₹10–30 LPA", gradient: ["#1e3a5f", "#0369a1"], query: "robotics engineer career India" },
    ],
  },
  {
    sectionId: "competitive_exams", title: "Competitive Exams", emoji: "📝",
    cards: [
      { id: "1", emoji: "🏛️", title: "UPSC IAS", subtitle: "Civil Services", gradient: ["#450a0a", "#b91c1c"], query: "UPSC IAS preparation guide" },
      { id: "2", emoji: "🔬", title: "IIT JEE", subtitle: "Engineering", gradient: ["#1e3a5f", "#1d4ed8"], query: "IIT JEE preparation strategy" },
      { id: "3", emoji: "💊", title: "NEET Medical", subtitle: "Medical Entry", gradient: ["#064e3b", "#047857"], query: "NEET medical entrance preparation" },
      { id: "4", emoji: "💼", title: "SSC CGL", subtitle: "Govt Jobs", gradient: ["#451a03", "#b45309"], query: "SSC CGL government job preparation" },
    ],
  },
  {
    sectionId: "scholarships", title: "Scholarships", emoji: "🎓",
    cards: [
      { id: "1", emoji: "🇮🇳", title: "NSP Scholarship", subtitle: "Up to ₹36,000", gradient: ["#1e3a5f", "#1d4ed8"], query: "NSP National Scholarship Portal India" },
      { id: "2", emoji: "🌟", title: "INSPIRE Scheme", subtitle: "₹80,000/year", gradient: ["#064e3b", "#065f46"], query: "INSPIRE scholarship for science students" },
      { id: "3", emoji: "🎖️", title: "PM Scholarship", subtitle: "Defense families", gradient: ["#450a0a", "#991b1b"], query: "PM scholarship scheme India" },
      { id: "4", emoji: "🏆", title: "Merit Scholarships", subtitle: "State level", gradient: ["#451a03", "#92400e"], query: "merit based scholarships India students 2025" },
    ],
  },
  {
    sectionId: "high_salary", title: "High Salary Careers", emoji: "💰",
    cards: [
      { id: "1", emoji: "📊", title: "Investment Banker", subtitle: "₹20–80 LPA", gradient: ["#451a03", "#c2410c"], query: "investment banking career India" },
      { id: "2", emoji: "🧑‍⚕️", title: "Surgeon", subtitle: "₹25–100 LPA", gradient: ["#064e3b", "#059669"], query: "surgeon career India medical" },
      { id: "3", emoji: "📈", title: "Data Scientist", subtitle: "₹15–60 LPA", gradient: ["#1e1b4b", "#4338ca"], query: "data scientist career India" },
      { id: "4", emoji: "✈️", title: "Airline Pilot", subtitle: "₹15–50 LPA", gradient: ["#1e3a5f", "#075985"], query: "airline pilot career India" },
    ],
  },
  {
    sectionId: "govt_jobs", title: "Government Jobs", emoji: "🏛️",
    cards: [
      { id: "1", emoji: "🏛️", title: "IAS Officer", subtitle: "Grade A Service", gradient: ["#450a0a", "#b91c1c"], query: "IAS officer government job India" },
      { id: "2", emoji: "🏦", title: "Bank PO (IBPS)", subtitle: "₹6–14 LPA", gradient: ["#1e3a5f", "#1d4ed8"], query: "bank PO IBPS SBI career" },
      { id: "3", emoji: "🚂", title: "RRB Railway", subtitle: "₹4–12 LPA", gradient: ["#1a3a1a", "#15803d"], query: "railway RRB government job India" },
      { id: "4", emoji: "👮", title: "Police/Defence", subtitle: "₹5–15 LPA", gradient: ["#451a03", "#92400e"], query: "police defence government job India" },
    ],
  },
  {
    sectionId: "coding_ai", title: "Coding & AI", emoji: "💻",
    cards: [
      { id: "1", emoji: "🐍", title: "Python Dev", subtitle: "₹6–25 LPA", gradient: ["#1a3a1a", "#166534"], query: "Python developer career India" },
      { id: "2", emoji: "🌐", title: "Full Stack Web", subtitle: "₹8–30 LPA", gradient: ["#1e3a5f", "#1d4ed8"], query: "full stack web developer career India" },
      { id: "3", emoji: "🔐", title: "Cybersecurity", subtitle: "₹10–40 LPA", gradient: ["#450a0a", "#991b1b"], query: "cybersecurity career India" },
      { id: "4", emoji: "☁️", title: "Cloud Engineer", subtitle: "₹12–45 LPA", gradient: ["#1e1b4b", "#312e81"], query: "cloud computing engineer career India" },
    ],
  },
  {
    sectionId: "college_discovery", title: "College Discovery", emoji: "🏫",
    cards: [
      { id: "1", emoji: "🔭", title: "Top IITs", subtitle: "Engineering", gradient: ["#1e3a5f", "#1d4ed8"], query: "IIT admission process eligibility fees" },
      { id: "2", emoji: "🏥", title: "AIIMS Medical", subtitle: "Medicine", gradient: ["#064e3b", "#065f46"], query: "AIIMS medical college admission" },
      { id: "3", emoji: "⚖️", title: "Top NLUs", subtitle: "Law", gradient: ["#451a03", "#92400e"], query: "NLU national law university admission CLAT" },
      { id: "4", emoji: "📊", title: "IIM MBA", subtitle: "Management", gradient: ["#1e1b4b", "#4338ca"], query: "IIM MBA admission CAT exam" },
    ],
  },
  {
    sectionId: "ai_recommended", title: "AI Recommended", emoji: "🤖",
    cards: [
      { id: "1", emoji: "🎨", title: "UI/UX Design", subtitle: "Creative Tech", gradient: ["#831843", "#be185d"], query: "UI UX design career India" },
      { id: "2", emoji: "📹", title: "Content Creator", subtitle: "Digital Media", gradient: ["#450a0a", "#c2410c"], query: "content creator YouTuber career India" },
      { id: "3", emoji: "🏗️", title: "Civil Engineer", subtitle: "₹5–18 LPA", gradient: ["#451a03", "#b45309"], query: "civil engineering career India" },
      { id: "4", emoji: "🧪", title: "Research Scientist", subtitle: "₹8–30 LPA", gradient: ["#1a3a1a", "#166534"], query: "research scientist career India" },
    ],
  },
  {
    sectionId: "study_motivation", title: "Study Strategies", emoji: "✨",
    cards: [
      { id: "1", emoji: "🧠", title: "Focus Techniques", subtitle: "Study Better", gradient: ["#1e1b4b", "#4338ca"], query: "focus techniques study better students" },
      { id: "2", emoji: "⏰", title: "Time Management", subtitle: "Productivity", gradient: ["#064e3b", "#047857"], query: "time management tips students exams" },
      { id: "3", emoji: "😌", title: "Exam Stress Relief", subtitle: "Mental Health", gradient: ["#4c1d95", "#7c3aed"], query: "exam stress management students" },
      { id: "4", emoji: "📋", title: "Revision Hacks", subtitle: "Memorise Fast", gradient: ["#1e3a5f", "#1d4ed8"], query: "revision strategies memorise faster students" },
    ],
  },
] as const;

const MOTIVATIONAL_LINES = [
  "Every search brings you closer to your dream 🌟",
  "Your future career is one discovery away ✨",
  "AI is your personal career counsellor today 🤖",
  "Explore. Discover. Achieve. 🚀",
  "Great careers start with great curiosity 💡",
];

function SectionRow({ section, onCardPress }: { section: typeof DISCOVERY_SECTIONS[number]; onCardPress: (q: string) => void }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
        <span style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{section.emoji} {section.title}</span>
        <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 700 }}>See All →</span>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px" }}>
        {section.cards.map((card) => (
          <button key={card.id} className="dc-btn" onClick={() => onCardPress(card.query)} style={{
            width: 140, height: 140, borderRadius: 20, padding: 14, flexShrink: 0,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            background: `linear-gradient(135deg,${card.gradient[0]},${card.gradient[1]})`,
            textAlign: "left", boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
          }}>
            <span style={{ fontSize: 30, marginBottom: 6 }}>{card.emoji}</span>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{card.title}</span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, marginTop: 2 }}>{card.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DiscoverHomePage() {
  const router = useRouter();
  const { studentProfile } = useStudentProfile();
  const { searchHistory, remainingSearches } = useDiscoverStore();

  const [query, setQuery] = useState("");
  const [trendingTerms, setTrendingTerms] = useState<TrendingTerm[]>([]);
  const [motiveLine] = useState(() => MOTIVATIONAL_LINES[Math.floor(Math.random() * MOTIVATIONAL_LINES.length)]);

  useEffect(() => {
    getTrending().then((r) => setTrendingTerms(r.terms.slice(0, 8))).catch(() => {});
  }, []);

  function handleSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/discover/result?query=${encodeURIComponent(trimmed)}`);
  }

  const firstName = studentProfile?.name?.split(" ")[0] ?? "Student";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const freeSearchesLeft = remainingSearches !== null ? remainingSearches : 3;

  return (
    <div style={{ minHeight: "100dvh", background: "#030712", paddingBottom: 40 }}>
      <style>{`.dc-btn{cursor:pointer;border:none}.dc-btn:hover{opacity:.9}.dc-input::placeholder{color:rgba(255,255,255,0.4)}`}</style>

      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Back button */}
        <button className="dc-btn" onClick={() => router.back()} style={{ background: "none", marginLeft: 16, marginTop: 8, marginBottom: 4, width: 40, height: 40, display: "flex", alignItems: "center", color: "rgba(255,255,255,0.7)", fontSize: 22 }}>‹</button>

        {/* Header card */}
        <div style={{ margin: "0 16px 16px", borderRadius: 24, padding: 20, position: "relative", overflow: "hidden", border: "1px solid rgba(99,102,241,0.25)", background: "linear-gradient(135deg,#0f0c29,#1e1b4b,#2d1f6e)" }}>
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.18)", top: -60, right: -60 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, position: "relative" }}>
            <div style={{ background: "rgba(99,102,241,0.25)", padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(139,92,246,0.4)" }}>
              <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 800 }}>🧭 Discover AI</span>
            </div>
            {remainingSearches !== null && (
              <div style={{ background: "rgba(16,185,129,0.15)", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(16,185,129,0.3)" }}>
                <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 700 }}>{freeSearchesLeft} free left today</span>
              </div>
            )}
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 4, position: "relative" }}>{greeting}, {firstName} 👋</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, marginBottom: 16, position: "relative" }}>{motiveLine}</div>
          <div style={{ display: "flex", gap: 10, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", padding: "7px 12px", borderRadius: 20 }}>
              <span style={{ fontSize: 14 }}>🔥</span><span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{studentProfile?.LearnFunXP ?? 0}</span><span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>XP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", padding: "7px 12px", borderRadius: 20 }}>
              <span style={{ fontSize: 14 }}>🪙</span><span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{studentProfile?.LearnFunCoins ?? 0}</span><span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>V-Coins</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.07)", padding: "7px 12px", borderRadius: 20 }}>
              <span style={{ fontSize: 14 }}>📚</span><span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{searchHistory.length}</span><span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>Searches</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ padding: "0 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(30,27,75,0.9)", borderRadius: 16, border: "1.5px solid rgba(99,102,241,0.3)", gap: 8, minHeight: 54, boxShadow: "0 4px 8px rgba(99,102,241,0.3)" }}>
            <span style={{ marginLeft: 14, color: "rgba(255,255,255,0.5)", fontSize: 18 }}>🔍</span>
            <input
              className="dc-input"
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query); }}
              placeholder="What do you want to learn, explore, or become today?"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 14, fontWeight: 500, padding: "14px 8px 14px 0" }}
            />
            {query.length > 0 && (
              <button className="dc-btn" onClick={() => handleSearch(query)} style={{ marginRight: 8, width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 16 }}>→</span>
              </button>
            )}
          </div>
        </div>

        {/* Trending chips */}
        {trendingTerms.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, padding: "0 16px", marginBottom: 8 }}>🔥 Trending searches</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px" }}>
              {trendingTerms.map((t) => (
                <button key={t.term} className="dc-btn" onClick={() => handleSearch(t.term)} style={{ background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.35)", padding: "7px 14px", borderRadius: 20, flexShrink: 0 }}>
                  <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 600 }}>{t.term}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent searches */}
        {searchHistory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, padding: "0 16px", marginBottom: 8 }}>🕐 Recent</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 16px" }}>
              {searchHistory.slice(0, 5).map((h) => (
                <button key={h.queryHash} className="dc-btn" onClick={() => handleSearch(h.query)} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", padding: "7px 12px", borderRadius: 20, flexShrink: 0, maxWidth: 180 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>⏱</span>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.query}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 10 Discovery Sections */}
        {DISCOVERY_SECTIONS.map((section) => (
          <SectionRow key={section.sectionId} section={section} onCardPress={handleSearch} />
        ))}

        {/* Upgrade nudge */}
        {remainingSearches !== null && remainingSearches <= 1 && (
          <button className="dc-btn" onClick={() => router.push("/discover/subscription")} style={{ display: "block", width: "calc(100% - 32px)", margin: "0 16px 16px", borderRadius: 16, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: 18, background: "linear-gradient(90deg,#312e81,#6366f1)" }}>
              <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🔓 Upgrade to Premium for unlimited AI searches</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>₹199/month · Cancel anytime →</div>
            </div>
          </button>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
