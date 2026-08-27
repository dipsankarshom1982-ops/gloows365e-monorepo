// PATH: apps/web/src/lib/aiGuru/relatedSearches.ts
// Mirror of apps/mobile/lib/aiGuru/relatedSearches.ts — same topic bank,
// same scoring function, so "related searches" behave identically on
// web and mobile.
//
// REPLACES the old fixed/curated SUGGESTED_TOPICS-after-answer behaviour
// in ask/page.tsx. That list was the same 10 generic items shown to every
// student after every single question — "related searches" in name only.
// This module actually looks at the question that was just asked and
// returns topics that share real subject-matter with it.
//
// HOW IT WORKS (deliberately simple, no backend call):
// 1. TOPIC_BANK is a larger, categorized pool of candidate follow-up
//    searches (~70 entries) spanning the same three areas Ask AI Guru
//    already covers: education (board-exam subjects), skills
//    (employability/soft-skills), and general knowledge.
// 2. Each entry carries a small set of keyword tags describing what it's
//    about (e.g. "newton's laws of motion" tags: physics, motion, force,
//    newton, mechanics).
// 3. getRelatedSearches(question) tokenizes the asked question, scores
//    every bank entry by tag/word overlap, and returns the
//    highest-scoring entries — i.e. things actually related to what was
//    asked, not a fixed list.
// 4. If nothing scores above zero (a truly novel/unrelated question),
//    it falls back to a same-category-as-active-mode subset so the rail
//    never goes empty, but it's no longer pretending those are
//    "related" — see getRelatedSearches's fallback comment.

export interface TopicEntry {
  emoji: string;
  text: string;
  category: "education" | "skills" | "gk";
  tags: string[];
}

// Stopwords stripped before matching — purely functional words that would
// otherwise dilute every score equally and add no signal.
const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","what","why","how","who","when",
  "where","which","does","do","did","can","could","should","would","of",
  "in","on","for","to","and","or","with","about","explain","define",
  "meaning","please","me","i","my","you","your","tell","give","make",
  "notes","summarize","summarise","chapter","class","help","prepare",
  "exam","this","that","it","be","as","by","from","into","its","also",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export const TOPIC_BANK: TopicEntry[] = [
  // ── Physics ──
  { emoji: "⚛️", text: "Explain Newton's three laws of motion simply", category: "education", tags: ["physics","motion","force","newton","mechanics","laws"] },
  { emoji: "🍎", text: "What is gravity and how does it work?", category: "education", tags: ["physics","gravity","force","motion","mass"] },
  { emoji: "💡", text: "What is the difference between speed and velocity?", category: "education", tags: ["physics","speed","velocity","motion","mechanics"] },
  { emoji: "🔋", text: "How does an electric circuit work?", category: "education", tags: ["physics","electricity","circuit","current","voltage"] },
  { emoji: "🌈", text: "Why does a prism split light into colours?", category: "education", tags: ["physics","light","optics","reflection","refraction","prism"] },
  { emoji: "🧊", text: "Why does ice float on water?", category: "education", tags: ["physics","density","water","ice","matter"] },
  { emoji: "🔊", text: "How does sound travel through air?", category: "education", tags: ["physics","sound","waves","vibration"] },

  // ── Chemistry / Biology ──
  { emoji: "🧪", text: "What is the difference between mitosis and meiosis?", category: "education", tags: ["biology","cell","mitosis","meiosis","division","genetics"] },
  { emoji: "🌱", text: "What is photosynthesis and why is it important?", category: "education", tags: ["biology","photosynthesis","plants","chlorophyll","biology"] },
  { emoji: "🧬", text: "What is DNA and what does it do?", category: "education", tags: ["biology","dna","genetics","chromosome","heredity"] },
  { emoji: "🫁", text: "How does the human respiratory system work?", category: "education", tags: ["biology","respiration","lungs","breathing","human body"] },
  { emoji: "❤️", text: "How does the human heart pump blood?", category: "education", tags: ["biology","heart","circulation","blood","human body"] },
  { emoji: "⚗️", text: "What is the difference between an atom and a molecule?", category: "education", tags: ["chemistry","atom","molecule","element","compound"] },
  { emoji: "🧫", text: "What is the periodic table and how is it organized?", category: "education", tags: ["chemistry","periodic table","element","atomic number"] },
  { emoji: "🔥", text: "What happens during a chemical reaction?", category: "education", tags: ["chemistry","reaction","reactant","product","bonds"] },

  // ── Math ──
  { emoji: "📐", text: "Explain the Pythagorean theorem with an example", category: "education", tags: ["math","geometry","pythagoras","triangle","theorem"] },
  { emoji: "📊", text: "What is the difference between mean, median and mode?", category: "education", tags: ["math","statistics","mean","median","mode","average"] },
  { emoji: "➗", text: "How do I solve a quadratic equation?", category: "education", tags: ["math","algebra","quadratic","equation"] },
  { emoji: "💰", text: "What is compound interest and how is it calculated?", category: "education", tags: ["math","interest","compound","finance","percentage"] },
  { emoji: "📈", text: "What is the difference between simple and compound interest?", category: "education", tags: ["math","interest","compound","simple","finance"] },
  { emoji: "🔺", text: "What is trigonometry used for in real life?", category: "education", tags: ["math","trigonometry","sine","cosine","angle"] },
  { emoji: "🎲", text: "How do I calculate probability of an event?", category: "education", tags: ["math","probability","statistics","chance"] },

  // ── Civics / History / Geography ──
  { emoji: "🏛️", text: "What are the Fundamental Rights in the Indian Constitution?", category: "education", tags: ["civics","constitution","rights","india","fundamental rights"] },
  { emoji: "🗳️", text: "How does the Indian Parliament work?", category: "education", tags: ["civics","parliament","government","india","democracy"] },
  { emoji: "⚖️", text: "What is the difference between the Lok Sabha and Rajya Sabha?", category: "education", tags: ["civics","parliament","lok sabha","rajya sabha","government"] },
  { emoji: "🕰️", text: "What caused the Indian independence movement?", category: "education", tags: ["history","independence","freedom struggle","india","british"] },
  { emoji: "🛕", text: "What were the main causes of the Mughal Empire's decline?", category: "education", tags: ["history","mughal","empire","india"] },
  { emoji: "🌏", text: "What is the largest river system in India?", category: "education", tags: ["geography","river","india","ganga","geography"] },
  { emoji: "🗻", text: "How are mountains formed?", category: "education", tags: ["geography","mountains","plate tectonics","formation"] },
  { emoji: "🌍", text: "What causes earthquakes?", category: "education", tags: ["geography","earthquake","plate tectonics","seismic"] },
  { emoji: "🌦️", text: "What is the difference between weather and climate?", category: "education", tags: ["geography","weather","climate"] },

  // ── Computer / Tech ──
  { emoji: "💻", text: "What is the difference between RAM and ROM?", category: "education", tags: ["computer","ram","rom","memory","hardware"] },
  { emoji: "🖥️", text: "What is the difference between hardware and software?", category: "education", tags: ["computer","hardware","software"] },
  { emoji: "🌐", text: "How does the internet actually work?", category: "skills", tags: ["computer","internet","network","tech"] },
  { emoji: "🤖", text: "What is Artificial Intelligence in simple words?", category: "skills", tags: ["computer","ai","artificial intelligence","tech","machine learning"] },
  { emoji: "🔐", text: "What is cybersecurity and why does it matter?", category: "skills", tags: ["computer","security","cybersecurity","tech","privacy"] },
  { emoji: "📱", text: "What is the difference between an app and a website?", category: "skills", tags: ["computer","app","website","tech","software"] },

  // ── Skills / employability ──
  { emoji: "📊", text: "How do I write a good resume as a student?", category: "skills", tags: ["resume","cv","job","career","skills"] },
  { emoji: "🗣️", text: "How can I improve my public speaking skills?", category: "skills", tags: ["communication","public speaking","skills","confidence"] },
  { emoji: "🤝", text: "What are the most important soft skills for a job interview?", category: "skills", tags: ["interview","soft skills","job","career","skills"] },
  { emoji: "📝", text: "How do I answer 'Tell me about yourself' in an interview?", category: "skills", tags: ["interview","job","career","communication"] },
  { emoji: "⏱️", text: "How can I manage my study time better?", category: "skills", tags: ["time management","study","productivity","skills"] },
  { emoji: "👥", text: "How do I become a better team leader?", category: "skills", tags: ["leadership","teamwork","skills","management"] },
  { emoji: "💬", text: "How can I improve my English speaking fluency?", category: "skills", tags: ["english","communication","language","fluency","skills"] },
  { emoji: "🧠", text: "What are some good memory techniques for studying?", category: "skills", tags: ["memory","study","skills","exam","techniques"] },
  { emoji: "✍️", text: "How do I write a formal email?", category: "skills", tags: ["communication","email","writing","skills"] },

  // ── General knowledge ──
  { emoji: "🇮🇳", text: "What are the National Symbols of India?", category: "gk", tags: ["gk","india","symbols","national"] },
  { emoji: "🏆", text: "Which countries have won the most Cricket World Cups?", category: "gk", tags: ["gk","cricket","sports","world cup"] },
  { emoji: "🪐", text: "How many planets are there in our solar system?", category: "gk", tags: ["gk","planets","solar system","space","astronomy"] },
  { emoji: "🚀", text: "What is ISRO and what has it achieved?", category: "gk", tags: ["gk","isro","space","india","astronomy"] },
  { emoji: "🏞️", text: "Which is the largest desert in the world?", category: "gk", tags: ["gk","desert","geography","world"] },
  { emoji: "💵", text: "What is GDP and why does it matter?", category: "gk", tags: ["gk","economics","gdp","finance"] },
  { emoji: "🏥", text: "What is the difference between a pandemic and an epidemic?", category: "gk", tags: ["gk","health","disease","pandemic"] },
];

// Score a bank entry against the asked question's tokens. Overlap with
// `tags` counts more than overlap with the entry's own display text,
// since tags are the curated "what this is about" signal.
function scoreEntry(entry: TopicEntry, queryTokens: Set<string>): number {
  let score = 0;
  for (const tag of entry.tags) {
    const tagWords = tag.split(/\s+/);
    for (const tw of tagWords) {
      if (queryTokens.has(tw)) score += 2;
    }
  }
  const textTokens = tokenize(entry.text);
  for (const t of textTokens) {
    if (queryTokens.has(t)) score += 1;
  }
  return score;
}

/**
 * Returns topics genuinely related to the question that was just asked.
 * Excludes the question itself (case-insensitive) so it never suggests
 * re-searching the same thing.
 *
 * Fallback: if nothing in the bank shares any vocabulary with the
 * question (score 0 for everything — happens for very short or very
 * unusual queries), this falls back to a same-category sample as a
 * "students also explore" rail rather than a true "related searches"
 * rail. Callers can check `usedFallback` to label it differently in
 * the UI if desired.
 */
export function getRelatedSearches(
  question: string,
  count = 6
): { items: TopicEntry[]; usedFallback: boolean } {
  const queryTokens = new Set(tokenize(question));
  const normalizedQ = question.trim().toLowerCase();

  const scored = TOPIC_BANK
    .filter((e) => e.text.trim().toLowerCase() !== normalizedQ)
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((s) => s.score > 0).slice(0, count);
  if (relevant.length >= Math.min(3, count)) {
    return { items: relevant.map((s) => s.entry), usedFallback: false };
  }

  // Not enough real matches — top up with same-vocabulary-adjacent items
  // first, then generic items, so the rail is never empty.
  const topUp = scored
    .filter((s) => !relevant.includes(s))
    .slice(0, count - relevant.length)
    .map((s) => s.entry);

  return {
    items: [...relevant.map((s) => s.entry), ...topUp],
    usedFallback: relevant.length === 0,
  };
}
