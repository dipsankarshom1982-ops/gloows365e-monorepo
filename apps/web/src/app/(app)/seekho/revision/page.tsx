"use client";

// PATH: apps/web/src/app/(app)/seekho/revision/page.tsx
//
// FIX (bug report — "404 showing on some pages, specially in seekho"):
// the "Revision Due" banner on ../seekho/page.tsx links to /seekho/revision,
// but no route existed here, so tapping it hit Next.js's default 404. The
// spaced-repetition revision queue UI isn't built yet, so this renders a
// proper on-brand "Coming Soon" screen instead of a dead end.

import ComingSoon from "@/components/ComingSoon";

export default function SeekhoRevisionPage() {
  return (
    <ComingSoon
      emoji="🔄"
      title="Revision Queue"
      description="Your spaced-repetition revision queue is on the way. Check back soon!"
    />
  );
}
