// ─── Request / Input ──────────────────────────────────────────────────────────

export interface DiscoverSearchPayload {
  query: string;
  language?: string;
  studentName?: string;
  classLevel?: string | number;
  interests?: string[];
}

// ─── Sub-shapes ───────────────────────────────────────────────────────────────

export interface SalaryRange {
  min: number;
  max: number;
  currency: "INR";
}

export interface SalaryBar {
  role: string;
  minLPA: number;
  maxLPA: number;
  color: string;
}

export interface CareerCard {
  title: string;
  emoji: string;
  domain: string;
  salaryRange: SalaryRange;
  demandLevel: "low" | "medium" | "high" | "very_high";
  futureDemand: number;
  description: string;
}

export interface Skill {
  name: string;
  category: "technical" | "soft" | "domain";
  importance: "must_have" | "good_to_have";
}

export interface LearningStep {
  step: number;
  title: string;
  description: string;
  durationMonths: number;
  resources: string[];
}

export interface CollegeSuggestion {
  name: string;
  location: string;
  type: "IIT" | "NIT" | "Central" | "State" | "Private" | "Deemed";
  course: string;
  entranceExam: string;
  approxFeePerYear: string;
  website?: string;
  snippet?: string;
}

export interface ScholarshipSuggestion {
  name: string;
  amount: string;
  eligibility: string;
  lastDate?: string;
  applyUrl?: string;
  snippet?: string;
}

// ─── Main result ──────────────────────────────────────────────────────────────

export interface DiscoverResult {
  queryHash: string;
  query: string;
  language: string;
  generatedAt: number;
  aiSummary: string;
  careerScope: CareerCard;
  salaryBars: SalaryBar[];
  requiredSkills: Skill[];
  learningPath: LearningStep[];
  collegeSuggestions: CollegeSuggestion[];
  scholarshipSuggestions: ScholarshipSuggestion[];
  mentorAdvice: string;
  futureDemandScore: number;
  nextActionSteps: string[];
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface DiscoverSearchResponse {
  result: DiscoverResult;
  fromCache: boolean;
  remainingSearches: number | null;
}

export interface TrendingTerm {
  term: string;
  score: number;
}

export interface DiscoverTrendingResponse {
  terms: TrendingTerm[];
}

// ─── Store shapes ─────────────────────────────────────────────────────────────

export interface DiscoverHistoryItem {
  query: string;
  queryHash: string;
  searchedAt: number;
}

export interface SavedCareer {
  careerId: string;
  query: string;
  title: string;
  emoji: string;
  savedAt: number;
}

// ─── UI section cards ─────────────────────────────────────────────────────────

export interface DiscoverSectionCard {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  query: string;
}

export interface DiscoverSection {
  sectionId: string;
  title: string;
  emoji: string;
  cards: DiscoverSectionCard[];
}
