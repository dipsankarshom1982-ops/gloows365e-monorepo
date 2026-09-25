"use client";
// apps/tutor/src/app/(app)/messages/page.tsx
// Tutor-student messaging phase — "My Messages" inbox. Every conversation
// a student has started with this tutor (useTutorConversations, scoped
// to role "tutor"), most-recently-active first. A tutor can only ever
// reply inside a conversation a student has already started — there's no
// "start a new conversation" action here, see
// functions/src/tutorMessaging.ts's header comment for why.

import { useRouter } from "next/navigation";
import { useTutorConversations, useTutorProfile } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

export default function MessagesPage() {
  const router = useRouter();
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { conversations, loading } = useTutorConversations(user?.uid, "tutor");

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-black text-slate-100 mb-6">{t("myMessagesTitle")}</h1>

        {loading ? (
          <LoadingState />
        ) : conversations.length === 0 ? (
          <EmptyState title={t("noMessagesTitle")} subtitle={t("noMessagesSubtitle")} />
        ) : (
          <div className="flex flex-col gap-3">
            {conversations.map((c) => {
              const unread = c.tutorUnreadCount ?? 0;
              return (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:border-brand-500 transition-colors"
                >
                  <button
                    className="w-full text-left"
                    onClick={() => router.push(`/messages/thread?peer=${c.studentUid}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-100">{c.studentName || "Student"}</p>
                      {unread > 0 && (
                        <span className="bg-danger text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    {!!c.lastMessageText && (
                      <p className={`text-xs mt-1 truncate ${unread > 0 ? "text-slate-100 font-semibold" : "text-slate-400"}`}>
                        {c.lastMessageText}
                      </p>
                    )}
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
