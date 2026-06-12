import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import axios from "axios";
import { callGeminiText, parseJsonFromResponse } from "./gemini";
import { getSubscription } from "./usageCheck";
import { getRedis, RK, TTL, todayIST, ttlUntilMidnightIST } from "./redish";

// Minimal type for cached result blobs — full type lives in lib/discover/types.ts (frontend)
type DiscoverResult = Record<string, unknown> & {
  queryHash: string;
  query: string;
  language: string;
  generatedAt: number;
};

const db = admin.firestore();
const FREE_DAILY_DISCOVER = 3;

// ─── CORS + Auth ──────────────────────────────────────────────────────────────

function setCorsHeaders(res: any): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function verifyAuthToken(req: any): Promise<string> {
  const authHeader: string = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const token = authHeader.slice(7);
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

async function checkDiscoverLimit(uid: string): Promise<number> {
  const { isPremium } = await getSubscription(uid, db);
  if (isPremium) return -1; // unlimited

  const date = todayIST();
  const key = RK.discoverSearch(uid, date);
  let used = 0;

  try {
    const count = await getRedis().get<number>(key);
    if (count !== null) {
      used = count;
    } else {
      const snap = await db.doc(`discoverUsage/${uid}/daily/${date}`).get();
      used = snap.exists ? (snap.data()?.searchesUsed ?? 0) : 0;
      if (used > 0) {
        getRedis().set(key, used, { ex: ttlUntilMidnightIST() }).catch(() => {});
      }
    }
  } catch {
    const snap = await db.doc(`discoverUsage/${uid}/daily/${date}`).get();
    used = snap.exists ? (snap.data()?.searchesUsed ?? 0) : 0;
  }

  if (used >= FREE_DAILY_DISCOVER) {
    throw new Error(
      `FREE_LIMIT_REACHED:You have used your ${FREE_DAILY_DISCOVER} free searches for today. Upgrade to Premium for unlimited discovery.`
    );
  }
  return FREE_DAILY_DISCOVER - used - 1;
}

async function incrementDiscoverUsage(uid: string): Promise<void> {
  const date = todayIST();
  const key = RK.discoverSearch(uid, date);
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, ttlUntilMidnightIST());
  } catch { /* Redis unavailable */ }

  db.doc(`discoverUsage/${uid}/daily/${date}`).set(
    {
      searchesUsed: admin.firestore.FieldValue.increment(1),
      lastSearchedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  ).catch((e) => console.warn("discoverUsage write failed:", e));
}

// ─── Query hash ───────────────────────────────────────────────────────────────

function makeQueryHash(query: string, language: string): string {
  return crypto
    .createHash("sha256")
    .update(`${query.toLowerCase().trim()}:${language}`)
    .digest("hex")
    .slice(0, 16);
}

// ─── Google Search ────────────────────────────────────────────────────────────

async function runGoogleSearch(
  query: string
): Promise<Array<{ title: string; snippet: string; link: string }>> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return [];

  try {
    const params = new URLSearchParams({ key: apiKey, cx, q: query, num: "5" });
    const resp = await axios.get(
      `https://www.googleapis.com/customsearch/v1?${params}`,
      { timeout: 8_000 }
    );
    return (resp.data.items ?? []).map((item: any) => ({
      title: item.title ?? "",
      snippet: item.snippet ?? "",
      link: item.link ?? "",
    }));
  } catch (e) {
    console.warn("Google Search failed:", e);
    return [];
  }
}

function formatSnippetsForPrompt(
  results: Array<{ title: string; snippet: string; link: string }>
): string {
  if (results.length === 0) return "No search results available.";
  return results
    .map((r, i) => `${i + 1}. ${r.title}: ${r.snippet} [${r.link}]`)
    .join("\n");
}

// ─── Gemini prompt ────────────────────────────────────────────────────────────

function buildDiscoverPrompt(
  query: string,
  studentName: string,
  classLevel: string | number,
  interests: string[],
  language: string,
  collegeSnippets: string,
  scholarshipSnippets: string
): string {
  const interestStr = interests.length > 0 ? interests.join(", ") : "general studies";
  const langInstruction =
    language !== "English"
      ? `IMPORTANT: Write ALL text fields (aiSummary, descriptions, mentorAdvice, etc.) in ${language} language. Keep JSON keys in English.`
      : "Write all text fields in clear, friendly English.";

  return `You are Discover AI — India's smartest career and education advisor for students.
Student: ${studentName}, Class ${classLevel}, Interests: ${interestStr}
Query: "${query}"
${langInstruction}

Generate a comprehensive educational discovery response for this Indian student.
Return ONLY valid JSON. No markdown, no code fences, no thinking blocks, no explanations outside JSON.

Real search data for college and scholarship sections:
COLLEGES DATA:
${collegeSnippets}

SCHOLARSHIPS DATA:
${scholarshipSnippets}

Return exactly this JSON structure with ALL fields populated:
{
  "aiSummary": "3-4 sentences. What is ${query}? Why is it exciting for Indian students? What can ${studentName} specifically do? Warm, personal, encouraging tone.",
  "careerScope": {
    "title": "Primary career title related to ${query}",
    "emoji": "One relevant emoji",
    "domain": "Technology OR Healthcare OR Arts OR Science OR Commerce OR Government OR Sports OR Media OR Education",
    "salaryRange": { "min": 600000, "max": 4000000, "currency": "INR" },
    "demandLevel": "low OR medium OR high OR very_high",
    "futureDemand": 75,
    "description": "2-3 sentences about career scope in India specifically"
  },
  "salaryBars": [
    { "role": "Entry Level (0-2 yrs)", "minLPA": 3, "maxLPA": 8, "color": "#3b82f6" },
    { "role": "Mid Level (3-5 yrs)", "minLPA": 8, "maxLPA": 18, "color": "#6366f1" },
    { "role": "Senior Level (6-10 yrs)", "minLPA": 18, "maxLPA": 35, "color": "#8b5cf6" },
    { "role": "Expert/Lead (10+ yrs)", "minLPA": 35, "maxLPA": 80, "color": "#a855f7" }
  ],
  "requiredSkills": [
    { "name": "Skill Name", "category": "technical OR soft OR domain", "importance": "must_have OR good_to_have" }
  ],
  "learningPath": [
    { "step": 1, "title": "Step title", "description": "What to do in this step", "durationMonths": 3, "resources": ["Resource 1", "Resource 2"] }
  ],
  "collegeSuggestions": [
    { "name": "College name", "location": "City, State", "type": "IIT OR NIT OR Central OR State OR Private OR Deemed", "course": "Course name", "entranceExam": "JEE/NEET/etc", "approxFeePerYear": "₹X lakh", "website": "website.edu.in", "snippet": "Brief info from search" }
  ],
  "scholarshipSuggestions": [
    { "name": "Scholarship name", "amount": "₹X,000 per year", "eligibility": "Who can apply", "lastDate": "Month Year", "applyUrl": "https://...", "snippet": "Brief description" }
  ],
  "mentorAdvice": "Warm, personal paragraph addressing ${studentName} directly. Mention their Class ${classLevel} level. Give specific, actionable advice for Indian students pursuing ${query}. Include one motivational line.",
  "futureDemandScore": 75,
  "nextActionSteps": [
    "Step 1: Specific action for Class ${classLevel} student",
    "Step 2: Next concrete step",
    "Step 3: Medium-term goal",
    "Step 4: Long-term direction"
  ]
}

Constraints:
- salaryBars: Use realistic Indian market LPA values
- learningPath: Minimum 4 steps tailored for Class ${classLevel} student starting from scratch
- requiredSkills: Minimum 6 skills (mix of technical and soft)
- collegeSuggestions: 4-6 colleges. Populate name/snippet from COLLEGES DATA snippets above
- scholarshipSuggestions: 3-5 scholarships. Populate from SCHOLARSHIPS DATA snippets above
- futureDemandScore: integer 0-100. 80+ for AI/tech, 60-79 for emerging, 40-59 for stable, <40 for declining
- nextActionSteps: Exactly 4 steps, actionable and specific to Class ${classLevel}
- mentorAdvice: Emotionally warm. Reference the specific query and student's situation.`;
}

// ─── History + trending ───────────────────────────────────────────────────────

async function saveSearchHistory(
  uid: string,
  query: string,
  hash: string
): Promise<void> {
  const ref = db.collection("discoverHistory").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing: Array<{ query: string; queryHash: string; searchedAt: number }> =
      snap.exists ? (snap.data()?.searches ?? []) : [];
    const filtered = existing.filter((s) => s.queryHash !== hash);
    const updated = [
      { query, queryHash: hash, searchedAt: Date.now() },
      ...filtered,
    ].slice(0, 20);
    tx.set(ref, {
      searches: updated,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

async function updateTrending(query: string): Promise<void> {
  try {
    const key = RK.discoverTrending();
    const normalized = query.toLowerCase().trim().slice(0, 60);
    await getRedis().zincrby(key, 1, normalized);
    getRedis().expire(key, TTL.discoverTrending).catch(() => {});
  } catch { /* Redis unavailable */ }
}

// ─── Export: discoverSearch ───────────────────────────────────────────────────

export const discoverSearch = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["GEMINI_API_KEY", "GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_CX"],
  },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

    let uid: string;
    try {
      uid = await verifyAuthToken(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const remaining = await checkDiscoverLimit(uid);

      const {
        query,
        language = "English",
        studentName = "Student",
        classLevel = "10",
        interests = [],
      } = req.body as {
        query: string;
        language?: string;
        studentName?: string;
        classLevel?: string | number;
        interests?: string[];
      };

      if (!query?.trim()) {
        res.status(400).json({ error: "query is required" });
        return;
      }

      const hash = makeQueryHash(query, language);
      const cacheKey = RK.discoverQuery(hash);

      // ── 1. Redis cache check ──────────────────────────────────
      let cachedResult: DiscoverResult | null = null;
      try {
        cachedResult = await getRedis().get<DiscoverResult>(cacheKey);
      } catch { /* Redis unavailable */ }

      if (cachedResult) {
        saveSearchHistory(uid, query, hash).catch(() => {});
        updateTrending(query).catch(() => {});
        await incrementDiscoverUsage(uid);
        res.status(200).json({ result: cachedResult, fromCache: true, remainingSearches: remaining });
        return;
      }

      // ── 2. Firestore cache fallback ───────────────────────────
      const fsSnap = await db.doc(`discoverCache/${hash}`).get();
      if (fsSnap.exists) {
        const fsResult = fsSnap.data() as DiscoverResult;
        getRedis().set(cacheKey, fsResult, { ex: TTL.discoverQuery }).catch(() => {});
        saveSearchHistory(uid, query, hash).catch(() => {});
        updateTrending(query).catch(() => {});
        await incrementDiscoverUsage(uid);
        res.status(200).json({ result: fsResult, fromCache: true, remainingSearches: remaining });
        return;
      }

      // ── 3. Parallel Google Search ─────────────────────────────
      const [collegeResults, scholarshipResults] = await Promise.all([
        runGoogleSearch(`top colleges for ${query} India admissions 2025`),
        runGoogleSearch(`scholarships for ${query} students India 2025 2026`),
      ]);

      // ── 4. Gemini AI call ────────────────────────────────────
      const prompt = buildDiscoverPrompt(
        query,
        String(studentName),
        classLevel,
        interests,
        language,
        formatSnippetsForPrompt(collegeResults),
        formatSnippetsForPrompt(scholarshipResults)
      );

      const rawResponse = await callGeminiText(prompt);
      const parsed = parseJsonFromResponse(rawResponse) as Omit<
        DiscoverResult,
        "queryHash" | "query" | "language" | "generatedAt"
      >;

      // ── 5. Assemble final result ──────────────────────────────
      const result: DiscoverResult = {
        ...parsed,
        queryHash: hash,
        query,
        language,
        generatedAt: Date.now(),
      };

      // ── 6. Cache (fire-and-forget) ────────────────────────────
      getRedis().set(cacheKey, result, { ex: TTL.discoverQuery }).catch(() => {});
      db.doc(`discoverCache/${hash}`).set(result).catch(() => {});

      // ── 7. History + trending (fire-and-forget) ───────────────
      saveSearchHistory(uid, query, hash).catch(() => {});
      updateTrending(query).catch(() => {});

      // ── 8. Increment usage ────────────────────────────────────
      await incrementDiscoverUsage(uid);

      res.status(200).json({ result, fromCache: false, remainingSearches: remaining });
    } catch (err: any) {
      const msg: string = err?.message ?? "Unknown error";
      console.error("discoverSearch error:", msg);

      if (msg.startsWith("FREE_LIMIT_REACHED:")) {
        res.status(429).json({
          error: msg.replace("FREE_LIMIT_REACHED:", ""),
          code: "FREE_LIMIT_REACHED",
        });
      } else if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({ error: "AI is busy right now. Please try again in a minute.", code: "QUOTA_EXCEEDED" });
      } else {
        res.status(500).json({ error: "Discovery search failed. Please try again." });
      }
    }
  }
);

// ─── Export: discoverTrending ─────────────────────────────────────────────────

const FALLBACK_TRENDING = [
  { term: "software engineering career", score: 100 },
  { term: "data science india", score: 90 },
  { term: "UPSC IAS preparation", score: 85 },
  { term: "NEET medical entrance", score: 82 },
  { term: "IIT JEE coaching", score: 78 },
  { term: "AI machine learning career", score: 74 },
  { term: "government jobs after graduation", score: 70 },
];

export const discoverTrending = onRequest(
  {
    timeoutSeconds: 10,
    memory: "128MiB",
    secrets: ["REDIS_URL", "REDIS_TOKEN"],
  },
  async (req, res) => {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

    try {
      await verifyAuthToken(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const key = RK.discoverTrending();
      // zrange with rev:true returns highest-score members first
      const raw = await getRedis().zrange(key, 0, 14, { rev: true, withScores: true }) as (string | number)[];
      const terms: Array<{ term: string; score: number }> = [];
      for (let i = 0; i + 1 < raw.length; i += 2) {
        terms.push({ term: String(raw[i]), score: Number(raw[i + 1]) });
      }
      res.status(200).json({ terms: terms.length > 0 ? terms : FALLBACK_TRENDING });
    } catch {
      res.status(200).json({ terms: FALLBACK_TRENDING });
    }
  }
);
