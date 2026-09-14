// PATH: functions/src/dailyStreakQuizGeneration.ts
//
// Daily Streak Quiz — automatic AI question generation.
//
// Every day this generates the *next* days' questions ahead of time (a
// 1-2 day buffer) so a student never opens the app to find nothing
// published yet — mirrors the existing pattern of getOrTranslateQuestion's
// atomic-claim locking in dailyStreakQuiz.ts, just for question *authorship*
// instead of translation.
//
// STREAM (added 2026-09-14): Class 11/12 are no longer stream-agnostic.
// Each day generates 11 questions total — one per class 6–10 (`stream:
// null`) plus one per Class 11/12 × {Science, Commerce, Arts/Humanities}
// (6 more). A "slot" is the atomic unit everywhere in this file:
// {class, stream}. Classes 6–10's code paths are deliberately untouched
// wherever `stream` would be null — every query below adds a `stream`
// filter ONLY when a slot actually has one, so 6–10 behaves byte-for-byte
// like before this field existed, and legacy questions (authored before
// this change, `stream` field absent entirely) keep matching exactly the
// same way a `stream: null` slot's queries do. Nothing here guesses a
// student's stream — that's the mobile app / getTodaysStreakQuizQuestion's
// job, never this generator's.
//
// Idempotency: "one question per class+stream+date" is enforced two ways —
//   1. Before generating, query for an existing ACTIVE English question for
//      that class+stream+date (same shape as getTodaysStreakQuizQuestion's
//      query) — this catches both AI-generated *and* admin hand-authored
//      questions, so running this twice, or running it after an admin
//      already added today's question by hand, is always a safe no-op.
//   2. AI-generated docs use a deterministic ID (`${date}_c${class}` for
//      6–10, `${date}_c${class}_${streamSlug}` for 11/12) instead of
//      addDoc's random ID, so retried/concurrent runs claim the same doc
//      rather than creating duplicates.
// After a successful publish, any *other* active question left over for
// that same class+stream+date (e.g. an admin doc with a different random
// ID) is flipped to inactive — see deactivateOtherActiveQuestions — so
// "quizDate + class + stream" always resolves to exactly one active
// question, per the product requirement. This never touches a legacy
// stream-less question sitting alongside a newly-generated stream-specific
// one for the same class+date — they're different slots by design (see
// dailyStreakQuiz.ts's getTodaysStreakQuizQuestion for how a student
// without a stream set still finds one of them).
//
// Scaling to N questions/day later: extend the doc ID scheme to
// `${date}_c${class}_${streamSlug}_${n}` (or `${date}_c${class}_${n}` for
// 6–10) and loop `n` per slot in the scheduler below, then relax
// getTodaysStreakQuizQuestion's `.limit(1)` to `.limit(N)`. Not built now —
// everything here already treats "generate one question for a slot" as the
// atomic unit, so that change is additive, not a rewrite.

import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { callGeminiText, parseJsonFromResponse } from "./gemini";
import { todayIST } from "./redish";

const db = admin.firestore();

type Option = "A" | "B" | "C" | "D";
type DifficultyLevel = "easy" | "medium" | "hard";

// Mirrors packages/shared-logic/src/types/student.ts's StudentStream —
// functions can't import that frontend package, so this is intentionally a
// local copy of the same 3 literal strings (same convention as SUBJECTS/
// CLASS_DIFFICULTY below, already duplicated per-app rather than shared).
type StudentStream = "Science" | "Commerce" | "Arts/Humanities";
const STREAMS: readonly StudentStream[] = ["Science", "Commerce", "Arts/Humanities"];

const NON_STREAM_CLASSES = [6, 7, 8, 9, 10];
const STREAM_CLASSES = [11, 12];
const ALL_CLASSES = [...NON_STREAM_CLASSES, ...STREAM_CLASSES];

interface Slot {
  class: number;
  stream: StudentStream | null;
}

// The 11 daily slots: 5 non-stream classes + (Class 11 × 3 streams) +
// (Class 12 × 3 streams).
function buildDailySlots(): Slot[] {
  const slots: Slot[] = NON_STREAM_CLASSES.map((c) => ({ class: c, stream: null }));
  for (const c of STREAM_CLASSES) {
    for (const s of STREAMS) slots.push({ class: c, stream: s });
  }
  return slots;
}

function streamSlug(stream: StudentStream): string {
  return stream.toLowerCase().replace(/\//g, "-"); // "Arts/Humanities" -> "arts-humanities"
}

function questionDocId(cls: number, stream: StudentStream | null, date: string): string {
  return stream ? `${date}_c${cls}_${streamSlug(stream)}` : `${date}_c${cls}`;
}

// How many days ahead to keep pre-generated — a missed scheduler run on one
// day still leaves tomorrow's question already published from the day
// before.
const BUFFER_DAYS = [1, 2];

// How far back to look when telling the AI what to avoid repeating.
const LOOKBACK_DAYS = 30;

const MAX_ATTEMPTS = 3;
// Lowered 2026-09-15 from 0.75 after real-generation testing showed 0.75
// failed to catch even the brief's own worked example ("What is the
// largest planet in our solar system?" vs "Which is the biggest planet in
// the Solar System?" — raw word-overlap Jaccard for that pair is ~0.55,
// below the old threshold). Paired with STOPWORDS filtering in wordSet()
// below (so the overlap that's measured is of meaningful content words,
// not just how many connector words like "the"/"is"/"in" two sentences
// happen to share) to keep this safer to lower than it would otherwise be.
// Known residual limit: this is still word-overlap similarity, not true
// semantic similarity — a paraphrase using substantially different
// vocabulary for the same underlying question (e.g. "organ...responsible
// for digesting" vs "site...for digestion") can still slip through. Catching
// that reliably would need an LLM-judged semantic check (like the
// negation/quality checks already delegated to buildValidatorPrompt),
// which is a bigger change than a threshold tweak — flagged, not built here.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

// General subject pool — classes 6–10 only (unchanged from before streams
// existed). Mirrors apps/admin/src/pages/DailyStreakQuiz.tsx's SUBJECTS list.
const SUBJECTS = [
  "General Knowledge", "Mathematics", "Science", "English",
  "Social Science", "Current Affairs", "Logical Reasoning",
];

// Class 11/12 subject pools, by stream. Deliberately just a plain map — the
// brief calls this out as something that should stay easy to retune later,
// and "not every student in a stream studies every listed subject" (the
// prompt below treats this as a pool to pick ONE from, not a syllabus).
const STREAM_SUBJECTS: Record<StudentStream, string[]> = {
  "Science":  ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", "General Scientific Reasoning"],
  "Commerce": ["Accountancy", "Business Studies", "Economics", "Mathematics", "Entrepreneurship / Financial Literacy"],
  "Arts/Humanities": ["History", "Political Science", "Geography", "Sociology", "Psychology", "Economics", "Literature / Language"],
};

const CLASS_DIFFICULTY: Record<number, { level: DifficultyLevel; label: string }> = {
  6:  { level: "easy",   label: "Basic school-level concepts and general knowledge. Keep the wording simple." },
  7:  { level: "easy",   label: "Basic-to-moderate school-level concepts and general knowledge." },
  8:  { level: "medium", label: "Moderate school-level concepts and reasoning." },
  9:  { level: "medium", label: "Moderate-to-challenging school-level academic concepts." },
  10: { level: "medium", label: "Board-exam-oriented general academic concepts, with difficulty appropriate for Class 10." },
  11: { level: "hard",   label: "Advanced academic concepts appropriate for Class 11." },
  // Strengthened 2026-09-15 — real-generation testing showed the previous
  // generic wording let the model default to direct textbook fact recall
  // (e.g. "DPSPs are non-justiciable" as a bare definition). Explicitly
  // pushes toward application/analysis instead, per the brief: "appropriately
  // advanced and thought-provoking, not unnecessarily complicated."
  12: { level: "hard",   label: "Advanced Class 12 academic concepts. Strongly prefer questions that require APPLICATION, ANALYSIS, COMPARISON, INTERPRETATION, or CAUSE-AND-EFFECT REASONING over simple direct fact/definition recall — for example, present a brief scenario, data point, or situation and ask which concept/principle best explains or applies to it, and why, rather than just naming or defining a term. Should be appropriately advanced and thought-provoking for a board-level student, NOT unnecessarily complicated, obscure, or convoluted — a clear scenario with a clear correct principle, not a trick question." },
};

// Extra framing appended only for Class 12 Arts/Humanities — that stream's
// "advanced" questions most easily default to bare definitional recall
// (civics/history terms), so it gets its own explicit nudge toward
// scenario-based reasoning on top of the CLASS_DIFFICULTY[12] label above.
const CLASS_12_ARTS_HUMANITIES_HINT =
  `For this Arts/Humanities question specifically: prefer a scenario-based or ` +
  `applied-reasoning question over a direct definitional/comparison question. ` +
  `For example, instead of "Which constitutional principle applies to X?" or ` +
  `"What distinguishes X from Y?", prefer something like "Given this situation, ` +
  `which principle/concept best explains the outcome, and why?" Avoid a pure ` +
  `recall-of-definition question when a scenario-based alternative tests the ` +
  `same knowledge more meaningfully.`;

interface GeneratedQuestion {
  subject: string;
  topic: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: Option;
  explanation: string;
}

interface EnsureResult {
  status: "success" | "already-active" | "failed";
  reason?: string;
}

// ─── Date helpers (IST calendar-date arithmetic, no time-of-day precision
// needed here — publishDate is always a plain "YYYY-MM-DD") ────────────────

function dateOffsetIST(base: string, offsetDays: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ─── Text similarity (duplicate detection) ─────────────────────────────────

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Stripped only for duplicate-similarity comparison (findDuplicateMatch) —
// keeps the measured overlap focused on meaningful content words rather
// than how many connector words ("the"/"is"/"in"/"our"/...) two otherwise-
// unrelated sentences happen to share, which is what let the threshold
// lower above be lowered without a false-positive blow-up.
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "of", "in", "on", "at", "to", "for",
  "with", "and", "or", "our", "its", "what", "which", "who", "whom",
  "does", "do", "did", "as", "by", "from", "you", "your", "we",
]);

function wordSet(s: string): Set<string> {
  return new Set(normalizeText(s).split(" ").filter((w) => w && !STOPWORDS.has(w)));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((w) => { if (setB.has(w)) intersection++; });
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function findDuplicateMatch(question: string, avoidQuestions: string[]): string | null {
  for (const prior of avoidQuestions) {
    if (jaccardSimilarity(question, prior) >= DUPLICATE_SIMILARITY_THRESHOLD) return prior;
  }
  return null;
}

// ─── Negation/inversion & near-duplicate option pairs (added 2026-09-15,
// narrowed same day after real-generation testing) ─────────────────────────
// Deterministic backstop for the classic "same claim, polarity swapped"
// distractor pattern — e.g. "DPSPs are justiciable, FR are not" / "FR are
// non-justiciable, DPSPs are" / "DPSPs are non-justiciable, FR are"
// (correct) / "both are equally justiciable". Strips common negation
// markers before comparing word-sets: two options that are near-identical
// once negation words are removed are almost certainly the same underlying
// claim with the polarity flipped, not two genuinely distinct misconceptions.
//
// IMPORTANT — only compares a pair when at least one side actually contains
// an explicit negation marker word. Real-generation testing on Class 12
// Science caught a serious false positive without this guard: option pairs
// like "2-ethoxy-2,3-dimethylbutane" vs "3-ethoxy-2,2-dimethylbutane" (two
// genuinely different, chemically distinct isomer names for an organic
// chemistry question) got flagged as "negation pairs" purely because they
// share almost all their word/number tokens — normal and expected for
// technical/numeric nomenclature (chemistry, math expressions, coordinates),
// which has nothing to do with logical negation. Requiring a real negation
// word before comparing keeps this check scoped to what it's actually
// designed to catch. This runs BEFORE the semantic validator call (cheap,
// no extra Gemini round-trip) — buildValidatorPrompt's checks 7/8 also
// judge this semantically and are what actually caught the one real
// negation-pair case seen in testing so far (a physics thermodynamics
// question) — this deterministic check is a narrow backstop, not the
// primary defense.
const NEGATION_MARKERS = new Set([
  "not", "non", "never", "cannot", "cant", "isnt", "arent", "doesnt",
  "wont", "wouldnt", "no", "without",
]);
const NEGATION_PAIR_SIMILARITY_THRESHOLD = 0.7;

function containsNegationMarker(s: string): boolean {
  const words = normalizeText(s).split(" ").filter(Boolean);
  return words.some((w) => NEGATION_MARKERS.has(w));
}

function stripNegationMarkers(s: string): Set<string> {
  const words = normalizeText(s).split(" ").filter(Boolean);
  return new Set(words.filter((w) => !NEGATION_MARKERS.has(w)));
}

function jaccardOfSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  a.forEach((w) => { if (b.has(w)) intersection++; });
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function findNegationOrDuplicateOptionPair(options: string[]): string | null {
  const hasMarker = options.map(containsNegationMarker);
  const stripped = options.map(stripNegationMarkers);
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (!hasMarker[i] && !hasMarker[j]) continue; // no negation word on either side — not this pattern
      const sim = jaccardOfSets(stripped[i], stripped[j]);
      if (sim >= NEGATION_PAIR_SIMILARITY_THRESHOLD) {
        return `Options "${options[i]}" and "${options[j]}" appear to be the same underlying claim with polarity/wording flipped, not distinct misconceptions`;
      }
    }
  }
  return null;
}

// ─── Correct-answer position shuffle (added 2026-09-15) ────────────────────
// Never rely on Gemini to place the correct answer at a random letter —
// real-generation testing showed a real skew toward "A". Runs AFTER both
// validation passes, immediately before storage, using a real Fisher-Yates
// shuffle — so validation always judges the question in whatever shape
// Gemini actually produced (matching what buildValidatorPrompt showed it),
// and only the final stored A/B/C/D lettering is randomized. The three
// option TEXTS plus the correct one are shuffled as a unit — the question's
// meaning and every option's wording are untouched, only which letter each
// lands on changes.
function shuffleOptionsFisherYates(data: GeneratedQuestion): GeneratedQuestion {
  const letters: Option[] = ["A", "B", "C", "D"];
  const values = [data.optionA, data.optionB, data.optionC, data.optionD];
  const correctIndex = letters.indexOf(data.correctOption);
  const correctValue = values[correctIndex];

  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  // Exact-string lookup, not normalized — options are guaranteed pairwise
  // distinct by isStructurallyValidGenerated, and this is the same string
  // reference just relocated, so this always resolves to exactly one index.
  const newCorrectIndex = values.indexOf(correctValue);

  return {
    ...data,
    optionA: values[0],
    optionB: values[1],
    optionC: values[2],
    optionD: values[3],
    correctOption: letters[newCorrectIndex],
  };
}

// ─── Structural validation ──────────────────────────────────────────────────

function isStructurallyValidGenerated(
  v: unknown
): { ok: true; data: GeneratedQuestion } | { ok: false; reason: string } {
  if (!v || typeof v !== "object") return { ok: false, reason: "Response was not a JSON object" };
  const t = v as Record<string, unknown>;

  const strFields = ["subject", "topic", "question", "optionA", "optionB", "optionC", "optionD", "explanation"];
  for (const f of strFields) {
    if (typeof t[f] !== "string" || !(t[f] as string).trim()) {
      return { ok: false, reason: `Missing or empty field: ${f}` };
    }
  }

  if (typeof t.correctOption !== "string" || !["A", "B", "C", "D"].includes(t.correctOption)) {
    return { ok: false, reason: "correctOption must be A, B, C, or D" };
  }

  const options = [t.optionA, t.optionB, t.optionC, t.optionD] as string[];
  const uniqueCount = new Set(options.map((o) => normalizeText(o))).size;
  if (uniqueCount !== 4) {
    return { ok: false, reason: "The four options are not all distinct" };
  }

  return {
    ok: true,
    data: {
      subject: (t.subject as string).trim(),
      topic: (t.topic as string).trim(),
      question: (t.question as string).trim(),
      optionA: (t.optionA as string).trim(),
      optionB: (t.optionB as string).trim(),
      optionC: (t.optionC as string).trim(),
      optionD: (t.optionD as string).trim(),
      correctOption: t.correctOption as Option,
      explanation: (t.explanation as string).trim(),
    },
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────

function buildGenerationPrompt(
  cls: number,
  stream: StudentStream | null,
  difficultyLabel: string,
  avoidTopics: string[],
  avoidQuestions: string[],
  previousFailureReason?: string
): string {
  const subjectPool = stream ? STREAM_SUBJECTS[stream] : SUBJECTS;
  const streamLine = stream
    ? `This student is in the ${stream} stream — pick a subject genuinely relevant to a ${stream} student, but keep in mind not every student in the stream studies every subject listed, so favor commonly-studied ones.`
    : "";
  const arts12Line = (cls === 12 && stream === "Arts/Humanities") ? `\n${CLASS_12_ARTS_HUMANITIES_HINT}\n` : "";

  return `You are writing ONE multiple-choice quiz question for the Gloows365 Daily Streak Quiz, for a school student in Class ${cls} in India${stream ? ` (${stream} stream)` : ""}.

Difficulty guidance: ${difficultyLabel}
${streamLine}
${arts12Line}
Pick ONE subject from this list: ${subjectPool.join(", ")}.
Pick a specific topic within that subject, different from all of these recently-used topics for this class${stream ? "/stream" : ""}: ${avoidTopics.length ? avoidTopics.join("; ") : "(none yet)"}.
Do NOT write a question that means the same thing as any of these recent questions, even reworded: ${avoidQuestions.length ? avoidQuestions.map((q) => `"${q}"`).join(" | ") : "(none yet)"}.

Requirements:
- Exactly one clear, unambiguous, factually correct question.
- Exactly four answer options, all plausible, all different from each other, with only one correct.
- Do NOT make two answer options simple logical negations or inversions of each other (e.g. "X is true and Y is false" / "X is false and Y is true" / "X is false and Y is false" as three of the four options — these are just recombinations of one binary claim, not genuinely different options). Each incorrect option must represent a distinct, plausible misconception, alternative interpretation, or same-domain near-miss — never a mechanical negation of the correct answer or of another option.
- Incorrect options must be clearly and unambiguously different from the correct answer under the exact wording of the question — do not use vague, overlapping, approximate, or partially-correct alternatives that could reasonably be interpreted as also correct (e.g. don't offer "Air" as a wrong option when the question specifically asks for "Carbon Dioxide" as one of the inputs to photosynthesis — that's too close to correct). Distractors should be plausible and same-domain, but clearly and unambiguously wrong once read carefully.
- A short (1-2 sentence) factually accurate explanation of the correct answer.
- Age-appropriate and educationally useful for Class ${cls}. Not unnecessarily difficult. No political, religious, violent, or otherwise inappropriate content.
${previousFailureReason ? `\nYour previous attempt was rejected for this reason — do not repeat the mistake: ${previousFailureReason}\n` : ""}
Return ONLY valid JSON, no markdown, no commentary, in exactly this shape:
{"subject":"","topic":"","question":"","optionA":"","optionB":"","optionC":"","optionD":"","correctOption":"A|B|C|D","explanation":""}`;
}

function buildValidatorPrompt(cls: number, stream: StudentStream | null, q: GeneratedQuestion): string {
  return `You are a strict quality reviewer for a Class ${cls}${stream ? ` (${stream} stream)` : ""} Indian school quiz question. Review this question honestly.

Question: ${q.question}
A: ${q.optionA}
B: ${q.optionB}
C: ${q.optionC}
D: ${q.optionD}
Marked correct answer: ${q.correctOption}
Explanation given: ${q.explanation}

Check ALL of the following and report any failures:
1. The question is understandable and unambiguous.
2. It is appropriate in difficulty and content for a Class ${cls} Indian student${stream ? ` in the ${stream} stream` : ""}.
3. It is factually correct.
4. The marked correct answer is actually correct.
5. The explanation is accurate and matches the correct answer.
6. There is no inappropriate, unsafe, political, or offensive content.
7. No two options are simple logical negations/inversions of each other (the same underlying claim with true/false or a qualifier flipped) — each wrong option must be a genuinely distinct, plausible misconception, not a mechanical opposite of another option.
8. Every wrong option is clearly and unambiguously incorrect under the exact wording of the question — none of them is vague, overlapping, or close enough to the correct answer that a careful reader could defend it as also correct.

Return ONLY valid JSON, no markdown: {"valid": true|false, "reasons": ["short reason", ...]}
"reasons" should be an empty array if valid is true.`;
}

// ─── Generation + validation loop ───────────────────────────────────────────

async function generateValidatedQuestion(
  cls: number,
  stream: StudentStream | null,
  avoidTopics: string[],
  avoidQuestions: string[]
): Promise<{ data: GeneratedQuestion; difficulty: DifficultyLevel; generationAttempts: number }> {
  const { label: difficultyLabel, level: difficulty } = CLASS_DIFFICULTY[cls] ?? CLASS_DIFFICULTY[8];
  let lastFailureReason: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const prompt = buildGenerationPrompt(cls, stream, difficultyLabel, avoidTopics, avoidQuestions, lastFailureReason);
      const raw = await callGeminiText(prompt);
      const parsed = parseJsonFromResponse(raw);

      const structural = isStructurallyValidGenerated(parsed);
      if (!structural.ok) {
        lastFailureReason = structural.reason;
        console.warn(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} attempt=${attempt} structural validation failed: ${structural.reason}`);
        continue;
      }

      // Deterministic negation/inversion-pair backstop — cheap, runs before
      // the extra Gemini validator call. buildValidatorPrompt's checks 7/8
      // also judge this semantically, since this heuristic can't catch
      // every phrasing.
      const negationIssue = findNegationOrDuplicateOptionPair([
        structural.data.optionA, structural.data.optionB, structural.data.optionC, structural.data.optionD,
      ]);
      if (negationIssue) {
        lastFailureReason = negationIssue;
        console.warn(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} attempt=${attempt} negation/duplicate option pair: ${negationIssue}`);
        continue;
      }

      const dupMatch = findDuplicateMatch(structural.data.question, avoidQuestions);
      if (dupMatch) {
        lastFailureReason = `Too similar to a recently-used question: "${dupMatch}"`;
        console.warn(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} attempt=${attempt} duplicate match: "${dupMatch}"`);
        continue;
      }

      const validatorRaw = await callGeminiText(buildValidatorPrompt(cls, stream, structural.data));
      const verdict = parseJsonFromResponse(validatorRaw) as { valid?: boolean; reasons?: string[] };
      if (!verdict?.valid) {
        lastFailureReason = (verdict?.reasons ?? ["Failed semantic validation"]).join("; ");
        console.warn(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} attempt=${attempt} semantic validation failed: ${lastFailureReason}`);
        continue;
      }

      return { data: structural.data, difficulty, generationAttempts: attempt };
    } catch (err) {
      lastFailureReason = err instanceof Error ? err.message : String(err);
      console.warn(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} attempt=${attempt} error: ${lastFailureReason}`);
    }
  }

  throw new Error(`Failed after ${MAX_ATTEMPTS} attempts — last reason: ${lastFailureReason ?? "unknown"}`);
}

// ─── Recent-question context (variety + duplicate avoidance) ───────────────
// class (==) + publishDate (range) needs a composite index — added to
// firestore.indexes.json (class ASC, publishDate ASC). Adding stream (==)
// when set needs a second composite index (class ASC, stream ASC,
// publishDate ASC) — also added there. Deploy both with
// `firebase deploy --only firestore:indexes`.
//
// Scoped by stream when the slot has one, so e.g. Class 11 Science's
// question history is tracked entirely separately from Class 11 Commerce —
// each stream gets its own 30-day dedup/variety window.

async function getRecentQuestionContext(
  cls: number,
  stream: StudentStream | null,
  date: string
): Promise<{ topics: string[]; questions: string[] }> {
  const fromDate = dateOffsetIST(date, -LOOKBACK_DAYS);
  let query = db.collection("dailyStreakQuizQuestions")
    .where("class", "==", cls)
    .where("publishDate", ">=", fromDate)
    .where("publishDate", "<", date);
  if (stream) query = query.where("stream", "==", stream);

  const snap = await query.limit(60).get();

  const topics: string[] = [];
  const questions: string[] = [];
  snap.docs.forEach((d) => {
    const q = d.data() as { question?: string; topic?: string; subject?: string };
    if (q.question) questions.push(q.question);
    const topic = q.topic ?? q.subject;
    if (topic) topics.push(topic);
  });
  return { topics, questions };
}

// If some other active question already exists for this exact class+stream+
// date slot (e.g. an admin-authored doc with a different random ID) once
// we've published ours, deactivate it so "quizDate + class + stream" keeps
// resolving to exactly one active question, regardless of authorship mix.
//
// When stream is set (11/12), this is deliberately scoped to that exact
// stream — never touches a legacy stream-less question or a different
// stream's question for the same class+date; those are different slots by
// design (see this file's header). When stream is null (6–10), there is
// only ever one slot for that class+date to begin with, so — mirroring the
// pre-check above — this intentionally does NOT filter by stream, so it
// still recognizes and supersedes a legacy doc whose `stream` field is
// absent entirely, not just one explicitly set to null.
async function deactivateOtherActiveQuestions(
  cls: number,
  stream: StudentStream | null,
  date: string,
  keepDocId: string
): Promise<void> {
  let query = db.collection("dailyStreakQuizQuestions")
    .where("status", "==", "active")
    .where("class", "==", cls)
    .where("language", "==", "English")
    .where("publishDate", "==", date);
  if (stream) query = query.where("stream", "==", stream);

  const snap = await query.get();

  const stale = snap.docs.filter((d) => d.id !== keepDocId);
  if (stale.length === 0) return;

  const batch = db.batch();
  stale.forEach((d) => batch.set(d.ref, {
    status: "inactive",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }));
  await batch.commit();

  console.log(`dailyStreakQuizGeneration: deactivated ${stale.length} stale active question(s) for class=${cls} stream=${stream ?? "-"} date=${date} in favor of ${keepDocId}`);
}

// ─── ensureQuestionGenerated ────────────────────────────────────────────────

async function ensureQuestionGenerated(
  cls: number,
  stream: StudentStream | null,
  date: string,
  opts?: { force?: boolean }
): Promise<EnsureResult> {
  const force = opts?.force ?? false;
  const docRef = db.collection("dailyStreakQuizQuestions").doc(questionDocId(cls, stream, date));

  if (!force) {
    // Pre-check is intentionally NOT stream-scoped when stream is null —
    // classes 6–10's idempotency check is byte-for-byte what it was before
    // streams existed, so it still recognizes a legacy no-stream doc as
    // "already covered" exactly as before. Stream-specific slots (11/12)
    // scope the check to that exact stream, per the slot model above.
    let existingQuery = db.collection("dailyStreakQuizQuestions")
      .where("status", "==", "active")
      .where("class", "==", cls)
      .where("language", "==", "English")
      .where("publishDate", "==", date);
    if (stream) existingQuery = existingQuery.where("stream", "==", stream);

    const existing = await existingQuery.limit(1).get();
    if (!existing.empty) {
      console.log(`dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} date=${date} already has an active question (id=${existing.docs[0].id}) — skipping`);
      return { status: "already-active" };
    }
  }

  // Claim the slot so two concurrent/retried runs never both call Gemini
  // for the same class+stream+date — same idea as getOrTranslateQuestion's
  // transaction-claim lock in dailyStreakQuiz.ts.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists && !force && snap.data()?.generationStatus === "generating") {
      return "in-progress" as const;
    }
    tx.set(docRef, {
      class: cls,
      stream: stream ?? null,
      publishDate: date,
      language: "English",
      status: snap.exists ? (snap.data()?.status ?? "inactive") : "inactive",
      generationStatus: "generating",
      generatedBy: "ai",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return "claimed" as const;
  });

  if (claim === "in-progress") {
    return { status: "failed", reason: "Already being generated by another run" };
  }

  try {
    const { topics, questions } = await getRecentQuestionContext(cls, stream, date);
    const { data: validatedData, difficulty, generationAttempts } = await generateValidatedQuestion(cls, stream, topics, questions);

    // Shuffle AFTER both validation passes (structural + semantic), right
    // before storage — validation always judges the question in the exact
    // shape Gemini produced (matching what buildValidatorPrompt showed it);
    // only the final stored A/B/C/D lettering is randomized. See
    // shuffleOptionsFisherYates's header for why this isn't left to Gemini.
    const data = shuffleOptionsFisherYates(validatedData);

    await docRef.set({
      ...data,
      class: cls,
      stream: stream ?? null,
      publishDate: date,
      language: "English",
      status: "active",
      difficulty,
      generatedBy: "ai",
      generationStatus: "success",
      validationStatus: "validated",
      generationAttempts,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await deactivateOtherActiveQuestions(cls, stream, date, docRef.id);

    console.log(`✅ dailyStreakQuizGeneration: class=${cls} stream=${stream ?? "-"} date=${date} published (id=${docRef.id}, topic="${data.topic}")`);
    return { status: "success" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`❌ dailyStreakQuizGeneration failed: class=${cls} stream=${stream ?? "-"} date=${date}: ${reason}`);
    await docRef.set({
      generationStatus: "failed",
      validationStatus: "failed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    return { status: "failed", reason };
  }
}

// ─── generateDailyStreakQuizQuestions (scheduled) ───────────────────────────
// Runs after the existing 18:00 IST dailyStreakQuizReminder (dailyStreakQuiz.ts)
// so the two never race on the same Firestore paths. 11 slots/day × 2
// buffer days = 22 ensureQuestionGenerated calls per run, most of which
// no-op (already-active) on any given day.

export const generateDailyStreakQuizQuestions = onSchedule(
  {
    schedule: "0 15 * * *", // 15:00 UTC = 20:30 IST
    timeZone: "Asia/Kolkata",
    memory: "512MiB",
    timeoutSeconds: 540,
    secrets: ["GEMINI_API_KEY"],
  },
  async (_event) => {
    const today = todayIST();
    const dates = BUFFER_DAYS.map((offset) => dateOffsetIST(today, offset));
    const slots = buildDailySlots();

    for (const date of dates) {
      for (const slot of slots) {
        try {
          await ensureQuestionGenerated(slot.class, slot.stream, date);
        } catch (err) {
          // ensureQuestionGenerated already catches and logs generation
          // failures internally (writes generationStatus:"failed") — this
          // outer catch only guards against something escaping that (e.g.
          // the idempotency pre-check query itself throwing), so one
          // slot/date can never abort the rest of the batch.
          console.error(`dailyStreakQuizGeneration: unexpected error class=${slot.class} stream=${slot.stream ?? "-"} date=${date}:`, err);
        }
      }
    }
  }
);

// ─── regenerateDailyStreakQuizQuestion (admin-only manual trigger) ─────────

export const regenerateDailyStreakQuizQuestion = functionsV1
  .runWith({ timeoutSeconds: 120, memory: "512MB", secrets: ["GEMINI_API_KEY"] })
  .https.onCall(async (data: { class?: number; date?: string; stream?: string | null }, context) => {
    if (!context.auth || context.auth.token.admin !== true) {
      throw new functionsV1.https.HttpsError("permission-denied", "Admin access required");
    }

    const cls = Number(data?.class);
    const date = data?.date;
    if (!cls || !ALL_CLASSES.includes(cls) || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new functionsV1.https.HttpsError("invalid-argument", "Missing or invalid class/date");
    }

    const rawStream = data?.stream ?? null;
    let stream: StudentStream | null = null;
    if (STREAM_CLASSES.includes(cls)) {
      if (!rawStream || !STREAMS.includes(rawStream as StudentStream)) {
        throw new functionsV1.https.HttpsError("invalid-argument", "Class 11/12 requires a valid stream (Science, Commerce, or Arts/Humanities)");
      }
      stream = rawStream as StudentStream;
    } else if (rawStream) {
      throw new functionsV1.https.HttpsError("invalid-argument", "Classes 6–10 do not have a stream");
    }

    const result = await ensureQuestionGenerated(cls, stream, date, { force: true });
    if (result.status === "failed") {
      throw new functionsV1.https.HttpsError("internal", result.reason ?? "Generation failed");
    }
    return { success: true, status: result.status };
  });

// ─── Test-only exports ──────────────────────────────────────────────────────
// Pure, deterministic helpers — exported so they can be unit-tested (and
// were, directly, for the negation-pair detector and the shuffle) without
// needing a live Firestore/Gemini round-trip. No behavior change; nothing
// here is called differently by the exported Cloud Functions above.
export {
  normalizeText,
  jaccardSimilarity,
  findDuplicateMatch,
  findNegationOrDuplicateOptionPair,
  shuffleOptionsFisherYates,
  isStructurallyValidGenerated,
};
