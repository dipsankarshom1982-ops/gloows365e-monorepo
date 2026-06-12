import { GoogleGenerativeAI } from "@google/generative-ai";

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY secret not configured");
    _genAI = new GoogleGenerativeAI(key);
  }
  return _genAI;
}

export async function callGeminiText(prompt: string): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function callGeminiWithImage(
  prompt: string,
  imageBase64: string,
  imageMimeType: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType: imageMimeType as any } },
    prompt,
  ]);
  return result.response.text();
}

export async function callGeminiWithAudio(
  prompt: string,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { data: audioBase64, mimeType: mimeType as any } },
    prompt,
  ]);
  return result.response.text();
}

export function parseJsonFromResponse(raw: string): unknown {
  // Strip thinking blocks (gemini-2.5-flash may include <thinking>...</thinking>)
  let cleaned = raw.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

  // Strip markdown code fences
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Extract the outermost JSON object as a fallback
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}
