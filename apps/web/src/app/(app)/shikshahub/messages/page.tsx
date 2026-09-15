"use client";

// PATH: apps/web/src/app/(app)/shikshahub/messages/page.tsx
// ShikshaHub messaging phase — "My Messages" inbox. Every conversation
// the signed-in student has with a tutor (useTutorConversations, scoped
// to role "student"), most-recently-active first. Mirrors
// .../bookings/page.tsx's "My X" list shape. Tapping a row opens the
// thread at .../messages/thread?peer={tutorUid}.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppTranslation } from "@/context/LanguageContext";
import { useStudentProfile, useTutorConversations } from "@gloows/shared-logic";
import { ShikshaHubStyles, TutorAvatar } from "../_shared";

export default function ShikshaHubMessagesPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { user } = useStudentProfile();
  const { conversations, loading } = useTutorConversations(user?.uid, "student");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 60 }}>
      <ShikshaHubStyles />
      <div className="shikshahub-container" style={{ padding: "20px 16px 40px", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
            {t("shikshaHubMessagesTitle", "Messages")}
          </span>
          <Link href="/shikshahub" style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
            {t("browseShikshaHub", "Browse ShikshaHub")}
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
        ) : conversations.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
              {t("shikshaHubNoMessages", "No conversations yet — message a tutor from their profile.")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {conversations.map((c) => {
              const unread = c.studentUnreadCount ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/shikshahub/messages/thread?peer=${c.tutorUid}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                    border: "1px solid var(--border)", borderRadius: 16, background: "var(--bg-card)",
                    padding: 14, cursor: "pointer",
                  }}
                >
                  <TutorAvatar tutor={{ name: c.tutorName ?? "", profilePic: "" }} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text)" }}>
                        {c.tutorName || "Tutor"}
                      </span>
                      {unread > 0 && (
                        <span style={{
                          flexShrink: 0, background: "#0d9488", color: "#fff", borderRadius: 20,
                          fontSize: 10.5, fontWeight: 800, padding: "2px 7px",
                        }}>
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    {!!c.lastMessageText && (
                      <div
                        style={{
                          fontSize: 12, fontWeight: unread > 0 ? 700 : 500,
                          color: unread > 0 ? "var(--text)" : "var(--text-muted)",
                          marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}
                      >
                        {c.lastMessageText}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
