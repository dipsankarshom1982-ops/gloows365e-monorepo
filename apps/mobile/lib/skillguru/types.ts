// PATH: apps/mobile/lib/skillguru/types.ts
// Renamed from apps/mobile/lib/vidyaguru/types.ts as part of the
// VidyaGuru → SkillGuru rebuild. Shape is unchanged — same message and
// state types, just relocated under the new skillguru/ directory.

export type GuruMessage = {
  id: string;
  role: "guru" | "student";
  text: string;
  audioBase64?: string;
  createdAt: number;
};

export type GuruState = "idle" | "listening" | "thinking" | "speaking";
