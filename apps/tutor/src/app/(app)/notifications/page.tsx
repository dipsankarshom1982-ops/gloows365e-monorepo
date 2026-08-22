"use client";
// apps/tutor/src/app/(app)/notifications/page.tsx
// ShikshaHub notifications phase — the tutor apps had no notification
// inbox at all before this; this reads notifications/{uid}/items (via
// the shared useAppNotifications hook), the same subcollection
// functions/src/shikshahubNotify.ts writes to for Instant Help requests,
// payout status changes, and new reviews.

import { useTutorProfile, useAppNotifications, type AppNotification } from "@gloows/shared-logic";
import { useTutorT } from "@gloows/tutor-i18n";
import { Card, EmptyState, LoadingState } from "@/components/ui";
import BottomNav from "@/components/BottomNav";

const TYPE_META: Record<AppNotification["type"], { icon: string }> = {
  instant_help: { icon: "⚡" },
  payout: { icon: "💸" },
  review: { icon: "⭐" },
  shikshahub: { icon: "🎓" },
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const { t } = useTutorT();
  const { user } = useTutorProfile();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useAppNotifications(user?.uid);

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black text-slate-100">
            {t("notificationsTitle", "Notifications")}
            {unreadCount > 0 && <span className="ml-2 text-brand-400 text-sm font-bold">({unreadCount})</span>}
          </h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-brand-400 text-xs font-bold">
              {t("markAllRead", "Mark all read")}
            </button>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t("noNotificationsTitle", "All caught up!")}
            subtitle={t("noNotificationsSubtitle", "You'll see Instant Help requests, payout updates, and reviews here.")}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <Card
                key={n.id}
                className={`flex items-start gap-3 cursor-pointer transition-colors ${n.read ? "" : "border-brand-500/50 bg-brand-500/5"}`}
              >
                <button className="flex items-start gap-3 text-left w-full" onClick={() => !n.read && markRead(n.id)}>
                  <span className="text-lg shrink-0">{TYPE_META[n.type]?.icon ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm text-slate-100 truncate ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{n.body}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
