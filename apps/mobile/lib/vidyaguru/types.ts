export type GuruMessage = {
  id: string;
  role: "guru" | "student";
  text: string;
  audioBase64?: string;
  createdAt: number;
};

export type GuruState = "idle" | "listening" | "thinking" | "speaking";
