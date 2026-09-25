"use client";

// PATH: apps/web/src/app/(app)/knowledge-hub/page.tsx
//
// FIX (bug report — "404 showing on some pages"): home/page.tsx's
// Knowledge Hub section ("View all" link + each card) routes to
// /knowledge-hub, but no route existed here, so it hit Next.js's default
// 404. The full Knowledge Hub browsing UI isn't built yet, so this renders
// a proper on-brand "Coming Soon" screen instead of a dead end.

import ComingSoon from "@/components/ComingSoon";

export default function KnowledgeHubPage() {
  return (
    <ComingSoon
      emoji="🧠"
      title="Knowledge Hub"
      description="A full library of bite-sized knowledge cards is on the way. Check back soon!"
    />
  );
}
