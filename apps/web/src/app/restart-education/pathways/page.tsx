"use client";

// PATH: apps/web/src/app/restart-education/pathways/page.tsx
// Web port of apps/mobile/app/restart-education/pathways.tsx — dynamic
// educational pathways from Firestore educationPathways/ collection, same
// fallback list, same admin-manageable behaviour.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import AuthGuard from "@/components/layout/AuthGuard";

interface Pathway {
  id: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  learnMoreUrl: string;
  order: number;
  tags?: string[];
}

const FALLBACK_PATHWAYS: Pathway[] = [
  { id: "nios", title: "NIOS Open Schooling", description: "Complete Class 10 or 12 through National Institute of Open Schooling at your own pace from anywhere in India.", emoji: "📖", color: "#1d4ed8", learnMoreUrl: "https://www.nios.ac.in", order: 1, tags: ["Class 10", "Class 12", "Government"] },
  { id: "ignou", title: "IGNOU Distance Learning", description: "Pursue graduation and post-graduation through India's largest open university. Flexible schedules, affordable fees.", emoji: "🎓", color: "#7c3aed", learnMoreUrl: "https://www.ignou.ac.in", order: 2, tags: ["Graduation", "Post-Grad", "Government"] },
  { id: "iti", title: "ITI Vocational Training", description: "Gain practical skills in trades like electrician, plumber, mechanic, and more. Government-recognised certification.", emoji: "🛠️", color: "#b45309", learnMoreUrl: "https://www.dget.nic.in", order: 3, tags: ["Vocational", "Skills", "Government"] },
  { id: "skill-india", title: "Skill India / PMKVY", description: "Free skill development training under Pradhan Mantri Kaushal Vikas Yojana. 300+ courses across industries.", emoji: "⚡", color: "#15803d", learnMoreUrl: "https://www.pmkvyofficial.org", order: 4, tags: ["Free", "Skills", "Government"] },
  { id: "state-open", title: "State Open Schools", description: "Many states have their own open schools for Class 10 and 12. Often easier to access than NIOS for local learners.", emoji: "🏫", color: "#0e7490", learnMoreUrl: "https://www.nios.ac.in/state-open-schools.aspx", order: 5, tags: ["Class 10", "Class 12", "State"] },
];

function PathwaysContent() {
  const router = useRouter();
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "educationPathways"), where("isActive", "==", true), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setPathways(snap.empty ? FALLBACK_PATHWAYS : snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pathway)));
      setLoading(false);
    }, () => { setPathways(FALLBACK_PATHWAYS); setLoading(false); });
    return () => unsub();
  }, []);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => router.back()} aria-label="Back">←</button>
        <div style={S.headerTitle}>🎓 Education Pathways</div>
        <div style={{ width: 36 }} />
      </div>

      {loading ? (
        <div style={S.loadingWrap}><div style={S.spinner} /></div>
      ) : (
        <div style={S.list}>
          <div style={S.intro}>
            Every pathway below is a legitimate, government-recognised way to continue your education.
            Tap any card to learn more.
          </div>
          {pathways.map((item) => (
            <a
              key={item.id}
              href={item.learnMoreUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={S.card}
            >
              <div style={{ ...S.cardLeft, background: `${item.color}20` }}>
                <span style={S.cardEmoji}>{item.emoji}</span>
              </div>
              <div style={S.cardContent}>
                <div style={S.cardTitle}>{item.title}</div>
                <div style={S.cardDesc}>{item.description}</div>
                {item.tags && (
                  <div style={S.tags}>
                    {item.tags.map((tag) => (
                      <span key={tag} style={{ ...S.tag, background: `${item.color}15`, color: item.color }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {item.learnMoreUrl && (
                  <div style={{ ...S.learnMore, color: item.color }}>Learn more →</div>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PathwaysPage() {
  return (
    <AuthGuard>
      <PathwaysContent />
    </AuthGuard>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#F9FAFB" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16,
    background: "#fff", borderBottom: "1px solid #F3F4F6",
  },
  backBtn: { width: 36, background: "none", border: "none", fontSize: 20, color: "#111", cursor: "pointer", textAlign: "left" },
  headerTitle: { fontSize: 17, fontWeight: 700, color: "#111" },
  loadingWrap: { display: "flex", justifyContent: "center", marginTop: 60 },
  spinner: { width: 32, height: 32, border: "3px solid rgba(29,78,216,0.25)", borderTop: "3px solid #1d4ed8", borderRadius: "50%" },
  list: { maxWidth: 720, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 },
  intro: { fontSize: 13, color: "#6B7280", lineHeight: 1.55, marginBottom: 8 },
  card: {
    display: "flex", background: "#fff", borderRadius: 16, padding: 14, gap: 14,
    border: "1px solid #F3F4F6", textDecoration: "none", cursor: "pointer",
  },
  cardLeft: { width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardEmoji: { fontSize: 26 },
  cardContent: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111" },
  cardDesc: { fontSize: 12, color: "#6B7280", lineHeight: 1.5 },
  tags: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 },
  learnMore: { fontSize: 12, fontWeight: 700, marginTop: 4 },
};
