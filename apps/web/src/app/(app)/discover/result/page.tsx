"use client";
// PATH: apps/web/src/app/(app)/discover/result/page.tsx
// Discover Result — mirror of mobile app/discover/result.tsx
// AI summary, career scope, salary bars, skills, learning path, colleges,
// scholarships, mentor advice, demand meter, next action steps.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudentProfile } from "@gloows/shared-logic";
import { useAppConfig } from "@/context/AppConfigContext";
import { useDiscoverStore } from "@/store/discoverStore";
import { searchDiscover } from "@/services/discoverApi";
import type { DiscoverResult, SalaryBar } from "@/lib/discover/types";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).slice(0, 16).padStart(16, "0");
}

function collegeBadgeColor(type: string): string {
  const map: Record<string, string> = { IIT: "#854d0e", NIT: "#1e3a5f", Central: "#1a4731", State: "#064e3b", Private: "#4c1d95", Deemed: "#1e293b" };
  return map[type] ?? "#1e293b";
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function SalaryBarsChart({ bars }: { bars: SalaryBar[] }) {
  const MAX_LPA = 80;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bars.map((bar) => (
        <div key={bar.role} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>{bar.role}</span>
          <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${Math.min((bar.maxLPA / MAX_LPA) * 100, 100)}%`, height: "100%", background: bar.color, borderRadius: 5 }} />
          </div>
          <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>₹{bar.minLPA}–{bar.maxLPA}L</span>
        </div>
      ))}
    </div>
  );
}

function DemandMeter({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "High Future Demand" : score >= 40 ? "Moderate Demand" : "Stable Demand";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ height: 14, background: "rgba(255,255,255,0.08)", borderRadius: 7, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 7, transition: "width 1.2s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span style={{ color, fontSize: 13, fontWeight: 900 }}>{score}/100</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`@keyframes drpulse{0%,100%{opacity:.3}50%{opacity:.8}}`}</style>
      {[120, 100, 160, 80, 200, 140].map((h, i) => (
        <div key={i} style={{ width: "100%", height: h, borderRadius: 16, background: "rgba(99,102,241,0.25)", animation: "drpulse 1.4s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

function DiscoverResultContent() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("query") ?? "";
  const { studentProfile } = useStudentProfile();
  const { addSearch, addResult, saveCareer, unsaveCareer, isCareerSaved, getCachedResult, setRemaining } = useDiscoverStore();
  // FIX (launch audit, Task 3) — the paywall CTA used to hardcode "₹199/month",
  // a value sourced from nowhere (not subscriptionPlans, not AppConfigContext),
  // while /discover/subscription itself renders real Firestore-driven prices.
  // If an admin ever changes the Discover plan price, this button would lie.
  const { plans } = useAppConfig();
  const discoverPlan = plans.find((p) => p.module === "discover" && p.highlight)
    ?? plans.find((p) => p.module === "discover");

  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!query) return;

    const queryHash = simpleHash(query);
    const cached = getCachedResult(queryHash);
    if (cached) {
      setResult(cached);
      setLoading(false);
      setSaved(isCareerSaved(queryHash));
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { result: r, remainingSearches } = await searchDiscover({
          query,
          language: studentProfile?.preferredLanguage ?? "English",
          studentName: studentProfile?.name ?? "Student",
          classLevel: studentProfile?.class ?? "10",
          interests: studentProfile?.interests ?? [],
        });
        setResult(r);
        setSaved(isCareerSaved(r.queryHash));
        addResult(r);
        addSearch(query, r.queryHash);
        setRemaining(remainingSearches);
      } catch (err: any) {
        setError({ message: err?.message ?? "Search failed", code: err?.code });
      } finally {
        setLoading(false);
      }
    })();
  }, [query]);

  function toggleSave() {
    if (!result) return;
    if (saved) {
      unsaveCareer(result.queryHash);
      setSaved(false);
    } else {
      saveCareer({ careerId: result.queryHash, query: result.query, title: result.careerScope?.title ?? result.query, emoji: result.careerScope?.emoji ?? "🧭", savedAt: Date.now() });
      setSaved(true);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#030712" }}>
      <style>{`.dr-btn{cursor:pointer;border:none;background:none}.dr-btn:hover{opacity:.88}`}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px", gap: 8, maxWidth: 700, margin: "0 auto" }}>
        <button className="dr-btn" onClick={() => router.back()} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22 }}>‹</button>
        <span style={{ flex: 1, color: "#fff", fontSize: 15, fontWeight: 700, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{query}</span>
        <div style={{ width: 40 }} />
      </div>

      {loading && <LoadingSkeleton />}

      {!loading && error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: "60vh" }}>
          {(error.code === "CREDITS_EXHAUSTED" || error.code === "FREE_LIMIT_REACHED") ? (
            <div style={{ borderRadius: 20, padding: 28, textAlign: "center", width: "100%", maxWidth: 380, background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔒</div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Daily Limit Reached</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 20 }}>{error.message}</div>
              <button
                className="dr-btn"
                // Discover draws from the same shared AI Guru credit pool as
                // every other feature (functions/src/discover.ts's
                // checkDiscoverLimit calls tryDebitAiGuruCredit(..,
                // "DISCOVER", ..) once the free limit is hit) — buying
                // credits there unlocks Discover too, so CREDITS_EXHAUSTED
                // routes there. FREE_LIMIT_REACHED (the common path — the
                // first paywall any free user hits) routes to
                // /discover/subscription, which now correctly calls
                // aiGuruCreateSubscription (fixed in the launch audit's
                // Task 3 — it used to call a Cloud Function that was never
                // written, making this the default dead end for every free
                // web user).
                onClick={() => router.push(error.code === "CREDITS_EXHAUSTED" ? "/ai-guru/credits" : "/discover/subscription")}
                style={{ width: "100%", borderRadius: 14, overflow: "hidden", padding: 0 }}
              >
                <div style={{ padding: "14px 0", background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }}>
                  <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>
                    {error.code === "CREDITS_EXHAUSTED"
                      ? "⚡ Buy Credits"
                      : discoverPlan
                        ? `Unlock Premium — ₹${discoverPlan.monthlyPrice}/month`
                        : "Unlock Premium"}
                  </span>
                </div>
              </button>
              <button className="dr-btn" onClick={() => router.back()} style={{ marginTop: 12, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>← Go back</button>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Search failed</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 20 }}>{error.message}</div>
              <button className="dr-btn" onClick={() => router.back()} style={{ padding: "12px 28px", background: "rgba(99,102,241,0.25)", borderRadius: 12, color: "#a5b4fc", fontSize: 14, fontWeight: 700 }}>← Try again</button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && result && (
        <div style={{ position: "relative" }}>
          <div style={{ padding: "4px 16px", maxWidth: 700, margin: "0 auto" }}>

            {/* 1. AI Summary */}
            <div style={{ borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid rgba(99,102,241,0.2)", background: "linear-gradient(135deg,#0f172a,#1e1b4b)" }}>
              <div style={{ background: "rgba(99,102,241,0.25)", alignSelf: "flex-start", display: "inline-block", padding: "4px 10px", borderRadius: 20, marginBottom: 12, border: "1px solid rgba(139,92,246,0.35)" }}>
                <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>✨ AI Discovery</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, lineHeight: 1.6, fontWeight: 500 }}>{result.aiSummary}</div>
            </div>

            {/* 2. Career Scope */}
            {result.careerScope && (
              <Section title="Career Scope" emoji="🎯">
                <div style={{ borderRadius: 16, padding: 18, border: "1px solid rgba(99,102,241,0.2)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 40 }}>{result.careerScope.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#fff", fontSize: 20, fontWeight: 900, marginBottom: 6 }}>{result.careerScope.title}</div>
                      <div style={{ background: "rgba(99,102,241,0.2)", display: "inline-block", padding: "3px 10px", borderRadius: 12 }}>
                        <span style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 700 }}>{result.careerScope.domain}</span>
                      </div>
                    </div>
                    <div style={{
                      padding: "5px 10px", borderRadius: 10, flexShrink: 0,
                      background: (result.futureDemandScore >= 70 ? "#10b981" : result.futureDemandScore >= 40 ? "#f59e0b" : "#ef4444") + "25",
                      border: `1px solid ${(result.futureDemandScore >= 70 ? "#10b981" : result.futureDemandScore >= 40 ? "#f59e0b" : "#ef4444")}66`,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: result.futureDemandScore >= 70 ? "#10b981" : result.futureDemandScore >= 40 ? "#f59e0b" : "#ef4444" }}>
                        {result.careerScope.demandLevel?.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.55 }}>{result.careerScope.description}</div>
                </div>
              </Section>
            )}

            {/* 3. Salary Insights */}
            {result.salaryBars?.length > 0 && (
              <Section title="Salary Insights" emoji="💰">
                <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                  <SalaryBarsChart bars={result.salaryBars} />
                </div>
              </Section>
            )}

            {/* 4. Required Skills */}
            {result.requiredSkills?.length > 0 && (
              <Section title="Required Skills" emoji="⚡">
                <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                  {(["technical", "soft", "domain"] as const).map((cat) => {
                    const skills = result.requiredSkills.filter((s) => s.category === cat);
                    if (!skills.length) return null;
                    return (
                      <div key={cat} style={{ marginBottom: 14 }}>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" }}>
                          {cat === "technical" ? "🔧 Technical" : cat === "soft" ? "🤝 Soft Skills" : "📚 Domain"}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {skills.map((sk) => (
                            <div key={sk.name} style={{
                              padding: "6px 12px", borderRadius: 20,
                              border: `1px solid ${sk.importance === "must_have" ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.2)"}`,
                              background: sk.importance === "must_have" ? "rgba(99,102,241,0.25)" : "transparent",
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: sk.importance === "must_have" ? "#a5b4fc" : "rgba(255,255,255,0.55)" }}>{sk.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* 5. Learning Path */}
            {result.learningPath?.length > 0 && (
              <Section title="Learning Path" emoji="🗺️">
                <div>
                  {result.learningPath.map((step, idx) => (
                    <div key={step.step} style={{ display: "flex", gap: 12 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", zIndex: 1, flexShrink: 0 }}>
                          <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>{step.step}</span>
                        </div>
                        {idx < result.learningPath.length - 1 && <div style={{ width: 2, flex: 1, background: "rgba(99,102,241,0.3)", minHeight: 16, margin: "4px 0" }} />}
                      </div>
                      <div style={{ flex: 1, borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                        <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{step.title}</div>
                        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.55, marginBottom: 10 }}>{step.description}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(99,102,241,0.15)", padding: "3px 8px", borderRadius: 10 }}>
                            <span style={{ color: "#6366f1", fontSize: 11, fontWeight: 700 }}>⏱ {step.durationMonths} months</span>
                          </div>
                          {step.resources?.slice(0, 2).map((r) => (
                            <div key={r} style={{ background: "rgba(255,255,255,0.07)", padding: "3px 8px", borderRadius: 10 }}>
                              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140, display: "inline-block" }}>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 6. College Suggestions */}
            {result.collegeSuggestions?.length > 0 && (
              <Section title="College Suggestions" emoji="🏫">
                <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                  {result.collegeSuggestions.map((c, i) => (
                    <div key={i} style={{ width: 180, flexShrink: 0, borderRadius: 16, padding: 14, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                      <div style={{ display: "inline-block", padding: "3px 8px", borderRadius: 8, marginBottom: 8, background: collegeBadgeColor(c.type) }}>
                        <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>{c.type}</span>
                      </div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, marginBottom: 4, lineHeight: 1.3 }}>{c.name}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>📍 {c.location}</div>
                      <div style={{ color: "#a5b4fc", fontSize: 11, fontWeight: 600, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.course}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>{c.entranceExam}</span>
                        <span style={{ color: "#4ade80", fontSize: 10, fontWeight: 700 }}>{c.approxFeePerYear}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 7. Scholarship Suggestions */}
            {result.scholarshipSuggestions?.length > 0 && (
              <Section title="Scholarships" emoji="🎓">
                <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                  {result.scholarshipSuggestions.map((s, i) => (
                    <div key={i} style={{ width: 200, flexShrink: 0, borderRadius: 16, padding: 14, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                      <div style={{ color: "#4ade80", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>{s.amount}</div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>{s.name}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, lineHeight: 1.4, marginBottom: 6 }}>{s.eligibility}</div>
                      {s.lastDate && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 8 }}>📅 {s.lastDate}</div>}
                      {s.applyUrl && (
                        <a href={s.applyUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", background: "rgba(99,102,241,0.25)", padding: "7px 0", borderRadius: 10, border: "1px solid rgba(99,102,241,0.4)", textDecoration: "none" }}>
                          <span style={{ color: "#a5b4fc", fontSize: 12, fontWeight: 800 }}>Apply →</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 8. AI Mentor Advice */}
            {result.mentorAdvice && (
              <Section title="AI Mentor Advice" emoji="🧑‍🏫">
                <div style={{ borderRadius: 16, padding: 22, border: "1px solid rgba(139,92,246,0.3)", background: "linear-gradient(135deg,#1a0a2e,#4a1259)", position: "relative" }}>
                  <span style={{ color: "rgba(168,85,247,0.4)", fontSize: 60, fontWeight: 900, display: "block", lineHeight: 1 }}>&ldquo;</span>
                  <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 1.7, fontStyle: "italic", fontWeight: 500 }}>{result.mentorAdvice}</div>
                  <span style={{ color: "rgba(168,85,247,0.4)", fontSize: 60, fontWeight: 900, display: "block", textAlign: "right", lineHeight: 1 }}>&rdquo;</span>
                </div>
              </Section>
            )}

            {/* 9. Future Demand Meter */}
            <Section title="Future Demand" emoji="📈">
              <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(99,102,241,0.15)", background: "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                <DemandMeter score={result.futureDemandScore} />
              </div>
            </Section>

            {/* 10. Next Action Steps */}
            {result.nextActionSteps?.length > 0 && (
              <Section title="Next Action Steps" emoji="🚀">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.nextActionSteps.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 14, padding: 14, border: "1px solid rgba(99,102,241,0.2)", background: "linear-gradient(90deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                        <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>{i + 1}</span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, lineHeight: 1.55, flex: 1, fontWeight: 500 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <div style={{ height: 100 }} />
          </div>

          {/* Floating save button */}
          <button className="dr-btn" onClick={toggleSave} style={{
            position: "fixed", bottom: 28, right: "max(20px, calc(50% - 350px + 20px))", borderRadius: 30,
            boxShadow: "0 4px 10px rgba(99,102,241,0.5)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "center",
              background: saved ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
            }}>
              <span style={{ color: "#fff", fontSize: 22 }}>{saved ? "★" : "☆"}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default function DiscoverResultPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#030712" }} />}>
      <DiscoverResultContent />
    </Suspense>
  );
}
