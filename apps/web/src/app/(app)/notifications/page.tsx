"use client";

// PATH: apps/web/src/app/(app)/notifications/page.tsx
//
// FIX (bug report — "404 showing on some pages"): AppHeader.tsx's bell
// icon routes to /notifications (and already listens for unread count
// there), but no route existed here, so tapping it hit Next.js's default
// 404. The full notification list/detail UI isn't built yet — that needs
// the real notifications/{uid}/items field schema (title, body, deep
// link, etc.) mirrored from the mobile app, which isn't in this repo —
// so this renders a proper on-brand "Coming Soon" screen instead of a
// dead end.

import ComingSoon from "@/components/ComingSoon";

export default function NotificationsPage() {
  return (
    <ComingSoon
      emoji="🔔"
      title="Notifications"
      description="Your notification inbox is on the way. Check back soon!"
    />
  );
}
