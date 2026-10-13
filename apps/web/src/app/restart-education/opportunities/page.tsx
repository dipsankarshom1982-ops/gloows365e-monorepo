"use client";

// PATH: apps/web/src/app/restart-education/opportunities/page.tsx
// Web port of apps/mobile/app/restart-education/opportunities.tsx.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import AuthGuard from "@/components/layout/AuthGuard";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: string;
  deadline?: string;
  link?: string;
  order: number;
}

const FALLBACK: Opportunity[] = [
  { id: "1", title: "NIOS Admission Open", description: "Enroll for Class 10 or Class 12 through NIOS open schooling. Applications accepted year-round.", emoji: "📖", type: "Admission", deadline: "Open year-round", link: "https://www.nios.ac.in", order: 1 },
  { id: "2", title: "PMKVY Free Skill Training", description: "Get free skill training under Pradhan Mantri Kaushal Vikas Yojana. Certificate recognised by government.", emoji: "⚡", type: "Free Training", deadline: "Ongoing", link: "https://www.pmkvyofficial.org", order: 2 },
  { id: "3", title: "IGNOU Admission", description: "Pursue graduation from India's largest open university at very affordable fees.", emoji: "🎓", type: "Admission", deadline: "Jan & Jul cycles", link: "https://www.ignou.ac.in", order: 3 },
  { id: "4", title: "National Scholarship Portal", description: "Find government scholarships for continuing education. Multiple schemes available.", emoji: "💰", type: "Scholarship", deadline: "Various", link: "https://scholarships.gov.in", order: 4 },
  { id: "5", title: "ITI Free Admission", description: "Industrial Training Institutes offer free vocational courses in many states.", emoji: "🛠️", type: "Free Training", deadline: "June–August", link: "https://www.dget.nic.in", order: 5 },
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Admission: { bg: "#DBEAFE", text: "#1d4ed8" },
  "Free Training": { bg: "#DCFCE7", text: "#15803d" },
  Scholarship: { bg: "#FEF3C7", text: "#b45309" },
  Scheme: { bg: "#EDE9FE", text: "#7c3aed" },
};

function OpportunitiesContent() {
  const router = useRouter();
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "educationOpportunities"), where("isActive", "==", true), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.empty ? FALLBACK : snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity)));
      setLoading(false);
    }, () => { setItems(FALLBACK); setLoading(false); });
    return () => unsub();
  }, []);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => router.back()} aria-label="Back">←</button>
        <div style={S.headerTitle}>🎯 Opportunities</div>
        <div style={{ width: 36 }} />
      </div>

      {loading ? (
        <div style={S.loadingWrap}><div style={S.spinner} /></div>
      ) : (
        <div style={S.list}>
          <div style={S.intro}>
            Scholarships, free training programmes, and admission opportunities for adult learners across India.
          </div>
          {items.map((item) => {
            const typeColor = TYPE_COLORS[item.type] ?? { bg: "#F3F4F6", text: "#374151" };
            return (
              <a
                key={item.id}
                href={item.link || undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={S.card}
              >
                <div style={S.cardTop}>
                  <span style={{ fontSize: 28 }}>{item.emoji}</span>
                  <span style={{ ...S.typePill, background: typeColor.bg, color: typeColor.text }}>
                    {item.type}
                  </span>
                </div>
                <div style={S.cardTitle}>{item.title}</div>
                <div style={S.cardDesc}>{item.description}</div>
                {item.deadline && <div style={S.deadline}>⏰ {item.deadline}</div>}
                {item.link && <div style={S.learnMore}>Learn more →</div>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <AuthGuard>
      <OpportunitiesContent />
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
  spinner: { width: 32, height: 32, border: "3px solid rgba(21,128,61,0.25)", borderTop: "3px solid #15803d", borderRadius: "50%" },
  list: { maxWidth: 720, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  intro: { fontSize: 13, color: "#6B7280", lineHeight: 1.55, marginBottom: 8 },
  card: {
    display: "block", background: "#fff", borderRadius: 16, padding: 16,
    border: "1px solid #F3F4F6", textDecoration: "none", cursor: "pointer",
  },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  typePill: { padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 6 },
  cardDesc: { fontSize: 13, color: "#6B7280", lineHeight: 1.5, marginBottom: 6 },
  deadline: { fontSize: 12, color: "#b45309", fontWeight: 600, marginBottom: 4 },
  learnMore: { fontSize: 12, fontWeight: 700, color: "#1d4ed8" },
};
