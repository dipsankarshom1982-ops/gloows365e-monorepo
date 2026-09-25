// PATH: apps/web/src/lib/seekhoSubjects.ts
// Single source of truth for the Seekho subject list — used by both the
// subject grid (seekho/page.tsx) and seekho/[subject]/page.tsx's
// generateStaticParams() (which needs a plain, importable array since it
// runs at build time in a Server Component, not in the client bundle).
export const SEEKHO_SUBJECTS = [
  "Mathematics", "Science", "Social Science",
  "English", "Hindi", "Sanskrit",
  "Computer Science", "Physical Education",
] as const;

export type SeekhoSubject = typeof SEEKHO_SUBJECTS[number];
