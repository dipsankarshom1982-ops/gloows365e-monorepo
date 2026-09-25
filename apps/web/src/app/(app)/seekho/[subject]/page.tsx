// PATH: apps/web/src/app/(app)/seekho/[subject]/page.tsx
//
// FIX (bug report — "404 showing on some pages, specially in seekho"):
// the Seekho subject grid (../seekho/page.tsx) links every subject card to
// /seekho/<subject> (e.g. /seekho/Mathematics), but no route existed here
// at all, so tapping any subject hit Next.js's default 404. The actual
// lesson-browsing UI for a subject isn't built yet, so this renders a
// proper on-brand "Coming Soon" screen instead of a dead end.
//
// FIX (build error — "missing generateStaticParams()"): this app builds
// with output: "export" (next.config.ts, required for Firebase Hosting —
// no Node server to render dynamic routes on demand). A dynamic segment
// under static export MUST export generateStaticParams() so Next knows
// every concrete path to pre-render at build time; it can't be client-only.
// That means this file itself can't have "use client" (Next disallows
// generateStaticParams in a Client Component) — it stays a plain Server
// Component that reads the [subject] param directly via props, and
// delegates the actual (client-side) rendering to <ComingSoon>.

import ComingSoon from "@/components/ComingSoon";
import { SEEKHO_SUBJECTS } from "@/lib/seekhoSubjects";

const SUBJECT_EMOJI: Record<string, string> = {
  "Mathematics":        "📐",
  "Science":            "🔬",
  "Social Science":     "🌍",
  "English":            "📝",
  "Hindi":              "🪷",
  "Sanskrit":           "📜",
  "Computer Science":   "💻",
  "Physical Education": "🏃",
};

// Pre-render one static page per known subject — required by output: "export".
export function generateStaticParams() {
  return SEEKHO_SUBJECTS.map((subject) => ({ subject }));
}

export default async function SeekhoSubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject: rawSubject } = await params;
  const subject = decodeURIComponent(rawSubject ?? "");
  const emoji = SUBJECT_EMOJI[subject] ?? "📖";

  return (
    <ComingSoon
      emoji={emoji}
      title={subject ? `${subject} Lessons` : "Seekho"}
      description={`Curriculum-aligned video lessons for ${subject || "this subject"} are on the way. Check back soon!`}
    />
  );
}
