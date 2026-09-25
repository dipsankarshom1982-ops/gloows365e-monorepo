"use client";

// PATH: apps/web/src/app/restart-education/guidance/page.tsx
// Web port of apps/mobile/app/restart-education/guidance.tsx — shows the
// user's own submitted educationLeads with live status.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import AuthGuard from "@/components/layout/AuthGuard";
import LeadCaptureModal from "@/components/restart/LeadCaptureModal";

interface Lead {
  id: string;
  name: string;
  state: string;
  district: string;
  status: string;
  assignedPartner: string;
  notes: string;
  createdAt: { toDate?: () => Date } | null;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  New:       { color: "#1d4ed8", bg: "#DBEAFE", label: "New — Under review" },
  Verified:  { color: "#7c3aed", bg: "#EDE9FE", label: "Verified" },
  Assigned:  { color: "#b45309", bg: "#FEF3C7", label: "Assigned to advisor" },
  Contacted: { color: "#0e7490", bg: "#CFFAFE", label: "Team contacted you" },
  Admitted:  { color: "#15803d", bg: "#DCFCE7", label: "Admitted to programme" },
  Closed:    { color: "#6B7280", bg: "#F3F4F6", label: "Closed" },
};

function GuidanceContent() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "educationLeads"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => router.back()} aria-label="Back">←</button>
        <div style={S.headerTitle}>🤝 My Guidance Requests</div>
        <div style={{ width: 36 }} />
      </div>

      {loading ? (
        <div style={S.loadingWrap}><div style={S.spinner} /></div>
      ) : leads.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 52 }}>🤝</div>
          <div style={S.emptyTitle}>No requests yet</div>
          <div style={S.emptySub}>
            Submit a guidance request and our team will reach out to help you for free.
          </div>
          <button style={S.requestBtn} onClick={() => setShowModal(true)}>
            Request Free Guidance
          </button>
        </div>
      ) : (
        <div style={S.list}>
          <button style={S.newRequestBtn} onClick={() => setShowModal(true)}>
            + <span>Submit Another Request</span>
          </button>

          {leads.map((item) => {
            const statusConf = STATUS_CONFIG[item.status] ?? STATUS_CONFIG["New"];
            const date = item.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ?? "";
            return (
              <div key={item.id} style={S.card}>
                <div style={S.cardTop}>
                  <span style={{ ...S.statusPill, background: statusConf.bg, color: statusConf.color }}>
                    {statusConf.label}
                  </span>
                  {!!date && <span style={S.dateText}>{date}</span>}
                </div>
                <div style={S.cardName}>{item.name}</div>
                <div style={S.cardLocation}>{item.district}, {item.state}</div>
                {!!item.assignedPartner && <div style={S.assignedText}>Advisor: {item.assignedPartner}</div>}
                {!!item.notes && (
                  <div style={S.notesBox}>
                    <div style={S.notesLabel}>Team note:</div>
                    <div style={S.notesText}>{item.notes}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LeadCaptureModal visible={showModal} onClose={() => setShowModal(false)} onSubmitted={() => setShowModal(false)} />
    </div>
  );
}

export default function GuidancePage() {
  return (
    <AuthGuard>
      <GuidanceContent />
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
  spinner: { width: 32, height: 32, border: "3px solid rgba(22,163,74,0.25)", borderTop: "3px solid #16a34a", borderRadius: "50%" },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: 32, gap: 12, textAlign: "center", maxWidth: 420, margin: "40px auto 0",
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#374151" },
  emptySub: { fontSize: 13, color: "#9CA3AF", lineHeight: 1.55 },
  requestBtn: {
    borderRadius: 14, marginTop: 8, width: "100%", border: "none", padding: "14px 0",
    background: "linear-gradient(135deg, #16a34a, #15803d)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
  },
  list: { maxWidth: 720, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 },
  newRequestBtn: {
    display: "flex", alignItems: "center", gap: 8, background: "#F0FDF4", borderRadius: 12, padding: 12,
    border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  card: { background: "#fff", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 6, border: "1px solid #F3F4F6" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  statusPill: { padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  dateText: { fontSize: 11, color: "#9CA3AF" },
  cardName: { fontSize: 15, fontWeight: 700, color: "#111" },
  cardLocation: { fontSize: 12, color: "#6B7280" },
  assignedText: { fontSize: 12, color: "#7c3aed", fontWeight: 600 },
  notesBox: { background: "#F9FAFB", borderRadius: 10, padding: 10, border: "1px solid #E5E7EB" },
  notesLabel: { fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 2 },
  notesText: { fontSize: 12, color: "#6B7280", lineHeight: 1.5 },
};
